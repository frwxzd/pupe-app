import { ACTIVE_CLAIM_STATUSES, PROTECTED_PHOTO } from './constants'
import { addLog, pruneLogs } from './dbutil'
import type { DB, Item, User } from './types'

// Conservación de datos (sanitización).
//  - Objetos: a los 6 meses de su hallazgo salen del catálogo y se borran sus fotos y
//    datos personales; queda una ficha mínima (folio, edificio, fechas, estado).
//  - Cuentas de alumno: 6 meses sin actividad → suspendida (puede reactivarse por correo);
//    30 días suspendida → eliminada con sus datos personales.
// Nunca se toca nada con un reclamo en curso. Las actas de entrega se conservan.

export const RETENTION_MONTHS = 6
export const SUSPENSION_GRACE_DAYS = 30
export const SYSTEM_ACTOR = 'sistema'
export const PURGED_TEXT = 'Información eliminada por antigüedad (más de 6 meses).'

const DAY = 86_400_000

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() < day) d.setDate(0) // 31 de agosto + 6 meses → 28/29 de febrero
  return d
}

const hasActiveClaimOnItem = (db: DB, itemId: string) =>
  db.claims.some((c) => c.itemId === itemId && ACTIVE_CLAIM_STATUSES.includes(c.status))

const hasActiveClaimByStudent = (db: DB, userId: string) =>
  db.claims.some((c) => c.studentId === userId && ACTIVE_CLAIM_STATUSES.includes(c.status))

/** Fecha en que el objeto deja de publicarse. */
export const itemExpiresAt = (item: Item) => addMonths(new Date(item.foundAt), RETENTION_MONTHS)

/** Fecha en que la cuenta se suspende si no vuelve a entrar. */
export const accountExpiresAt = (user: User) => addMonths(new Date(user.lastActiveAt ?? user.createdAt), RETENTION_MONTHS)

/** Fecha en que una cuenta suspendida se elimina. */
export const suspensionEndsAt = (user: User) => new Date(new Date(user.suspendedAt!).getTime() + SUSPENSION_GRACE_DAYS * DAY)

export function isItemPurgeable(db: DB, item: Item, now: Date) {
  return !item.purgedAt && itemExpiresAt(item) <= now && !hasActiveClaimOnItem(db, item.id)
}

const isRetainedStudent = (u: User) => u.role === 'student' && !u.deletedAt

export function isStudentSuspendable(db: DB, user: User, now: Date) {
  return isRetainedStudent(user) && !user.suspendedAt && !!user.lastActiveAt && accountExpiresAt(user) <= now && !hasActiveClaimByStudent(db, user.id)
}

export function isStudentDeletable(user: User, now: Date) {
  return isRetainedStudent(user) && !!user.suspendedAt && suspensionEndsAt(user) <= now
}

function sanitizeItem(db: DB, item: Item, at: string) {
  const before = item.status
  if (item.status !== 'devuelto') item.status = 'archivado'
  item.description = PURGED_TEXT
  item.photos = [PROTECTED_PHOTO]
  for (const k of ['brand', 'model', 'color', 'condition', 'components', 'missing', 'notes', 'privateData'] as const) delete item[k]
  if (item.finder) {
    item.finder = {
      name: 'Dato eliminado', matricula: '', email: '', signature: '',
      deliveredAt: item.finder.deliveredAt, folio: item.finder.folio, declarationAccepted: item.finder.declarationAccepted,
    }
  }
  item.purgedAt = at
  item.updatedAt = at
  // Las pruebas de propiedad de reclamos ya cerrados también son datos personales.
  for (const c of db.claims) {
    if (c.itemId !== item.id) continue
    c.marks = PURGED_TEXT
    c.evidencePhotos = []
    delete c.evidenceText
    delete c.serialModel
  }
  addLog(db, {
    actorId: SYSTEM_ACTOR, action: 'Depuró objeto por antigüedad', entity: 'objeto', entityId: item.id,
    buildingCode: item.buildingCode, before, after: item.status, reason: `${RETENTION_MONTHS} meses desde el hallazgo`,
  })
}

function suspendStudent(db: DB, user: User, at: string) {
  user.suspendedAt = at
  addLog(db, { actorId: SYSTEM_ACTOR, action: 'Suspendió cuenta por inactividad', entity: 'usuario', entityId: user.id, reason: `${RETENTION_MONTHS} meses sin actividad` })
}

function deleteStudent(db: DB, user: User, at: string) {
  user.name = 'Alumno'
  user.email = `eliminado.${user.id}@pupe.invalid`
  user.matricula = ''
  delete user.phone
  user.deletedAt = at
  addLog(db, { actorId: SYSTEM_ACTOR, action: 'Eliminó cuenta inactiva', entity: 'usuario', entityId: user.id, reason: `${SUSPENSION_GRACE_DAYS} días suspendida sin reactivarse` })
}

export interface RetentionResult {
  purgedItems: string[]
  suspended: { id: string; name: string; email: string }[]
  deleted: string[]
}

/** Aplica las reglas de conservación sobre la base. La ejecuta solo el servidor. */
export function runRetention(db: DB, now: Date): RetentionResult {
  const at = now.toISOString()
  const result: RetentionResult = { purgedItems: [], suspended: [], deleted: [] }

  pruneLogs(db)
  // Las cuentas creadas antes de esta regla empiezan a contar desde hoy.
  for (const u of db.users) if (isRetainedStudent(u) && !u.lastActiveAt) u.lastActiveAt = at

  for (const item of db.items) {
    if (!isItemPurgeable(db, item, now)) continue
    sanitizeItem(db, item, at)
    result.purgedItems.push(item.id)
  }
  for (const u of db.users) {
    if (isStudentDeletable(u, now)) {
      deleteStudent(db, u, at)
      result.deleted.push(u.id)
    } else if (isStudentSuspendable(db, u, now)) {
      result.suspended.push({ id: u.id, name: u.name, email: u.email })
      suspendStudent(db, u, at)
    }
  }
  return result
}

/** Lo que se limpiará en los próximos días (para el panel del super administrador). */
export function retentionPreview(db: DB, now: Date, days = 30) {
  const until = new Date(now.getTime() + days * DAY)
  return {
    items: db.items.filter((i) => isItemPurgeable(db, i, until)).length,
    toSuspend: db.users.filter((u) => isStudentSuspendable(db, u, until)).length,
    suspended: db.users.filter((u) => isRetainedStudent(u) && u.suspendedAt).length,
    toDelete: db.users.filter((u) => isStudentDeletable(u, until)).length,
  }
}
