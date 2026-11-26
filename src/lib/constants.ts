import type { ClaimStatus, ItemStatus, Role, SensitiveType } from './types'

// Lista única de dominios permitidos. Para agregar uno nuevo basta con añadirlo aquí.
export const ALLOWED_DOMAINS = ['alumno.buap.mx', 'alm.buap.mx', 'correo.buap.mx']

export const BUILDING_CODES = [
  'VAL1', 'VAL2', 'VAL3', 'VAL4', 'VAL5',
  'EMA1', 'EMA2', 'EMA3', 'EMA4', 'EMA5', 'EMA6', 'EMA7', 'EMA8', 'EMA9', 'EMA10',
]

/** Tipos de edificio. Los edificios nuevos de CU2 pueden ser de cualquiera. */
export const BUILDING_TYPES = ['VAL', 'EMA', 'OTRO'] as const
export const BUILDING_TYPE_LABEL: Record<(typeof BUILDING_TYPES)[number], string> = { VAL: 'VAL', EMA: 'EMA', OTRO: 'Otro' }

/** Clave de edificio: empieza con letra; letras, números o guion; de 2 a 10 caracteres. */
export const BUILDING_CODE_RE = /^[A-Z][A-Z0-9-]{1,9}$/

/** Orden de los edificios: VAL, EMA y luego otros; dentro de cada tipo, por número (EMA2 antes que EMA10). */
export function compareBuildings(a: { code: string; type: string }, b: { code: string; type: string }) {
  const rank = (t: string) => { const i = (BUILDING_TYPES as readonly string[]).indexOf(t); return i < 0 ? BUILDING_TYPES.length : i }
  return rank(a.type) - rank(b.type) || a.code.localeCompare(b.code, 'es', { numeric: true })
}

export const CATEGORIES = [
  'Electrónicos',
  'Documentos',
  'Llaves',
  'Mochilas',
  'Ropa',
  'Accesorios',
  'Útiles escolares',
  'Termos y botellas',
  'Dinero y tarjetas',
  'Otros',
]

export const ROLE_LABEL: Record<Role, string> = {
  student: 'Alumno',
  manager: 'Encargado',
  super_admin: 'Super administrador',
}

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  en_resguardo: 'En resguardo',
  en_revision: 'En revisión',
  devuelto: 'Devuelto',
  no_reclamado: 'No reclamado',
  archivado: 'Archivado',
}

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  enviado: 'Enviado',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  entregado: 'Entregado',
}

export const ACTIVE_CLAIM_STATUSES: ClaimStatus[] = ['enviado', 'en_revision', 'aprobado']

export const SENSITIVE_LABEL: Record<SensitiveType, string> = {
  dinero: 'Dinero',
  identificacion: 'Identificación o tarjeta',
  electronico: 'Electrónico con serie / IMEI',
  valor: 'Otro objeto de valor',
}

export const ID_TYPES = ['Credencial BUAP', 'INE', 'Pasaporte', 'Licencia de conducir', 'Otra']

export const PROTECTED_PHOTO = '/demo/protegido.svg'
export const MAX_PHOTOS = 5

export const TERMS_VERSION = '1.1'

export const TERMS_TEXT = [
  'PUPE es una herramienta de apoyo de Ciudad Universitaria 2 (CU2) de la BUAP para registrar y resguardar objetos extraviados en sus edificios. No garantiza la recuperación ni la entrega inmediata.',
  'El usuario declara que la información que proporciona es veraz y que es el propietario del objeto o cuenta con autorización para reclamarlo.',
  'Está prohibido reclamar objetos ajenos, proporcionar información falsa o usar la plataforma para fines distintos al extravío.',
  'Dinero, tarjetas, identificaciones y objetos de valor se resguardan mediante protocolo especial; no se publican datos sensibles.',
  'El objeto se entrega en la condición y con los componentes registrados al momento de su resguardo. El receptor firma de recibido.',
  'La universidad no responde por objetos no reclamados, deterioro natural o información incorrecta proporcionada por terceros.',
  'Los datos personales se usan solo para gestionar el extravío y se tratan conforme al aviso de privacidad.',
  'Conservación de publicaciones: cada objeto se retira del catálogo a los 6 meses de su hallazgo. En ese momento se eliminan sus fotos, sus datos privados, los datos de quien lo entregó y las pruebas de los reclamos ya cerrados; solo se conserva una ficha mínima (folio, edificio, fechas y estado) con fines estadísticos. Los objetos con un reclamo en curso se conservan hasta que el reclamo concluya. Las actas de entrega se conservan como comprobante.',
  'Cuentas inactivas: la cuenta de alumno que no se use durante 6 meses se suspende y se avisa a su correo institucional. Puede reactivarse durante los 30 días siguientes con la opción «¿Olvidaste tu contraseña?». Pasado ese plazo, la cuenta y sus datos personales se eliminan de forma definitiva. Las cuentas con un reclamo en curso no se suspenden.',
  'El incumplimiento puede derivar en cancelación del reclamo y en las acciones universitarias correspondientes.',
]

export const CLAIM_DECLARATION =
  'Declaro ser el propietario del objeto o estar autorizado para reclamarlo; la información proporcionada es veraz.'

export const FINDER_DECLARATION =
  'Entrego voluntariamente el objeto al encargado y manifiesto que no me pertenece; acepto que se resguarde y se devuelva a su propietario.'
