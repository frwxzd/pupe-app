import { BUILDING_CODE_RE, CATEGORIES, ID_TYPES, MAX_PHOTOS, PROTECTED_PHOTO, SENSITIVE_LABEL } from '../src/lib/constants'
import { RuleError, type ClaimInput, type DeliveryInput, type FinderInput, type ItemInput } from '../src/lib/rules'
import type { PrivateData, SensitiveType } from '../src/lib/types'
import { validateEmail, validateMatricula } from '../src/lib/validators'

// Validación de todo lo que llega del navegador. Solo se copian los campos
// conocidos, con su tipo y largo máximo: un campo extra (por ejemplo
// "status": "devuelto") se ignora en lugar de guardarse.

type Obj = Record<string, unknown>

export function obj(v: unknown): Obj {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new RuleError('Datos inválidos.')
  return v as Obj
}

function text(v: unknown, label: string, max: number): string {
  if (v === undefined || v === null) return ''
  if (typeof v !== 'string') throw new RuleError(`El campo ${label} no es válido.`)
  const s = v.trim()
  if (s.length > max) throw new RuleError(`El campo ${label} es demasiado largo (máximo ${max} caracteres).`)
  return s
}

export function req(v: unknown, label: string, max = 500): string {
  const s = text(v, label, max)
  if (!s) throw new RuleError(`Falta ${label}.`)
  return s
}

export function opt(v: unknown, label: string, max = 500): string | undefined {
  return text(v, label, max) || undefined
}

export const bool = (v: unknown) => v === true

/** Clave de edificio con formato válido; que exista lo comprueban las reglas. */
export function buildingCode(v: unknown): string {
  if (typeof v !== 'string' || !BUILDING_CODE_RE.test(v)) throw new RuleError('Elige un edificio válido.')
  return v
}

export function oneOf<T extends string>(v: unknown, list: readonly T[], label: string): T {
  if (typeof v !== 'string' || !list.includes(v as T)) throw new RuleError(`Elige ${label} válido.`)
  return v as T
}

export function isoDate(v: unknown, label: string, opts: { past?: boolean } = {}): string {
  if (typeof v !== 'string' || v.length > 40) throw new RuleError(`La fecha de ${label} no es válida.`)
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) throw new RuleError(`La fecha de ${label} no es válida.`)
  if (opts.past && d.getTime() > Date.now() + 5 * 60_000) throw new RuleError(`La fecha de ${label} no puede ser futura.`)
  return d.toISOString()
}

const DATA_IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/
const DEMO_IMAGE = /^\/demo\/[a-z0-9-]+\.(jpg|svg)$/
const MAX_IMAGE_CHARS = 1_500_000 // ~1.1 MB por foto (la app ya las comprime a 800 px)

export function image(v: unknown, label: string): string {
  if (typeof v !== 'string') throw new RuleError(`${label} no es válida.`)
  if (DEMO_IMAGE.test(v)) return v
  if (v.length > MAX_IMAGE_CHARS) throw new RuleError(`${label} es demasiado pesada.`)
  if (!DATA_IMAGE.test(v)) throw new RuleError(`${label} no es una imagen válida.`)
  return v
}

export function images(v: unknown, label: string, max = MAX_PHOTOS): string[] {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) throw new RuleError(`Las fotos de ${label} no son válidas.`)
  if (v.length > max) throw new RuleError(`Máximo ${max} fotos.`)
  return v.map((p, i) => image(p, `La foto ${i + 1}`))
}

function signature(v: unknown): string {
  if (typeof v !== 'string' || !v) throw new RuleError('Falta la firma.')
  if (v.length > 600_000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(v)) throw new RuleError('La firma no es válida.')
  return v
}

function fieldCheck(error: string | null) {
  if (error) throw new RuleError(error)
}

// ---------- Formularios ----------

const SENSITIVE_TYPES = Object.keys(SENSITIVE_LABEL) as SensitiveType[]

