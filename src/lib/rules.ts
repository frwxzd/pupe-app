import { ACTIVE_CLAIM_STATUSES, BUILDING_CODE_RE, BUILDING_TYPES, ITEM_STATUS_LABEL, TERMS_VERSION, compareBuildings } from './constants'
import { addLog, hasAcceptedTerms, nextFolio, uid } from './dbutil'
import { can } from './permissions'
import type { BuildingType, Claim, ClaimStatus, DB, Delivery, Finder, Item, ItemStatus, User } from './types'

// Reglas de negocio de PUPE. Se ejecutan en el servidor sobre una copia de la
// base de datos; si alguna lanza RuleError, no se guarda ningún cambio.
// El navegador solo usa las funciones de consulta (activeClaimFor, claimableItem).

export class RuleError extends Error {}

const now = () => new Date().toISOString()

function findItem(db: DB, id: string): Item {
  const item = db.items.find((i) => i.id === id)
  if (!item) throw new RuleError('El objeto no existe.')
  return item
}

function findClaim(db: DB, id: string): Claim {
  const claim = db.claims.find((c) => c.id === id)
  if (!claim) throw new RuleError('El reclamo no existe.')
  return claim
}

function requireBuilding(db: DB, code: string) {
  if (!db.buildings.some((b) => b.code === code)) throw new RuleError('El edificio no existe.')
}

function requireCan(user: User, action: Parameters<typeof can>[1], building?: string) {
  if (!can(user, action, building)) throw new RuleError('No tienes permiso para esta acción en este edificio.')
}

function setItemStatus(db: DB, item: Item, status: ItemStatus, actor: User, reason?: string) {
  const before = item.status
  if (before === status) return
  item.status = status
  item.updatedAt = now()
  addLog(db, {
    actorId: actor.id, action: 'Cambió estado de objeto', entity: 'objeto', entityId: item.id,
    buildingCode: item.buildingCode, before: ITEM_STATUS_LABEL[before], after: ITEM_STATUS_LABEL[status], reason,
  })
}

function pushClaimStatus(claim: Claim, status: ClaimStatus, actor: User, note: string) {
  claim.status = status
  claim.history.push({ at: now(), by: actor.id, status, note, kind: 'estado' })
}

// ---------- Consultas (también en el navegador) ----------

export function activeClaimFor(db: DB, itemId: string, studentId: string): Claim | undefined {
  return db.claims.find((c) => c.itemId === itemId && c.studentId === studentId && ACTIVE_CLAIM_STATUSES.includes(c.status))
}

export function claimableItem(item: Item) {
  return item.status === 'en_resguardo' || item.status === 'en_revision'
}

// ---------- Cuentas ----------

export function acceptTerms(db: DB, actor: User, sessionId: string) {
  if (hasAcceptedTerms(db, actor)) return
  db.terms.push({ userId: actor.id, version: TERMS_VERSION, acceptedAt: now(), sessionId })
  addLog(db, { actorId: actor.id, action: `Aceptó términos v${TERMS_VERSION}`, entity: 'usuario', entityId: actor.id })
}

export function createUser(db: DB, data: { name: string; email: string; matricula: string; role: User['role']; phone?: string }): User {
  const email = data.email.trim().toLowerCase()
  const matricula = data.matricula.trim()
  if (db.users.some((u) => u.email.toLowerCase() === email)) throw new RuleError('Ya existe una cuenta con este correo.')
  if (db.users.some((u) => u.matricula === matricula)) throw new RuleError('Esta matrícula ya está registrada.')
  const user: User = {
    id: uid('u'), name: data.name.trim(), email, matricula, role: data.role,
    phone: data.phone?.trim() || undefined, createdAt: now(), lastActiveAt: now(),
  }
  db.users.push(user)
  return user
}

export function updateProfile(db: DB, actor: User, data: { name: string; phone?: string }) {
  if (!data.name.trim()) throw new RuleError('El nombre es obligatorio.')
  const u = db.users.find((x) => x.id === actor.id)
  if (!u) return
  u.name = data.name.trim()
  u.phone = data.phone?.trim() || undefined
}

// ---------- Objetos ----------

export type ItemInput = Omit<Item, 'id' | 'status' | 'finder' | 'createdBy' | 'createdAt' | 'updatedAt'>
export type FinderInput = Omit<Finder, 'folio'>

