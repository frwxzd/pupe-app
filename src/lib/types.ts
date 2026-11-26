// Modelo de datos de PUPE. Pensado para migrar después a PostgreSQL / Supabase:
// cada colección corresponde a una tabla y los ids son texto.

export type Role = 'student' | 'manager' | 'super_admin'

export interface User {
  id: string
  name: string
  email: string
  matricula: string
  role: Role
  buildingCode?: string
  phone?: string
  createdAt: string
  /** Último uso de la plataforma (inicio de sesión o actividad con sesión abierta). */
  lastActiveAt?: string
  /** Suspendida por inactividad: no puede entrar hasta reactivarla por correo. */
  suspendedAt?: string
  /** Cuenta dada de baja: no puede iniciar sesión, se conserva para el historial. */
  deletedAt?: string
}

export type BuildingType = 'VAL' | 'EMA' | 'OTRO'

export interface Building {
  code: string
  name?: string
  type: BuildingType
  managerId?: string
}

export type ItemStatus = 'en_resguardo' | 'en_revision' | 'devuelto' | 'no_reclamado' | 'archivado'

export type SensitiveType = 'dinero' | 'identificacion' | 'electronico' | 'valor'

// Datos que nunca se muestran en el catálogo.
export interface PrivateData {
  sensitiveType: SensitiveType
  amount?: string
  countedBy?: string
  serial?: string
  imei?: string
  last4?: string
  legalNotes?: string
}

export interface Finder {
  name: string
  matricula: string
  email: string
  phone?: string
  deliveredAt: string
  signature: string
  folio: string
  observations?: string
  declarationAccepted: boolean
}

export interface Item {
  id: string
  title: string
  description: string
  category: string
  photos: string[]
  foundAt: string
  buildingCode: string
  floorZone: string
  storageLocation: string
  status: ItemStatus
  brand?: string
  model?: string
  color?: string
  condition?: string
  components?: string
  missing?: string
  complete: boolean
  notes?: string
  sensitive: boolean
  privateData?: PrivateData
  finder?: Finder
  createdBy: string
  createdAt: string
  updatedAt: string
  /** Fotos y datos personales eliminados por antigüedad. */
  purgedAt?: string
}

export type ClaimStatus = 'enviado' | 'en_revision' | 'aprobado' | 'rechazado' | 'entregado'

export interface ClaimEvent {
  at: string
  by: string
  status?: ClaimStatus
  note: string
  kind: 'estado' | 'solicitud_info' | 'respuesta' | 'agenda'
}

export interface Claim {
  id: string
  itemId: string
  studentId: string
  marks: string
  approxDate: string
  serialModel?: string
  evidenceText?: string
  evidencePhotos: string[]
  declarationAccepted: boolean
  status: ClaimStatus
  managerNotes?: string
  scheduledAt?: string
  history: ClaimEvent[]
  createdAt: string
}

export interface Delivery {
  id: string
  claimId: string
  itemId: string
  receiverName: string
  receiverMatricula: string
  idType: string
  idLast4: string
  signature: string
  photo?: string
  condition: string
  components: string
  witness?: string
  observations?: string
  folio: string
  deliveredAt: string
  deliveredBy: string
}

export interface TermsAcceptance {
  userId: string
  version: string
  acceptedAt: string
  sessionId: string
}

export interface LogEntry {
  id: string
  actorId: string
  action: string
  entity: 'objeto' | 'reclamo' | 'entrega' | 'usuario' | 'edificio' | 'sistema'
  entityId: string
  buildingCode?: string
  at: string
  before?: string
  after?: string
  reason?: string
}

export interface DB {
  version: number
  users: User[]
  buildings: Building[]
  items: Item[]
  claims: Claim[]
  deliveries: Delivery[]
  terms: TermsAcceptance[]
  logs: LogEntry[]
  counters: Record<string, number>
}
