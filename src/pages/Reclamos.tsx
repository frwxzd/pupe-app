import { IconArrowRight, IconCheck, IconEye, IconMessage, IconPackage, IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BuildingSelect } from '../components/BuildingScope'
import { useBuildingScope } from '../lib/useBuildingScope'
import { Forbidden } from '../components/Guard'
import { ClaimStatusBadge } from '../components/StatusBadge'
import { Alert, BackLink, EmptyState, InfoRow, PageHeader } from '../components/ui'
import { approveClaim, rejectClaim, requestInfo, RuleError, startReview } from '../lib/actions'
import { useCurrentUser } from '../lib/auth'
import { CLAIM_STATUS_LABEL } from '../lib/constants'
import { fmtDate, fmtDateTime, userName } from '../lib/format'
import { can } from '../lib/permissions'
import { useDB } from '../lib/storage'
import type { ClaimStatus } from '../lib/types'

const TABS: { key: string; label: string; statuses: ClaimStatus[] }[] = [
  { key: 'pendientes', label: 'Pendientes', statuses: ['enviado', 'en_revision'] },
  { key: 'aprobados', label: 'Aprobados', statuses: ['aprobado'] },
  { key: 'cerrados', label: 'Cerrados', statuses: ['rechazado', 'entregado'] },
]

