import {
  IconBuilding, IconCircleCheck, IconClipboardList, IconFileCertificate,
  IconClockHour4, IconHistory, IconPackage, IconPlus, IconRefresh, IconShieldLock, IconTrash, IconUserPlus, IconWorld,
} from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ClaimStatusBadge, ItemStatusBadge } from '../components/StatusBadge'
import { Alert, Field, PageHeader, Stat } from '../components/ui'
import { assignManager, createBuilding, createManager, deleteManager, renameBuilding, resetDemo, RuleError, runCleanup } from '../lib/actions'
import { BUILDING_CODE_RE, BUILDING_TYPE_LABEL, BUILDING_TYPES } from '../lib/constants'
import { useAppConfig } from '../lib/api'
import { fmtDate, userName } from '../lib/format'
import { RETENTION_MONTHS, retentionPreview, SUSPENSION_GRACE_DAYS } from '../lib/retention'
import { useDB } from '../lib/storage'
import type { BuildingType, User } from '../lib/types'
import { PASSWORD_MIN, validateEmail, validateMatricula, validatePassword } from '../lib/validators'

export default function PanelSuperAdmin() {
  const db = useDB()
  const config = useAppConfig()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const managers = db.users.filter((u) => u.role === 'manager' && !u.deletedAt)
  const students = db.users.filter((u) => u.role === 'student')
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      setMsg({ kind: 'success', text: ok })
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof RuleError ? e.message : 'No se pudo completar la acción.' })
    }
  }

  const reset = () => {
    if (!window.confirm('¿Restablecer los datos demo? Se perderán todos los cambios hechos en la app.')) return
    run(resetDemo, 'Datos demo restablecidos.')
  }

  const removeManager = (m: User) => {
    const where = m.buildingCode ? ` ${m.buildingCode} quedará sin encargado.` : ''
    if (!window.confirm(`¿Eliminar la cuenta de ${m.name}? Ya no podrá iniciar sesión.${where} Su nombre se conserva en la bitácora y en los historiales.`)) return
    run(() => deleteManager(m.id), `Cuenta de ${m.name} eliminada.`)
  }

  const pending = db.claims.filter((c) => c.status === 'enviado' || c.status === 'en_revision')
  const approved = db.claims.filter((c) => c.status === 'aprobado')
  const returned = db.items.filter((i) => i.status === 'devuelto').length
  const recoveryRate = db.items.length ? Math.round((returned / db.items.length) * 100) : 0
  const buildingsWithoutManager = db.buildings.filter((b) => !b.managerId)
  const sensitiveInCustody = db.items.filter((i) => i.sensitive && i.status === 'en_resguardo')
  const byBuilding = (code: string) => {
    const ids = new Set(db.items.filter((i) => i.buildingCode === code).map((i) => i.id))
    return {
      items: ids.size,
      resguardo: db.items.filter((i) => i.buildingCode === code && i.status === 'en_resguardo').length,
      pending: pending.filter((c) => ids.has(c.itemId)).length,
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Administración"
        title="Panel global"
        subtitle={`Coordinación de los ${db.buildings.length} edificios de CU2.`}
        actions={<>
          <Link to="/bitacora" className="btn-secondary"><IconHistory size={18} /> Bitácora</Link>
          {config?.demo && <button type="button" onClick={reset} className="btn-danger"><IconRefresh size={18} /> Restablecer demo</button>}
        </>}
      />
      {msg && <div className="mb-5"><Alert kind={msg.kind}>{msg.text}</Alert></div>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-7">
        <Stat label="Objetos registrados" value={db.items.length} tone="cian" icon={IconPackage} hint={`En los ${db.buildings.length} edificios`} />
        <Stat label="En resguardo" value={db.items.filter((i) => i.status === 'en_resguardo').length} tone="lima" icon={IconCircleCheck} hint="Disponibles" />
        <Stat label="Reclamos pendientes" value={pending.length} tone="naranja" icon={IconClipboardList} hint="Por revisar" />
        <Stat label="Entregas" value={db.deliveries.length} tone="verde" icon={IconFileCertificate} hint="Con acta" />
        <Stat label="Tasa de recuperación" value={`${recoveryRate}%`} tone="cian" icon={IconWorld} hint={`${returned} de ${db.items.length} objetos`} />
      </div>

      <section className="grid md:grid-cols-3 gap-3 mb-8">
        <div className="card p-5 border-l-4 border-l-amber-400">
          <div className="flex items-center gap-2 text-amber-700">
            <IconBuilding size={18} aria-hidden />
            <p className="text-xs font-black uppercase tracking-[0.12em]">Edificios sin encargado</p>
          </div>
          <p className="text-2xl font-black text-titulo mt-2">{buildingsWithoutManager.length}</p>
          <p className="text-xs text-slate-500 mt-1">{buildingsWithoutManager.length ? buildingsWithoutManager.map((b) => b.code).join(' · ') : 'Todos los edificios tienen encargado.'}</p>
        </div>
        <div className="card p-5 border-l-4 border-l-cyan-400">
          <div className="flex items-center gap-2 text-acento-osc">
            <IconShieldLock size={18} aria-hidden />
            <p className="text-xs font-black uppercase tracking-[0.12em]">Sensibles en resguardo</p>
          </div>
          <p className="text-2xl font-black text-titulo mt-2">{sensitiveInCustody.length}</p>
          <p className="text-xs text-slate-500 mt-1">Objetos con datos privados que requieren protocolo especial.</p>
        </div>
        <div className="card p-5 border-l-4 border-l-emerald-400">
          <div className="flex items-center gap-2 text-emerald-700">
            <IconCircleCheck size={18} aria-hidden />
            <p className="text-xs font-black uppercase tracking-[0.12em]">Aprobados sin entrega</p>
          </div>
          <p className="text-2xl font-black text-titulo mt-2">{approved.length}</p>
          <p className="text-xs text-slate-500 mt-1">Reclamos aprobados que todavía no tienen acta.</p>
        </div>
      </section>

      <RetentionCard onMessage={setMsg} />

      <section className="mb-8">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <p className="eyebrow">Edificios</p>
            <h2 className="section-title mt-1">Edificios y encargados</h2>
          </div>
          <span className="text-xs text-slate-400">{managers.length} encargados · {students.length} alumnos</span>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-navbar text-white text-left">
              <tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Encargado</th><th className="px-4 py-3 text-center">Objetos</th><th className="px-4 py-3 text-center">Resguardo</th><th className="px-4 py-3 text-center">Pendientes</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {db.buildings.map((b) => {
                const s = byBuilding(b.code)
                return (
                  <tr key={b.code} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-black text-titulo">{b.code}</span>
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{BUILDING_TYPE_LABEL[b.type] ?? b.type}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <label className="sr-only" htmlFor={`n-${b.code}`}>Nombre de {b.code}</label>
                      <input id={`n-${b.code}`} className="input min-h-9 text-xs" defaultValue={b.name ?? ''} placeholder={b.code}
                        onBlur={(e) => { if ((e.target.value.trim() || undefined) !== b.name) run(() => renameBuilding(b.code, e.target.value), `Nombre de ${b.code} actualizado.`) }} />
                    </td>
                    <td className="px-4 py-2.5">
                      <label className="sr-only" htmlFor={`m-${b.code}`}>Encargado de {b.code}</label>
                      <select id={`m-${b.code}`} className="input min-h-9 text-xs" value={b.managerId ?? ''}
                        onChange={(e) => run(() => assignManager(b.code, e.target.value || undefined), `Encargado de ${b.code} actualizado.`)}>
                        <option value="">Sin encargado</option>
                        {managers.filter((m) => !m.buildingCode || m.buildingCode === b.code).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold">{s.items}</td>
                    <td className="px-4 py-2.5 text-center">{s.resguardo}</td>
                    <td className="px-4 py-2.5 text-center">{s.pending > 0 ? <span className="inline-flex min-w-6 justify-center rounded-full bg-orange-50 px-2 py-0.5 text-xs font-black text-orange-700">{s.pending}</span> : <span className="text-slate-300">0</span>}</td>
                    <td className="px-4 py-2.5 text-right"><Link to={`/encargado?edificio=${b.code}`} className="text-xs font-bold text-acento-osc hover:underline whitespace-nowrap">Abrir panel</Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-2">Cada encargado administra un solo edificio. En la lista solo aparecen los encargados libres; para mover a uno, primero déjalo &laquo;Sin encargado&raquo; en su edificio actual.</p>
        <NewBuilding onDone={(text) => setMsg({ kind: 'success', text })} />
      </section>

      <section className="mb-8">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <p className="eyebrow">Cuentas</p>
            <h2 className="section-title mt-1">Encargados</h2>
          </div>
          <span className="text-xs text-slate-400">{managers.filter((m) => !m.buildingCode).length} sin edificio</span>
        </div>
        {managers.length === 0 ? <div className="card p-6 text-center text-sm text-slate-400">Todavía no hay encargados. Crea uno con el formulario de abajo.</div> : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-navbar text-white text-left">
                <tr><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Correo</th><th className="px-4 py-3">Teléfono</th><th className="px-4 py-3">Edificio</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody>
                {managers.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-titulo">{m.name}</td>
                    <td className="px-4 py-2.5 break-all">{m.email}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{m.phone || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-2.5">{m.buildingCode ? <span className="font-black text-titulo">{m.buildingCode}</span> : <span className="text-xs font-bold text-amber-700">Sin edificio</span>}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button" onClick={() => removeManager(m)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 transition-colors" aria-label={`Eliminar cuenta de ${m.name}`}>
                        <IconTrash size={15} aria-hidden /> Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <NewManager onDone={(t) => setMsg({ kind: 'success', text: t })} />
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="eyebrow">Solicitudes</p>
              <h2 className="text-lg mt-1">Reclamos pendientes</h2>
            </div>
            <Link to="/encargado/reclamos" className="text-xs font-bold text-acento-osc hover:underline">Ver bandeja</Link>
          </div>
          {pending.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">No hay reclamos pendientes.</p> : (
            <ul className="flex flex-col gap-2">
              {pending.map((c) => {
                const item = db.items.find((i) => i.id === c.itemId)
                return (
                  <li key={c.id}>
                    <Link to={`/encargado/reclamos/${c.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 hover:border-acento/50 transition-colors text-sm">
                      <span className="min-w-0 truncate"><strong>{item?.title}</strong> · {item?.buildingCode} · {userName(db, c.studentId)}</span>
                      <ClaimStatusBadge status={c.status} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <p className="eyebrow">Inventario</p>
            <h2 className="section-title mt-1">Todos los objetos</h2>
          </div>
          <Link to="/bitacora" className="text-sm font-bold text-acento-osc hover:underline">Ver bitácora</Link>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-navbar text-white text-left">
              <tr><th className="px-4 py-3">Objeto</th><th className="px-4 py-3">Edificio</th><th className="px-4 py-3">Hallazgo</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {[...db.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((i) => (
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
                  <td className="px-4 py-3"><ItemStatusBadge status={i.status} /></td>
                  <td className="px-4 py-3 text-right"><Link to={`/objeto/${i.id}`} className="text-xs font-bold text-acento-osc hover:underline">Ver</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function NewManager({ onDone }: { onDone: (text: string) => void }) {
  const db = useDB()
  const blank = { name: '', email: '', matricula: '', buildingCode: '', phone: '', password: '' }
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!f.name.trim()) errs.name = 'El nombre es obligatorio.'
    const em = validateEmail(f.email); if (em) errs.email = em
    const m = validateMatricula(f.matricula); if (m) errs.matricula = m
    const p = validatePassword(f.password, f); if (p) errs.password = p
    setErrors(errs)
    if (Object.keys(errs).length || busy) return
    setBusy(true)
    try {
      const u = await createManager({ ...f, buildingCode: f.buildingCode || undefined })
      setF(blank)
      onDone(`Cuenta creada para ${u.name}. Comparte la contraseña inicial por un medio seguro; podrá cambiarla en su perfil.`)
    } catch (err) {
      setErrors({ form: err instanceof RuleError ? err.message : 'No se pudo crear la cuenta.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 flex flex-col gap-3" noValidate>
      <div>
        <p className="eyebrow">Cuentas</p>
        <h2 className="text-lg mt-1">Crear cuenta de encargado</h2>
      </div>
      {errors.form && <Alert kind="error">{errors.form}</Alert>}
      <Field label="Nombre" required error={errors.name} htmlFor="mn"><input id="mn" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Correo institucional" required error={errors.email} htmlFor="me"><input id="me" type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nombre@correo.buap.mx" /></Field>
        <Field label="Matrícula" required error={errors.matricula} htmlFor="mm"><input id="mm" className="input" inputMode="numeric" maxLength={9} value={f.matricula} onChange={(e) => setF({ ...f, matricula: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Edificio" htmlFor="mb">
          <select id="mb" className="input" value={f.buildingCode} onChange={(e) => setF({ ...f, buildingCode: e.target.value })}>
            <option value="">Asignar después</option>
            {db.buildings.map((b) => <option key={b.code} value={b.code}>{b.code}{b.managerId ? ' (reemplaza al actual)' : ''}</option>)}
          </select>
        </Field>
        <Field label="Teléfono" htmlFor="mp"><input id="mp" type="tel" className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Contraseña inicial" required error={errors.password} htmlFor="mpw" hint={`Mínimo ${PASSWORD_MIN} caracteres, con letras y números.`}>
          <input id="mpw" type="password" className="input" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
      </div>
      <button type="submit" disabled={busy} className="btn-primary self-start"><IconUserPlus size={18} /> Crear encargado</button>
    </form>
  )
}

function NewBuilding({ onDone }: { onDone: (text: string) => void }) {
  const db = useDB()
  const blank = { code: '', name: '', type: 'EMA' as BuildingType }
  const [f, setF] = useState(blank)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const code = f.code.trim().toUpperCase()
    if (!BUILDING_CODE_RE.test(code)) return setError('La clave debe empezar con letra y tener de 2 a 10 letras, números o guiones (por ejemplo, EMA11).')
    if (db.buildings.some((b) => b.code === code)) return setError(`Ya existe el edificio ${code}.`)
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await createBuilding({ code, name: f.name.trim() || undefined, type: f.type })
      setF(blank)
      onDone(`Edificio ${code} agregado. Ya puedes asignarle un encargado.`)
    } catch (err) {
      setError(err instanceof RuleError ? err.message : 'No se pudo agregar el edificio.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 mt-4 flex flex-col gap-3" noValidate>
      <div className="flex items-center gap-2">
        <IconBuilding size={18} className="text-acento-osc" aria-hidden />
        <h3 className="text-base font-black text-titulo">Agregar edificio</h3>
        <span className="text-xs text-slate-400">Para los edificios nuevos de CU2.</span>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="grid sm:grid-cols-[1fr_2fr_1fr_auto] gap-3 items-end">
        <Field label="Clave" required htmlFor="nb-code">
          <input id="nb-code" className="input uppercase" maxLength={10} value={f.code} placeholder="EMA11" onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} />
        </Field>
        <Field label="Nombre" htmlFor="nb-name">
          <input id="nb-name" className="input" maxLength={80} value={f.name} placeholder="Opcional" onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Tipo" htmlFor="nb-type">
          <select id="nb-type" className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as BuildingType })}>
            {BUILDING_TYPES.map((t) => <option key={t} value={t}>{BUILDING_TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <button type="submit" disabled={busy} className="btn-primary"><IconPlus size={18} aria-hidden /> Agregar</button>
      </div>
    </form>
  )
}

function RetentionCard({ onMessage }: { onMessage: (m: { kind: 'success' | 'error'; text: string }) => void }) {
  const db = useDB()
  const [busy, setBusy] = useState(false)
  const [now] = useState(() => new Date())
  const p = retentionPreview(db, now, 30)
  const cleanup = async () => {
    if (!window.confirm('¿Ejecutar ahora la limpieza de datos? Se depuran los objetos de más de 6 meses y se suspenden o eliminan las cuentas de alumno inactivas que ya cumplieron el plazo. No se puede deshacer.')) return
    setBusy(true)
    try {
      const r = await runCleanup()
      onMessage({ kind: 'success', text: `Limpieza ejecutada: ${r.objetosDepurados} objeto(s) depurado(s), ${r.cuentasSuspendidas} cuenta(s) suspendida(s) y ${r.cuentasEliminadas} eliminada(s).` })
    } catch (e) {
      onMessage({ kind: 'error', text: e instanceof RuleError ? e.message : 'No se pudo ejecutar la limpieza.' })
    } finally {
      setBusy(false)
    }
  }
  const tiles = [
    { label: 'Objetos por depurar', value: p.items, hint: `Cumplen ${RETENTION_MONTHS} meses en los próximos 30 días` },
    { label: 'Cuentas por suspender', value: p.toSuspend, hint: `Alumnos con ${RETENTION_MONTHS} meses sin entrar` },
    { label: 'Cuentas suspendidas', value: p.suspended, hint: `Se eliminan a los ${SUSPENSION_GRACE_DAYS} días si no se reactivan` },
  ]
  return (
    <section className="card p-5 mb-8 border-l-4 border-l-slate-400">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-600">
            <IconClockHour4 size={18} aria-hidden />
            <p className="text-xs font-black uppercase tracking-[0.12em]">Conservación de datos</p>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Los objetos salen del catálogo a los {RETENTION_MONTHS} meses de su hallazgo y se borran sus fotos y datos personales.
            Las cuentas de alumno sin actividad en {RETENTION_MONTHS} meses se suspenden y, si no se reactivan en {SUSPENSION_GRACE_DAYS} días, se eliminan.
            Se aplica automáticamente cada hora.
          </p>
        </div>
        <button type="button" onClick={cleanup} disabled={busy} className="btn-secondary shrink-0"><IconRefresh size={18} aria-hidden /> Ejecutar limpieza ahora</button>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <p className="text-xs font-bold text-slate-500">{t.label}</p>
            <p className="text-2xl font-black text-titulo mt-1">{t.value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{t.hint}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
