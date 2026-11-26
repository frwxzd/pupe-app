import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import type { Store, Tx } from './store'

// Registro con verificación de correo.
// Mientras el alumno no escribe el código, sus datos viven en pending_registrations
// y NO existe la cuenta. Solo se guarda el hash del código, que vence y tiene intentos limitados.

export const CODE_MINUTES = 15
const MAX_ATTEMPTS = 5
const RESEND_SECONDS = 60
const MAX_SENDS = 5

export class VerificationError extends Error {
  constructor(message: string, readonly status = 400, readonly restart = false) {
    super(message)
  }
}

const codeHash = (email: string, code: string) => createHash('sha256').update(`${email}:${code}`).digest('hex')
const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

export interface Pending {
  email: string
  name: string
  matricula: string
  password_hash: string
}

/** Crea o reemplaza el registro pendiente de ese correo y devuelve el código a enviar. */
export async function startPending(store: Store, p: Pending): Promise<string> {
  const { rows } = await store.pool.query(
    'SELECT EXTRACT(EPOCH FROM (now() - last_sent_at))::int AS ago FROM pending_registrations WHERE email = $1',
    [p.email],
  )
  if (rows[0] && rows[0].ago < RESEND_SECONDS) {
    throw new VerificationError(`Ya te enviamos un código. Espera ${RESEND_SECONDS - rows[0].ago} segundos para pedir otro.`, 429)
  }
  const code = newCode()
  await store.pool.query(
    `INSERT INTO pending_registrations (email, name, matricula, password_hash, code_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(mins => $6::int))
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, matricula = EXCLUDED.matricula,
       password_hash = EXCLUDED.password_hash, code_hash = EXCLUDED.code_hash, attempts = 0, sends = 1,
       last_sent_at = now(), expires_at = EXCLUDED.expires_at, created_at = now()`,
    [p.email, p.name, p.matricula, p.password_hash, codeHash(p.email, code), CODE_MINUTES],
  )
  return code
}

/** Genera un código nuevo para un registro pendiente. */
export async function resendCode(store: Store, email: string): Promise<{ code: string; name: string }> {
  const { rows } = await store.pool.query(
    `SELECT name, sends, EXTRACT(EPOCH FROM (now() - last_sent_at))::int AS ago
       FROM pending_registrations WHERE email = $1 AND created_at > now() - interval '1 day'`,
    [email],
  )
  const row = rows[0]
  if (!row) throw new VerificationError('No hay un registro pendiente para este correo. Regístrate de nuevo.', 400, true)
  if (row.ago < RESEND_SECONDS) throw new VerificationError(`Espera ${RESEND_SECONDS - row.ago} segundos para pedir otro código.`, 429)
  if (row.sends >= MAX_SENDS) throw new VerificationError('Llegaste al límite de códigos. Regístrate de nuevo más tarde.', 429, true)
  const code = newCode()
  await store.pool.query(
    `UPDATE pending_registrations SET code_hash = $2, attempts = 0, sends = sends + 1, last_sent_at = now(),
       expires_at = now() + make_interval(mins => $3::int) WHERE email = $1`,
    [email, codeHash(email, code), CODE_MINUTES],
  )
  return { code, name: row.name }
}

/** Revisa el código. Si es correcto devuelve los datos del registro (aún sin borrarlos). */
export async function checkCode(store: Store, email: string, code: string): Promise<Pending> {
  const { rows } = await store.pool.query(
    'SELECT email, name, matricula, password_hash, code_hash, attempts, expires_at < now() AS expired FROM pending_registrations WHERE email = $1',
    [email],
  )
  const row = rows[0]
  if (!row) throw new VerificationError('No hay un registro pendiente para este correo. Regístrate de nuevo.', 400, true)
  if (row.expired) throw new VerificationError('El código venció. Pide uno nuevo.')
  const given = Buffer.from(codeHash(email, code))
  const ok = /^\d{6}$/.test(code) && timingSafeEqual(given, Buffer.from(row.code_hash))
  if (!ok) {
    if (row.attempts + 1 >= MAX_ATTEMPTS) {
      await store.pool.query('DELETE FROM pending_registrations WHERE email = $1', [email])
      throw new VerificationError('Demasiados intentos con un código incorrecto. Regístrate de nuevo.', 429, true)
    }
    await store.pool.query('UPDATE pending_registrations SET attempts = attempts + 1 WHERE email = $1', [email])
    const left = MAX_ATTEMPTS - row.attempts - 1
    throw new VerificationError(`El código no es correcto. Te quedan ${left} intento${left === 1 ? '' : 's'}.`)
  }
  return row
}

export const deletePending = (tx: Tx, email: string) => tx.query('DELETE FROM pending_registrations WHERE email = $1', [email])

export async function purgePending(store: Store) {
  await store.pool.query("DELETE FROM pending_registrations WHERE created_at < now() - interval '1 day'")
}
