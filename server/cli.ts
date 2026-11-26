import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import { addLog } from '../src/lib/dbutil'
import { createUser, RuleError } from '../src/lib/rules'
import { validateEmail, validateMatricula, validatePassword } from '../src/lib/validators'
import { seedDemoCredentials } from './app'
import { checkConfig, config } from './config'
import { hashPassword, saveHash } from './security'
import { Store } from './store'

// Administración desde la terminal del servidor.
//   node dist-server/cli.js crear-admin --nombre "María Torres" --correo admin@correo.buap.mx --matricula 202000001
//   node dist-server/cli.js cambiar-password --correo admin@correo.buap.mx
//   node dist-server/cli.js desbloquear --correo alumno@alumno.buap.mx
//   node dist-server/cli.js cerrar-sesiones --correo alumno@alumno.buap.mx

function args() {
  const [command, ...rest] = process.argv.slice(2)
  const opts: Record<string, string> = {}
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) opts[rest[i].slice(2)] = rest[i + 1] ?? ''
  }
  return { command, opts }
}

/** Pide un texto sin mostrarlo en pantalla. */
function askHidden(question: string): Promise<string> {
  let muted = false
  const out = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk)
      cb()
    },
  })
  const rl = createInterface({ input: process.stdin, output: out, terminal: true })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
    muted = true
  })
}

async function askPassword(ctx: { email: string; matricula?: string }) {
  const pw = await askHidden('Nueva contraseña: ')
  const problem = validatePassword(pw, ctx)
  if (problem) throw new Error(problem)
  if ((await askHidden('Repite la contraseña: ')) !== pw) throw new Error('Las contraseñas no coinciden.')
  return pw
}

async function main() {
  const { command, opts } = args()
  checkConfig(() => undefined)
  const store = new Store(config.databaseUrl)
  await store.init({ demo: config.demo, onFirstRun: config.demo ? seedDemoCredentials : undefined })
  const email = (opts.correo ?? '').trim().toLowerCase()
  const find = () => {
    const u = store.current.users.find((x) => x.email === email)
    if (!u) throw new Error(`No existe un usuario con el correo ${email}.`)
    return u
  }

  try {
    switch (command) {
      case 'crear-admin': {
        const name = (opts.nombre ?? '').trim()
        const matricula = (opts.matricula ?? '').trim()
        if (!name) throw new Error('Falta --nombre.')
        for (const e of [validateEmail(email), validateMatricula(matricula)]) if (e) throw new Error(e)
        const hash = await hashPassword(await askPassword({ email, matricula }))
        const user = await store.mutate(
          (db) => {
            const u = createUser(db, { name, email, matricula, role: 'super_admin' })
            addLog(db, { actorId: u.id, action: 'Cuenta de super administrador creada desde la terminal', entity: 'usuario', entityId: u.id })
            return u
          },
          (tx, u) => saveHash(tx, u.id, hash),
        )
        console.log(`Super administrador creado: ${user.name} <${user.email}>`)
        console.log('Reinicia el servicio para que la API lo vea:  sudo systemctl restart pupe')
        break
      }
      case 'cambiar-password': {
        const user = find()
        const hash = await hashPassword(await askPassword(user))
        await saveHash(store.pool, user.id, hash)
        await store.pool.query('DELETE FROM sessions WHERE user_id = $1', [user.id])
        console.log(`Contraseña actualizada para ${user.email}. Se cerraron sus sesiones.`)
        break
      }
      case 'desbloquear': {
        const user = find()
        await store.pool.query('UPDATE credentials SET failed_attempts = 0, locked_until = NULL WHERE user_id = $1', [user.id])
        console.log(`Cuenta desbloqueada: ${user.email}`)
        break
      }
      case 'cerrar-sesiones': {
        const user = find()
        const { rowCount } = await store.pool.query('DELETE FROM sessions WHERE user_id = $1', [user.id])
        console.log(`Sesiones cerradas para ${user.email}: ${rowCount}`)
        break
      }
      default:
        console.log('Comandos: crear-admin, cambiar-password, desbloquear, cerrar-sesiones')
        process.exitCode = 1
    }
  } catch (err) {
    console.error('Error:', err instanceof RuleError || err instanceof Error ? err.message : err)
    process.exitCode = 1
  } finally {
    await store.close()
  }
}

await main()
