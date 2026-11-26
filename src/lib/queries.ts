import type { DB, Item, User } from './types'

/**
 * Objetos que un usuario puede ver en el catálogo.
 * - Alumno: todo excepto archivados.
 * - Encargado: solo los de su edificio.
 * - Super admin: todo.
 */
export function catalogItems(db: DB, user: User | null): Item[] {
  if (!user) return []
  if (user.role === 'manager') return db.items.filter((i) => i.buildingCode === user.buildingCode)
  if (user.role === 'super_admin') return db.items
  return db.items.filter((i) => i.status !== 'archivado')
}

export function canViewItem(user: User | null, item: Item): boolean {
  if (!user) return false
  if (user.role === 'manager') return item.buildingCode === user.buildingCode
  if (user.role === 'student') return item.status !== 'archivado'
  return true
}

/** Edificios que el usuario administra en los paneles. */
export function staffBuildings(db: DB, user: User | null): string[] {
  if (!user) return []
  if (user.role === 'super_admin') return db.buildings.map((b) => b.code)
  if (user.role === 'manager' && user.buildingCode) return [user.buildingCode]
  return []
}

export function itemBuilding(db: DB, itemId: string): string | undefined {
  return db.items.find((i) => i.id === itemId)?.buildingCode
}
