import { IconSend } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import PhotoUploader from '../components/PhotoUploader'
import { Alert, BackLink, EmptyState, Field } from '../components/ui'
import { activeClaimFor, claimableItem, RuleError, submitClaim } from '../lib/actions'
import { hasAcceptedTerms, useCurrentUser } from '../lib/auth'
import { CLAIM_DECLARATION } from '../lib/constants'
import { fmtDate } from '../lib/format'
import { can } from '../lib/permissions'
import { StorageFullError, useDB } from '../lib/storage'

export default function Reclamo() {
  const { id } = useParams()
  const user = useCurrentUser()!
  const db = useDB()
  const navigate = useNavigate()
  const location = useLocation()
  const item = db.items.find((i) => i.id === id)

  const [marks, setMarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [approxDate, setApproxDate] = useState('')
  const [serialModel, setSerialModel] = useState('')
  const [evidenceText, setEvidenceText] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [declaration, setDeclaration] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [maxDate] = useState(() => new Date().toISOString().slice(0, 10))

  if (!item) return <div className="page"><EmptyState title="Objeto no encontrado" /></div>
  if (!can(user, 'enviar_reclamo')) return <Navigate to={`/objeto/${item.id}`} replace />
  // Los términos son obligatorios para reclamar, también para el super admin.
  if (!hasAcceptedTerms(db, user)) return <Navigate to="/terminos" replace state={{ from: location.pathname }} />

  const existing = activeClaimFor(db, item.id, user.id)
  if (existing || !claimableItem(item)) {
    return (
      <div className="page max-w-2xl">
        <BackLink to={`/objeto/${item.id}`} />
        <Alert kind="info">
          {existing ? 'Ya tienes un reclamo activo sobre este objeto.' : 'Este objeto ya no se puede reclamar.'}{' '}
          <Link to="/mis-reclamos" className="font-bold underline">Ver mis reclamos</Link>
        </Alert>
      </div>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      await submitForm(e)
    } finally {
      setBusy(false)
    }
  }

  const submitForm = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (marks.trim().length < 10) errs.marks = 'Describe marcas distintivas (mínimo 10 caracteres).'
    if (!approxDate) errs.approxDate = 'Indica la fecha aproximada en que lo perdiste.'
    if (!declaration) errs.declaration = 'Debes aceptar la declaración para enviar el reclamo.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      await submitClaim(item.id, {
        marks: marks.trim(), approxDate, serialModel: serialModel.trim() || undefined,
        evidenceText: evidenceText.trim() || undefined, evidencePhotos: photos, declarationAccepted: declaration,
      })
      navigate('/mis-reclamos', { state: { sent: true } })
    } catch (err) {
      setErrors({ form: err instanceof RuleError || err instanceof StorageFullError ? err.message : 'No se pudo enviar el reclamo.' })
    }
  }

  return (
    <div className="page max-w-3xl">
      <BackLink to={`/objeto/${item.id}`} label="Volver al objeto" />
      <p className="eyebrow">Reclamo</p>
      <h1 className="page-title">Reclamar objeto</h1>
      <div className="card p-4 mt-4 mb-6 flex items-center gap-4">
        <img src={item.photos[0]} alt="" className="size-16 rounded-lg object-cover" />
        <div className="min-w-0">
          <p className="font-bold text-titulo">{item.title}</p>
          <p className="text-sm text-slate-500">{item.buildingCode} · encontrado el {fmtDate(item.foundAt)}</p>
        </div>
      </div>

      <form onSubmit={submit} className="card p-6 flex flex-col gap-5" noValidate>
        {errors.form && <Alert kind="error">{errors.form}</Alert>}
        <Field label="Marcas distintivas" required error={errors.marks} htmlFor="marks" hint="Detalles que solo el dueño conoce: rayones, calcomanías, contenido, iniciales…">
          <textarea id="marks" rows={4} className="input" value={marks} onChange={(e) => setMarks(e.target.value)} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Fecha aproximada de pérdida" required error={errors.approxDate} htmlFor="date">
            <input id="date" type="date" className="input" value={approxDate} max={maxDate} onChange={(e) => setApproxDate(e.target.value)} />
          </Field>
          <Field label="Número de serie o modelo" htmlFor="serial" hint="Opcional. Ayuda a verificar electrónicos.">
            <input id="serial" className="input" value={serialModel} onChange={(e) => setSerialModel(e.target.value)} />
          </Field>
        </div>
        <Field label="Evidencia (descripción)" htmlFor="evid" hint="Opcional. Ej.: ticket de compra, foto donde aparezcas con el objeto.">
          <textarea id="evid" rows={2} className="input" value={evidenceText} onChange={(e) => setEvidenceText(e.target.value)} />
        </Field>
        <div>
          <span className="label">Fotos de evidencia (opcional)</span>
          <PhotoUploader photos={photos} onChange={setPhotos} max={3} label="Agregar evidencia" />
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1 size-5 accent-acento" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} />
            <span>“{CLAIM_DECLARATION}”</span>
          </label>
          {errors.declaration && <p className="field-error">{errors.declaration}</p>}
        </div>
        <button type="submit" disabled={busy} className="btn-primary self-start"><IconSend size={18} aria-hidden /> Enviar reclamo</button>
      </form>
    </div>
  )
}
