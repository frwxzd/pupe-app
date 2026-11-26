import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { BUILDING_TYPES } from '../src/lib/constants'
import { addLog, emptyDB } from '../src/lib/dbutil'
import { can } from '../src/lib/permissions'
import * as rules from '../src/lib/rules'
import { RuleError } from '../src/lib/rules'
import { createSeed } from '../src/lib/seed'
import type { DB, User } from '../src/lib/types'
import { validateEmail, validateMatricula, validatePassword, validateRequired } from '../src/lib/validators'
import { captchaEnabled, config, DEMO_PASSWORD } from './config'
import { claimInput, deliveryInput, finderInput, isoDate, itemInput, obj, oneOf, opt, req } from './input'
import {
  checkPassword, createSession, destroyOtherSessions, destroySession, hashPassword, readSession, saveHash,
  SESSION_COOKIE, sessionId, setPassword, verifyCaptcha,
} from './security'
import type { Store, Tx } from './store'
import { lastCodes, sendVerificationCode } from './mail'
import { checkResetCode, deleteReset, issueResetCode, RESET_MINUTES, ResetError } from './passwordReset'
import { checkCode, CODE_MINUTES, deletePending, resendCode, startPending, VerificationError } from './verification'
import { runRetentionJob } from './retention'
import { viewFor } from './view'

/** Error por campo si el correo o la matrícula ya tienen cuenta. */
function takenField(db: DB, email: string, matricula: string): Record<string, string> | null {
  if (db.users.some((u) => u.email.toLowerCase() === email)) return { email: 'Ya existe una cuenta con este correo. Inicia sesión.' }
  if (db.users.some((u) => u.matricula === matricula)) return { matricula: 'Esta matrícula ya está registrada.' }
  return null
}

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null
    sessionToken?: string
  }
}

// Política de contenido: solo scripts propios y el de Turnstile.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export function clientIp(req: FastifyRequest): string {
  if (config.trustCloudflare) {
    const cf = req.headers['cf-connecting-ip']
    if (typeof cf === 'string' && cf) return cf
  }
  return req.ip
}

/** Contraseña de las cuentas demo, calculada una sola vez. */
let demoHash: Promise<string> | null = null
const getDemoHash = () => (demoHash ??= hashPassword(DEMO_PASSWORD))

export async function seedDemoCredentials(tx: Tx, db: DB) {
  const hash = await getDemoHash()
  for (const u of db.users) await saveHash(tx, u.id, hash)
}

