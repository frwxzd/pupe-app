import { emptyDB } from '../src/lib/dbutil'
import type { DB, Item, User } from '../src/lib/types'

// Copia de la base que se envía al navegador según el rol.
// El navegador nunca recibe datos que el usuario no tenga permiso de ver.
//  - Alumno: catálogo sin datos privados ni del hallador, sus reclamos, sus actas.
//  - Encargado: todo lo de su edificio.
//  - Super admin: todo.

const publicStaff = (u: User): User => ({
  id: u.id, name: u.name, email: u.email, matricula: '', role: u.role, buildingCode: u.buildingCode, phone: u.phone, createdAt: u.createdAt,
})

const publicItem = (i: Item): Item => {
  const copy = { ...i }
  delete copy.privateData
  delete copy.finder
  return copy
}

export function viewFor(db: DB, user: User): DB {
  if (user.role === 'super_admin') return structuredClone(db)

  const out = emptyDB()
  out.version = db.version
  out.buildings = structuredClone(db.buildings)
  const staff = db.users.filter((u) => u.role !== 'student' && u.id !== user.id)

  if (user.role === 'student') {
    out.items = db.items.filter((i) => i.status !== 'archivado' && !i.purgedAt).map(publicItem)
    out.claims = db.claims.filter((c) => c.studentId === user.id)
    const myClaims = new Set(out.claims.map((c) => c.id))
    out.deliveries = db.deliveries.filter((d) => myClaims.has(d.claimId))
    out.terms = db.terms.filter((t) => t.userId === user.id)
    out.users = [user, ...staff.map(publicStaff)]
    return structuredClone(out)
  }

  // Encargado: solo su edificio. Sin edificio asignado no ve objetos.
  const code = user.buildingCode
  out.items = db.items.filter((i) => code && i.buildingCode === code)
  const itemIds = new Set(out.items.map((i) => i.id))
  out.claims = db.claims.filter((c) => itemIds.has(c.itemId))
  out.deliveries = db.deliveries.filter((d) => itemIds.has(d.itemId))
  out.logs = db.logs.filter((l) => code && l.buildingCode === code)
  if (code && db.counters[code] !== undefined) out.counters[code] = db.counters[code]

  const students = new Set(out.claims.map((c) => c.studentId))
  out.users = [user, ...staff.map(publicStaff), ...db.users.filter((u) => students.has(u.id))]
  const visible = new Set(out.users.map((u) => u.id))
  out.terms = db.terms.filter((t) => visible.has(t.userId))
  return structuredClone(out)
}