export function publishItem(db: DB, actor: User, input: ItemInput, finder: FinderInput): Item {
  requireCan(actor, 'publicar_objeto', input.buildingCode)
  requireBuilding(db, input.buildingCode)
  if (!finder.declarationAccepted) throw new RuleError('El hallador debe aceptar la declaración.')
  if (!finder.signature) throw new RuleError('Falta la firma del hallador.')
  if (input.photos.length === 0) throw new RuleError('Agrega al menos una foto.')

  const item: Item = {
    ...input,
    id: uid('obj'),
    status: 'en_resguardo',
    finder: { ...finder, folio: nextFolio(db, input.buildingCode) },
    createdBy: actor.id,
    createdAt: now(),
    updatedAt: now(),
  }
  db.items.unshift(item)
  addLog(db, { actorId: actor.id, action: 'Recibió objeto del hallador', entity: 'objeto', entityId: item.id, buildingCode: item.buildingCode, after: item.finder!.folio })
  addLog(db, { actorId: actor.id, action: 'Publicó objeto', entity: 'objeto', entityId: item.id, buildingCode: item.buildingCode, after: item.title })
  return item
}

export function updateItem(db: DB, actor: User, id: string, input: ItemInput) {
  const item = findItem(db, id)
  requireCan(actor, 'editar_objeto', item.buildingCode)
  if (item.purgedAt) throw new RuleError('Este objeto se depuró por antigüedad y ya no se puede editar.')
  if (input.buildingCode !== item.buildingCode) {
    requireCan(actor, 'editar_objeto', input.buildingCode)
    requireBuilding(db, input.buildingCode)
  }
  const before = JSON.stringify({ title: item.title, buildingCode: item.buildingCode, storageLocation: item.storageLocation })
  Object.assign(item, input, { updatedAt: now() })
  addLog(db, {
    actorId: actor.id, action: 'Editó objeto', entity: 'objeto', entityId: item.id, buildingCode: item.buildingCode,
    before, after: JSON.stringify({ title: item.title, buildingCode: item.buildingCode, storageLocation: item.storageLocation }),
  })
}

/** No se borra: se marca como no reclamado o se archiva, conservando el historial. */
export function changeItemLifecycle(db: DB, actor: User, id: string, status: 'no_reclamado' | 'archivado' | 'en_resguardo', reason: string) {
  const item = findItem(db, id)
  requireCan(actor, 'editar_objeto', item.buildingCode)
  if (item.status === 'devuelto') throw new RuleError('Un objeto devuelto no puede cambiar de estado.')
  if (item.purgedAt) throw new RuleError('Este objeto se depuró por antigüedad y ya no puede cambiar de estado.')
  const active = db.claims.some((c) => c.itemId === id && ACTIVE_CLAIM_STATUSES.includes(c.status))
  if (active && status !== 'en_resguardo') throw new RuleError('El objeto tiene reclamos activos. Resuélvelos primero.')
  if (status === 'archivado' && item.status !== 'no_reclamado') {
    throw new RuleError('Primero marca el objeto como "No reclamado" y después archívalo.')
  }
  setItemStatus(db, item, status, actor, reason)
}

// ---------- Reclamos ----------

export interface ClaimInput {
  marks: string
  approxDate: string
  serialModel?: string
  evidenceText?: string
  evidencePhotos: string[]
  declarationAccepted: boolean
}

export function submitClaim(db: DB, actor: User, itemId: string, input: ClaimInput): Claim {
  requireCan(actor, 'enviar_reclamo')
  if (!hasAcceptedTerms(db, actor)) throw new RuleError('Debes aceptar los términos y condiciones antes de reclamar.')
  const item = findItem(db, itemId)
  if (actor.role === 'student' && item.status === 'archivado') throw new RuleError('El objeto no existe.')
  if (item.purgedAt) throw new RuleError('Este objeto ya no se puede reclamar: se depuró por antigüedad.')
  if (!claimableItem(item)) throw new RuleError('Este objeto ya no se puede reclamar.')
  if (activeClaimFor(db, itemId, actor.id)) throw new RuleError('Ya tienes un reclamo activo sobre este objeto.')
  if (!input.declarationAccepted) throw new RuleError('Debes aceptar la declaración de propiedad.')
  if (!input.marks.trim()) throw new RuleError('Describe las señas particulares del objeto.')
  const claim: Claim = {
    ...input,
    id: uid('rec'),
    itemId,
    studentId: actor.id,
    status: 'enviado',
    createdAt: now(),
    history: [{ at: now(), by: actor.id, status: 'enviado', note: 'Reclamo enviado.', kind: 'estado' }],
  }
  db.claims.unshift(claim)
  addLog(db, { actorId: actor.id, action: 'Envió reclamo', entity: 'reclamo', entityId: claim.id, buildingCode: item.buildingCode, after: item.title })
  return claim
}

