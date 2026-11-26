import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import type { Store, Tx } from './store'

// Recuperación de contraseña con código por correo.
// Solo se guarda el hash del código; vence, tiene intentos limitados y se puede
// reenviar con espera. Las respuestas al navegador no revelan si el correo existe.

export const RESET_MINUTES = 15
const MAX_ATTEMPTS = 5
const RESEND_SECONDS = 60
const MAX_SENDS = 5

export class ResetError extends Error {
  constructor(message: string, readonly status = 400, readonly restart = false) {
    super(message)
  }
}

const hash = (userId: string, code: string) => createHash('sha256').update(`reset:${userId}:${code}`).digest('hex')
const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

/**
 * Prepara un código nuevo para el usuario. Devuelve null si no toca enviar
 * (se pidió hace menos de un minuto o se llegó al límite de envíos).
 */
export async function issueResetCode(store: Store, userId: string): Promise<string | null> {
  const { rows } = await store.pool.query(
    `SELECT sends, EXTRACT(EPOCH FROM (now() - last_sent_at))::int AS ago,
            created_at > now() - interval '1 hour' AS recent
       FROM password_resets WHERE user_id = $1`,
    [userId],
  )
  const row = rows[0]
  const code = newCode()
  if (row && row.recent) {
    if (row.ago < RESEND_SECONDS || row.sends >= MAX_SENDS) return null
    await store.pool.query(
      `UPDATE password_resets SET code_hash = $2, attempts = 0, sends = sends + 1, last_sent_at = now(),
         expires_at = now() + make_interval(mins => $3::int) WHERE user_id = $1`,
      [userId, hash(userId, code), RESET_MINUTES],
    )
    return code
  }
  await store.pool.query(
    `INSERT INTO password_resets (user_id, code_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3::int))
     ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, attempts = 0, sends = 1,
       last_sent_at = now(), expires_at = EXCLUDED.expires_at, created_at = now()`,
    [userId, hash(userId, code), RESET_MINUTES],
  )
  return code
}

/** Revisa el código. Si es incorrecto descuenta un intento; al quinto fallo lo anula. */
export async function checkResetCode(store: Store, userId: string | undefined, code: string) {
  const generic = 'El código no es correcto o ya venció. Pide uno nuevo.'
  if (!userId) throw new ResetError(generic, 400, true)
  const { rows } = await store.pool.query(
    'SELECT code_hash, attempts, expires_at < now() AS expired FROM password_resets WHERE user_id = $1',
    [userId],
  )
  const row = rows[0]
  if (!row || row.expired) throw new ResetError(generic, 400, true)
  const ok = /^\d{6}$/.test(code) && timingSafeEqual(Buffer.from(hash(userId, code)), Buffer.from(row.code_hash))
  if (ok) return
  if (row.attempts + 1 >= MAX_ATTEMPTS) {
    await store.pool.query('DELETE FROM password_resets WHERE user_id = $1', [userId])
    throw new ResetError('Demasiados intentos con un código incorrecto. Pide uno nuevo.', 429, true)
  }
  await store.pool.query('UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = $1', [userId])
  const left = MAX_ATTEMPTS - row.attempts - 1
  throw new ResetError(`El código no es correcto. Te quedan ${left} intento${left === 1 ? '' : 's'}.`)
}

export const deleteReset = (tx: Tx | Store['pool'], userId: string) => tx.query('DELETE FROM password_resets WHERE user_id = $1', [userId])

export async function purgeResets(store: Store) {
  await store.pool.query("DELETE FROM password_resets WHERE created_at < now() - interval '1 day'")
}
