import { IconPrinter } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BuildingSelect } from '../components/BuildingScope'
import { ClaimStatusBadge, ItemStatusBadge } from '../components/StatusBadge'
import { PageHeader } from '../components/ui'
import { useCurrentUser } from '../lib/auth'
import { fmtDate, fmtDateTime, userName } from '../lib/format'
import { useDB } from '../lib/storage'
import type { Claim, ClaimEvent, DB } from '../lib/types'
import { useBuildingScope } from '../lib/useBuildingScope'

const pad = (n: number) => String(n).padStart(2, '0')
/** Mes local (AAAA-MM) de una fecha ISO. */
const monthOf = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
const currentMonth = () => monthOf(new Date().toISOString())
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const DECISIONS: Partial<Record<NonNullable<ClaimEvent['status']>, string>> = {
  en_revision: 'Inició revisión', aprobado: 'Aprobado', rechazado: 'Rechazado', entregado: 'Entregado',
}

function buildReport(db: DB, month: string, inScope: (code: string) => boolean) {
  const itemById = new Map(db.items.map((i) => [i.id, i]))
  const claimItem = (c: Claim) => itemById.get(c.itemId)
  const scopedClaims = db.claims.filter((c) => { const i = claimItem(c); return i && inScope(i.buildingCode) })

  const received = db.items.filter((i) => inScope(i.buildingCode) && monthOf(i.createdAt) === month)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const submitted = scopedClaims.filter((c) => monthOf(c.createdAt) === month)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const events = scopedClaims.flatMap((c) => c.history
    .filter((e) => monthOf(e.at) === month && (e.kind !== 'estado' || (e.status && e.status !== 'enviado')))
    .map((e) => ({ claim: c, event: e })))
    .sort((a, b) => a.event.at.localeCompare(b.event.at))
  const deliveries = db.deliveries.filter((d) => { const i = itemById.get(d.itemId); return i && inScope(i.buildingCode) && monthOf(d.deliveredAt) === month })
    .sort((a, b) => a.deliveredAt.localeCompare(b.deliveredAt))
  const logs = db.logs.filter((l) => monthOf(l.at) === month && (l.buildingCode ? inScope(l.buildingCode) : true))
    .sort((a, b) => a.at.localeCompare(b.at))
  const logins = logs.filter((l) => l.action === 'Inició sesión')
  const lifecycle = logs.filter((l) => l.entity === 'objeto' && (l.action === 'Cambió estado de objeto' || l.action === 'Depuró objeto por antigüedad'))

  const count = (s: NonNullable<ClaimEvent['status']>) => events.filter((e) => e.event.kind === 'estado' && e.event.status === s).length
  return {
    received, submitted, events, deliveries, logs, logins, lifecycle,
    totals: {
      received: received.length,
      submitted: submitted.length,
      approved: count('aprobado'),
      rejected: count('rechazado'),
      infoRequests: events.filter((e) => e.event.kind === 'solicitud_info').length,
      delivered: deliveries.length,
      sensitive: received.filter((i) => i.sensitive).length,
    },
  }
}

