import { checkConfig, config } from './config'
import { buildApp, seedDemoCredentials } from './app'
import { purgeExpiredSessions } from './security'
import { purgePending } from './verification'
import { purgeResets } from './passwordReset'
import { runRetentionJob } from './retention'
import { Store } from './store'
import { createSeed } from '../src/lib/seed'

checkConfig((msg) => console.warn(msg))
const store = new Store(config.databaseUrl)
await store.init({ demo: config.demo, onFirstRun: config.demo ? seedDemoCredentials : undefined })

// Una base que se usó en modo demo conserva sus cuentas (con contraseña conocida)
// aunque después se apague DEMO_MODE. En producción eso no se permite.
if (config.production && !config.demo) {
  const demoIds = new Set(createSeed().users.map((u) => u.id))
  if (store.current.users.some((u) => demoIds.has(u.id))) {
    await store.close()
    throw new Error('La base tiene cuentas de demostración y DEMO_MODE=false. Usa una base limpia (ver "Pasar de demo a producción" en DEPLOY.md).')
  }
}

const app = await buildApp(store)
await app.listen({ host: config.host, port: config.port })
console.log(`PUPE escuchando en http://${config.host}:${config.port} (${config.production ? 'producción' : 'desarrollo'}${config.demo ? ', modo demo' : ''})`)

// Limpieza cada hora: sesiones y códigos vencidos, y conservación de datos
// (objetos de más de 6 meses y cuentas de alumno inactivas).
const retention = () => runRetentionJob(store).catch((err) => console.error('Limpieza de datos:', err))
if (!config.testMode) retention()
const timer = setInterval(() => {
  purgeExpiredSessions(store).catch(() => undefined)
  purgePending(store).catch(() => undefined)
  purgeResets(store).catch(() => undefined)
  if (!config.testMode) retention()
}, 3_600_000)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    clearInterval(timer)
    await app.close()
    await store.close()
    process.exit(0)
  })
}
