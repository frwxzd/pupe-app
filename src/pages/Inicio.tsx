import {
  IconArrowRight, IconBackpack, IconBox, IconDeviceMobile, IconFileText,
  IconHeartHandshake, IconKey, IconLayoutDashboard, IconListCheck, IconMapPin, IconPencil,
  IconSearch, IconShieldCheck, IconShirt, IconSparkles, IconTag, IconWallet, IconWorld,
} from '@tabler/icons-react'
import type { ComponentType } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ItemCard from '../components/ItemCard'
import ServiceCard from '../components/ServiceCard'
import { EmptyState } from '../components/ui'
import { useCurrentUser } from '../lib/auth'
import { CATEGORIES } from '../lib/constants'
import { catalogItems } from '../lib/queries'
import { useDB } from '../lib/storage'

const CATEGORY_ICONS: Record<string, ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = {
  'Electrónicos': IconDeviceMobile,
  'Documentos': IconFileText,
  'Llaves': IconKey,
  'Mochilas': IconBackpack,
  'Ropa': IconShirt,
  'Accesorios': IconTag,
  'Útiles escolares': IconPencil,
  'Termos y botellas': IconBox,
  'Dinero y tarjetas': IconWallet,
  'Otros': IconBox,
}

const STEPS = [
  { n: '01', title: 'Busca', text: 'Filtra por edificio, categoría, fecha o palabra clave.' },
  { n: '02', title: 'Reclama', text: 'Describe marcas distintivas y adjunta evidencia de propiedad.' },
  { n: '03', title: 'Recoge', text: 'El encargado valida el reclamo y registra la entrega.' },
]

