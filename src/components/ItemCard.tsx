import { IconArrowUpRight, IconCalendar, IconLock, IconMapPin } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { fmtDate } from '../lib/format'
import type { Item } from '../lib/types'
import { ItemStatusBadge } from './StatusBadge'

// Solo muestra datos públicos del objeto.
export default function ItemCard({ item }: { item: Item }) {
  return (
    <Link
      to={`/objeto/${item.id}`}
      className="card card-hover overflow-hidden flex flex-col group focus-visible:outline-none"
    >
      <div className="aspect-[4/3] bg-slate-100 overflow-hidden relative">
        <img
          src={item.photos[0]}
          alt={item.title}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-70" />
        <div className="absolute top-3 left-3"><ItemStatusBadge status={item.status} /></div>
        {item.sensitive && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-navbar/85 backdrop-blur text-white text-[11px] font-bold px-2.5 py-1">
            <IconLock size={12} aria-hidden /> Sensible
          </span>
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-white/90 backdrop-blur px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-titulo">
          {item.category}
        </span>
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base leading-snug line-clamp-2">{item.title}</h3>
          <IconArrowUpRight size={17} className="text-slate-300 group-hover:text-acento shrink-0 transition-colors" aria-hidden />
        </div>
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><IconMapPin size={14} aria-hidden /> {item.buildingCode}</span>
          <span className="inline-flex items-center gap-1"><IconCalendar size={14} aria-hidden /> {fmtDate(item.foundAt)}</span>
        </div>
      </div>
    </Link>
  )
}
