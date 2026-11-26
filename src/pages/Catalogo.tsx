import { IconAdjustmentsHorizontal, IconFilter, IconSearch, IconX } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import ItemCard from '../components/ItemCard'
import { Alert, EmptyState, PageHeader } from '../components/ui'
import { useCurrentUser } from '../lib/auth'
import { CATEGORIES, ITEM_STATUS_LABEL } from '../lib/constants'
import { catalogItems } from '../lib/queries'
import { useDB } from '../lib/storage'
import type { ItemStatus } from '../lib/types'

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function Catalogo() {
  const user = useCurrentUser()!
  const db = useDB()
  const [params, setParams] = useSearchParams()

  const q = params.get('q') ?? ''
  const building = params.get('edificio') ?? ''
  const category = params.get('categoria') ?? ''
  const status = params.get('estado') ?? ''
  const from = params.get('desde') ?? ''
  const to = params.get('hasta') ?? ''
  const sort = params.get('orden') ?? 'recientes'

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const base = catalogItems(db, user)
  const statuses = (Object.keys(ITEM_STATUS_LABEL) as ItemStatus[]).filter((s) => user.role !== 'student' || s !== 'archivado')

  const results = useMemo(() => {
    const words = normalize(q).split(/\s+/).filter(Boolean)
    const filtered = base.filter((i) => {
      // La búsqueda solo usa campos públicos.
      const text = normalize([i.title, i.description, i.category, i.color, i.brand, i.buildingCode, i.floorZone].filter(Boolean).join(' '))
      if (words.some((w) => !text.includes(w))) return false
      if (building && i.buildingCode !== building) return false
      if (category && i.category !== category) return false
      if (status && i.status !== status) return false
      const day = i.foundAt.slice(0, 10)
      if (from && day < from) return false
      if (to && day > to) return false
      return true
    })
    return filtered.sort((a, b) => {
      if (sort === 'antiguos') return a.foundAt.localeCompare(b.foundAt)
      if (sort === 'nombre') return a.title.localeCompare(b.title, 'es')
      return b.foundAt.localeCompare(a.foundAt)
    })
  }, [base, q, building, category, status, from, to, sort])

  const hasFilters = Boolean(q || building || category || status || from || to || (sort && sort !== 'recientes'))
  const activeFilters = [
    q && { key: 'q', label: `“${q}”` },
    building && { key: 'edificio', label: building },
    category && { key: 'categoria', label: category },
    status && { key: 'estado', label: ITEM_STATUS_LABEL[status as ItemStatus] ?? status },
    from && { key: 'desde', label: `Desde ${from}` },
    to && { key: 'hasta', label: `Hasta ${to}` },
  ].filter(Boolean) as { key: string; label: string }[]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Catálogo"
        title="Buscar objetos"
        subtitle={`${results.length} de ${base.length} objetos publicados en CU2.`}
        actions={hasFilters ? (
          <button type="button" className="btn-secondary" onClick={() => setParams({}, { replace: true })}>
            <IconX size={16} aria-hidden /> Limpiar filtros
          </button>
        ) : undefined}
      />

      {user.role === 'manager' && (
        <div className="mb-5"><Alert kind="info">Como encargado solo ves los objetos de <strong>{user.buildingCode}</strong>.</Alert></div>
      )}

      <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
        <aside className="card p-5 lg:sticky lg:top-24">
          <div className="flex items-center gap-2 mb-4">
            <span className="size-9 rounded-lg bg-cyan-50 text-acento-osc flex items-center justify-center"><IconAdjustmentsHorizontal size={18} aria-hidden /></span>
            <div>
              <p className="text-sm font-black text-titulo">Filtros</p>
              <p className="text-[11px] text-slate-400">Ajusta la búsqueda</p>
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            <div>
              <label className="label text-xs" htmlFor="q">Palabra clave</label>
              <div className="relative">
                <IconSearch size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
                <input id="q" className="input pl-10" placeholder="Color, marca, objeto…" value={q} onChange={(e) => set('q', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label text-xs" htmlFor="f-edif">Edificio</label>
              <select id="f-edif" className="input" value={building} onChange={(e) => set('edificio', e.target.value)} disabled={user.role === 'manager'}>
                <option value="">Todos</option>
                {db.buildings.map((b) => <option key={b.code} value={b.code}>{b.code}{b.name ? ` · ${b.name}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs" htmlFor="f-cat">Categoría</label>
              <select id="f-cat" className="input" value={category} onChange={(e) => set('categoria', e.target.value)}>
                <option value="">Todas</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs" htmlFor="f-est">Estado</label>
              <select id="f-est" className="input" value={status} onChange={(e) => set('estado', e.target.value)}>
                <option value="">Todos</option>
                {statuses.map((s) => <option key={s} value={s}>{ITEM_STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-xs" htmlFor="f-desde">Desde</label>
                <input id="f-desde" type="date" className="input" value={from} onChange={(e) => set('desde', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs" htmlFor="f-hasta">Hasta</label>
                <input id="f-hasta" type="date" className="input" value={to} onChange={(e) => set('hasta', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label text-xs" htmlFor="f-sort">Ordenar por</label>
              <select id="f-sort" className="input" value={sort} onChange={(e) => set('orden', e.target.value)}>
                <option value="recientes">Más recientes</option>
                <option value="antiguos">Más antiguos</option>
                <option value="nombre">Nombre A–Z</option>
              </select>
            </div>
          </div>

          {hasFilters && (
            <button type="button" className="btn-secondary w-full mt-4" onClick={() => setParams({}, { replace: true })}>
              <IconFilter size={16} aria-hidden /> Quitar filtros
            </button>
          )}
        </aside>

        <section className="min-w-0">
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs font-bold text-slate-400">Filtros activos:</span>
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => set(f.key, '')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-3 py-1 text-xs font-bold text-titulo hover:border-acento transition-colors cursor-pointer"
                >
                  {f.label} <IconX size={13} aria-hidden />
                </button>
              ))}
            </div>
          )}

          {results.length === 0 ? (
            <EmptyState
              title="No encontramos objetos"
              text="Prueba con otras palabras o quita algunos filtros. Si perdiste algo hace poco, vuelve a revisar en unos días."
              action={hasFilters ? <button className="btn-secondary" onClick={() => setParams({}, { replace: true })}><IconFilter size={16} /> Quitar filtros</button> : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {results.map((i) => <ItemCard key={i.id} item={i} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
