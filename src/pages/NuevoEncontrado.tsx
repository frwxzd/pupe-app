import { IconDeviceFloppy } from '@tabler/icons-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Forbidden } from '../components/Guard'
import PhotoUploader from '../components/PhotoUploader'
import SignaturePad from '../components/SignaturePad'
import { Alert, BackLink, EmptyState, Field } from '../components/ui'
import { publishItem, RuleError, updateItem, type ItemInput } from '../lib/actions'
import { useCurrentUser } from '../lib/auth'
import { CATEGORIES, FINDER_DECLARATION, MAX_PHOTOS, PROTECTED_PHOTO, SENSITIVE_LABEL } from '../lib/constants'
import { toLocalInput } from '../lib/format'
import { can } from '../lib/permissions'
import { staffBuildings } from '../lib/queries'
import { StorageFullError, useDB } from '../lib/storage'
import type { Item, SensitiveType } from '../lib/types'
import { validateEmail, validateMatricula } from '../lib/validators'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="card p-6 flex flex-col gap-4">
      <legend className="sr-only">{title}</legend>
      <h2 className="text-lg">{title}</h2>
      {children}
    </fieldset>
  )
}

export default function NuevoEncontrado() {
  const { id } = useParams()
  const db = useDB()
  const user = useCurrentUser()!
  const editing = id ? db.items.find((i) => i.id === id) : undefined

  if (id && !editing) return <div className="page"><EmptyState title="Objeto no encontrado" /></div>
  if (editing && !can(user, 'editar_objeto', editing.buildingCode)) return <Forbidden text="Solo puedes editar objetos de tu edificio." />
  if (!editing && !can(user, 'publicar_objeto')) return <Forbidden text="Solo los encargados publican objetos encontrados." />
  if (editing && editing.status === 'devuelto') {
    return <div className="page"><Alert kind="info">Este objeto ya fue devuelto; su registro no se puede modificar.</Alert></div>
  }
  return <ItemForm key={id ?? 'nuevo'} editing={editing} />
}

