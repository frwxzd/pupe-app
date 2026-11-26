// Configuración del servidor. Todo se lee de variables de entorno (ver .env.example).

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name]
  if (v === undefined || v === '') return fallback
  return ['1', 'true', 'yes', 'si', 'sí'].includes(v.toLowerCase())
}

function int(name: string, fallback: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? v : fallback
}

const production = process.env.NODE_ENV === 'production'

/** Interpreta PUBLIC_URL. Devuelve null si no es una URL http(s) válida sin ruta. */
function parsePublicUrl(raw: string): URL | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (u.pathname !== '/' || u.search || u.hash || u.username || u.password) return null
    return u
  } catch {
    return null
  }
}
const publicUrl = parsePublicUrl(process.env.PUBLIC_URL ?? '')

export const config = {
  production,
  host: process.env.HOST || '127.0.0.1',
  port: int('PORT', 3000),
  /** En desarrollo usa el PostgreSQL local del proyecto; en producción es obligatoria. */
  databaseUrl: process.env.DATABASE_URL || (production ? '' : 'postgres://pupe@127.0.0.1:5433/pupe'),

  /** URL pública, p. ej. https://pupe.tudominio.com. Se usa para validar el Origin y el captcha. */
  publicUrl: publicUrl?.origin ?? '',
  /** Dominio y puerto de PUBLIC_URL (p. ej. pupe.tudominio.com), o '' si no hay. */
  publicHost: publicUrl?.host ?? '',
  publicHostname: publicUrl?.hostname ?? '',

  /** Cookie solo por HTTPS. Debe ser true detrás de Cloudflare. */
  cookieSecure: bool('COOKIE_SECURE', production),

  /** Tomar la IP real del header CF-Connecting-IP (solo si el servidor escucha en 127.0.0.1 detrás de cloudflared). */
  trustCloudflare: bool('TRUST_CLOUDFLARE', production),

  turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
  turnstileSecret: process.env.TURNSTILE_SECRET_KEY || '',

  /** Modo demostración: carga datos de ejemplo, muestra las cuentas demo y permite restablecer. */
  demo: bool('DEMO_MODE', !production),

  sessionHours: int('SESSION_HOURS', 12),
  maxFailedLogins: int('MAX_FAILED_LOGINS', 5),
  lockMinutes: int('LOCK_MINUTES', 15),
  /** Intentos de login/registro por IP cada 15 minutos. */
  authRateLimit: int('AUTH_RATE_LIMIT', 20),

  /** Solo para pruebas automáticas: habilita POST /api/test/reset. */
  testMode: bool('PUPE_TEST_MODE', false),

  /** Correo saliente (SMTP) para los códigos de verificación. */
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: int('SMTP_PORT', 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
  },

  /** Carpeta con la app compilada (vite build). */
  staticDir: process.env.STATIC_DIR || 'dist',
}

/** En desarrollo basta con host y remitente; en producción también se exige usuario y clave. */
export const mailConfigured = () => Boolean(config.smtp.host && config.smtp.from)

export const captchaEnabled = () => Boolean(config.turnstileSecret && config.turnstileSiteKey)

/**
 * Contraseña de las cuentas demo (solo con DEMO_MODE=true). Nunca se envía al navegador.
 * En producción debe definirse en DEMO_PASSWORD; en desarrollo hay una por defecto.
 */
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || (production ? '' : 'PupeDemo2026')

/**
 * Revisa la configuración al arrancar. En producción, cualquier falta detiene el
 * servidor con un mensaje claro en lugar de arrancar a medias o en modo inseguro.
 */
export function checkConfig(log: (msg: string) => void) {
  const raw = process.env.PUBLIC_URL ?? ''
  if (raw && !config.publicUrl) {
    throw new Error(`PUBLIC_URL no es válida: "${raw}". Debe ser algo como https://pupe.tudominio.com (sin ruta después del dominio).`)
  }

  if (config.production) {
    const missing: string[] = []
    if (!process.env.DATABASE_URL) missing.push('DATABASE_URL')
    if (!config.publicUrl) missing.push('PUBLIC_URL')
    if (!config.turnstileSiteKey) missing.push('TURNSTILE_SITE_KEY')
    if (!config.turnstileSecret) missing.push('TURNSTILE_SECRET_KEY')
    if (!config.smtp.host) missing.push('SMTP_HOST')
    if (!config.smtp.user) missing.push('SMTP_USER')
    if (!config.smtp.pass) missing.push('SMTP_PASS')
    if (!config.smtp.from) missing.push('SMTP_FROM')
    if (missing.length) throw new Error(`Faltan variables obligatorias en producción: ${missing.join(', ')}.`)

    if (!config.publicUrl.startsWith('https://')) throw new Error('En producción PUBLIC_URL debe empezar con https://.')
    if (!/^postgres(ql)?:\/\//.test(config.databaseUrl)) throw new Error('DATABASE_URL debe empezar con postgres:// (por ejemplo postgres://pupe:CONTRASEÑA@127.0.0.1:5432/pupe).')
    if (!config.cookieSecure) throw new Error('En producción COOKIE_SECURE debe ser true.')
    if (config.testMode) throw new Error('PUPE_TEST_MODE no se puede usar en producción.')
    if (config.demo && DEMO_PASSWORD.length < 10) throw new Error('Con DEMO_MODE=true en producción define DEMO_PASSWORD (mínimo 10 caracteres).')
    if (config.trustCloudflare && config.host !== '127.0.0.1' && config.host !== '::1') {
      throw new Error('Con TRUST_CLOUDFLARE=true el servidor debe escuchar solo en 127.0.0.1 (HOST=127.0.0.1); si no, cualquiera podría falsificar su IP.')
    }
    if (config.demo) log('Aviso: DEMO_MODE está activo en producción.')
  } else if (!captchaEnabled()) {
    log('Aviso: captcha desactivado (faltan TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY). Solo para desarrollo.')
  }
  if (!config.production && !mailConfigured()) log('Aviso: SMTP no configurado. Los códigos de verificación se imprimen en esta consola.')
}