function staffClaim(db: DB, actor: User, claimId: string) {
  const claim = findClaim(db, claimId)
  const item = findItem(db, claim.itemId)
  requireCan(actor, 'revisar_reclamo', item.buildingCode)
  return { claim, item }
}

export function startReview(db: DB, actor: User, claimId: string) {
  const { claim, item } = staffClaim(db, actor, claimId)
  if (claim.status !== 'enviado') return
  pushClaimStatus(claim, 'en_revision', actor, 'El encargado inició la revisión.')
  if (item.status === 'en_resguardo') setItemStatus(db, item, 'en_revision', actor, 'Reclamo en revisión')
  addLog(db, { actorId: actor.id, action: 'Inició revisión de reclamo', entity: 'reclamo', entityId: claim.id, buildingCode: item.buildingCode })
}

export function approveClaim(db: DB, actor: User, claimId: string, note: string, scheduledAt?: string) {
  const { claim, item } = staffClaim(db, actor, claimId)
  if (claim.status !== 'en_revision' && claim.status !== 'enviado') throw new RuleError('Solo se puede aprobar un reclamo enviado o en revisión.')
  const other = db.claims.find((c) => c.itemId === item.id && c.id !== claim.id && c.status === 'aprobado')
  if (other) throw new RuleError('Ya hay otro reclamo aprobado para este objeto.')
  if (claim.status === 'enviado') pushClaimStatus(claim, 'en_revision', actor, 'El encargado inició la revisión.')
  claim.managerNotes = note || claim.managerNotes
  claim.scheduledAt = scheduledAt || undefined
  pushClaimStatus(claim, 'aprobado', actor, note || 'Reclamo aprobado.')
  if (scheduledAt) claim.history.push({ at: now(), by: actor.id, note: `Entrega agendada para ${new Date(scheduledAt).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}.`, kind: 'agenda' })
  if (item.status === 'en_resguardo') setItemStatus(db, item, 'en_revision', actor, 'Reclamo aprobado')
  addLog(db, { actorId: actor.id, action: 'Aprobó reclamo', entity: 'reclamo', entityId: claim.id, buildingCode: item.buildingCode, reason: note })
}

export function rejectClaim(db: DB, actor: User, claimId: string, note: string) {
  if (!note.trim()) throw new RuleError('Escribe el motivo del rechazo.')
  const { claim, item } = staffClaim(db, actor, claimId)
  if (!['enviado', 'en_revision', 'aprobado'].includes(claim.status)) throw new RuleError('Este reclamo ya fue cerrado.')
  claim.managerNotes = note
  pushClaimStatus(claim, 'rechazado', actor, note)
  const stillActive = db.claims.some((c) => c.itemId === item.id && c.id !== claim.id && ['en_revision', 'aprobado'].includes(c.status))
  if (!stillActive && item.status === 'en_revision') setItemStatus(db, item, 'en_resguardo', actor, 'Sin reclamos en revisión')
  addLog(db, { actorId: actor.id, action: 'Rechazó reclamo', entity: 'reclamo', entityId: claim.id, buildingCode: item.buildingCode, reason: note })
}

export function requestInfo(db: DB, actor: User, claimId: string, note: string) {
  if (!note.trim()) throw new RuleError('Escribe qué información necesitas.')
  const { claim, item } = staffClaim(db, actor, claimId)
  if (claim.status !== 'enviado' && claim.status !== 'en_revision') {
    throw new RuleError('Solo se puede pedir información de un reclamo abierto.')
  }
  if (claim.status === 'enviado') {
    pushClaimStatus(claim, 'en_revision', actor, 'El encargado inició la revisión.')
    if (item.status === 'en_resguardo') setItemStatus(db, item, 'en_revision', actor, 'Reclamo en revisión')
  }
  claim.history.push({ at: now(), by: actor.id, note, kind: 'solicitud_info' })
  addLog(db, { actorId: actor.id, action: 'Solicitó más información', entity: 'reclamo', entityId: claim.id, buildingCode: item.buildingCode, reason: note })
}

