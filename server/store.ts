import pg from 'pg'
import { BUILDING_CODES, compareBuildings } from '../src/lib/constants'
import { emptyDB } from '../src/lib/dbutil'
import { createSeed, DB_VERSION } from '../src/lib/seed'
import type { DB } from '../src/lib/types'

// Almacenamiento en PostgreSQL.
// Cada colección es una tabla (id, data jsonb). El servidor mantiene una copia en
// memoria y, en cada cambio, escribe solo los registros modificados dentro de una
// transacción. Por eso debe correr UN solo proceso de la API.

type Keyed = Exclude<keyof DB, 'version' | 'counters'>

const KEYS: Record<Keyed, (row: never) => string> = {
  users: (u: DB['users'][number]) => u.id,
  buildings: (b: DB['buildings'][number]) => b.code,
  items: (i: DB['items'][number]) => i.id,
  claims: (c: DB['claims'][number]) => c.id,
  deliveries: (d: DB['deliveries'][number]) => d.id,
  terms: (t: DB['terms'][number]) => `${t.userId}:${t.version}`,
  logs: (l: DB['logs'][number]) => l.id,
} as Record<Keyed, (row: never) => string>

const COLLECTIONS = Object.keys(KEYS) as Keyed[]

const SCHEMA = `
${COLLECTIONS.map((c) => `CREATE TABLE IF NOT EXISTS ${c} (id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());`).join('\n')}
CREATE TABLE IF NOT EXISTS counters (id text PRIMARY KEY, value integer NOT NULL);
CREATE TABLE IF NOT EXISTS meta (key text PRIMARY KEY, value text NOT NULL);
CREATE TABLE IF NOT EXISTS credentials (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ip text,
  user_agent text
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS password_resets (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  sends integer NOT NULL DEFAULT 1,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pending_registrations (
  email text PRIMARY KEY,
  name text NOT NULL,
  matricula text NOT NULL,
  password_hash text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  sends integer NOT NULL DEFAULT 1,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`

const byDesc = (k: string) => (a: Record<string, unknown>, b: Record<string, unknown>) => String(b[k] ?? '').localeCompare(String(a[k] ?? ''))
const byAsc = (k: string) => (a: Record<string, unknown>, b: Record<string, unknown>) => String(a[k] ?? '').localeCompare(String(b[k] ?? ''))

// Orden en memoria igual al de la app original: lo más reciente primero.
const ORDER: Record<Keyed, (a: never, b: never) => number> = {
  users: byAsc('createdAt'),
  buildings: compareBuildings,
  items: byDesc('createdAt'),
  claims: byDesc('createdAt'),
  deliveries: byDesc('deliveredAt'),
  terms: byAsc('acceptedAt'),
  logs: byDesc('at'),
} as Record<Keyed, (a: never, b: never) => number>

export type Tx = pg.PoolClient

export class Store {
  readonly pool: pg.Pool
  private db: DB = emptyDB()
  private queue: Promise<unknown> = Promise.resolve()

  constructor(url: string) {
    this.pool = new pg.Pool({ connectionString: url, max: 10 })
  }

  /** Base completa en memoria. Solo lectura: para cambiar algo usa mutate(). */
  get current(): DB {
    return this.db
  }

  async init(seed: { demo: boolean; onFirstRun?: (tx: Tx, db: DB) => Promise<void> }) {
    await this.pool.query(SCHEMA)
    const { rows } = await this.pool.query("SELECT value FROM meta WHERE key = 'initialized'")
    if (rows.length === 0) {
      const db = seed.demo ? createSeed() : initialDB()
      await this.replaceAll(db, (tx) => seed.onFirstRun?.(tx, db) ?? Promise.resolve())
      await this.pool.query("INSERT INTO meta (key, value) VALUES ('initialized', now()::text)")
    }
    await this.reload()
  }

