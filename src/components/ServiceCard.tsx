import { IconArrowRight } from '@tabler/icons-react'
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'

const TONES = {
  cian: 'bg-cyan-50 text-acento-osc ring-cyan-100',
  lima: 'bg-lime-50 text-lime-700 ring-lime-100',
  verde: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  naranja: 'bg-orange-50 text-orange-700 ring-orange-100',
}

export default function ServiceCard({ to, title, text, icon: Icon, tone = 'cian' }: {
  to: string
  title: string
  text: string
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
  tone?: keyof typeof TONES
}) {
  return (
    <Link to={to} className="card card-hover p-5 flex items-center gap-4 group">
      <div className={`size-12 shrink-0 rounded-xl ring-1 ring-inset flex items-center justify-center ${TONES[tone]}`}>
        <Icon size={24} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base leading-tight">{title}</h3>
        <p className="text-sm text-slate-500 mt-0.5">{text}</p>
      </div>
      <span className="size-9 shrink-0 rounded-full bg-slate-50 text-slate-400 group-hover:bg-acento group-hover:text-white flex items-center justify-center transition-colors">
        <IconArrowRight size={17} aria-hidden />
      </span>
    </Link>
  )
}
