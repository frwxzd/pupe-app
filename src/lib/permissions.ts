import type { Role, User } from './types'

// Matriz de permisos de la especificación. "building" significa: solo en su edificio.
export type Action =
  | 'ver_catalogo'
  | 'publicar_objeto'
  | 'editar_objeto'
  | 'enviar_reclamo'
  | 'revisar_reclamo'
  | 'registrar_entrega'
  | 'gestionar_edificios'
  | 'ver_bitacora'

type Scope = boolean | 'building'

const MATRIX: Record<Action, Record<Role, Scope>> = {
  ver_catalogo: { student: true, manager: true, super_admin: true },
  publicar_objeto: { student: false, manager: 'building', super_admin: true },
  editar_objeto: { student: false, manager: 'building', super_admin: true },
  enviar_reclamo: { student: true, manager: false, super_admin: true },
  revisar_reclamo: { student: false, manager: 'building', super_admin: true },
  registrar_entrega: { student: false, manager: 'building', super_admin: true },
  gestionar_edificios: { student: false, manager: false, super_admin: true },
  ver_bitacora: { student: false, manager: 'building', super_admin: true },
}

/** ¿Puede el usuario hacer la acción? Si se pasa un edificio, se valida también el alcance. */
export function can(user: User | null | undefined, action: Action, buildingCode?: string): boolean {
  if (!user) return false
  const scope = MATRIX[action][user.role]
  if (scope === true) return true
  if (scope === false) return false
  if (!user.buildingCode) return false
  return buildingCode === undefined || buildingCode === user.buildingCode
}

/** Edificio sobre el que opera un usuario en los paneles. El super admin puede elegir cualquiera. */
export function canAccessBuilding(user: User | null | undefined, buildingCode: string): boolean {
  if (!user) return false
  if (user.role === 'super_admin') return true
  return user.role === 'manager' && user.buildingCode === buildingCode
}

export const isStaff = (user: User | null | undefined) =>
  user?.role === 'manager' || user?.role === 'super_admin'
