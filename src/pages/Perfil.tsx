import { IconDeviceFloppy, IconKey, IconLogout } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Field, InfoRow, PageHeader } from '../components/ui'
import { RuleError, updateProfile } from '../lib/actions'
import { changePassword, logout, useCurrentUser } from '../lib/auth'
import { ROLE_LABEL, TERMS_VERSION } from '../lib/constants'
import { fmtDateTime } from '../lib/format'
import { useDB } from '../lib/storage'
import { PASSWORD_MIN, validatePassword } from '../lib/validators'

export default function Perfil() {
  const user = useCurrentUser()!
  const db = useDB()
  const navigate = useNavigate()
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const terms = db.terms.filter((t) => t.userId === user.id).at(-1)

  const save = async () => {
    try {
      await updateProfile({ name, phone })
      setMsg({ kind: 'success', text: 'Perfil actualizado.' })
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof RuleError ? e.message : 'No se pudo guardar.' })
    }
  }

  return (
    <div className="page max-w-3xl">
      <PageHeader eyebrow="Cuenta" title="Mi perfil" actions={<button className="btn-secondary" onClick={async () => { await logout(); navigate('/login') }}><IconLogout size={18} /> Cerrar sesión</button>} />
      <div className="grid md:grid-cols-2 gap-6">
        <dl className="card p-5">
          <InfoRow label="Correo">{user.email}</InfoRow>
          <InfoRow label="Matrícula">{user.matricula}</InfoRow>
          <InfoRow label="Rol">{ROLE_LABEL[user.role]}</InfoRow>
          <InfoRow label="Edificio asignado">{user.buildingCode ?? (user.role === 'student' ? 'No aplica' : 'Sin asignar')}</InfoRow>
          <InfoRow label="Términos">{terms ? `v${terms.version} · ${fmtDateTime(terms.acceptedAt)}` : (user.role === 'student' ? `Pendiente (v${TERMS_VERSION})` : 'No requeridos')}</InfoRow>
        </dl>
        <div className="card p-5 flex flex-col gap-3">
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
          <Field label="Nombre" required htmlFor="pn"><input id="pn" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Teléfono" htmlFor="pp" hint="Opcional."><input id="pp" type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <button type="button" className="btn-primary self-start" onClick={save}><IconDeviceFloppy size={18} /> Guardar</button>
        </div>
        <PasswordCard />
      </div>
    </div>
  )
}

function PasswordCard() {
  const user = useCurrentUser()!
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const errs: Record<string, string> = {}
    if (!current) errs.current = 'Escribe tu contraseña actual.'
    const p = validatePassword(next, user)
    if (p) errs.next = p
    else if (next !== confirm) errs.confirm = 'Las contraseñas no coinciden.'
    setErrors(errs)
    setDone(false)
    if (Object.keys(errs).length) return
    setBusy(true)
    const res = await changePassword(current, next)
    setBusy(false)
    if (!res.ok) {
      setErrors(res.errors)
      return
    }
    setCurrent('')
    setNext('')
    setConfirm('')
    setDone(true)
  }

  return (
    <form onSubmit={submit} className="card p-5 flex flex-col gap-3 md:col-span-2" noValidate>
      <div>
        <p className="eyebrow">Seguridad</p>
        <h2 className="text-lg mt-1">Cambiar contraseña</h2>
        <p className="text-sm text-slate-500 mt-1">Al cambiarla se cierran tus sesiones abiertas en otros dispositivos.</p>
      </div>
      {done && <Alert kind="success">Contraseña actualizada.</Alert>}
      {errors.form && <Alert kind="error">{errors.form}</Alert>}
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Contraseña actual" required error={errors.current} htmlFor="pw-cur">
          <input id="pw-cur" type="password" className="input" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="Nueva contraseña" required error={errors.next} htmlFor="pw-new" hint={`Mínimo ${PASSWORD_MIN} caracteres, con letras y números.`}>
          <input id="pw-new" type="password" className="input" autoComplete="new-password" maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Confirmar contraseña" required error={errors.confirm} htmlFor="pw-conf">
          <input id="pw-conf" type="password" className="input" autoComplete="new-password" maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
      </div>
      <button type="submit" disabled={busy} className="btn-secondary self-start"><IconKey size={18} aria-hidden /> Cambiar contraseña</button>
    </form>
  )
}
