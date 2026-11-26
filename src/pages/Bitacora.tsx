import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BuildingSelect } from '../components/BuildingScope'
import { useBuildingScope } from '../lib/useBuildingScope'
import { EmptyState, PageHeader } from '../components/ui'
import { useCurrentUser } from '../lib/auth'
import { fmtDateTime, userName } from '../lib/format'
import { useDB } from '../lib/storage'
import type { LogEntry } from '../lib/types'

function entityLink(e: LogEntry): string | null {
  if (e.entity === 'objeto') return `/objeto/${e.entityId}`
  if (e.entity === 'reclamo') return `/encargado/reclamos/${e.entityId}`
  if (e.entity === 'entrega') return `/acta/${e.entityId}`
  return null
}

export default function Bitacora() {
  const db = useDB()
  const user = useCurrentUser()!
  const scope = useBuildingScope()
  const [q, setQ] = useState('')

  // El encargado solo ve acciones de su edificio; el super admin ve también las globales.
  const logs = db.logs.filter((l) => {
    if (l.buildingCode) { if (!scope.inScope(l.buildingCode)) return false }
    else if (user.role !== 'super_admin' || scope.selected) return false
    if (!q) return true
    const text = `${l.action} ${userName(db, l.actorId)} ${l.entity} ${l.entityId} ${l.reason ?? ''} ${l.after ?? ''}`.toLowerCase()
    return text.includes(q.toLowerCase())
  })

  return (
    <div className="page">
      <PageHeader eyebrow="Auditoría" title="Bitácora" subtitle={<span className="inline-flex items-center gap-2 flex-wrap">Acciones sensibles de <BuildingSelect scope={scope} /></span>} />
      <label htmlFor="q-log" className="sr-only">Buscar en la bitácora</label>
      <input id="q-log" className="input max-w-md mb-4" placeholder="Buscar acción, usuario, folio…" value={q} onChange={(e) => setQ(e.target.value)} />
      {logs.length === 0 ? <EmptyState title="Sin registros" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-navbar text-white text-left">
              <tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Actor</th><th className="px-4 py-2">Acción</th><th className="px-4 py-2">Entidad</th><th className="px-4 py-2">Detalle</th></tr>
            </thead>
            <tbody>
              {logs.slice(0, 300).map((l) => {
                const link = entityLink(l)
                return (
                  <tr key={l.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-2 whitespace-nowrap">{fmtDateTime(l.at)}</td>
                    <td className="px-4 py-2">{userName(db, l.actorId)}</td>
                    <td className="px-4 py-2 font-bold text-titulo">{l.action}</td>
                    <td className="px-4 py-2">
                      {l.entity}{l.buildingCode ? ` · ${l.buildingCode}` : ''}<br />
                      {link ? <Link to={link} className="text-xs text-acento-osc underline break-all">{l.entityId}</Link> : <span className="text-xs text-slate-500">{l.entityId}</span>}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600 max-w-xs break-words">
                      {l.before && <div><strong>Antes:</strong> {l.before}</div>}
                      {l.after && <div><strong>Después:</strong> {l.after}</div>}
                      {l.reason && <div><strong>Motivo:</strong> {l.reason}</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