export function ReclamosPendientes() {
  const db = useDB()
  const scope = useBuildingScope()
  const [tab, setTab] = useState('pendientes')
  const statuses = TABS.find((t) => t.key === tab)!.statuses

  const claims = db.claims
    .filter((c) => {
      const item = db.items.find((i) => i.id === c.itemId)
      return item && scope.inScope(item.buildingCode)
    })
  const shown = claims.filter((c) => statuses.includes(c.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return (
    <div className="page">
      <PageHeader
        eyebrow="Gestión"
        title="Reclamos"
        subtitle={<span className="inline-flex items-center gap-2 flex-wrap">Revisa las solicitudes de <BuildingSelect scope={scope} />.</span>}
      />

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 mb-6 w-full sm:w-fit overflow-x-auto" role="tablist">
        {TABS.map((t) => {
          const n = claims.filter((c) => t.statuses.includes(c.status)).length
          return (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`min-h-11 px-4 rounded-lg text-sm font-bold whitespace-nowrap cursor-pointer transition-all ${tab === t.key ? 'bg-white shadow-sm text-titulo' : 'text-slate-500 hover:text-titulo'}`}>
              {t.label} <span className={`ml-1 inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 text-[10px] ${tab === t.key ? 'bg-cyan-50 text-acento-osc' : 'bg-slate-200/70 text-slate-500'}`}>{n}</span>
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No hay reclamos en esta bandeja" text="Cuando un alumno envíe una solicitud o cambie de estado, aparecerá aquí." />
      ) : (
        <ul className="grid lg:grid-cols-2 gap-3">
          {shown.map((c) => {
            const item = db.items.find((i) => i.id === c.itemId)!
            return (
              <li key={c.id}>
                <Link to={`/encargado/reclamos/${c.id}`} className="card card-hover p-4 flex items-center gap-4 group">
                  <img src={item.photos[0]} alt="" className="size-14 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-titulo truncate">{item.title}</p>
                      <ClaimStatusBadge status={c.status} />
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-1">{userName(db, c.studentId)} · {item.buildingCode} · {item.category}</p>
                    <p className="text-[11px] text-slate-400 mt-1">Enviado el {fmtDate(c.createdAt)}</p>
                  </div>
                  <IconArrowRight size={17} className="text-slate-300 group-hover:text-acento shrink-0 transition-colors" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function ReclamoDetalle() {
  const { id } = useParams()
  const db = useDB()
  const user = useCurrentUser()!
  const claim = db.claims.find((c) => c.id === id)
  const item = claim ? db.items.find((i) => i.id === claim.itemId) : undefined
  const [note, setNote] = useState('')
  const [schedule, setSchedule] = useState('')
  const [error, setError] = useState('')

  const allowed = Boolean(item && can(user, 'revisar_reclamo', item.buildingCode))

  // Al abrir un reclamo enviado, pasa a "En revisión".
  useEffect(() => {
    if (claim && allowed && claim.status === 'enviado') {
      startReview(claim.id).catch(() => { /* sin permiso o ya en revisión */ })
    }
  }, [claim?.id, claim?.status, allowed]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!claim || !item) return <div className="page"><EmptyState title="Reclamo no encontrado" /></div>
  if (!allowed) return <Forbidden text="Este reclamo pertenece a otro edificio." />

  const student = db.users.find((u) => u.id === claim.studentId)
  const open = claim.status === 'enviado' || claim.status === 'en_revision'

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setError('')
      await fn()
      setNote('')
    } catch (e) {
      setError(e instanceof RuleError ? e.message : 'No se pudo completar la acción.')
    }
  }

  return (
    <div className="page">
      <BackLink to="/encargado/reclamos" label="Volver a reclamos" />
      <PageHeader eyebrow="Revisión" title="Revisar reclamo" subtitle={<>Compara la evidencia con el objeto · <ClaimStatusBadge status={claim.status} /></>} />
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-5">
          <h2 className="text-lg mb-3">Lo que dice el alumno</h2>
          <dl>
            <InfoRow label="Alumno">{student?.name} · {student?.matricula}</InfoRow>
            <InfoRow label="Correo">{student?.email}</InfoRow>
            <InfoRow label="Marcas distintivas">{claim.marks}</InfoRow>
            <InfoRow label="Fecha aproximada">{fmtDate(claim.approxDate)}</InfoRow>
            <InfoRow label="Serie / modelo">{claim.serialModel}</InfoRow>
            <InfoRow label="Evidencia">{claim.evidenceText}</InfoRow>
            <InfoRow label="Declaración">{claim.declarationAccepted ? 'Aceptada' : 'No aceptada'}</InfoRow>
          </dl>
          {claim.evidencePhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {claim.evidencePhotos.map((p, i) => <img key={i} src={p} alt={`Evidencia ${i + 1}`} className="rounded-lg aspect-square object-cover" />)}
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-lg">Lo que se registró del objeto</h2>
            <Link to={`/objeto/${item.id}`} className="text-sm font-bold text-acento-osc inline-flex items-center gap-1"><IconEye size={16} /> Ver ficha</Link>
          </div>
          <img src={item.photos[0]} alt={item.title} className="w-full max-h-48 object-cover rounded-lg mb-3" />
          <dl>
            <InfoRow label="Objeto">{item.title}</InfoRow>
            <InfoRow label="Descripción">{item.description}</InfoRow>
            <InfoRow label="Hallazgo">{fmtDateTime(item.foundAt)} · {item.floorZone}</InfoRow>
            <InfoRow label="Marca / modelo">{[item.brand, item.model].filter(Boolean).join(' · ')}</InfoRow>
            <InfoRow label="Componentes">{item.components}</InfoRow>
            {item.privateData?.serial && <InfoRow label="Serie (privada)">{item.privateData.serial}</InfoRow>}
            {item.privateData?.imei && <InfoRow label="IMEI (privado)">{item.privateData.imei}</InfoRow>}
            {item.privateData?.last4 && <InfoRow label="Últimos 4 (privado)">{item.privateData.last4}</InfoRow>}
            {item.notes && <InfoRow label="Notas">{item.notes}</InfoRow>}
          </dl>
        </section>
      </div>

      {open && (
        <section className="card p-5 mt-6 flex flex-col gap-4">
          <h2 className="text-lg">Decisión</h2>
          <div>
            <label className="label" htmlFor="note">Nota para el alumno</label>
            <textarea id="note" rows={3} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo del rechazo, información que necesitas o instrucciones de entrega…" />
          </div>
          <div className="max-w-xs">
            <label className="label" htmlFor="sched">Agendar entrega (opcional, al aprobar)</label>
            <input id="sched" type="datetime-local" className="input" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-success" onClick={() => run(() => approveClaim(claim.id, note.trim(), schedule ? new Date(schedule).toISOString() : undefined))}>
              <IconCheck size={18} /> Aprobar
            </button>
            <button type="button" className="btn-danger" onClick={() => run(() => rejectClaim(claim.id, note))}>
              <IconX size={18} /> Rechazar
            </button>
            <button type="button" className="btn-secondary" onClick={() => run(() => requestInfo(claim.id, note))}>
              <IconMessage size={18} /> Pedir más información
            </button>
          </div>
        </section>
      )}

      {claim.status === 'aprobado' && (
        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
          <Alert kind="success">Reclamo aprobado{claim.scheduledAt ? `, entrega agendada para ${fmtDateTime(claim.scheduledAt)}` : ''}. Registra la entrega cuando el alumno se presente.</Alert>
          <Link to={`/encargado/entrega/${claim.id}`} className="btn-success shrink-0"><IconPackage size={18} /> Registrar entrega</Link>
          <button type="button" className="btn-secondary shrink-0" onClick={() => {
            const reason = window.prompt('Motivo para revocar la aprobación y rechazar:')
            if (reason) run(() => rejectClaim(claim.id, reason))
          }}>Revocar</button>
        </div>
      )}

      <section className="card p-5 mt-6">
        <h2 className="text-lg mb-3">Historial</h2>
        <ol className="border-l-2 border-slate-200 pl-4 flex flex-col gap-3">
          {claim.history.map((h, i) => (
            <li key={i} className="relative text-sm">
              <span className="absolute -left-[23px] top-1 size-3 rounded-full bg-acento ring-4 ring-white" aria-hidden />
              <p className="font-bold text-titulo">
                {h.kind === 'estado' && h.status ? CLAIM_STATUS_LABEL[h.status] : h.kind === 'solicitud_info' ? 'Solicitud de información' : h.kind === 'respuesta' ? 'Respuesta del alumno' : 'Entrega agendada'}
              </p>
              <p className="text-slate-600">{h.note}</p>
              <p className="text-xs text-slate-400">{fmtDateTime(h.at)} · {userName(db, h.by)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