function privateData(v: unknown): PrivateData {
  const o = obj(v)
  const last4 = opt(o.last4, 'últimos 4 dígitos', 4)
  if (last4 && !/^\d{4}$/.test(last4)) throw new RuleError('Los últimos 4 dígitos deben ser numéricos.')
  return {
    sensitiveType: oneOf(o.sensitiveType, SENSITIVE_TYPES, 'un tipo de objeto sensible'),
    amount: opt(o.amount, 'monto', 50),
    countedBy: opt(o.countedBy, 'contado con', 120),
    serial: opt(o.serial, 'número de serie', 100),
    imei: opt(o.imei, 'IMEI', 30),
    last4,
    legalNotes: opt(o.legalNotes, 'notas legales', 1000),
  }
}

export function itemInput(v: unknown): ItemInput {
  const o = obj(v)
  const sensitive = bool(o.sensitive)
  const complete = bool(o.complete)
  const photos = images(o.photos, 'el objeto')
  if (photos.length === 0) throw new RuleError('Agrega al menos una foto.')
  if (photos.includes(PROTECTED_PHOTO) && photos.length > 1) throw new RuleError('La foto protegida no se combina con otras fotos.')
  return {
    title: req(o.title, 'el título', 120),
    description: req(o.description, 'la descripción', 2000),
    category: oneOf(o.category, CATEGORIES, 'una categoría'),
    photos,
    foundAt: isoDate(o.foundAt, 'hallazgo', { past: true }),
    buildingCode: buildingCode(o.buildingCode),
    floorZone: req(o.floorZone, 'el piso o zona', 200),
    storageLocation: req(o.storageLocation, 'el lugar de resguardo', 200),
    brand: opt(o.brand, 'marca', 100),
    model: opt(o.model, 'modelo', 100),
    color: opt(o.color, 'color', 100),
    condition: opt(o.condition, 'condición', 300),
    components: opt(o.components, 'componentes', 500),
    missing: complete ? undefined : req(o.missing, 'qué le falta al objeto', 500),
    complete,
    notes: opt(o.notes, 'notas', 1000),
    sensitive,
    privateData: sensitive ? privateData(o.privateData) : undefined,
  }
}

export function finderInput(v: unknown): FinderInput {
  const o = obj(v)
  const matricula = req(o.matricula, 'la matrícula del hallador', 9)
  const email = req(o.email, 'el correo del hallador', 120).toLowerCase()
  fieldCheck(validateMatricula(matricula))
  fieldCheck(validateEmail(email))
  return {
    name: req(o.name, 'el nombre del hallador', 120),
    matricula,
    email,
    phone: opt(o.phone, 'teléfono', 30),
    observations: opt(o.observations, 'observaciones', 1000),
    deliveredAt: new Date().toISOString(),
    signature: signature(o.signature),
    declarationAccepted: bool(o.declarationAccepted),
  }
}

export function claimInput(v: unknown): ClaimInput {
  const o = obj(v)
  const approxDate = req(o.approxDate, 'la fecha aproximada', 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(approxDate)) throw new RuleError('La fecha aproximada no es válida.')
  return {
    marks: req(o.marks, 'las señas particulares', 2000),
    approxDate,
    serialModel: opt(o.serialModel, 'serie o modelo', 200),
    evidenceText: opt(o.evidenceText, 'evidencia', 2000),
    evidencePhotos: images(o.evidencePhotos, 'evidencia'),
    declarationAccepted: bool(o.declarationAccepted),
  }
}

export function deliveryInput(v: unknown): DeliveryInput {
  const o = obj(v)
  return {
    receiverName: req(o.receiverName, 'el nombre del receptor', 120),
    receiverMatricula: req(o.receiverMatricula, 'la matrícula del receptor', 9),
    idType: oneOf(o.idType, ID_TYPES, 'un tipo de identificación'),
    idLast4: req(o.idLast4, 'los últimos 4 dígitos', 4),
    signature: signature(o.signature),
    photo: o.photo ? image(o.photo, 'La foto de entrega') : undefined,
    condition: req(o.condition, 'la condición', 300),
    components: req(o.components, 'los componentes', 500),
    witness: opt(o.witness, 'testigo', 120),
    observations: opt(o.observations, 'observaciones', 1000),
  }
}
