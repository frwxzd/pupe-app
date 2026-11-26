import {
  IconArchive, IconArrowRight, IconBuilding, IconCalendar, IconEdit, IconHandStop,
  IconLock, IconMapPin, IconPackage, IconReceipt, IconRefresh, IconShieldCheck,
} from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Forbidden } from '../components/Guard'
import { ClaimStatusBadge, ItemStatusBadge } from '../components/StatusBadge'
import { Alert, BackLink, EmptyState, InfoRow } from '../components/ui'
import { activeClaimFor, changeItemLifecycle, claimableItem, RuleError } from '../lib/actions'
import { useCurrentUser } from '../lib/auth'
import { SENSITIVE_LABEL } from '../lib/constants'
import { buildingLabel, fmtDateTime, userName } from '../lib/format'
import { can } from '../lib/permissions'
import { canViewItem } from '../lib/queries'
import { useDB } from '../lib/storage'

export default function Detalle() {
  const { id } = useParams()
  const user = useCurrentUser()!
  const db = useDB()
  const item = db.items.find((i) => i.id === id)
  const [photo, setPhoto] = useState(0)
  const [error, setError] = useState('')

  if (!item) return <div className="page"><EmptyState title="Objeto no encontrado" action={<Link to="/catalogo" className="btn-primary">Ir al catálogo</Link>} /></div>
  if (!canViewItem(user, item)) return <Forbidden text="Este objeto pertenece a otro edificio." />

  const building = db.buildings.find((b) => b.code === item.buildingCode)
  const staff = can(user, 'editar_objeto', item.buildingCode)
  const myClaim = activeClaimFor(db, item.id, user.id)
  const canClaim = can(user, 'enviar_reclamo') && claimableItem(item) && !myClaim
  const itemClaims = staff ? db.claims.filter((c) => c.itemId === item.id) : []
  const delivery = db.deliveries.find((d) => d.itemId === item.id)

  const lifecycle = async (status: 'no_reclamado' | 'archivado' | 'en_resguardo', label: string) => {
    const reason = window.prompt(`Motivo para "${label}":`)
    if (reason === null) return
    try {
      setError('')
      await changeItemLifecycle(item.id, status, reason)
    } catch (e) {
      setError(e instanceof RuleError ? e.message : 'No se pudo cambiar el estado.')
    }
  }

  return (
    <div className="page">
      <BackLink to="/catalogo" label="Volver al catálogo" />

      <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-6 xl:gap-8 items-start">
        <section className="min-w-0">
          <div className="card overflow-hidden">
            <div className="relative aspect-[4/3] bg-slate-50">
              <img src={item.photos[photo] ?? item.photos[0]} alt={`${item.title}, foto ${photo + 1}`} className="size-full object-contain p-3" />
              <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                <ItemStatusBadge status={item.status} />
                {item.sensitive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-navbar/85 backdrop-blur text-white text-[11px] font-bold px-2.5 py-1">
                    <IconLock size={12} aria-hidden /> Objeto sensible
                  </span>
                )}
              </div>
              <span className="absolute bottom-4 right-4 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-[11px] font-bold text-slate-600">
                {photo + 1} / {item.photos.length}
              </span>
            </div>
          </div>
          {item.photos.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {item.photos.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPhoto(i)}
                  aria-label={`Ver foto ${i + 1}`}
                  className={`size-20 shrink-0 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${i === photo ? 'border-acento shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                >
                  <img src={p} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="card p-6 mt-5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-acento-osc">
              <IconBuilding size={14} aria-hidden /> {buildingLabel(building)}
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mt-2">{item.title}</h1>
            <p className="mt-3 text-slate-600 leading-relaxed">{item.description}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600">{item.category}</span>
              {item.color && <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600">Color: {item.color}</span>}
              {item.brand && <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600">Marca: {item.brand}</span>}
              {item.condition && <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600">{item.condition}</span>}
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-24">
          <div className="card p-6">
            <p className="eyebrow">Ficha del objeto</p>
            <dl className="mt-3">
              <InfoRow label="Edificio">{buildingLabel(building)}</InfoRow>
              <InfoRow label="Piso / zona">{item.floorZone}</InfoRow>
              <InfoRow label="Fecha del hallazgo">{fmtDateTime(item.foundAt)}</InfoRow>
              <InfoRow label="Lugar de resguardo">{item.storageLocation}</InfoRow>
              {item.color && <InfoRow label="Color">{item.color}</InfoRow>}
              {item.brand && <InfoRow label="Marca">{item.brand}</InfoRow>}
              {item.condition && <InfoRow label="Condición">{item.condition}</InfoRow>}
            </dl>
          </div>

          {error && <Alert kind="error">{error}</Alert>}

          {user.role !== 'manager' && (
            <div className="card p-6 border-t-4 border-t-acento">
              {canClaim && (
                <>
                  <p className="eyebrow">¿Es tuyo?</p>
                  <h2 className="text-xl mt-1">Reclama este objeto</h2>
                  <p className="text-sm text-slate-500 mt-2">Describe detalles que solo el dueño conoce. El encargado revisará tu solicitud.</p>
                  <Link to={`/objeto/${item.id}/reclamar`} className="btn-primary w-full mt-4 text-base">
                    <IconHandStop size={20} aria-hidden /> Este objeto es mío
                  </Link>
                </>
              )}
              {myClaim && (
                <Alert kind="info">
                  Ya tienes un reclamo activo sobre este objeto (<ClaimStatusBadge status={myClaim.status} />).{' '}
                  <Link to="/mis-reclamos" className="font-bold underline">Ver mis reclamos</Link>
                </Alert>
              )}
              {!claimableItem(item) && <Alert kind="info">Este objeto ya no está disponible para reclamar.</Alert>}

              <div className="mt-5 pt-5 border-t border-slate-100">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400 mb-3">Qué pasa después</p>
                <ol className="flex flex-col gap-3">
                  {[
                    'El encargado revisa tu reclamo y la evidencia.',
                    'Si coincide, agenda la entrega en el edificio.',
                    'Firmas el acta y recibes el objeto.',
                  ].map((text, i) => (
                    <li key={text} className="flex items-start gap-3 text-sm text-slate-600">
                      <span className="size-6 shrink-0 rounded-full bg-cyan-50 text-acento-osc text-xs font-black flex items-center justify-center">{i + 1}</span>
                      {text}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-navbar text-white p-5 flex items-start gap-3">
            <span className="size-10 shrink-0 rounded-xl bg-white/10 text-cyan-200 flex items-center justify-center"><IconShieldCheck size={21} aria-hidden /></span>
            <div>
              <p className="text-sm font-bold">Entrega segura</p>
              <p className="text-xs text-white/55 mt-1">La entrega se registra con identificación, firma y condición del objeto.</p>
            </div>
          </div>
        </aside>
      </div>

      {staff && (
        <section className="card p-6 mt-8 border-t-4 border-t-titulo">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <p className="eyebrow">Solo encargados</p>
              <h2 className="text-xl mt-1 flex items-center gap-2"><IconLock size={18} /> Información privada y gestión</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.status !== 'devuelto' && <Link to={`/encargado/objeto/${item.id}/editar`} className="btn-secondary"><IconEdit size={16} /> Editar</Link>}
              {item.finder && <Link to={`/encargado/recibo/${item.id}`} className="btn-secondary"><IconReceipt size={16} /> Recibo</Link>}
              {delivery && <Link to={`/acta/${delivery.id}`} className="btn-secondary"><IconReceipt size={16} /> Acta de entrega</Link>}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400 mb-2">Objeto</p>
              <dl>
                <InfoRow label="Completo">{item.complete ? 'Sí' : 'No'}</InfoRow>
                <InfoRow label="Componentes">{item.components}</InfoRow>
                {item.missing && <InfoRow label="Faltantes">{item.missing}</InfoRow>}
                {item.model && <InfoRow label="Modelo">{item.model}</InfoRow>}
                {item.notes && <InfoRow label="Notas">{item.notes}</InfoRow>}
                {item.privateData && (
                  <>
                    <InfoRow label="Tipo sensible">{SENSITIVE_LABEL[item.privateData.sensitiveType]}</InfoRow>
                    {item.privateData.amount && <InfoRow label="Monto">{item.privateData.amount}{item.privateData.countedBy ? ` (contado con ${item.privateData.countedBy})` : ''}</InfoRow>}
                    {item.privateData.serial && <InfoRow label="No. de serie">{item.privateData.serial}</InfoRow>}
                    {item.privateData.imei && <InfoRow label="IMEI">{item.privateData.imei}</InfoRow>}
                    {item.privateData.last4 && <InfoRow label="Últimos 4">{item.privateData.last4}</InfoRow>}
                    {item.privateData.legalNotes && <InfoRow label="Notas legales">{item.privateData.legalNotes}</InfoRow>}
                  </>
                )}
              </dl>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400 mb-2">Hallador y publicación</p>
              <dl>
                {item.finder && (
                  <>
                    <InfoRow label="Hallador">{item.finder.name} · {item.finder.matricula}</InfoRow>
                    <InfoRow label="Contacto">{item.finder.email}{item.finder.phone ? ` · ${item.finder.phone}` : ''}</InfoRow>
                    <InfoRow label="Folio de recibo">{item.finder.folio}</InfoRow>
                  </>
                )}
                <InfoRow label="Publicado por">{userName(db, item.createdBy)}</InfoRow>
              </dl>
              <div className="flex flex-wrap gap-2 mt-4">
                {(item.status === 'en_resguardo' || item.status === 'en_revision') && (
                  <button type="button" className="btn-secondary" onClick={() => lifecycle('no_reclamado', 'No reclamado')}>Marcar no reclamado</button>
                )}
                {item.status === 'no_reclamado' && (
                  <>
                    <button type="button" className="btn-secondary" onClick={() => lifecycle('archivado', 'Archivar')}><IconArchive size={16} /> Archivar</button>
                    <button type="button" className="btn-secondary" onClick={() => lifecycle('en_resguardo', 'Regresar a resguardo')}><IconRefresh size={16} /> Regresar a resguardo</button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-base">Reclamos de este objeto</h3>
              <Link to="/encargado/reclamos" className="text-xs font-bold text-acento-osc inline-flex items-center gap-1 hover:underline">Ver bandeja <IconArrowRight size={13} /></Link>
            </div>
            {itemClaims.length === 0 ? <p className="text-sm text-slate-500">Sin reclamos.</p> : (
              <ul className="grid md:grid-cols-2 gap-2">
                {itemClaims.map((c) => (
                  <li key={c.id}>
                    <Link to={`/encargado/reclamos/${c.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 hover:border-acento hover:bg-cyan-50/30 text-sm transition-colors">
                      <span className="min-w-0 truncate">{userName(db, c.studentId)} · {fmtDateTime(c.createdAt)}</span>
                      <ClaimStatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5 flex items-center gap-2 text-xs text-slate-400">
            <IconPackage size={14} aria-hidden /> {delivery ? `Entrega registrada con folio ${delivery.folio}` : 'Sin entrega registrada'}
            <IconCalendar size={14} className="ml-3" aria-hidden /> Actualizado {fmtDateTime(item.updatedAt)}
            <IconMapPin size={14} className="ml-3" aria-hidden /> {item.buildingCode}
          </div>
        </section>
      )}
    </div>
  )
}