export default function Inicio() {
  const user = useCurrentUser()!
  const db = useDB()
  const navigate = useNavigate()
  const visible = catalogItems(db, user)
  const available = visible.filter((i) => i.status === 'en_resguardo' || i.status === 'en_revision')
  const recent = [...available].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8)
  const returned = visible.filter((i) => i.status === 'devuelto').length
  const myClaims = db.claims.filter((c) => c.studentId === user.id).length
  const pendingClaims = db.claims.filter((c) => {
    if (c.status !== 'enviado' && c.status !== 'en_revision') return false
    const item = db.items.find((i) => i.id === c.itemId)
    return item && (user.role === 'super_admin' || item.buildingCode === user.buildingCode)
  }).length
  const isStaff = user.role !== 'student'

  const categoryCounts = available.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1
    return acc
  }, {})
  const categories = CATEGORIES.filter((c) => categoryCounts[c]).slice(0, 6)

  const search = (q: string) => navigate(q ? `/catalogo?q=${encodeURIComponent(q)}` : '/catalogo')

  return (
    <>
      <section className="relative overflow-hidden bg-[#06283D] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(0,181,226,0.22),transparent_42%),radial-gradient(circle_at_15%_85%,rgba(0,181,226,0.08),transparent_38%)]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.65) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.65) 1px, transparent 1px)', backgroundSize: '56px 56px' }}
        />
        {/* Escudo BUAP como marca de agua: solo la mitad, pegado al borde derecho de la franja azul.
            Se pinta con una máscara para poder usar cualquier color. */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 aspect-square h-[92%] sm:h-[125%] opacity-[0.16]"
          style={{
            backgroundColor: '#00B5E2',
            WebkitMaskImage: 'url(/brand/buap-white.svg)', maskImage: 'url(/brand/buap-white.svg)',
            WebkitMaskSize: 'contain', maskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center', maskPosition: 'center',
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16 lg:py-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
              <span className="size-1.5 rounded-full bg-acento" aria-hidden />
              PUPE · CU2 · BUAP
            </div>
            <h1 className="mt-5 text-4xl md:text-5xl lg:text-[3.4rem] leading-[1.04] font-black tracking-tight text-white text-balance">
              Objetos perdidos y encontrados de CU2
            </h1>
            <p className="mt-4 text-slate-300 max-w-xl text-base md:text-lg">
              Consulta los objetos resguardados en los {db.buildings.length} edificios y solicita la devolución de los tuyos.
            </p>

            <form
              className="mt-7 max-w-2xl"
              onSubmit={(e) => {
                e.preventDefault()
                const q = new FormData(e.currentTarget).get('q')
                search(q ? String(q) : '')
              }}
            >
              <div className="flex flex-col sm:flex-row gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-black/25">
                <div className="relative flex-1">
                  <IconSearch size={19} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
                  <label htmlFor="q-home" className="sr-only">Buscar objeto</label>
                  <input
                    id="q-home"
                    name="q"
                    className="w-full min-h-12 rounded-xl bg-transparent pl-11 pr-3 text-sm text-texto outline-none placeholder:text-slate-400"
                    placeholder="Ej. mochila, llaves, calculadora…"
                  />
                </div>
                <button className="btn-primary min-h-12 px-6" type="submit">
                  <IconSearch size={18} aria-hidden /> Buscar objeto
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-white/45 font-bold">Populares:</span>
              {['Mochila', 'Llaves', 'Electrónicos', 'Documentos'].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => search(q)}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3 max-w-lg">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-2xl font-black text-white leading-none">15</p>
                <p className="text-[11px] text-white/50 mt-1">edificios</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-2xl font-black text-white leading-none">{available.length}</p>
                <p className="text-[11px] text-white/50 mt-1">objetos disponibles</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-2xl font-black text-white leading-none">{returned}</p>
                <p className="text-[11px] text-white/50 mt-1">recuperados</p>
              </div>
            </div>
          </div>

          <div className="relative hidden lg:block min-h-[360px]" aria-hidden>
            <div className="absolute top-8 left-8 size-56 rounded-full border border-cyan-300/20" />
            <div className="absolute top-16 left-20 size-40 rounded-full border border-cyan-300/15" />
            <div className="absolute right-0 top-0 w-[330px] rotate-[-3deg] rounded-2xl bg-white p-3 shadow-[0_30px_60px_rgba(0,0,0,0.35)]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                <img src="/demo/mochila-roja.jpg" alt="" className="size-full object-cover" />
                <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Encontrado
                </span>
              </div>
              <div className="px-2 pt-3 pb-1">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-acento-osc">Mochilas</p>
                <p className="text-base font-black text-titulo mt-1">Mochila roja Nike</p>
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500"><IconMapPin size={13} /> EMA1 · Planta baja</p>
              </div>
            </div>
            <div className="absolute left-0 bottom-0 w-[210px] rotate-[3deg] rounded-2xl bg-white p-4 shadow-[0_24px_50px_rgba(0,0,0,0.28)]">
              <div className="flex items-center gap-2 text-acento-osc">
                <IconShieldCheck size={20} />
                <span className="text-[10px] font-black uppercase tracking-[0.12em]">Resguardo seguro</span>
              </div>
              <p className="mt-2 text-sm font-bold text-titulo leading-snug">Cada objeto lo publica y resguarda un encargado.</p>
              <p className="mt-2 text-[11px] text-slate-500">{db.buildings.length} edificios · CU2</p>
            </div>
          </div>
        </div>
      </section>

      <div className="page -mt-6 md:-mt-8 relative z-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ServiceCard to="/catalogo" title="Buscar" text="objeto perdido" icon={IconSearch} tone="cian" />
          <ServiceCard to="/entregar" title="Entregar" text="al encargado" icon={IconHeartHandshake} tone="lima" />
          {user.role === 'student' && <ServiceCard to="/mis-reclamos" title="Mis reclamos" text={`${myClaims} en total`} icon={IconListCheck} tone="verde" />}
          {isStaff && <ServiceCard to="/encargado" title="Panel" text={pendingClaims > 0 ? `${pendingClaims} reclamos pendientes` : 'gestión del edificio'} icon={IconLayoutDashboard} tone="verde" />}
          {user.role === 'super_admin'
            ? <ServiceCard to="/admin" title="Panel global" text={`${db.buildings.length} edificios`} icon={IconWorld} tone="naranja" />
            : user.role === 'student'
              ? <ServiceCard to="/manual" title="Manual" text="aprende a usarlo" icon={IconSparkles} tone="naranja" />
              : <ServiceCard to="/encargado/reclamos" title="Reclamos" text={`${pendingClaims} pendientes`} icon={IconListCheck} tone="naranja" />}
        </div>

        <section className="mt-14">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <p className="eyebrow">Cómo funciona</p>
              <h2 className="section-title mt-1">Proceso de recuperación</h2>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {STEPS.map((s, i) => (
              <div key={s.n} className="card p-6 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="inline-flex size-11 items-center justify-center rounded-xl bg-cyan-50 text-acento-osc ring-1 ring-inset ring-cyan-100 font-black">{s.n}</span>
                  {i < STEPS.length - 1 && <IconArrowRight size={18} className="text-slate-300 hidden md:block" aria-hidden />}
                </div>
                <h3 className="mt-5 text-lg">{s.title}</h3>
                <p className="text-sm text-slate-500 mt-1.5">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {categories.length > 0 && (
          <section className="mt-14">
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <p className="eyebrow">Explora</p>
                <h2 className="section-title mt-1">Por categoría</h2>
              </div>
              <Link to="/catalogo" className="text-sm font-bold text-acento-osc hover:underline inline-flex items-center gap-1">
                Ver todas <IconArrowRight size={15} aria-hidden />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {categories.map((c) => {
                const Icon = CATEGORY_ICONS[c] ?? IconBox
                return (
                  <Link key={c} to={`/catalogo?categoria=${encodeURIComponent(c)}`} className="card card-hover p-4 flex flex-col gap-3 group">
                    <span className="size-10 rounded-xl bg-slate-50 text-titulo ring-1 ring-inset ring-slate-100 flex items-center justify-center group-hover:bg-cyan-50 group-hover:text-acento-osc transition-colors">
                      <Icon size={20} aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-titulo leading-tight">{c}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{categoryCounts[c]} objeto{categoryCounts[c] === 1 ? '' : 's'}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        <section className="mt-14">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <p className="eyebrow">Catálogo</p>
              <h2 className="section-title mt-1">Objetos recientes{user.role === 'manager' ? ` · ${user.buildingCode}` : ''}</h2>
            </div>
            <Link to="/catalogo" className="text-sm font-bold text-acento-osc hover:underline inline-flex items-center gap-1">
              Ver todos <IconArrowRight size={15} aria-hidden />
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState title="Aún no hay objetos en resguardo" text="Cuando un encargado publique un objeto, aparecerá aquí." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recent.map((i) => <ItemCard key={i.id} item={i} />)}
            </div>
          )}
        </section>

        <section className="mt-14 rounded-2xl bg-navbar text-white p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6 justify-between overflow-hidden relative">
          <div className="absolute right-0 top-0 size-48 rounded-full bg-acento/10 blur-2xl" aria-hidden />
          <div className="flex items-start gap-4 relative">
            <div className="size-12 shrink-0 rounded-xl bg-white/10 text-cyan-200 flex items-center justify-center">
              <IconShieldCheck size={26} aria-hidden />
            </div>
            <div>
              <p className="eyebrow text-cyan-300">Importante</p>
              <h2 className="text-white text-xl md:text-2xl mt-1">Solo los encargados publican objetos encontrados.</h2>
              <p className="text-sm text-white/60 mt-2 max-w-2xl">Si encontraste algo, entrégalo al encargado del edificio. Él registra tus datos, resguarda el objeto y lo publica.</p>
            </div>
          </div>
          <Link to="/entregar" className="btn-primary shrink-0 relative">Entregar al encargado <IconArrowRight size={16} aria-hidden /></Link>
        </section>
      </div>
    </>
  )
}
