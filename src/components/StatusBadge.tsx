import { CLAIM_STATUS_LABEL, ITEM_STATUS_LABEL } from '../lib/constants'
import type { ClaimStatus, ItemStatus } from '../lib/types'

const COLORS: Record<string, string> = {
  en_resguardo: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  enviado: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  en_revision: 'bg-amber-50 text-amber-800 ring-amber-200',
  devuelto: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  aprobado: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  entregado: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  rechazado: 'bg-red-50 text-red-800 ring-red-200',
  no_reclamado: 'bg-slate-100 text-slate-700 ring-slate-200',
  archivado: 'bg-slate-100 text-slate-700 ring-slate-200',
}

// Siempre muestra texto, no solo color.
export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  return <Badge color={COLORS[status]} label={ITEM_STATUS_LABEL[status]} />
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <Badge color={COLORS[status]} label={CLAIM_STATUS_LABEL[status]} />
}

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset whitespace-nowrap ${color}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
