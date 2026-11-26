import type { Building, DB } from './types'

export function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Valor para <input type="datetime-local"> en hora local. */
export function toLocalInput(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function buildingLabel(b?: Building): string {
  if (!b) return '—'
  return b.name ? `${b.code} · ${b.name}` : b.code
}

export function userName(db: DB, id?: string): string {
  if (!id) return '—'
  if (id === 'anonimo') return 'Desconocido'
  if (id === 'sistema') return 'Sistema (limpieza automática)'
  const u = db.users.find((x) => x.id === id)
  if (!u) return 'Usuario eliminado'
  return u.deletedAt ? `${u.name} (cuenta eliminada)` : u.name
}