function ItemForm({ editing }: { editing?: Item }) {
  const db = useDB()
  const user = useCurrentUser()!
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const buildings = staffBuildings(db, user)
  const defaultBuilding = editing?.buildingCode
    ?? (buildings.includes(params.get('edificio') ?? '') ? params.get('edificio')! : (user.buildingCode && buildings.includes(user.buildingCode) ? user.buildingCode : buildings[0]))

  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({
    title: editing?.title ?? '',
    category: editing?.category ?? '',
    description: editing?.description ?? '',
    brand: editing?.brand ?? '',
    model: editing?.model ?? '',
    color: editing?.color ?? '',
    foundAt: editing ? toLocalInput(new Date(editing.foundAt)) : toLocalInput(),
    buildingCode: defaultBuilding ?? '',
    floorZone: editing?.floorZone ?? '',
    storageLocation: editing?.storageLocation ?? '',
    condition: editing?.condition ?? '',
    components: editing?.components ?? '',
    missing: editing?.missing ?? '',
    complete: editing?.complete ?? true,
    notes: editing?.notes ?? '',
    sensitive: editing?.sensitive ?? false,
  })
  const [photos, setPhotos] = useState<string[]>(editing?.photos.filter((p) => p !== PROTECTED_PHOTO) ?? [])
  const [priv, setPriv] = useState({
    sensitiveType: (editing?.privateData?.sensitiveType ?? 'valor') as SensitiveType,
    amount: editing?.privateData?.amount ?? '',
    countedBy: editing?.privateData?.countedBy ?? '',
    serial: editing?.privateData?.serial ?? '',
    imei: editing?.privateData?.imei ?? '',
    last4: editing?.privateData?.last4 ?? '',
    legalNotes: editing?.privateData?.legalNotes ?? '',
  })
  const [finder, setFinder] = useState({ name: '', matricula: '', email: '', phone: '', observations: '', declarationAccepted: false })
  const [signature, setSignature] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))
  // Identificaciones y tarjetas nunca se publican con foto.
  const noPhotos = f.sensitive && priv.sensitiveType === 'identificacion'

  const validate = () => {
    const e: Record<string, string> = {}
    if (!f.title.trim()) e.title = 'El título es obligatorio.'
    if (!f.category) e.category = 'Elige una categoría.'
    if (!f.description.trim()) e.description = 'La descripción es obligatoria.'
    if (!f.foundAt) e.foundAt = 'Indica fecha y hora del hallazgo.'
    else if (new Date(f.foundAt) > new Date()) e.foundAt = 'La fecha no puede ser futura.'
    if (!f.buildingCode) e.buildingCode = 'Elige el edificio.'
    if (!f.floorZone.trim()) e.floorZone = 'Indica piso, zona o salón.'
    if (!f.storageLocation.trim()) e.storageLocation = 'Indica el lugar de resguardo.'
    if (!noPhotos && photos.length === 0) e.photos = 'Agrega al menos una foto.'
    if (!f.complete && !f.missing.trim()) e.missing = 'Describe qué le falta al objeto.'
    if (f.sensitive) {
      if (priv.sensitiveType === 'dinero' && !priv.amount.trim()) e.amount = 'Registra el monto (dato privado).'
      if (priv.sensitiveType === 'dinero' && !priv.countedBy.trim()) e.countedBy = 'El dinero se cuenta con dos personas.'
      if (priv.sensitiveType === 'identificacion' && priv.last4 && !/^\d{4}$/.test(priv.last4)) e.last4 = 'Deben ser 4 dígitos.'
    }
    if (!editing) {
      if (!finder.name.trim()) e.finderName = 'El nombre del hallador es obligatorio.'
      const m = validateMatricula(finder.matricula); if (m) e.finderMatricula = m
      const em = validateEmail(finder.email); if (em) e.finderEmail = em
      if (!signature) e.signature = 'El hallador debe firmar.'
      if (!finder.declarationAccepted) e.declaration = 'El hallador debe aceptar la declaración.'
    }
    return e
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      await submitForm(ev)
    } finally {
      setBusy(false)
    }
  }

  const submitForm = async (ev: FormEvent) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const input: ItemInput = {
      title: f.title.trim(), category: f.category, description: f.description.trim(),
      brand: f.brand.trim() || undefined, model: f.model.trim() || undefined, color: f.color.trim() || undefined,
      foundAt: new Date(f.foundAt).toISOString(), buildingCode: f.buildingCode,
      floorZone: f.floorZone.trim(), storageLocation: f.storageLocation.trim(),
      condition: f.condition.trim() || undefined, components: f.components.trim() || undefined,
      missing: f.complete ? undefined : f.missing.trim(), complete: f.complete, notes: f.notes.trim() || undefined,
      photos: noPhotos ? [PROTECTED_PHOTO] : photos,
      sensitive: f.sensitive,
      privateData: f.sensitive ? {
        sensitiveType: priv.sensitiveType,
        amount: priv.amount.trim() || undefined, countedBy: priv.countedBy.trim() || undefined,
        serial: priv.serial.trim() || undefined, imei: priv.imei.trim() || undefined,
        last4: priv.last4.trim() || undefined, legalNotes: priv.legalNotes.trim() || undefined,
      } : undefined,
    }
    try {
      if (editing) {
        await updateItem(editing.id, input)
        navigate(`/objeto/${editing.id}`)
      } else {
        const item = await publishItem(input, {
          name: finder.name.trim(), matricula: finder.matricula.trim(), email: finder.email.trim().toLowerCase(),
          phone: finder.phone.trim() || undefined, observations: finder.observations.trim() || undefined,
          deliveredAt: new Date().toISOString(), signature, declarationAccepted: finder.declarationAccepted,
        })
        navigate(`/encargado/recibo/${item.id}`, { state: { created: true } })
      }
    } catch (err) {
      setErrors({ form: err instanceof RuleError || err instanceof StorageFullError ? err.message : 'No se pudo guardar.' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const errorCount = Object.keys(errors).length

  return (
    <div className="page max-w-4xl">
      <BackLink to={editing ? `/objeto/${editing.id}` : '/encargado'} />
      <p className="eyebrow">{editing ? 'Edición' : 'Publicación'}</p>
      <h1 className="page-title mb-2">{editing ? 'Editar objeto' : 'Nuevo objeto encontrado'}</h1>
      <p className="text-slate-600 mb-6">{editing ? 'Los cambios quedan registrados en la bitácora.' : 'Registra el objeto que te entregó el hallador. Al guardar se genera el folio de recibo y el objeto queda “En resguardo”.'}</p>

      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        {errors.form && <Alert kind="error">{errors.form}</Alert>}
        {errorCount > 0 && !errors.form && <Alert kind="error">Revisa los {errorCount} campos marcados.</Alert>}

        <Section title="1. Objeto sensible">
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1 size-5 accent-acento" checked={f.sensitive} onChange={(e) => set('sensitive', e.target.checked)} />
            <span><strong>Es un objeto sensible</strong> (dinero, identificación, tarjeta, electrónico con serie u objeto de valor). Sus datos privados no aparecen en el catálogo.</span>
          </label>
          {f.sensitive && (
            <div className="grid sm:grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4">
              <Field label="Tipo de objeto sensible" required htmlFor="stype">
                <select id="stype" className="input" value={priv.sensitiveType} onChange={(e) => setPriv({ ...priv, sensitiveType: e.target.value as SensitiveType })}>
                  {(Object.keys(SENSITIVE_LABEL) as SensitiveType[]).map((k) => <option key={k} value={k}>{SENSITIVE_LABEL[k]}</option>)}
                </select>
              </Field>
              {priv.sensitiveType === 'dinero' && (
                <>
                  <Field label="Monto (privado)" required error={errors.amount} htmlFor="amount" hint="No se publica.">
                    <input id="amount" className="input" value={priv.amount} onChange={(e) => setPriv({ ...priv, amount: e.target.value })} placeholder="$0.00" />
                  </Field>
                  <Field label="Segunda persona que contó" required error={errors.countedBy} htmlFor="counted">
                    <input id="counted" className="input" value={priv.countedBy} onChange={(e) => setPriv({ ...priv, countedBy: e.target.value })} />
                  </Field>
                </>
              )}
              {priv.sensitiveType === 'identificacion' && (
                <Field label="Últimos 4 dígitos" error={errors.last4} htmlFor="last4" hint="No se publican fotos de identificaciones.">
                  <input id="last4" className="input" inputMode="numeric" maxLength={4} value={priv.last4} onChange={(e) => setPriv({ ...priv, last4: e.target.value.replace(/\D/g, '') })} />
                </Field>
              )}
              {(priv.sensitiveType === 'electronico' || priv.sensitiveType === 'valor') && (
                <>
                  <Field label="Número de serie (privado)" htmlFor="serial">
                    <input id="serial" className="input" value={priv.serial} onChange={(e) => setPriv({ ...priv, serial: e.target.value })} />
                  </Field>
                  <Field label="IMEI (privado)" htmlFor="imei">
                    <input id="imei" className="input" value={priv.imei} onChange={(e) => setPriv({ ...priv, imei: e.target.value })} />
                  </Field>
                </>
              )}
              <div className="sm:col-span-2">
                <Field label="Notas legales (privadas)" htmlFor="legal">
                  <textarea id="legal" rows={2} className="input" value={priv.legalNotes} onChange={(e) => setPriv({ ...priv, legalNotes: e.target.value })} />
                </Field>
              </div>
            </div>
          )}
        </Section>

        <Section title="2. Fotos">
          {noPhotos ? (
            <Alert kind="info">Para identificaciones y tarjetas no se publican fotos. El catálogo mostrará una imagen genérica de “foto protegida”.</Alert>
          ) : (
            <>
              <PhotoUploader photos={photos} onChange={setPhotos} max={MAX_PHOTOS} />
              {errors.photos && <p className="field-error">{errors.photos}</p>}
            </>
          )}
        </Section>

        <Section title="3. Datos del objeto">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Título" required error={errors.title} htmlFor="title">
              <input id="title" className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ej. Mochila roja Nike" />
            </Field>
            <Field label="Categoría" required error={errors.category} htmlFor="cat">
              <select id="cat" className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Elige…</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Descripción pública" required error={errors.description} htmlFor="desc" hint="No escribas datos que permitan reclamos falsos (serie, nombre, contenido exacto).">
            <textarea id="desc" rows={3} className="input" value={f.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Marca" htmlFor="brand"><input id="brand" className="input" value={f.brand} onChange={(e) => set('brand', e.target.value)} /></Field>
            <Field label="Modelo" htmlFor="model" hint="Privado"><input id="model" className="input" value={f.model} onChange={(e) => set('model', e.target.value)} /></Field>
            <Field label="Color" htmlFor="color"><input id="color" className="input" value={f.color} onChange={(e) => set('color', e.target.value)} /></Field>
          </div>
        </Section>

        <Section title="4. Hallazgo y resguardo">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Fecha y hora del hallazgo" required error={errors.foundAt} htmlFor="found">
              <input id="found" type="datetime-local" className="input" value={f.foundAt} max={toLocalInput()} onChange={(e) => set('foundAt', e.target.value)} />
            </Field>
            <Field label="Edificio" required error={errors.buildingCode} htmlFor="bld">
              <select id="bld" className="input" value={f.buildingCode} onChange={(e) => set('buildingCode', e.target.value)} disabled={buildings.length <= 1}>
                {buildings.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Piso, zona o salón" required error={errors.floorZone} htmlFor="zone">
              <input id="zone" className="input" value={f.floorZone} onChange={(e) => set('floorZone', e.target.value)} placeholder="Ej. Piso 2 · salón 204" />
            </Field>
            <Field label="Lugar de resguardo" required error={errors.storageLocation} htmlFor="storage">
              <input id="storage" className="input" value={f.storageLocation} onChange={(e) => set('storageLocation', e.target.value)} placeholder="Ej. Locker 3 de la coordinación" />
            </Field>
          </div>
        </Section>

        <Section title="5. Condición y componentes">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Condición" htmlFor="cond"><input id="cond" className="input" value={f.condition} onChange={(e) => set('condition', e.target.value)} placeholder="Ej. Buena, con rayones" /></Field>
            <Field label="Componentes" htmlFor="comp" hint="Lista de lo que se recibió."><input id="comp" className="input" value={f.components} onChange={(e) => set('components', e.target.value)} placeholder="Ej. Celular, funda" /></Field>
          </div>
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <input type="checkbox" className="size-5 accent-acento" checked={f.complete} onChange={(e) => set('complete', e.target.checked)} />
            El objeto está completo
          </label>
          {!f.complete && (
            <Field label="Faltantes" required error={errors.missing} htmlFor="missing">
              <input id="missing" className="input" value={f.missing} onChange={(e) => set('missing', e.target.value)} />
            </Field>
          )}
          <Field label="Notas internas" htmlFor="notes"><textarea id="notes" rows={2} className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </Section>

        {!editing && (
          <Section title="6. Datos del hallador y recibo">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nombre del hallador" required error={errors.finderName} htmlFor="fname">
                <input id="fname" className="input" value={finder.name} onChange={(e) => setFinder({ ...finder, name: e.target.value })} />
              </Field>
              <Field label="Matrícula" required error={errors.finderMatricula} htmlFor="fmat">
                <input id="fmat" className="input" inputMode="numeric" maxLength={9} value={finder.matricula} onChange={(e) => setFinder({ ...finder, matricula: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label="Correo institucional" required error={errors.finderEmail} htmlFor="femail">
                <input id="femail" type="email" className="input" value={finder.email} onChange={(e) => setFinder({ ...finder, email: e.target.value })} />
              </Field>
              <Field label="Teléfono" htmlFor="fphone" hint="Privado, nunca se muestra en el catálogo.">
                <input id="fphone" type="tel" className="input" value={finder.phone} onChange={(e) => setFinder({ ...finder, phone: e.target.value })} />
              </Field>
            </div>
            <Field label="Observaciones" htmlFor="fobs"><textarea id="fobs" rows={2} className="input" value={finder.observations} onChange={(e) => setFinder({ ...finder, observations: e.target.value })} /></Field>
            <div>
              <span className="label">Firma del hallador <span className="text-red-600">*</span></span>
              <SignaturePad onChange={setSignature} label="Firma del hallador" />
              {errors.signature && <p className="field-error">{errors.signature}</p>}
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <input type="checkbox" className="mt-1 size-5 accent-acento" checked={finder.declarationAccepted} onChange={(e) => setFinder({ ...finder, declarationAccepted: e.target.checked })} />
                <span>El hallador declara: “{FINDER_DECLARATION}”</span>
              </label>
              {errors.declaration && <p className="field-error">{errors.declaration}</p>}
            </div>
          </Section>
        )}

        <button type="submit" disabled={busy} className="btn-primary self-start text-base">
          <IconDeviceFloppy size={20} /> {editing ? 'Guardar cambios' : 'Guardar, generar recibo y publicar'}
        </button>
      </form>
    </div>
  )
}
