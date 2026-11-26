import { IconFileCertificate, IconMessage } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ClaimStatusBadge } from '../components/StatusBadge'
import { Alert, EmptyState, PageHeader } from '../components/ui'
import { answerInfo, RuleError } from '../lib/actions'
import { useCurrentUser } from '../lib/auth'
import { ACTIVE_CLAIM_STATUSES, CLAIM_STATUS_LABEL } from '../lib/constants'
import { fmtDate, fmtDateTime, userName } from '../lib/format'
import { useDB } from '../lib/storage'
import type { Claim } from '../lib/types'

export default function MisReclamos() {
  const user = useCurrentUser()!
  const db = useDB()
  const location = useLocation()
  const sent = (location.state as { sent?: boolean } | null)?.sent
  const claims = db.claims.filter((c) => c.studentId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="page max-w-4xl">
      <PageHeader eyebrow="Alumno" title="Mis reclamos" subtitle="Consulta el estado de tus reclamos y la respuesta del encargado." />
      {sent && <div className="mb-4"><Alert kind="success">Tu reclamo se envió. El encargado del edificio lo revisará.</Alert></div>}
      {claims.length === 0 ? (
        <EmptyState title="Aún no tienes reclamos" text="Busca tu objeto en el catálogo y presiona “Este objeto es mío”." action={<Link to="/catalogo" className="btn-primary">Buscar objetos</Link>} />
      ) : (
        <ul className="flex flex-col gap-4">
          {claims.map((c) => <ClaimCard key={c.id} claim={c} />)}
        </ul>
      )}
    </div>
  )
}

function ClaimCard({ claim }: { claim: Claim }) {
  const db = useDB()
  const item = db.items.find((i) => i.id === claim.itemId)
  const delivery = db.deliveries.find((d) => d.claimId === claim.id)
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const lastRequest = [...claim.history].reverse().find((h) => h.kind === 'solicitud_info' || h.kind === 'respuesta')
  const pendingInfo = lastRequest?.kind === 'solicitud_info' && ACTIVE_CLAIM_STATUSES.includes(claim.status)

  const send = async () => {
    try {
      await answerInfo(claim.id, reply)
      setReply('')
      setError('')
    } catch (e) {
      setError(e instanceof RuleError ? e.message : 'No se pudo enviar.')
    }
  }

  return (
    <li className="card p-5">
      <div className="flex flex-col sm:flex-row gap-4">
        {item && <img src={item.photos[0]} alt="" className="size-20 rounded-lg object-cover shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <Link to={`/objeto/${claim.itemId}`} className="text-lg font-bold text-titulo hover:underline">{item?.title ?? 'Objeto'}</Link>
            <ClaimStatusBadge status={claim.status} />
          </div>
          <p className="text-sm text-slate-500">{item?.buildingCode} · enviado el {fmtDate(claim.createdAt)}</p>
          {claim.managerNotes && (claim.status === 'aprobado' || claim.status === 'rechazado' || claim.status === 'entregado') && (
            <p className="mt-2 text-sm"><strong>Respuesta del encargado:</strong> {claim.managerNotes}</p>
          )}
          {claim.status === 'aprobado' && (
            <div className="mt-3"><Alert kind="success">
              Tu reclamo fue aprobado. Acude a <strong>{item?.storageLocation}</strong> ({item?.buildingCode}) con tu credencial
              {claim.scheduledAt ? <> el <strong>{fmtDateTime(claim.scheduledAt)}</strong></> : ''}.
            </Alert></div>
          )}
          {delivery && (
            <Link to={`/acta/${delivery.id}`} className="btn-secondary mt-3"><IconFileCertificate size={16} /> Ver acta {delivery.folio}</Link>
          )}
        </div>
      </div>

      {pendingInfo && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-bold text-amber-900 flex items-center gap-2"><IconMessage size={16} /> El encargado pide más información</p>
          <p className="text-sm mt-1">{lastRequest?.note}</p>
          <label htmlFor={`r-${claim.id}`} className="sr-only">Tu respuesta</label>
          <textarea id={`r-${claim.id}`} rows={2} className="input mt-2" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escribe tu respuesta…" />
          {error && <p className="field-error">{error}</p>}
          <button type="button" className="btn-primary mt-2" onClick={send}>Responder</button>
        </div>
      )}

      <details className="mt-4">
        <summary className="text-sm font-bold text-acento-osc cursor-pointer">Línea de tiempo</summary>
        <ol className="mt-3 border-l-2 border-slate-200 pl-4 flex flex-col gap-3">
          {claim.history.map((h, i) => (
            <li key={i} className="relative text-sm">
              <span className="absolute -left-[23px] top-1 size-3 rounded-full bg-acento ring-4 ring-white" aria-hidden />
              <p className="font-bold text-titulo">
                {h.kind === 'estado' && h.status ? CLAIM_STATUS_LABEL[h.status] : h.kind === 'solicitud_info' ? 'Solicitud de información' : h.kind === 'respuesta' ? 'Tu respuesta' : 'Entrega agendada'}
              </p>
              <p className="text-slate-600">{h.note}</p>
              <p className="text-xs text-slate-400">{fmtDateTime(h.at)} · {userName(db, h.by)}</p>
            </li>
          ))}
        </ol>
      </details>
    </li>
  )
}
