import { IconAlertTriangle, IconArrowLeft, IconCheck, IconInfoCircle, IconMoodEmpty } from '@tabler/icons-react'
import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function Field({ label, error, hint, children, required, htmlFor }: {
  label: string
  error?: string | null
  hint?: string
  children: ReactNode
  required?: boolean
  htmlFor?: string
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label} {required && <span className="text-red-600" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  )
}

export function Alert({ kind = 'info', children }: { kind?: 'info' | 'warning' | 'error' | 'success'; children: ReactNode }) {
  const styles = {
    info: 'bg-cyan-50 border-cyan-200 text-titulo',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  }[kind]
  const Icon = kind === 'success' ? IconCheck : kind === 'info' ? IconInfoCircle : IconAlertTriangle
  return (
    <div className={`flex gap-3 rounded-xl border p-4 text-sm ${styles}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon size={20} className="shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card p-10 text-center flex flex-col items-center gap-3">
      <div className="size-14 rounded-xl bg-cyan-50 text-acento flex items-center justify-center">
        <IconMoodEmpty size={30} aria-hidden />
      </div>
      <h3 className="text-lg">{title}</h3>
      {text && <p className="text-sm text-slate-600 max-w-md">{text}</p>}
      {action}
    </div>
  )
}

export function BackLink({ to, label = 'Volver' }: { to: string; label?: string }) {
  return (
    <Link to={to} className="no-print inline-flex items-center gap-1 text-sm font-bold text-acento-osc hover:underline mb-4">
      <IconArrowLeft size={16} aria-hidden /> {label}
    </Link>
  )
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <div className="text-slate-500 mt-2 max-w-2xl">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,140px)_1fr] gap-3 py-2 border-b border-slate-100 last:border-0 text-sm">
      <dt className="font-bold text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words">{children || '—'}</dd>
    </div>
  )
}

export function Stat({ label, value, tone = 'cian', icon: Icon, hint }: {
  label: string
  value: number | string
  tone?: 'cian' | 'lima' | 'verde' | 'naranja'
  icon?: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
  hint?: string
}) {
  const tones = {
    cian: 'bg-cyan-50 text-acento-osc ring-cyan-100',
    lima: 'bg-lime-50 text-lime-700 ring-lime-100',
    verde: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    naranja: 'bg-orange-50 text-orange-700 ring-orange-100',
  }[tone]
  return (
    <div className="card p-5 flex items-start gap-4 card-hover">
      {Icon && (
        <div className={`size-11 shrink-0 rounded-xl ring-1 ring-inset flex items-center justify-center ${tones}`}>
          <Icon size={22} aria-hidden />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-2xl font-black tracking-tight text-titulo leading-none">{value}</p>
        <p className="text-xs font-bold text-slate-500 mt-1.5">{label}</p>
        {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
      </div>
    </div>
  )
}

export function Avatar({ name, tone = 'cian' }: { name: string; tone?: 'cian' | 'verde' | 'naranja' }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('')
  const bg = { cian: 'bg-cyan-50 text-acento-osc', verde: 'bg-emerald-50 text-emerald-700', naranja: 'bg-orange-50 text-orange-700' }[tone]
  return <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${bg}`} aria-hidden>{initials || '?'}</span>
}
