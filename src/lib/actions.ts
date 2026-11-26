import { api } from './api'
import type { ClaimInput, DeliveryInput, FinderInput, ItemInput } from './rules'
import type { BuildingType } from './types'

// Acciones del usuario. Cada una se envía al servidor, que valida permisos y
// reglas con la sesión actual y devuelve los datos actualizados.

export { activeClaimFor, claimableItem, RuleError } from './rules'
export type { ClaimInput, DeliveryInput, FinderInput, ItemInput } from './rules'

async function act<T = null>(name: string, body: Record<string, unknown> = {}): Promise<T> {
  const data = await api<{ result: T }>(`/api/acciones/${name}`, body)
  return data.result
}

export const acceptTerms = () => act('aceptarTerminos')
export const updateProfile = (data: { name: string; phone?: string }) => act('actualizarPerfil', data)

export const publishItem = (item: ItemInput, finder: FinderInput) => act<{ id: string }>('publicarObjeto', { item, finder })
export const updateItem = (id: string, item: ItemInput) => act('editarObjeto', { id, item })
export const changeItemLifecycle = (id: string, status: 'no_reclamado' | 'archivado' | 'en_resguardo', reason: string) =>
  act('cambiarEstadoObjeto', { id, status, reason })

export const submitClaim = (itemId: string, claim: ClaimInput) => act<{ id: string }>('enviarReclamo', { itemId, claim })
export const startReview = (claimId: string) => act('iniciarRevision', { claimId })
export const approveClaim = (claimId: string, note: string, scheduledAt?: string) => act('aprobarReclamo', { claimId, note, scheduledAt })
export const rejectClaim = (claimId: string, note: string) => act('rechazarReclamo', { claimId, note })
export const requestInfo = (claimId: string, note: string) => act('pedirInformacion', { claimId, note })
export const answerInfo = (claimId: string, note: string) => act('responderInformacion', { claimId, note })

export const registerDelivery = (claimId: string, delivery: DeliveryInput) => act<{ id: string }>('registrarEntrega', { claimId, delivery })

export const createManager = (data: { name: string; email: string; matricula: string; buildingCode?: string; phone?: string; password: string }) =>
  act<{ id: string; name: string }>('crearEncargado', data)
export const assignManager = (buildingCode: string, managerId: string | undefined) => act('asignarEncargado', { buildingCode, managerId })
export const renameBuilding = (buildingCode: string, name: string) => act('renombrarEdificio', { buildingCode, name })
export const createBuilding = (data: { code: string; name?: string; type: BuildingType }) => act('agregarEdificio', data)
export const deleteManager = (managerId: string) => act('eliminarEncargado', { managerId })
export const resetDemo = () => act('restablecerDemo')
export const runCleanup = () => act<{ objetosDepurados: number; cuentasSuspendidas: number; cuentasEliminadas: number }>('ejecutarLimpieza')
