import { IconPrinter } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Forbidden } from '../components/Guard'
import { Alert, BackLink, EmptyState, InfoRow } from '../components/ui'
import { useCurrentUser } from '../lib/auth'
import { FINDER_DECLARATION } from '../lib/constants'
import { fmtDateTime, userName } from '../lib/format'
import { canAccessBuilding } from '../lib/permissions'
import { useDB } from '../lib/storage'

function DocShell({ title, folio, children }: { title: string; folio: string; children: ReactNode }) {
  return (
    <div className="card p-6 sm:p-10 print:shadow-none print:border-0">
      <div className="flex items-center justify-between gap-4 border-b-2 border-acento pb-4 mb-6">
        <div className="flex items-center gap-3">
          <img src="/brand/buap.svg" alt="Escudo BUAP" className="h-16 w-16" />
          <div className="leading-tight">
            <p className="font-black text-titulo">PUPE · CU2 · BUAP</p>
            <p className="text-xs text-slate-500">Objetos perdidos y encontrados · CU2</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Folio</p>
          <p className="font-mono font-bold text-titulo">{folio}</p>
        </div>
      </div>
      <h1 className="text-2xl font-black mb-4">{title}</h1>
      {children}
    </div>
  )
}

function Signature({ src, name, role }: { src: string; name: string; role: string }) {
  return (
    <div className="text-center">
      <img src={src} alt={`Firma de ${name}`} className="h-24 mx-auto object-contain" />
      <div className="border-t border-slate-400 pt-1 text-sm">
        <p className="font-bold">{name}</p>
        <p className="text-xs text-slate-500">{role}</p>
      </div>
    </div>
  )
}

export function Recibo() {
  const { itemId } = useParams()
  const db = useDB()
  const user = useCurrentUser()!
  const location = useLocation()
  const created = (location.state as { created?: boolean } | null)?.created
  const item = db.items.find((i) => i.id === itemId)

  if (!item || !item.finder) return <div className="page"><EmptyState title="Recibo no encontrado" /></div>
  if (!canAccessBuilding(user, item.buildingCode)) return <Forbidden text="Este recibo pertenece a otro edificio." />
  const f = item.finder

  return (
    <div className="page max-w-3xl">
      <BackLink to={`/objeto/${item.id}`} label="Ver objeto" />
      {created && <div className="mb-4 no-print"><Alert kind="success">Objeto registrado y publicado como “En resguardo”. Entrega este recibo al hallador.</Alert></div>}
      <DocShell title="Recibo de objeto encontrado" folio={f.folio}>
        <dl>
          <InfoRow label="Objeto">{item.title} ({item.category})</InfoRow>
          <InfoRow label="Edificio">{item.buildingCode} · {item.floorZone}</InfoRow>
          <InfoRow label="Fecha del hallazgo">{fmtDateTime(item.foundAt)}</InfoRow>
          <InfoRow label="Fecha de recepción">{fmtDateTime(f.deliveredAt)}</InfoRow>
          <InfoRow label="Condición">{item.condition}</InfoRow>
          <InfoRow label="Componentes">{item.components}{item.complete ? '' : ` · Faltantes: ${item.missing}`}</InfoRow>
          <InfoRow label="Resguardo">{item.storageLocation}</InfoRow>
          <InfoRow label="Hallador">{f.name} · Matrícula {f.matricula}</InfoRow>
          <InfoRow label="Correo">{f.email}</InfoRow>
          {f.observations && <InfoRow label="Observaciones">{f.observations}</InfoRow>}
          <InfoRow label="Recibió">{userName(db, item.createdBy)}</InfoRow>
        </dl>
        <p className="text-sm italic bg-slate-50 rounded-lg p-3 my-6">“{FINDER_DECLARATION}”</p>
        <div className="grid sm:grid-cols-2 gap-8">
          <Signature src={f.signature} name={f.name} role="Hallador" />
          <div className="text-center self-end">
            <div className="h-24" />
            <div className="border-t border-slate-400 pt-1 text-sm">
              <p className="font-bold">{userName(db, item.createdBy)}</p>
              <p className="text-xs text-slate-500">Encargado que recibe</p>
            </div>
          </div>
        </div>
      </DocShell>
      <button type="button" onClick={() => window.print()} className="btn-primary mt-4 no-print"><IconPrinter size={18} /> Imprimir recibo</button>
    </div>
  )
}

export function ActaView() {
  const { deliveryId } = useParams()
  const db = useDB()
  const user = useCurrentUser()!
  const d = db.deliveries.find((x) => x.id === deliveryId)
  const item = d ? db.items.find((i) => i.id === d.itemId) : undefined
  const claim = d ? db.claims.find((c) => c.id === d.claimId) : undefined

  if (!d || !item || !claim) return <div className="page"><EmptyState title="Acta no encontrada" /></div>
  const isOwner = claim.studentId === user.id
  if (!isOwner && !canAccessBuilding(user, item.buildingCode)) return <Forbidden text="No tienes acceso a esta acta." />

  return (
    <div className="page max-w-3xl">
      <BackLink to={isOwner ? '/mis-reclamos' : `/objeto/${item.id}`} />
      <DocShell title="Acta de entrega" folio={d.folio}>
        <dl>
          <InfoRow label="Objeto">{item.title} ({item.category})</InfoRow>
          <InfoRow label="Edificio">{item.buildingCode}</InfoRow>
          <InfoRow label="Fecha de entrega">{fmtDateTime(d.deliveredAt)}</InfoRow>
          <InfoRow label="Receptor">{d.receiverName} · Matrícula {d.receiverMatricula}</InfoRow>
          <InfoRow label="Identificación">{d.idType} · terminación {d.idLast4}</InfoRow>
          <InfoRow label="Condición al entregar">{d.condition}</InfoRow>
          <InfoRow label="Componentes entregados">{d.components}</InfoRow>
          {d.witness && <InfoRow label="Testigo">{d.witness}</InfoRow>}
          {d.observations && <InfoRow label="Observaciones">{d.observations}</InfoRow>}
          <InfoRow label="Entregó">{userName(db, d.deliveredBy)}</InfoRow>
          <InfoRow label="Reclamo">{claim.id}</InfoRow>
        </dl>
        <p className="text-sm bg-slate-50 rounded-lg p-3 my-6">
          El receptor declara recibir el objeto descrito en la condición y con los componentes aquí registrados, y manifiesta ser su propietario o estar autorizado para recibirlo.
        </p>
        {d.photo && <img src={d.photo} alt="Foto del objeto entregado" className="max-h-60 rounded-lg mx-auto mb-6" />}
        <div className="grid sm:grid-cols-2 gap-8">
          <Signature src={d.signature} name={d.receiverName} role="Receptor" />
          <div className="text-center self-end">
            <div className="h-24" />
            <div className="border-t border-slate-400 pt-1 text-sm">
              <p className="font-bold">{userName(db, d.deliveredBy)}</p>
              <p className="text-xs text-slate-500">Encargado que entrega</p>
            </div>
          </div>
        </div>
      </DocShell>
      <div className="flex gap-2 mt-4 no-print">
        <button type="button" onClick={() => window.print()} className="btn-primary"><IconPrinter size={18} /> Imprimir acta</button>
        {!isOwner && <Link to="/encargado" className="btn-secondary">Volver al panel</Link>}
      </div>
    </div>
  )
}
