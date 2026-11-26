import argon2 from 'argon2'
import { createHash, randomBytes } from 'node:crypto'
import { captchaEnabled, config } from './config'
import type { Store, Tx } from './store'

// ---------- Contraseñas (Argon2id) ----------

const ARGON = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const

export const hashPassword = (password: string) => argon2.hash(password, ARGON)

// Hash de relleno: si el correo no existe se verifica contra él, para que la
// respuesta tarde lo mismo y no revele qué correos están registrados.
let dummyHash: Promise<string> | null = null
const getDummy = () => (dummyHash ??= hashPassword(randomBytes(16).toString('hex')))

export async function setPassword(tx: Tx | Store['pool'], userId: string, password: string) {
  await saveHash(tx, userId, await hashPassword(password))
}

export async function saveHash(tx: Tx | Store['pool'], userId: string, hash: string) {
  await tx.query(
    `INSERT INTO credentials (user_id, password_hash) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash,
       failed_attempts = 0, locked_until = NULL, password_changed_at = now()`,
    [userId, hash],
  )
}

export type PasswordCheck =
  | { ok: true }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'locked'; minutes: number }

/** Verifica la contraseña y lleva la cuenta de intentos fallidos con bloqueo temporal. */
export async function checkPassword(store: Store, userId: string | undefined, password: string): Promise<PasswordCheck & { lockedNow?: boolean }> {
  const row = userId
    ? (await store.pool.query('SELECT password_hash, failed_attempts, locked_until FROM credentials WHERE user_id = $1', [userId])).rows[0]
    : undefined

  if (!row) {
    await argon2.verify(await getDummy(), password).catch(() => false)
    return { ok: false, reason: 'invalid' }
  }

  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    const minutes = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 60_000)
    return { ok: false, reason: 'locked', minutes }
  }

  const valid = await argon2.verify(row.password_hash, password).catch(() => false)
  if (valid) {
    await store.pool.query('UPDATE credentials SET failed_attempts = 0, locked_until = NULL WHERE user_id = $1', [userId])
    if (argon2.needsRehash(row.password_hash, ARGON)) await setPassword(store.pool, userId!, password)
    return { ok: true }
  }

  const { rows } = await store.pool.query(
    `UPDATE credentials
       SET failed_attempts = CASE WHEN failed_attempts + 1 >= $2::int THEN 0 ELSE failed_attempts + 1 END,
           locked_until   = CASE WHEN failed_attempts + 1 >= $2::int THEN now() + make_interval(mins => $3::int) ELSE NULL END
     WHERE user_id = $1
     RETURNING locked_until`,
    [userId, config.maxFailedLogins, config.lockMinutes],
  )
  if (rows[0]?.locked_until) return { ok: false, reason: 'locked', minutes: config.lockMinutes, lockedNow: true }
  return { ok: false, reason: 'invalid' }
}

// ---------- Sesiones ----------
// El navegador guarda un token aleatorio en una cookie HttpOnly; en la base
// solo se guarda su hash SHA-256, así que un respaldo filtrado no sirve para entrar.

export const SESSION_COOKIE = config.cookieSecure ? '__Host-pupe_sid' : 'pupe_sid'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export function sessionId(token: string) {
  // Identificador público de la sesión (para el registro de términos), sin revelar el token.
  return 'ses-' + sha256(token).slice(0, 12)
}

export async function createSession(store: Store, userId: string, meta: { ip: string; userAgent: string }) {
  const token = randomBytes(32).toString('base64url')
  await store.pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at, ip, user_agent)
     VALUES ($1, $2, now() + make_interval(hours => $3::int), $4, $5)`,
    [sha256(token), userId, config.sessionHours, meta.ip, meta.userAgent.slice(0, 300)],
  )
  return token
}

/** Devuelve el id de usuario si la sesión es válida y la renueva si ya pasó la mitad de su vida. */
export async function readSession(store: Store, token: string | undefined): Promise<string | null> {
  if (!token || token.length > 100) return null
  const { rows } = await store.pool.query(
    `UPDATE sessions
        SET expires_at = CASE WHEN expires_at < now() + make_interval(secs => $2::float8 * 1800)
                              THEN now() + make_interval(hours => $2::int) ELSE expires_at END
      WHERE token_hash = $1 AND expires_at > now()
      RETURNING user_id`,
    [sha256(token), config.sessionHours],
  )
  return rows[0]?.user_id ?? null
}

export async function destroySession(store: Store, token: string | undefined) {
  if (token) await store.pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)])
}

export async function destroyOtherSessions(store: Store, userId: string, keepToken?: string) {
  await store.pool.query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [userId, keepToken ? sha256(keepToken) : ''])
}

export async function purgeExpiredSessions(store: Store) {
  await store.pool.query('DELETE FROM sessions WHERE expires_at < now()')
}

// ---------- Captcha (Cloudflare Turnstile) ----------

export async function verifyCaptcha(token: unknown, ip: string): Promise<boolean> {
  if (!captchaEnabled()) return true
  if (typeof token !== 'string' || !token || token.length > 2048) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: config.turnstileSecret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8000),
    })
    const data = (await res.json()) as { success?: boolean; hostname?: string; metadata?: { result_with_testing_key?: boolean } }
    if (!data.success) return false
    // El token debe haberse emitido para nuestro dominio (las llaves de prueba de Cloudflare responden "example.com").
    const testing = data.metadata?.result_with_testing_key === true
    if (!testing && config.publicHostname && data.hostname !== config.publicHostname) return false
    return true
  } catch {
    return false
  }
}
