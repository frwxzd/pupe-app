import {
  IconArrowRight, IconCircleCheck, IconClipboardList, IconFileCertificate, IconHistory,
  IconPackage, IconPlus,
} from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { BuildingSelect } from '../components/BuildingScope'
import { ClaimStatusBadge, ItemStatusBadge } from '../components/StatusBadge'
import { Alert, Avatar, EmptyState, PageHeader, Stat } from '../components/ui'
import { useCurrentUser } from '../lib/auth'
import { fmtDate } from '../lib/format'
import { useDB } from '../lib/storage'
import { useBuildingScope } from '../lib/useBuildingScope'

export default function PanelEncargado() {
  const user = useCurrentUser()!
  const db = useDB()
  const scope = useBuildingScope()

  if (user.role === 'manager' && !user.buildingCode) {
    return <div className="page"><Alert kind="warning">Tu cuenta aún no tiene edificio asignado. Pide al super administrador que te asigne uno.</Alert></div>
  }

  const items = db.items.filter((i) => scope.inScope(i.buildingCode)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const itemIds = new Set(items.map((i) => i.id))
  const claims = db.claims.filter((c) => itemIds.has(c.itemId))
  const pending = claims.filter((c) => c.status === 'enviado' || c.status === 'en_revision')
  const approved = claims.filter((c) => c.status === 'aprobado')
  const deliveries = db.deliveries.filter((d) => itemIds.has(d.itemId))
  const q = scope.isSuper && scope.selected ? `?edificio=${scope.selected}` : ''

  const studentName = (id: string) => db.users.find((u) => u.id === id)?.name ?? 'Alumno'

  return (
    <div className="page">
      <PageHeader
        eyebrow="Gestión"
        title={scope.isSuper ? 'Panel de edificio' : 'Mi edificio'}
        subtitle={<span className="inline-flex items-center gap-2 flex-wrap">Objetos, reclamos y entregas de <BuildingSelect scope={scope} /></span>}
        actions={<Link to={`/encargado/nuevo${q}`} className="btn-primary"><IconPlus size={18} /> Publicar encontrado</Link>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <Stat label="En resguardo" value={items.filter((i) => i.status === 'en_resguardo').length} tone="cian" icon={IconPackage} hint="Objetos disponibles" />
        <Stat label="Reclamos pendientes" value={pending.length} tone="naranja" icon={IconClipboardList} hint="Por revisar" />
        <Stat label="Listos para entregar" value={approved.length} tone="lima" icon={IconCircleCheck} hint="Reclamos aprobados" />
        <Stat label="Entregas registradas" value={deliveries.length} tone="verde" icon={IconFileCertificate} hint="Con acta firmada" />
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <Link to={`/encargado/nuevo${q}`} className="card card-hover p-4 flex items-center gap-3">
          <span className="size-10 rounded-xl bg-cyan-50 text-acento-osc flex items-center justify-center"><IconPlus size={20} /></span>
          <span className="font-bold text-titulo text-sm">Nuevo objeto encontrado</span>
        </Link>
        <Link to={`/encargado/reclamos${q}`} className="card card-hover p-4 flex items-center gap-3">
          <span className="size-10 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center"><IconClipboardList size={20} /></span>
          <span className="font-bold text-titulo text-sm">Reclamos pendientes ({pending.length})</span>
        </Link>
        <Link to={`/bitacora${q}`} className="card card-hover p-4 flex items-center gap-3">
          <span className="size-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><IconHistory size={20} /></span>
          <span className="font-bold text-titulo text-sm">Bitácora del edificio</span>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-8">
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="eyebrow">Entregas</p>
              <h2 className="text-lg mt-1">Listos para entregar</h2>
            </div>
            <Link to={`/encargado/reclamos${q}`} className="text-xs font-bold text-acento-osc hover:underline">Ver todos</Link>
          </div>
          {approved.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No hay reclamos aprobados pendientes de entrega.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {approved.map((c) => {
                const item = db.items.find((i) => i.id === c.itemId)
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:border-acento/50 transition-colors">
                    <img src={item?.photos[0]} alt="" className="size-12 rounded-lg object-cover shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-titulo truncate text-sm">{item?.title}</p>
                      <p className="text-xs text-slate-500 truncate">{studentName(c.studentId)} · {item?.buildingCode}</p>
                    </div>
                    <Link to={`/encargado/entrega/${c.id}`} className="btn-success shrink-0 text-xs px-3">Entregar</Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="eyebrow">Bandeja</p>
              <h2 className="text-lg mt-1">Reclamos pendientes</h2>
            </div>
            <Link to={`/encargado/reclamos${q}`} className="text-xs font-bold text-acento-osc hover:underline">Abrir bandeja</Link>
          </div>
          {pending.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No hay reclamos pendientes.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pending.slice(0, 5).map((c) => {
                const item = db.items.find((i) => i.id === c.itemId)
                return (
                  <li key={c.id}>
                    <Link to={`/encargado/reclamos/${c.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:border-acento/50 transition-colors">
                      <Avatar name={studentName(c.studentId)} tone="naranja" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-titulo truncate text-sm">{item?.title}</p>
                        <p className="text-xs text-slate-500 truncate">{studentName(c.studentId)} · {fmtDate(c.createdAt)}</p>
                      </div>
                      <ClaimStatusBadge status={c.status} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <section>
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <p className="eyebrow">Inventario</p>
            <h2 className="section-title mt-1">Objetos ({items.length})</h2>
          </div>
          <Link to={`/encargado/nuevo${q}`} className="text-sm font-bold text-acento-osc hover:underline inline-flex items-center gap-1">
            Publicar <IconArrowRight size={15} />
          </Link>
        </div>
        {items.length === 0 ? <EmptyState title="No hay objetos registrados" text="Publica el primer objeto encontrado de este edificio." /> : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-navbar text-white text-left">
                <tr><th className="px-4 py-3">Objeto</th><th className="px-4 py-3">Edificio</th><th className="px-4 py-3">Hallazgo</th><th className="px-4 py-3">Folio recibo</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={i.photos[0]} alt="" className="size-10 rounded-lg object-cover shrink-0" />
                        <div className="min-w-0">
                          <Link to={`/objeto/${i.id}`} className="font-bold text-titulo hover:underline line-clamp-1">{i.title}</Link>
                          <p className="text-xs text-slate-400">{i.category}{i.sensitive ? ' · sensible' : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{i.buildingCode}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(i.foundAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{i.finder?.folio ?? '—'}</td>
                    <td className="px-4 py-3"><ItemStatusBadge status={i.status} /></td>
                    <td className="px-4 py-3 text-right"><Link to={`/objeto/${i.id}`} className="text-xs font-bold text-acento-osc hover:underline">Ver</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
