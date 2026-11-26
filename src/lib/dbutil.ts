import { TERMS_VERSION } from './constants'
import type { DB, LogEntry, User } from './types'

// Utilidades puras sobre la base de datos. Las usan el servidor y el navegador.

export function uid(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${rand}`
}

/** Folio único por edificio, compartido por recibos y actas: PUPE-EMA1-0001. */
export function nextFolio(db: DB, buildingCode: string): string {
  const n = (db.counters[buildingCode] ?? 0) + 1
  db.counters[buildingCode] = n
  return `PUPE-${buildingCode}-${String(n).padStart(4, '0')}`
}

// Qué guarda la bitácora: objetos, reclamos, entregas, edificios y procesos del sistema.
// De las cuentas, solo los accesos del personal (encargados y super administrador) y la
// creación o baja de encargados. La actividad de cuenta de los alumnos no se registra.
const STAFF_ACCESS_ACTIONS = new Set(['Inició sesión', 'Cuenta bloqueada temporalmente'])
const ACCOUNT_ADMIN_ACTIONS = new Set(['Creó cuenta de encargado', 'Eliminó cuenta de encargado', 'Cuenta de super administrador creada desde la terminal'])

export function isLoggable(db: DB, entry: Pick<LogEntry, 'entity' | 'action' | 'entityId'>): boolean {
  if (entry.entity !== 'usuario') return true
  if (ACCOUNT_ADMIN_ACTIONS.has(entry.action)) return true
  if (!STAFF_ACCESS_ACTIONS.has(entry.action)) return false
  const subject = db.users.find((u) => u.id === entry.entityId)
  return !!subject && subject.role !== 'student'
}

export function addLog(db: DB, entry: Omit<LogEntry, 'id' | 'at'>) {
  if (!isLoggable(db, entry)) return
  db.logs.unshift({ ...entry, id: uid('log'), at: new Date().toISOString() })
}

/** Quita de la bitácora los registros que ya no se guardan (para bases anteriores a esta regla). */
export function pruneLogs(db: DB): number {
  const before = db.logs.length
  db.logs = db.logs.filter((l) => isLoggable(db, l))
  return before - db.logs.length
}

/** Los términos solo son obligatorios para alumnos. */
export function needsTerms(db: DB, user: User | null): boolean {
  if (!user || user.role !== 'student') return false
  return !hasAcceptedTerms(db, user)
}

export function hasAcceptedTerms(db: DB, user: User | null): boolean {
  if (!user) return false
  return db.terms.some((t) => t.userId === user.id && t.version === TERMS_VERSION)
}

export function emptyDB(): DB {
  return { version: 1, users: [], buildings: [], items: [], claims: [], deliveries: [], terms: [], logs: [], counters: {} }
}