  async reload() {
    const db = emptyDB()
    db.version = DB_VERSION
    for (const c of COLLECTIONS) {
      const { rows } = await this.pool.query(`SELECT data FROM ${c}`)
      ;(db[c] as unknown[]) = rows.map((r) => r.data).sort(ORDER[c] as (a: unknown, b: unknown) => number)
    }
    const { rows } = await this.pool.query('SELECT id, value FROM counters')
    for (const r of rows) db.counters[r.id] = r.value
    this.db = db
  }

  /** Ejecuta las mutaciones una tras otra para que dos peticiones no se pisen. */
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task)
    this.queue = run.catch(() => undefined)
    return run
  }

  /**
   * Aplica fn sobre una copia de la base. Si fn lanza un error o falla la
   * escritura, la base no cambia. `extra` corre dentro de la misma transacción.
   */
  mutate<T>(fn: (draft: DB) => T, extra?: (tx: Tx, result: T) => Promise<void>): Promise<T> {
    return this.serial(async () => {
      const draft = structuredClone(this.db)
      const result = fn(draft)
      const tx = await this.pool.connect()
      try {
        await tx.query('BEGIN')
        await writeDiff(tx, this.db, draft)
        if (extra) await extra(tx, result)
        await tx.query('COMMIT')
      } catch (err) {
        await tx.query('ROLLBACK').catch(() => undefined)
        throw err
      } finally {
        tx.release()
      }
      this.db = draft
      return result
    })
  }

  /** Reemplaza toda la información (restablecer demo). Conserva credenciales de usuarios que sigan existiendo. */
  replaceAll(db: DB, extra?: (tx: Tx) => Promise<void>): Promise<void> {
    return this.serial(async () => {
      const tx = await this.pool.connect()
      try {
        await tx.query('BEGIN')
        const keep = db.users.map((u) => u.id)
        await tx.query('DELETE FROM credentials WHERE NOT (user_id = ANY($1))', [keep])
        await tx.query('DELETE FROM sessions WHERE NOT (user_id = ANY($1))', [keep])
        await tx.query(`TRUNCATE ${COLLECTIONS.filter((c) => c !== 'users').join(', ')}, counters`)
        await tx.query('DELETE FROM users WHERE NOT (id = ANY($1))', [keep])
        await writeDiff(tx, { ...emptyDB(), users: this.db.users.filter((u) => keep.includes(u.id)) }, db)
        if (extra) await extra(tx)
        await tx.query('COMMIT')
      } catch (err) {
        await tx.query('ROLLBACK').catch(() => undefined)
        throw err
      } finally {
        tx.release()
      }
      this.db = structuredClone(db)
    })
  }

  close() {
    return this.pool.end()
  }
}

/** Base inicial para producción: solo los 15 edificios originales, sin usuarios ni objetos. */
function initialDB(): DB {
  const db = emptyDB()
  db.version = DB_VERSION
  db.buildings = BUILDING_CODES.map((code) => ({ code, type: code.startsWith('VAL') ? 'VAL' : 'EMA' }))
  return db
}

async function writeDiff(tx: Tx, before: DB, after: DB) {
  for (const c of COLLECTIONS) {
    const key = KEYS[c] as (row: unknown) => string
    const old = new Map<string, string>()
    for (const row of before[c] as unknown[]) old.set(key(row), JSON.stringify(row))
    const seen = new Set<string>()
    for (const row of after[c] as unknown[]) {
      const id = key(row)
      seen.add(id)
      const json = JSON.stringify(row)
      if (old.get(id) === json) continue
      await tx.query(
        `INSERT INTO ${c} (id, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [id, json],
      )
    }
    const removed = [...old.keys()].filter((id) => !seen.has(id))
    if (removed.length) await tx.query(`DELETE FROM ${c} WHERE id = ANY($1)`, [removed])
  }
  for (const [id, value] of Object.entries(after.counters)) {
    if (before.counters[id] === value) continue
    await tx.query('INSERT INTO counters (id, value) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value', [id, value])
  }
}