export async function buildApp(store: Store) {
  const app = Fastify({
    logger: { level: config.production ? 'info' : 'warn' },
    bodyLimit: 10 * 1024 * 1024,
    trustProxy: false,
  })

  await app.register(cookie)
  await app.register(rateLimit, {
    global: false,
    keyGenerator: clientIp,
    errorResponseBuilder: (_req, ctx) => ({
      statusCode: 429,
      error: `Demasiadas solicitudes. Espera ${Math.ceil(ctx.ttl / 60_000)} minuto(s) e inténtalo de nuevo.`,
    }),
  })

  app.decorateRequest('user', null)

  // Cabeceras de seguridad en todas las respuestas.
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Content-Security-Policy', CSP)
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), payment=()')
    reply.header('Cross-Origin-Opener-Policy', 'same-origin')
    if (config.cookieSecure) reply.header('Strict-Transport-Security', 'max-age=31536000')
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store')
  })

  // Protección CSRF: toda petición que cambia datos debe venir de nuestro propio origen.
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'GET' || req.method === 'HEAD' || !req.url.startsWith('/api/')) return
    const origin = req.headers.origin
    const expected = config.publicHost || req.headers.host
    let ok = false
    try {
      ok = !!origin && new URL(origin).host === expected
    } catch {
      ok = false
    }
    if (!ok) return reply.code(403).send({ error: 'Origen no permitido.' })
    if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
      return reply.code(415).send({ error: 'Formato no permitido.' })
    }
  })

  // Sesión: el usuario se obtiene siempre de la base, nunca del navegador.
  app.addHook('preHandler', async (req) => {
    if (!req.url.startsWith('/api/')) return
    const token = req.cookies[SESSION_COOKIE]
    const userId = await readSession(store, token)
    if (!userId) return
    req.user = store.current.users.find((u) => u.id === userId && !u.deletedAt && !u.suspendedAt) ?? null
    if (!req.user) return
    req.sessionToken = token
    // Última actividad, para la regla de cuentas inactivas. Se guarda como mucho dos veces al día.
    const last = req.user.lastActiveAt ? Date.parse(req.user.lastActiveAt) : 0
    if (Date.now() - last > 12 * 3_600_000) {
      const id = req.user.id
      await store.mutate((db) => { const u = db.users.find((x) => x.id === id); if (u) u.lastActiveAt = new Date().toISOString() })
    }
  })

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof RuleError) return reply.code(400).send({ error: err.message })
    const status = (err as { statusCode?: number }).statusCode ?? 500
    if (status === 413) return reply.code(413).send({ error: 'Las fotos son demasiado pesadas. Usa menos fotos o imágenes más ligeras.' })
    if (status === 429) return reply.code(429).send(err)
    if (status < 500) return reply.code(status).send({ error: 'Solicitud inválida.' })
    req.log.error(err)
    return reply.code(500).send({ error: 'Ocurrió un error en el servidor. Inténtalo de nuevo.' })
  })

  const state = (user: User | null) => {
    if (!user) return { me: null, db: emptyDB() }
    const fresh = store.current.users.find((u) => u.id === user.id) ?? null
    return { me: fresh, db: fresh ? viewFor(store.current, fresh) : emptyDB() }
  }

  const setSessionCookie = (reply: FastifyReply, token: string) =>
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true, secure: config.cookieSecure, sameSite: 'strict', path: '/', maxAge: config.sessionHours * 3600,
    })

  const requireUser = (req: FastifyRequest): User => {
    if (!req.user) throw Object.assign(new Error('Sesión expirada'), { statusCode: 401 })
    return req.user
  }

  const authLimit = { rateLimit: { max: config.authRateLimit, timeWindow: '15 minutes' } }
  const apiLimit = { rateLimit: { max: 240, timeWindow: '1 minute' } }

  // ---------- Públicas ----------

  app.get('/api/config', { config: apiLimit }, async () => ({
    captchaSiteKey: captchaEnabled() ? config.turnstileSiteKey : null,
    demo: config.demo,
  }))

  app.get('/api/estado', { config: apiLimit }, async (req, reply) => {
    if (req.sessionToken) setSessionCookie(reply, req.sessionToken)
    else if (req.cookies[SESSION_COOKIE]) reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return state(req.user)
  })

  // ---------- Autenticación ----------

  app.post('/api/auth/login', { config: authLimit }, async (req, reply) => {
    const body = obj(req.body)
    const ip = clientIp(req)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 120) : ''
    const password = typeof body.password === 'string' ? body.password.slice(0, 200) : ''
    if (!email || !password) return reply.code(400).send({ error: 'Escribe tu correo y tu contraseña.' })
    if (!(await verifyCaptcha(body.captcha, ip))) {
      return reply.code(400).send({ error: 'Completa la verificación de seguridad.', captcha: true })
    }

    const user = store.current.users.find((u) => u.email.toLowerCase() === email)
    const check = await checkPassword(store, user?.id, password)
    if (!check.ok) {
      await store.mutate((db) => {
        addLog(db, {
          actorId: user?.id ?? 'anonimo', action: 'Intento de inicio de sesión fallido', entity: 'usuario',
          entityId: user?.id ?? 'desconocido', after: user ? undefined : email, reason: `IP ${ip}`,
        })
        if (check.lockedNow && user) {
          addLog(db, { actorId: user.id, action: 'Cuenta bloqueada temporalmente', entity: 'usuario', entityId: user.id, reason: `${config.maxFailedLogins} intentos fallidos` })
        }
      })
      if (check.reason === 'locked') {
        return reply.code(429).send({ error: `Demasiados intentos fallidos. Espera ${check.minutes} minuto(s) e inténtalo de nuevo.` })
      }
      return reply.code(401).send({ error: 'Correo o contraseña incorrectos.' })
    }

    // Solo con la contraseña correcta se revela que la cuenta está suspendida.
    if (user!.suspendedAt) {
      return reply.code(403).send({
        error: 'Tu cuenta está suspendida por no usarse en 6 meses. Para reactivarla, elige «¿Olvidaste tu contraseña?» y confirma el código que te enviaremos a tu correo.',
        suspended: true,
      })
    }

    // Sesión nueva en cada inicio (evita fijación de sesión).
    await destroySession(store, req.cookies[SESSION_COOKIE])
    const token = await createSession(store, user!.id, { ip, userAgent: String(req.headers['user-agent'] ?? '') })
    await store.mutate((db) => {
      const u = db.users.find((x) => x.id === user!.id)
      if (u) u.lastActiveAt = new Date().toISOString()
      addLog(db, { actorId: user!.id, action: 'Inició sesión', entity: 'usuario', entityId: user!.id, reason: `IP ${ip}` })
    })
    setSessionCookie(reply, token)
    return state(user!)
  })

  // Registro en dos pasos: 1) datos + captcha → se envía un código al correo;
  // 2) el alumno escribe el código → se crea la cuenta y se inicia sesión.
  app.post('/api/auth/registro', { config: authLimit }, async (req, reply) => {
    const body = obj(req.body)
    const ip = clientIp(req)
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 120) : ''
    const matricula = typeof body.matricula === 'string' ? body.matricula.trim().slice(0, 20) : ''
    const password = typeof body.password === 'string' ? body.password : ''

    const fields: Record<string, string> = {}
    const checks = {
      name: validateRequired(name, 'El nombre'),
      email: validateEmail(email),
      matricula: validateMatricula(matricula),
      password: validatePassword(password, { email, matricula }),
    }
    for (const [k, v] of Object.entries(checks)) if (v) fields[k] = v
    if (Object.keys(fields).length) return reply.code(400).send({ error: 'Revisa los campos marcados.', fields })
    if (!(await verifyCaptcha(body.captcha, ip))) {
      return reply.code(400).send({ error: 'Completa la verificación de seguridad.', captcha: true })
    }
    const taken = takenField(store.current, email, matricula)
    if (taken) return reply.code(400).send({ error: 'Revisa los campos marcados.', fields: taken })

    try {
      const code = await startPending(store, { email, name, matricula, password_hash: await hashPassword(password) })
      await sendVerificationCode(email, name, code, CODE_MINUTES)
    } catch (err) {
      if (err instanceof VerificationError) return reply.code(err.status).send({ error: err.message })
      req.log.error(err)
      return reply.code(502).send({ error: 'No se pudo enviar el correo con el código. Inténtalo más tarde.' })
    }
    return { pending: true, email }
  })

  app.post('/api/auth/verificar', { config: authLimit }, async (req, reply) => {
    const body = obj(req.body)
    const ip = clientIp(req)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 120) : ''
    const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '').slice(0, 10) : ''
    let pending
    try {
      pending = await checkCode(store, email, code)
    } catch (err) {
      if (err instanceof VerificationError) return reply.code(err.status).send({ error: err.message, restart: err.restart })
      throw err
    }

    let user: User
    try {
      user = await store.mutate(
        (db) => {
          const u = rules.createUser(db, { name: pending.name, email: pending.email, matricula: pending.matricula, role: 'student' })
          addLog(db, { actorId: u.id, action: 'Se registró como alumno (correo verificado)', entity: 'usuario', entityId: u.id, reason: `IP ${ip}` })
          return u
        },
        async (tx, u) => {
          await saveHash(tx, u.id, pending.password_hash)
          await deletePending(tx, pending.email)
        },
      )
    } catch (err) {
      if (err instanceof RuleError) return reply.code(400).send({ error: err.message + ' Inicia sesión o regístrate con otros datos.', restart: true })
      throw err
    }
    const token = await createSession(store, user.id, { ip, userAgent: String(req.headers['user-agent'] ?? '') })
    setSessionCookie(reply, token)
    return state(user)
  })

  app.post('/api/auth/reenviar', { config: authLimit }, async (req, reply) => {
    const body = obj(req.body)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 120) : ''
    try {
      const { code, name } = await resendCode(store, email)
      await sendVerificationCode(email, name, code, CODE_MINUTES)
    } catch (err) {
      if (err instanceof VerificationError) return reply.code(err.status).send({ error: err.message, restart: err.restart })
      req.log.error(err)
      return reply.code(502).send({ error: 'No se pudo enviar el correo con el código. Inténtalo más tarde.' })
    }
    return { ok: true }
  })

  // ---------- Recuperar contraseña ----------
  // Paso 1: correo + captcha. La respuesta es la misma exista o no la cuenta,
  // y el correo se envía en segundo plano para que el tiempo tampoco lo delate.
  const RESET_SENT = { ok: true, message: 'Si el correo tiene una cuenta en PUPE, te enviamos un código. Revisa también la carpeta de no deseados.' }

  const sendReset = async (email: string, ip: string) => {
    const user = store.current.users.find((u) => u.email.toLowerCase() === email)
    if (!user) return
    const code = await issueResetCode(store, user.id)
    if (!code) return
    await store.mutate((db) => addLog(db, { actorId: user.id, action: 'Solicitó restablecer su contraseña', entity: 'usuario', entityId: user.id, reason: `IP ${ip}` }))
    await sendVerificationCode(user.email, user.name, code, RESET_MINUTES, 'recuperar')
  }

  app.post('/api/auth/recuperar', { config: authLimit }, async (req, reply) => {
    const body = obj(req.body)
    const ip = clientIp(req)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 120) : ''
    const bad = validateEmail(email)
    if (bad) return reply.code(400).send({ error: bad, fields: { email: bad } })
    if (!(await verifyCaptcha(body.captcha, ip))) {
      return reply.code(400).send({ error: 'Completa la verificación de seguridad.', captcha: true })
    }
    sendReset(email, ip).catch((err) => req.log.error(err))
    return RESET_SENT
  })

  // Reenvío sin captcha: solo funciona si ya hay un código pedido y respeta la espera de 60 s.
  app.post('/api/auth/recuperar/reenviar', { config: authLimit }, async (req) => {
    const body = obj(req.body)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 120) : ''
    const user = store.current.users.find((u) => u.email.toLowerCase() === email)
    if (user) {
      const { rows } = await store.pool.query('SELECT 1 FROM password_resets WHERE user_id = $1', [user.id])
      if (rows.length) sendReset(email, clientIp(req)).catch((err) => req.log.error(err))
    }
    return RESET_SENT
  })

  // Paso 2: código + contraseña nueva. Cierra todas las sesiones abiertas y quita el bloqueo.
  app.post('/api/auth/restablecer', { config: authLimit }, async (req, reply) => {
    const body = obj(req.body)
    const ip = clientIp(req)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 120) : ''
    const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '').slice(0, 10) : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const user = store.current.users.find((u) => u.email.toLowerCase() === email)

    try {
      await checkResetCode(store, user?.id, code)
    } catch (err) {
      if (err instanceof ResetError) return reply.code(err.status).send({ error: err.message, restart: err.restart })
      throw err
    }
    const problem = validatePassword(password, user!)
    if (problem) return reply.code(400).send({ error: problem, fields: { password: problem } })

    const newHash = await hashPassword(password)
    const tx = await store.pool.connect()
    try {
      await tx.query('BEGIN')
      await saveHash(tx, user!.id, newHash)
      await deleteReset(tx, user!.id)
      await tx.query('DELETE FROM sessions WHERE user_id = $1', [user!.id])
      await tx.query('COMMIT')
    } catch (err) {
      await tx.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      tx.release()
    }
    await store.mutate((db) => {
      addLog(db, { actorId: user!.id, action: 'Restableció su contraseña por correo', entity: 'usuario', entityId: user!.id, reason: `IP ${ip}` })
      // Confirmar el código del correo también reactiva una cuenta suspendida por inactividad.
      const u = db.users.find((x) => x.id === user!.id)
      if (u?.suspendedAt) {
        delete u.suspendedAt
        u.lastActiveAt = new Date().toISOString()
        addLog(db, { actorId: u.id, action: 'Reactivó su cuenta', entity: 'usuario', entityId: u.id, reason: 'Código confirmado por correo' })
      }
    })
    return { ok: true }
  })

  app.post('/api/auth/logout', { config: apiLimit }, async (req, reply) => {
    await destroySession(store, req.cookies[SESSION_COOKIE])
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return state(null)
  })

  app.post('/api/auth/password', { config: authLimit }, async (req, reply) => {
    const user = requireUser(req)
    const body = obj(req.body)
    const current = typeof body.current === 'string' ? body.current.slice(0, 200) : ''
    const next = typeof body.next === 'string' ? body.next : ''
    const check = await checkPassword(store, user.id, current)
    if (!check.ok) {
      if (check.reason === 'locked') return reply.code(429).send({ error: `Demasiados intentos fallidos. Espera ${check.minutes} minuto(s).` })
      return reply.code(400).send({ error: 'La contraseña actual no es correcta.', fields: { current: 'La contraseña actual no es correcta.' } })
    }
    const problem = validatePassword(next, user)
    if (problem) return reply.code(400).send({ error: problem, fields: { next: problem } })
    if (next === current) return reply.code(400).send({ error: 'La nueva contraseña debe ser distinta.', fields: { next: 'La nueva contraseña debe ser distinta.' } })
    await setPassword(store.pool, user.id, next)
    await destroyOtherSessions(store, user.id, req.sessionToken)
    await store.mutate((db) => addLog(db, { actorId: user.id, action: 'Cambió su contraseña', entity: 'usuario', entityId: user.id }))
    return { ok: true }
  })

  // ---------- Acciones de negocio ----------
  // Cada acción valida sus datos de entrada y ejecuta la regla correspondiente
  // con el usuario de la sesión. El navegador nunca indica quién es el actor.

  type Ctx = { user: User; body: Record<string, unknown>; req: FastifyRequest }
  const run = <T>(fn: (db: DB) => T) => store.mutate(fn)

  const ACTIONS: Record<string, (ctx: Ctx) => Promise<unknown>> = {
    aceptarTerminos: ({ user, req }) => run((db) => rules.acceptTerms(db, user, sessionId(req.sessionToken ?? ''))),
    actualizarPerfil: ({ user, body }) =>
      run((db) => rules.updateProfile(db, user, { name: req(body.name, 'el nombre', 120), phone: opt(body.phone, 'teléfono', 30) })),

    publicarObjeto: async ({ user, body }) => {
      const item = itemInput(body.item)
      const finder = finderInput(body.finder)
      const created = await run((db) => rules.publishItem(db, user, item, finder))
      return { id: created.id }
    },
    editarObjeto: ({ user, body }) => {
      const input = itemInput(body.item)
      return run((db) => rules.updateItem(db, user, req(body.id, 'el objeto', 80), input))
    },
    cambiarEstadoObjeto: ({ user, body }) =>
      run((db) => rules.changeItemLifecycle(db, user, req(body.id, 'el objeto', 80),
        oneOf(body.status, ['no_reclamado', 'archivado', 'en_resguardo'] as const, 'un estado'), opt(body.reason, 'motivo', 500) ?? '')),

    enviarReclamo: async ({ user, body }) => {
      const input = claimInput(body.claim)
      const claim = await run((db) => rules.submitClaim(db, user, req(body.itemId, 'el objeto', 80), input))
      return { id: claim.id }
    },
    iniciarRevision: ({ user, body }) => run((db) => rules.startReview(db, user, req(body.claimId, 'el reclamo', 80))),
    aprobarReclamo: ({ user, body }) => {
      const scheduledAt = body.scheduledAt ? isoDate(body.scheduledAt, 'entrega') : undefined
      return run((db) => rules.approveClaim(db, user, req(body.claimId, 'el reclamo', 80), opt(body.note, 'nota', 1000) ?? '', scheduledAt))
    },
    rechazarReclamo: ({ user, body }) => run((db) => rules.rejectClaim(db, user, req(body.claimId, 'el reclamo', 80), opt(body.note, 'motivo', 1000) ?? '')),
    pedirInformacion: ({ user, body }) => run((db) => rules.requestInfo(db, user, req(body.claimId, 'el reclamo', 80), opt(body.note, 'mensaje', 1000) ?? '')),
    responderInformacion: ({ user, body }) => run((db) => rules.answerInfo(db, user, req(body.claimId, 'el reclamo', 80), opt(body.note, 'respuesta', 1000) ?? '')),

    registrarEntrega: async ({ user, body }) => {
      const input = deliveryInput(body.delivery)
      const d = await run((db) => rules.registerDelivery(db, user, req(body.claimId, 'el reclamo', 80), input))
      return { id: d.id }
    },

    crearEncargado: async ({ user, body }) => {
      const data = {
        name: req(body.name, 'el nombre', 120),
        email: req(body.email, 'el correo', 120).toLowerCase(),
        matricula: req(body.matricula, 'la matrícula', 9),
        buildingCode: body.buildingCode ? oneOf(body.buildingCode, store.current.buildings.map((b) => b.code), 'un edificio') : undefined,
        phone: opt(body.phone, 'teléfono', 30),
      }
      for (const e of [validateEmail(data.email), validateMatricula(data.matricula)]) if (e) throw new RuleError(e)
      const password = typeof body.password === 'string' ? body.password : ''
      const problem = validatePassword(password, data)
      if (problem) throw new RuleError(problem)
      const hash = await hashPassword(password)
      const created = await store.mutate((db) => rules.createManager(db, user, data), (tx, u) => saveHash(tx, u.id, hash))
      return { id: created.id, name: created.name }
    },
    asignarEncargado: ({ user, body }) =>
      run((db) => rules.assignManager(db, user, req(body.buildingCode, 'el edificio', 10), opt(body.managerId, 'encargado', 80))),
    agregarEdificio: ({ user, body }) =>
      run((db) => rules.createBuilding(db, user, {
        code: req(body.code, 'la clave del edificio', 10),
        name: opt(body.name, 'nombre', 80),
        type: oneOf(body.type, BUILDING_TYPES, 'un tipo de edificio'),
      })),
    eliminarEncargado: async ({ user, body }) => {
      const managerId = req(body.managerId, 'el encargado', 80)
      await store.mutate((db) => rules.deleteManager(db, user, managerId), async (tx) => {
        await tx.query('DELETE FROM sessions WHERE user_id = $1', [managerId])
        await tx.query('DELETE FROM credentials WHERE user_id = $1', [managerId])
        await tx.query('DELETE FROM password_resets WHERE user_id = $1', [managerId])
      })
    },
    ejecutarLimpieza: async ({ user }) => {
      if (!can(user, 'gestionar_edificios')) throw new RuleError('No tienes permiso para esta acción.')
      const summary = await runRetentionJob(store)
      await run((db) => addLog(db, {
        actorId: user.id, action: 'Ejecutó la limpieza de datos', entity: 'sistema', entityId: 'conservacion',
        after: `${summary.objetosDepurados} objetos · ${summary.cuentasSuspendidas} suspendidas · ${summary.cuentasEliminadas} eliminadas`,
      }))
      return summary
    },
    renombrarEdificio: ({ user, body }) =>
      run((db) => rules.renameBuilding(db, user, req(body.buildingCode, 'el edificio', 10), opt(body.name, 'nombre', 80) ?? '')),

    restablecerDemo: async ({ user }) => {
      if (!config.demo) throw new RuleError('Restablecer datos solo está disponible en modo demostración.')
      if (user.role !== 'super_admin') throw new RuleError('No tienes permiso para esta acción.')
      const seed = createSeed()
      await store.replaceAll(seed, (tx) => seedDemoCredentials(tx, seed))
      await run((db) => addLog(db, { actorId: user.id, action: 'Restableció datos demo', entity: 'sistema', entityId: 'demo' }))
    },
  }

  app.post<{ Params: { name: string } }>('/api/acciones/:name', { config: apiLimit }, async (req) => {
    const user = requireUser(req)
    const action = Object.hasOwn(ACTIONS, req.params.name) ? ACTIONS[req.params.name] : undefined
    if (!action) throw Object.assign(new Error('Acción desconocida'), { statusCode: 404 })
    const result = await action({ user, body: obj(req.body ?? {}), req })
    return { result: result ?? null, ...state(user) }
  })

  // Solo pruebas automáticas: vuelve a los datos semilla.
  if (config.testMode) {
    app.get<{ Querystring: { email?: string; tipo?: string } }>('/api/test/codigo', async (req) => ({
      code: lastCodes.get(`${req.query.tipo === 'recuperar' ? 'recuperar' : 'registro'}:${String(req.query.email ?? '')}`) ?? null,
    }))
    // Ejecuta la limpieza como si fuera otra fecha (para probar los plazos).
    app.post('/api/test/limpieza', async (req) => {
      const at = String(obj(req.body).now ?? '')
      return runRetentionJob(store, at ? new Date(at) : new Date())
    })
    app.post('/api/test/reset', async () => {
      const seed = createSeed()
      lastCodes.clear()
      await store.replaceAll(seed, async (tx) => {
        await tx.query('DELETE FROM sessions')
        await tx.query('DELETE FROM pending_registrations')
        await tx.query('DELETE FROM password_resets')
        await seedDemoCredentials(tx, seed)
      })
      return { ok: true }
    })
  }

  // App compilada (npm run build). En desarrollo la sirve Vite.
  const root = resolve(config.staticDir)
  const hasStatic = existsSync(resolve(root, 'index.html'))
  if (hasStatic) {
    await app.register(fastifyStatic, {
      root,
      wildcard: false,
      setHeaders: (res, path) => {
        if (path.includes('/assets/')) res.header('Cache-Control', 'public, max-age=31536000, immutable')
        else res.header('Cache-Control', 'no-cache')
      },
    })
  }

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'No encontrado.' })
    if ((req.method !== 'GET' && req.method !== 'HEAD') || !hasStatic) return reply.code(404).send('No encontrado')
    reply.header('Cache-Control', 'no-cache')
    return reply.sendFile('index.html')
  })

  return app
}
