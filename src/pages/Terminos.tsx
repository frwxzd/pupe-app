import { IconCheck } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert } from '../components/ui'
import { acceptTerms, RuleError } from '../lib/actions'
import { useCurrentUser } from '../lib/auth'
import { CLAIM_DECLARATION, FINDER_DECLARATION, TERMS_TEXT, TERMS_VERSION } from '../lib/constants'
import { fmtDateTime } from '../lib/format'
import { useDB } from '../lib/storage'

export function TermsText() {
  return (
    <div className="border-l-4 border-acento bg-slate-50 rounded-xl p-5">
      <h2 className="text-lg mb-3">Términos y condiciones de uso · PUPE</h2>
      <ol className="list-decimal pl-5 flex flex-col gap-2 text-sm">
        {TERMS_TEXT.map((t, i) => <li key={i}>{t}</li>)}
      </ol>
      <h3 className="text-base mt-5 mb-2">Declaraciones adicionales</h3>
      <ul className="list-disc pl-5 flex flex-col gap-2 text-sm">
        <li><strong>Al reclamar:</strong> “{CLAIM_DECLARATION}”</li>
        <li><strong>Al entregar un objeto hallado:</strong> “{FINDER_DECLARATION}”</li>
      </ul>
    </div>
  )
}

export default function Terminos() {
  const user = useCurrentUser()
  const db = useDB()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/catalogo'
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const accepted = user ? db.terms.find((t) => t.userId === user.id && t.version === TERMS_VERSION) : undefined

  const accept = async () => {
    if (!user || !checked || busy) return
    setBusy(true)
    setError('')
    try {
      await acceptTerms()
      navigate(from, { replace: true })
    } catch (e) {
      setError(e instanceof RuleError ? e.message : 'No se pudieron registrar los términos.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page max-w-3xl">
      <p className="eyebrow">Legal</p>
      <h1 className="page-title mb-2">Términos y condiciones</h1>
      <p className="text-slate-600 mb-6">Versión {TERMS_VERSION}. Para ver el catálogo y reclamar objetos debes aceptarlos.</p>
      <TermsText />

      <div className="mt-6">
        {!user && <Alert kind="info">Inicia sesión para aceptar los términos. <Link to="/login" className="font-bold underline">Ir a iniciar sesión</Link></Alert>}
        {user && accepted && (
          <Alert kind="success">
            Aceptaste la versión {accepted.version} el {fmtDateTime(accepted.acceptedAt)}.{' '}
            <Link to="/catalogo" className="font-bold underline">Ir al catálogo</Link>
          </Alert>
        )}
        {user && !accepted && (
          <div className="card p-5 flex flex-col gap-4">
            {error && <Alert kind="error">{error}</Alert>}
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input type="checkbox" className="mt-1 size-5 accent-acento" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              <span>He leído y acepto los términos y condiciones de uso de PUPE (versión {TERMS_VERSION}).</span>
            </label>
            <button type="button" onClick={accept} disabled={!checked || busy} className="btn-primary self-start">
              <IconCheck size={18} aria-hidden /> Aceptar y continuar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function Privacidad() {
  return (
    <div className="page max-w-3xl">
      <h1 className="page-title mb-4">Aviso de privacidad</h1>
      <div className="card p-6 flex flex-col gap-3 text-sm">
        <p>PUPE recaba nombre, correo institucional, matrícula y, en su caso, teléfono, firma y datos de identificación, con el único fin de gestionar el resguardo y la devolución de objetos extraviados en CU2.</p>
        <p>Los datos sensibles (número de serie, IMEI, montos, últimos dígitos de tarjetas, identificaciones y teléfonos) nunca se muestran en el catálogo; solo los consultan los encargados para verificar la propiedad y registrar la entrega.</p>
        <p><strong>Plazos de conservación.</strong> Las publicaciones de objetos se retiran a los 6 meses de su hallazgo y en ese momento se eliminan sus fotos y datos personales. Las cuentas de alumno sin actividad durante 6 meses se suspenden, con aviso al correo institucional, y se eliminan junto con sus datos personales si no se reactivan en los 30 días siguientes. Las actas de entrega se conservan como comprobante.</p>
        <p>La información se guarda en el servidor de la plataforma. Las contraseñas se almacenan cifradas con Argon2id y nunca se comparten. Cada usuario solo recibe los datos que su rol le permite ver.</p>
        <Alert kind="warning">Texto de ejemplo para el prototipo académico. No sustituye el aviso de privacidad oficial de la BUAP.</Alert>
      </div>
    </div>
  )
}