export default function Reporte() {
  const db = useDB()
  const user = useCurrentUser()!
  const scope = useBuildingScope()
  const [month, setMonth] = useState(currentMonth)
  const r = buildReport(db, month, scope.inScope)
  const scopeLabel = scope.selected === '' ? 'Todos los edificios de CU2' : `Edificio ${scope.selected}`
  const [generated] = useState(() => new Date().toISOString())

  const tiles = [
    ['Objetos recibidos', r.totals.received],
    ['Reclamos recibidos', r.totals.submitted],
    ['Reclamos aprobados', r.totals.approved],
    ['Reclamos rechazados', r.totals.rejected],
    ['Solicitudes de información', r.totals.infoRequests],
    ['Objetos entregados', r.totals.delivered],
  ] as const

  return (
    <div className="page report">
      <div className="no-print">
        <PageHeader
          eyebrow="Reportes"
          title="Reporte mensual"
          subtitle="Todo lo que se hizo en el mes: objetos recibidos con sus fotos, reclamos y su resultado, entregas y movimientos de la bitácora."
          actions={<button type="button" onClick={() => window.print()} className="btn-primary"><IconPrinter size={18} aria-hidden /> Imprimir o guardar PDF</button>}
        />
        <div className="card p-4 mb-6 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="rep-month" className="block text-sm font-bold text-titulo mb-1">Mes</label>
            <input id="rep-month" type="month" className="input w-auto" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </div>
          <BuildingSelect scope={scope} />
        </div>
      </div>

      <article className="card p-6 sm:p-8 report-sheet">
        <div className="report-head flex flex-wrap items-center justify-between gap-4 rounded-xl bg-titulo-osc border-b-4 border-acento px-5 py-4 mb-6 text-white">
          <div className="flex items-center gap-4">
            <img src="/brand/buap-white.svg" alt="BUAP" className="h-14" />
            <span className="h-10 w-px bg-white/30" aria-hidden />
            <img src="/brand/cu2.png" alt="CU2" className="h-9" />
          </div>
          <div className="text-right">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-acento">PUPE · Reporte mensual de movimientos</p>
            <h2 className="text-2xl font-black text-white">{monthLabel(month)}</h2>
            <p className="text-sm text-white/75">{scopeLabel} · Generado el {fmtDateTime(generated)} por {user.name}</p>
          </div>
        </div>

        <section className="report-section">
          <h3 className="report-title">1. Resumen</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {tiles.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-bold text-slate-500">{label}</p>
                <p className="text-2xl font-black text-titulo">{value}</p>
              </div>
            ))}
          </div>
          {r.totals.sensitive > 0 && <p className="text-xs text-slate-500 mt-2">{r.totals.sensitive} de los objetos recibidos son sensibles: no se publica su foto ni sus datos privados.</p>}
        </section>

        <section className="report-section">
          <h3 className="report-title">2. Objetos recibidos ({r.received.length})</h3>
          {r.received.length === 0 ? <p className="report-empty">No se recibieron objetos este mes.</p> : (
            <div className="grid sm:grid-cols-2 gap-3">
              {r.received.map((i) => (
                <div key={i.id} className="report-item flex gap-3 rounded-xl border border-slate-200 p-3">
                  <img src={i.photos[0]} alt={`Foto de ${i.title}`} className="size-24 rounded-lg object-cover shrink-0 bg-slate-100" />
                  <div className="min-w-0 text-sm">
                    <Link to={`/objeto/${i.id}`} className="font-black text-titulo hover:underline">{i.title}</Link>
                    <p className="text-xs text-slate-500">{i.category} · {i.buildingCode} · {i.floorZone}</p>
                    <p className="text-xs text-slate-500">Recibido el {fmtDate(i.createdAt)}{i.finder?.folio ? ` · Recibo ${i.finder.folio}` : ''}</p>
                    <p className="text-xs text-slate-500">Registró: {userName(db, i.createdBy)}</p>
                    <div className="mt-1"><ItemStatusBadge status={i.status} /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="report-section">
          <h3 className="report-title">3. Reclamos recibidos ({r.submitted.length})</h3>
          {r.submitted.length === 0 ? <p className="report-empty">No se recibieron reclamos este mes.</p> : (
            <table className="report-table">
              <thead><tr><th>Fecha</th><th>Objeto</th><th>Alumno</th><th>Estado actual</th></tr></thead>
              <tbody>
                {r.submitted.map((c) => {
                  const item = db.items.find((i) => i.id === c.itemId)
                  return (
                    <tr key={c.id}>
                      <td>{fmtDateTime(c.createdAt)}</td>
                      <td>{item?.title} · {item?.buildingCode}</td>
                      <td>{userName(db, c.studentId)}</td>
                      <td><ClaimStatusBadge status={c.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="report-section">
          <h3 className="report-title">4. Seguimiento de reclamos ({r.events.length})</h3>
          {r.events.length === 0 ? <p className="report-empty">Sin decisiones ni solicitudes este mes.</p> : (
            <table className="report-table">
              <thead><tr><th>Fecha</th><th>Objeto</th><th>Movimiento</th><th>Por</th><th>Nota</th></tr></thead>
              <tbody>
                {r.events.map(({ claim, event }, n) => {
                  const item = db.items.find((i) => i.id === claim.itemId)
                  const what = event.kind === 'solicitud_info' ? 'Pidió más información'
                    : event.kind === 'respuesta' ? 'El alumno respondió'
                    : event.kind === 'agenda' ? 'Agendó la entrega'
                    : DECISIONS[event.status!] ?? event.status
                  return (
                    <tr key={`${claim.id}-${n}`}>
                      <td>{fmtDateTime(event.at)}</td>
                      <td>{item?.title} · {item?.buildingCode}</td>
                      <td className="font-bold">{what}</td>
                      <td>{userName(db, event.by)}</td>
                      <td className="text-slate-600">{event.note}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="report-section">
          <h3 className="report-title">5. Entregas ({r.deliveries.length})</h3>
          {r.deliveries.length === 0 ? <p className="report-empty">No hubo entregas este mes.</p> : (
            <div className="grid sm:grid-cols-2 gap-3">
              {r.deliveries.map((d) => {
                const item = db.items.find((i) => i.id === d.itemId)
                return (
                  <div key={d.id} className="report-item flex gap-3 rounded-xl border border-slate-200 p-3">
                    <img src={d.photo || item?.photos[0]} alt={`Entrega de ${item?.title ?? 'objeto'}`} className="size-24 rounded-lg object-cover shrink-0 bg-slate-100" />
                    <div className="min-w-0 text-sm">
                      <Link to={`/acta/${d.id}`} className="font-black text-titulo hover:underline">Acta {d.folio}</Link>
                      <p className="text-xs text-slate-500">{item?.title} · {item?.buildingCode}</p>
                      <p className="text-xs text-slate-500">Entregado el {fmtDateTime(d.deliveredAt)}</p>
                      <p className="text-xs text-slate-500">Recibió: {d.receiverName} · Entregó: {userName(db, d.deliveredBy)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {r.lifecycle.length > 0 && (
          <section className="report-section">
            <h3 className="report-title">6. Cambios de estado de objetos ({r.lifecycle.length})</h3>
            <table className="report-table">
              <thead><tr><th>Fecha</th><th>Objeto</th><th>Movimiento</th><th>Por</th><th>Motivo</th></tr></thead>
              <tbody>
                {r.lifecycle.map((l) => (
                  <tr key={l.id}>
                    <td>{fmtDateTime(l.at)}</td>
                    <td>{db.items.find((i) => i.id === l.entityId)?.title ?? l.entityId} · {l.buildingCode}</td>
                    <td className="font-bold">{l.before && l.after ? `${l.before} → ${l.after}` : l.action}</td>
                    <td>{userName(db, l.actorId)}</td>
                    <td className="text-slate-600">{l.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {user.role === 'super_admin' && (
          <section className="report-section">
            <h3 className="report-title">Accesos del personal ({r.logins.length})</h3>
            {r.logins.length === 0 ? <p className="report-empty">Sin accesos registrados este mes.</p> : (
              <table className="report-table">
                <thead><tr><th>Fecha</th><th>Persona</th><th>Edificio</th><th>Origen</th></tr></thead>
                <tbody>
                  {r.logins.map((l) => (
                    <tr key={l.id}>
                      <td>{fmtDateTime(l.at)}</td>
                      <td>{userName(db, l.actorId)}</td>
                      <td>{db.users.find((u) => u.id === l.actorId)?.buildingCode ?? '—'}</td>
                      <td className="text-slate-600">{l.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        <section className="report-section">
          <h3 className="report-title">Registro completo de la bitácora ({r.logs.length})</h3>
          {r.logs.length === 0 ? <p className="report-empty">Sin movimientos este mes.</p> : (
            <table className="report-table">
              <thead><tr><th>Fecha</th><th>Persona</th><th>Acción</th><th>Edificio</th><th>Detalle</th></tr></thead>
              <tbody>
                {r.logs.map((l) => (
                  <tr key={l.id}>
                    <td>{fmtDateTime(l.at)}</td>
                    <td>{userName(db, l.actorId)}</td>
                    <td className="font-bold">{l.action}</td>
                    <td>{l.buildingCode ?? '—'}</td>
                    <td className="text-slate-600">{[l.before && `Antes: ${l.before}`, l.after && `Después: ${l.after}`, l.reason].filter(Boolean).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <p className="text-[11px] text-slate-400 mt-8 border-t border-slate-200 pt-3">
          Documento generado por PUPE · Objetos perdidos y encontrados de CU2 · BUAP. Los objetos de más de 6 meses aparecen sin foto ni datos personales, conforme a la política de conservación de datos.
        </p>
      </article>
    </div>
  )
}