/** El alumno responde una solicitud de información. No cambia el estado. */
export function answerInfo(db: DB, actor: User, claimId: string, note: string) {
  if (!note.trim()) throw new RuleError('Escribe tu respuesta.')
  const claim = findClaim(db, claimId)
  if (claim.studentId !== actor.id) throw new RuleError('Este reclamo no es tuyo.')
  if (!ACTIVE_CLAIM_STATUSES.includes(claim.status)) throw new RuleError('Este reclamo ya fue cerrado.')
  claim.history.push({ at: now(), by: actor.id, note, kind: 'respuesta' })
  const item = db.items.find((i) => i.id === claim.itemId)
  addLog(db, { actorId: actor.id, action: 'Respondió solicitud de información', entity: 'reclamo', entityId: claim.id, buildingCode: item?.buildingCode })
}

// ---------- Entrega ----------

export type DeliveryInput = Omit<Delivery, 'id' | 'claimId' | 'itemId' | 'folio' | 'deliveredAt' | 'deliveredBy'>

export function registerDelivery(db: DB, actor: User, claimId: string, input: DeliveryInput): Delivery {
  const claim = findClaim(db, claimId)
  const item = findItem(db, claim.itemId)
  requireCan(actor, 'registrar_entrega', item.buildingCode)
  if (claim.status !== 'aprobado') throw new RuleError('Solo se entregan objetos con reclamo aprobado.')

  // Protección legal: el acta solo puede firmarla el alumno que reclamó.
  const claimant = db.users.find((u) => u.id === claim.studentId)
  if (!claimant) throw new RuleError('No se encontró al alumno que hizo el reclamo.')
  if (input.receiverMatricula.trim() !== claimant.matricula) {
    throw new RuleError('La matrícula del receptor no coincide con la del alumno que reclamó. Solo el titular puede recibir el objeto.')
  }
  if (!input.receiverName.trim()) throw new RuleError('Escribe el nombre del receptor.')
  if (!input.idType.trim()) throw new RuleError('Indica el tipo de identificación.')
  if (!/^\d{4}$/.test(input.idLast4.trim())) throw new RuleError('Los últimos 4 dígitos de la identificación deben ser numéricos.')

  if (!input.signature) throw new RuleError('Falta la firma del receptor.')
  if (!input.condition.trim() || !input.components.trim()) throw new RuleError('Registra la condición y los componentes.')

  const delivery: Delivery = {
    ...input,
    id: uid('ent'),
    claimId,
    itemId: item.id,
    folio: nextFolio(db, item.buildingCode),
    deliveredAt: now(),
    deliveredBy: actor.id,
  }
  db.deliveries.unshift(delivery)
  pushClaimStatus(claim, 'entregado', actor, `Objeto entregado con acta ${delivery.folio}.`)
  setItemStatus(db, item, 'devuelto', actor, `Acta ${delivery.folio}`)

  // Los demás reclamos activos del mismo objeto se cierran.
  for (const other of db.claims) {
    if (other.itemId === item.id && other.id !== claim.id && ACTIVE_CLAIM_STATUSES.includes(other.status)) {
      other.managerNotes = 'El objeto fue entregado a otra persona que acreditó la propiedad.'
      pushClaimStatus(other, 'rechazado', actor, other.managerNotes)
    }
  }
  addLog(db, { actorId: actor.id, action: 'Registró entrega', entity: 'entrega', entityId: delivery.id, buildingCode: item.buildingCode, after: delivery.folio })
  return delivery
}

// ---------- Administración ----------

export function createManager(db: DB, actor: User, data: { name: string; email: string; matricula: string; buildingCode?: string; phone?: string }): User {
  requireCan(actor, 'gestionar_edificios')
  const user = createUser(db, { ...data, role: 'manager' })
  addLog(db, { actorId: actor.id, action: 'Creó cuenta de encargado', entity: 'usuario', entityId: user.id, after: user.email })
  if (data.buildingCode) assignInDb(db, actor, data.buildingCode, user.id)
  return user
}

