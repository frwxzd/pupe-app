import { IconFileCertificate } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Forbidden } from '../components/Guard'
import PhotoUploader from '../components/PhotoUploader'
import SignaturePad from '../components/SignaturePad'
import { Alert, BackLink, EmptyState, Field } from '../components/ui'
import { registerDelivery, RuleError } from '../lib/actions'
import { useCurrentUser } from '../lib/auth'
import { ID_TYPES } from '../lib/constants'
import { can } from '../lib/permissions'
import { StorageFullError, useDB } from '../lib/storage'
import { validateLast4, validateMatricula } from '../lib/validators'

export default function ActaEntrega() {
  const { claimId } = useParams()
  const db = useDB()
  const user = useCurrentUser()!
  const navigate = useNavigate()
  const claim = db.claims.find((c) => c.id === claimId)
  const item = claim ? db.items.find((i) => i.id === claim.itemId) : undefined
  const student = claim ? db.users.find((u) => u.id === claim.studentId) : undefined

  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({
    receiverName: student?.name ?? '',
    receiverMatricula: student?.matricula ?? '',
    idType: ID_TYPES[0],
    idLast4: '',
    condition: item?.condition ?? '',
    components: item?.components ?? '',
    witness: '',
    observations: '',
  })
  const [signature, setSignature] = useState('')
  const [photo, setPhoto] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!claim || !item) return <div className="page"><EmptyState title="Reclamo no encontrado" /></div>
  if (!can(user, 'registrar_entrega', item.buildingCode)) return <Forbidden text="Solo el encargado del edificio registra esta entrega." />
  if (claim.status !== 'aprobado') {
    return <div className="page max-w-2xl"><BackLink to={`/encargado/reclamos/${claim.id}`} /><Alert kind="warning">Solo se puede registrar la entrega de un reclamo aprobado. Estado actual: {claim.status}.</Alert></div>
  }

  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))

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
    if (!f.receiverName.trim()) errs.receiverName = 'Nombre del receptor obligatorio.'
    const m = validateMatricula(f.receiverMatricula); if (m) errs.receiverMatricula = m
    const l = validateLast4(f.idLast4); if (l) errs.idLast4 = l
    if (!f.condition.trim()) errs.condition = 'Registra la condición al momento de la entrega.'
    if (!f.components.trim()) errs.components = 'Registra los componentes entregados.'
    if (!signature) errs.signature = 'El receptor debe firmar.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      const d = await registerDelivery(claim.id, {
        receiverName: f.receiverName.trim(), receiverMatricula: f.receiverMatricula.trim(), idType: f.idType,
        idLast4: f.idLast4.trim(), signature, photo: photo[0], condition: f.condition.trim(), components: f.components.trim(),
        witness: f.witness.trim() || undefined, observations: f.observations.trim() || undefined,
      })
      navigate(`/acta/${d.id}`, { replace: true })
    } catch (err) {
      setErrors({ form: err instanceof RuleError || err instanceof StorageFullError ? err.message : 'No se pudo registrar la entrega.' })
    }
  }

  return (
    <div className="page max-w-3xl">
      <BackLink to={`/encargado/reclamos/${claim.id}`} label="Volver al reclamo" />
      <p className="eyebrow">Entrega</p>
      <h1 className="page-title mb-2">Acta de entrega</h1>
      <p className="text-slate-600 mb-6">Objeto: <strong>{item.title}</strong> · {item.buildingCode}. Al guardar, el objeto cambia a “Devuelto”.</p>

      <form onSubmit={submit} className="card p-6 flex flex-col gap-5" noValidate>
        {errors.form && <Alert kind="error">{errors.form}</Alert>}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nombre del receptor" required error={errors.receiverName} htmlFor="rn">
            <input id="rn" className="input" value={f.receiverName} onChange={(e) => set('receiverName', e.target.value)} />
          </Field>
          <Field
            label="Matrícula"
            required
            error={errors.receiverMatricula}
            htmlFor="rm"
            hint="Debe coincidir con el alumno que reclamó. Si no, no se puede generar el acta."
          >
            <input id="rm" className="input bg-slate-50" inputMode="numeric" maxLength={9} value={f.receiverMatricula} readOnly aria-readonly="true" />
          </Field>
          <Field label="Tipo de identificación" required htmlFor="it">
            <select id="it" className="input" value={f.idType} onChange={(e) => set('idType', e.target.value)}>
              {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Últimos 4 dígitos de la identificación" required error={errors.idLast4} htmlFor="l4">
            <input id="l4" className="input" inputMode="numeric" maxLength={4} value={f.idLast4} onChange={(e) => set('idLast4', e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>

        <Alert kind="warning">
          <strong>Protección legal:</strong> registra la condición y los componentes tal como se entregan. Así se evita que después se reclame que “faltaba una pieza”.
          {item.condition && <> Al recibirlo se registró: <em>{item.condition}</em>; componentes: <em>{item.components ?? '—'}</em>{!item.complete && <>; faltantes: <em>{item.missing}</em></>}.</>}
        </Alert>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Condición al entregar" required error={errors.condition} htmlFor="cd">
            <input id="cd" className="input" value={f.condition} onChange={(e) => set('condition', e.target.value)} />
          </Field>
          <Field label="Componentes entregados" required error={errors.components} htmlFor="cp">
            <input id="cp" className="input" value={f.components} onChange={(e) => set('components', e.target.value)} />
          </Field>
          <Field label="Testigo" htmlFor="ws"><input id="ws" className="input" value={f.witness} onChange={(e) => set('witness', e.target.value)} /></Field>
          <Field label="Observaciones" htmlFor="ob"><input id="ob" className="input" value={f.observations} onChange={(e) => set('observations', e.target.value)} /></Field>
        </div>
        <div>
          <span className="label">Foto del objeto entregado (opcional)</span>
          <PhotoUploader photos={photo} onChange={setPhoto} max={1} label="Tomar foto" />
        </div>
        <div>
          <span className="label">Firma del receptor <span className="text-red-600">*</span></span>
          <SignaturePad onChange={setSignature} label="Firma del receptor" />
          {errors.signature && <p className="field-error">{errors.signature}</p>}
        </div>
        <button type="submit" disabled={busy} className="btn-success self-start text-base"><IconFileCertificate size={20} /> Registrar entrega y generar acta</button>
      </form>
    </div>
  )
}