function assignInDb(db: DB, actor: User, buildingCode: string, managerId: string | undefined) {
  const building = db.buildings.find((b) => b.code === buildingCode)
  if (!building) throw new RuleError('El edificio no existe.')
  const prev = building.managerId
  if (prev === managerId) return
  if (prev) {
    const prevUser = db.users.find((u) => u.id === prev)
    if (prevUser && prevUser.role === 'manager') prevUser.buildingCode = undefined
  }
  if (managerId) {
    const user = db.users.find((u) => u.id === managerId)
    if (!user || user.role !== 'manager' || user.deletedAt) throw new RuleError('Solo se pueden asignar usuarios con rol de encargado.')
    // Un encargado administra un solo edificio: para cambiarlo, primero se le quita el actual.
    if (user.buildingCode && user.buildingCode !== buildingCode) {
      throw new RuleError(`${user.name} ya es encargado de ${user.buildingCode}. Primero quítalo de ese edificio.`)
    }
    user.buildingCode = buildingCode
  }
  building.managerId = managerId
  const name = (id?: string) => db.users.find((u) => u.id === id)?.name ?? 'Sin encargado'
  addLog(db, { actorId: actor.id, action: 'Asignó encargado', entity: 'edificio', entityId: buildingCode, buildingCode, before: name(prev), after: name(managerId) })
}

export function assignManager(db: DB, actor: User, buildingCode: string, managerId: string | undefined) {
  requireCan(actor, 'gestionar_edificios')
  assignInDb(db, actor, buildingCode, managerId)
}

export function renameBuilding(db: DB, actor: User, buildingCode: string, name: string) {
  requireCan(actor, 'gestionar_edificios')
  const b = db.buildings.find((x) => x.code === buildingCode)
  if (!b) throw new RuleError('El edificio no existe.')
  const before = b.name ?? b.code
  b.name = name.trim() || undefined
  addLog(db, { actorId: actor.id, action: 'Editó edificio', entity: 'edificio', entityId: buildingCode, buildingCode, before, after: b.name ?? b.code })
}

export function createBuilding(db: DB, actor: User, data: { code: string; name?: string; type: BuildingType }) {
  requireCan(actor, 'gestionar_edificios')
  const code = data.code.trim().toUpperCase()
  if (!BUILDING_CODE_RE.test(code)) throw new RuleError('La clave del edificio debe empezar con letra y tener de 2 a 10 letras, números o guiones (por ejemplo, EMA11).')
  if (db.buildings.some((b) => b.code === code)) throw new RuleError(`Ya existe el edificio ${code}.`)
  if (!(BUILDING_TYPES as readonly string[]).includes(data.type)) throw new RuleError('Elige un tipo de edificio válido.')
  const building = { code, name: data.name?.trim() || undefined, type: data.type }
  db.buildings.push(building)
  db.buildings.sort(compareBuildings)
  addLog(db, { actorId: actor.id, action: 'Agregó edificio', entity: 'edificio', entityId: code, buildingCode: code, after: building.name ? `${code} · ${building.name}` : code })
  return building
}

/**
 * Da de baja la cuenta de un encargado. No se borra el registro para que la bitácora
 * y los historiales conserven su nombre; se libera su edificio, su correo y su matrícula,
 * y el servidor elimina su contraseña y sus sesiones.
 */
export function deleteManager(db: DB, actor: User, managerId: string) {
  requireCan(actor, 'gestionar_edificios')
  const user = db.users.find((u) => u.id === managerId)
  if (!user || user.role !== 'manager' || user.deletedAt) throw new RuleError('El encargado no existe.')
  const email = user.email
  if (user.buildingCode) {
    const building = db.buildings.find((b) => b.code === user.buildingCode)
    if (building?.managerId === user.id) building.managerId = undefined
  }
  user.buildingCode = undefined
  user.email = `eliminado.${user.id}@pupe.invalid`
  user.matricula = ''
  user.phone = undefined
  user.deletedAt = now()
  addLog(db, { actorId: actor.id, action: 'Eliminó cuenta de encargado', entity: 'usuario', entityId: user.id, before: `${user.name} · ${email}` })
  return user
}
