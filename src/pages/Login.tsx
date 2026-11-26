import {
  IconBuilding, IconEye, IconEyeOff, IconLock, IconLogin, IconSearch, IconShieldCheck,
  IconKey, IconMailCheck, IconSparkles, IconUserPlus,
} from '@tabler/icons-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Turnstile } from '../components/Turnstile'
import { Alert, Field } from '../components/ui'
import { useAppConfig } from '../lib/api'
import {
  login, registerStudent, requestPasswordReset, resendEmailCode, resendPasswordReset, resetPassword, useCurrentUser, verifyEmail,
} from '../lib/auth'
import { ALLOWED_DOMAINS } from '../lib/constants'
import { PASSWORD_MIN, validateEmail, validateMatricula, validatePassword } from '../lib/validators'

type Mode = 'login' | 'register'

export default function Login() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [matricula, setMatricula] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [notice, setNotice] = useState('')
  const config = useAppConfig()
  const [captcha, setCaptcha] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)
  const siteKey = config?.captchaSiteKey ?? null

  if (user) return <Navigate to={from} replace />

  const validate = () => {
    const e: Record<string, string> = {}
    const em = validateEmail(email)
    if (em) e.email = em
    if (mode === 'login') {
      if (!password) e.password = 'Escribe tu contraseña.'
    } else {
      if (!name.trim()) e.name = 'El nombre es obligatorio.'
      const m = validateMatricula(matricula)
      if (m) e.matricula = m
      const p = validatePassword(password, { email, matricula })
      if (p) e.password = p
    }
    if (siteKey && !captcha) e.form = 'Espera a que termine la verificación de seguridad.'
    return e
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    const res = mode === 'login'
      ? await login(email, password, captcha)
      : await registerStudent({ name, email, matricula, password, captcha })
    setBusy(false)
    if (!res.ok) {
      setErrors(res.errors)
      setPassword('')
      // Cada token de captcha sirve una sola vez.
      if (siteKey) setCaptchaReset((n) => n + 1)
      return
    }
    if (res.pending) {
      setPassword('')
      setErrors({})
      setPendingEmail(email.trim().toLowerCase())
      return
    }
    navigate(from, { replace: true })
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setErrors({})
    setPassword('')
  }

  return (
    <div className="page">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-6 xl:gap-8 items-stretch">
        <section className="relative hidden lg:flex flex-col justify-between overflow-hidden rounded-3xl bg-[#06283D] p-9 xl:p-11 text-white min-h-[640px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(0,181,226,0.28),transparent_45%),radial-gradient(circle_at_10%_90%,rgba(0,181,226,0.10),transparent_40%)]" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.65) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.65) 1px, transparent 1px)', backgroundSize: '48px 48px' }}
          />
          <div className="relative">
            <div className="flex items-center gap-3">
              <img src="/brand/buap-white.svg" alt="Escudo BUAP" className="h-12 w-12" />
              <span className="h-8 w-px bg-white/20" aria-hidden />
              <img src="/brand/cu2.png" alt="CU2" className="h-8 w-auto" />
              <span className="text-white/60 text-xs font-black tracking-[0.18em] uppercase">PUPE</span>
            </div>
            <p className="mt-10 eyebrow text-cyan-300">Ciudad Universitaria 2 · BUAP</p>
            <h1 className="mt-3 text-4xl xl:text-5xl font-black leading-[1.05] tracking-tight text-white text-balance">
              Plataforma de objetos perdidos y encontrados
            </h1>
            <p className="mt-4 text-slate-300 max-w-md">
              Consulta, reclama y recupera objetos resguardados en los edificios de CU2.
            </p>
          </div>

          <div className="relative grid gap-3 max-w-md">
            {[
              { icon: IconSearch, title: 'Busca en todo CU2', text: 'Filtra por edificio, categoría o fecha.' },
              { icon: IconShieldCheck, title: 'Resguardo seguro', text: 'Cada objeto lo publica un encargado.' },
              { icon: IconBuilding, title: 'Entrega con acta', text: 'Firma, identificación y condición registradas.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                <span className="size-9 shrink-0 rounded-lg bg-cyan-400/10 text-cyan-300 flex items-center justify-center"><Icon size={18} aria-hidden /></span>
                <div>
                  <p className="text-sm font-bold text-white">{title}</p>
                  <p className="text-xs text-white/50 mt-0.5">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative flex items-center gap-3 text-xs text-white/40">
            <IconSparkles size={15} className="text-cyan-300" aria-hidden />
            <span>Prototipo académico · Ciudad Universitaria 2</span>
          </div>
        </section>

        <section className="card p-6 sm:p-8 xl:p-10 w-full max-w-xl mx-auto lg:max-w-none flex flex-col justify-center">
          <div className="flex lg:hidden items-center gap-3 mb-6">
            <img src="/brand/buap.svg" alt="Escudo BUAP" className="h-12 w-12" />
            <span className="h-7 w-px bg-slate-200" aria-hidden />
            <img src="/brand/cu2.png" alt="CU2" className="h-7 w-auto" />
          </div>

          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="eyebrow">Acceso institucional</p>
              <h2 className="text-2xl font-black mt-1">{resetting ? 'Recuperar contraseña' : pendingEmail ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
              <p className="text-sm text-slate-500 mt-1">
                {resetting ? 'Te enviaremos un código a tu correo BUAP.' : pendingEmail ? 'Último paso: confirma que el correo es tuyo.' : 'Usa tu correo BUAP y tu contraseña.'}
              </p>
            </div>
            <span className="size-11 rounded-xl bg-cyan-50 text-acento-osc ring-1 ring-inset ring-cyan-100 flex items-center justify-center">
              <IconLock size={22} aria-hidden />
            </span>
          </div>

          {resetting ? (
            <ResetFlow
              siteKey={siteKey}
              initialEmail={email}
              onDone={(resetEmail) => {
                setResetting(false)
                setMode('login')
                setEmail(resetEmail)
                setPassword('')
                setErrors({})
                setNotice('Tu contraseña se actualizó y se cerraron tus sesiones abiertas. Inicia sesión con la nueva.')
                if (siteKey) setCaptchaReset((n) => n + 1)
              }}
              onCancel={() => {
                setResetting(false)
                if (siteKey) setCaptchaReset((n) => n + 1)
              }}
            />
          ) : pendingEmail ? (
            <VerifyStep
              email={pendingEmail}
              onVerified={() => navigate(from, { replace: true })}
              onBack={() => {
                setPendingEmail(null)
                if (siteKey) setCaptchaReset((n) => n + 1)
              }}
            />
          ) : (<>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 mb-6" role="tablist">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`min-h-11 rounded-lg text-sm font-bold cursor-pointer transition-all ${mode === m ? 'bg-white shadow-sm text-titulo' : 'text-slate-500 hover:text-titulo'}`}
              >
                {m === 'login' ? 'Iniciar sesión' : 'Registrarme'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {notice && mode === 'login' && <Alert kind="success">{notice}</Alert>}
            {errors.form && <Alert kind="error">{errors.form}</Alert>}
            {mode === 'register' && (
              <Field label="Nombre completo" error={errors.name} required htmlFor="name">
                <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
            )}
            <Field label="Correo institucional" error={errors.email} required htmlFor="email" hint={ALLOWED_DOMAINS.map((d) => '@' + d).join(' · ')}>
              <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="202123456@alumno.buap.mx" />
            </Field>
            {mode === 'register' && (
              <Field label="Matrícula" error={errors.matricula} required htmlFor="matricula" hint="9 dígitos que empiezan con 202.">
                <input id="matricula" inputMode="numeric" maxLength={9} className="input" value={matricula} onChange={(e) => setMatricula(e.target.value.replace(/\D/g, ''))} autoComplete="off" />
              </Field>
            )}
            <Field
              label="Contraseña"
              error={errors.password}
              required
              htmlFor="password"
              hint={mode === 'register' ? `Mínimo ${PASSWORD_MIN} caracteres, con letras y números. No uses tu matrícula.` : undefined}
            >
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-12"
                  value={password}
                  maxLength={128}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-slate-400 hover:text-titulo cursor-pointer"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <IconEyeOff size={18} aria-hidden /> : <IconEye size={18} aria-hidden />}
                </button>
              </div>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => { setResetting(true); setErrors({}); setNotice('') }}
                  className="mt-2 text-xs font-bold text-acento-osc hover:underline cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </Field>
            {siteKey && (
              <Turnstile
                siteKey={siteKey}
                onToken={setCaptcha}
                resetKey={captchaReset}
                onError={(m) => setErrors((prev) => ({ ...prev, form: m }))}
              />
            )}
            <button type="submit" disabled={busy || !config} className="btn-primary w-full min-h-12">
              {mode === 'login' ? <><IconLogin size={18} aria-hidden /> Entrar</> : <><IconUserPlus size={18} aria-hidden /> Crear cuenta de alumno</>}
            </button>
            <p className="text-xs text-slate-500 text-center">
              Al continuar aceptas revisar los <Link to="/terminos" className="text-acento-osc font-bold underline">términos y condiciones</Link>.
              {mode === 'register' && ' Te enviaremos un código a tu correo para confirmar que es tuyo. Las cuentas de encargado las crea el super administrador.'}
            </p>
          </form>
          </>)}


          <p className="text-center text-xs text-slate-400 mt-4">
            ¿Primera vez? <Link to="/manual" className="font-bold text-acento-osc hover:underline">Consulta el manual de usuario</Link>
          </p>
        </section>
      </div>
    </div>
  )
}

const RESEND_SECONDS = 60

/** Paso 2 del registro: el alumno escribe el código que llegó a su correo. */
function VerifyStep({ email, onVerified, onBack }: { email: string; onVerified: () => void; onBack: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(RESEND_SECONDS)

  useEffect(() => {
    if (wait <= 0) return
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(t)
  }, [wait])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!/^\d{6}$/.test(code)) {
      setError('El código tiene 6 dígitos.')
      return
    }
    setBusy(true)
    setNotice('')
    const res = await verifyEmail(email, code)
    setBusy(false)
    if (res.ok) {
      onVerified()
      return
    }
    setError(res.errors.form ?? 'No se pudo verificar el código.')
    setCode('')
    if (res.restart) window.setTimeout(onBack, 2500)
  }

  const resend = async () => {
    setError('')
    setNotice('')
    const res = await resendEmailCode(email)
    if (res.ok) {
      setNotice('Te enviamos un código nuevo. El anterior ya no sirve.')
      setWait(RESEND_SECONDS)
    } else {
      setError(res.errors.form ?? 'No se pudo reenviar el código.')
      if (res.restart) window.setTimeout(onBack, 2500)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex items-start gap-3 rounded-xl bg-cyan-50 ring-1 ring-inset ring-cyan-100 p-4">
        <IconMailCheck size={22} className="text-acento-osc shrink-0 mt-0.5" aria-hidden />
        <div className="text-sm">
          <p className="font-bold text-titulo">Verifica tu correo</p>
          <p className="text-slate-600 mt-1">
            Enviamos un código de 6 dígitos a <strong className="break-all">{email}</strong>. Vence en 15 minutos.
            Si no lo ves, revisa la carpeta de correo no deseado.
          </p>
        </div>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      <Field label="Código de verificación" required htmlFor="code">
        <input
          id="code"
          className="input text-center text-2xl font-black tracking-[0.5em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
          autoFocus
        />
      </Field>
      <button type="submit" disabled={busy} className="btn-primary w-full min-h-12">
        <IconUserPlus size={18} aria-hidden /> Verificar y crear cuenta
      </button>
      <div className="flex items-center justify-between gap-3 text-sm">
        <button type="button" onClick={onBack} className="font-bold text-slate-500 hover:text-titulo cursor-pointer">Usar otro correo</button>
        <button type="button" onClick={resend} disabled={wait > 0} className="font-bold text-acento-osc hover:underline cursor-pointer disabled:text-slate-400 disabled:no-underline disabled:cursor-default">
          {wait > 0 ? `Reenviar código (${wait} s)` : 'Reenviar código'}
        </button>
      </div>
    </form>
  )
}

/** Recuperar contraseña: 1) correo + captcha → código; 2) código + contraseña nueva. */
function ResetFlow({ siteKey, initialEmail, onDone, onCancel }: {
  siteKey: string | null
  initialEmail: string
  onDone: (email: string) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState(initialEmail)
  const [captcha, setCaptcha] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(t)
  }, [wait])

  const sendCode = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const bad = validateEmail(email)
    if (bad) return setErrors({ email: bad })
    if (siteKey && !captcha) return setErrors({ form: 'Espera a que termine la verificación de seguridad.' })
    setBusy(true)
    const res = await requestPasswordReset(email.trim().toLowerCase(), captcha)
    setBusy(false)
    if (!res.ok) {
      setErrors(res.errors)
      if (siteKey) setCaptchaReset((n) => n + 1)
      return
    }
    setErrors({})
    setNotice('Si el correo tiene una cuenta en PUPE, te enviamos un código. Revisa también la carpeta de no deseados.')
    setWait(60)
    setStep('code')
  }

  const resend = async () => {
    setErrors({})
    await resendPasswordReset(email.trim().toLowerCase())
    setNotice('Si el correo tiene una cuenta, te enviamos un código nuevo. El anterior ya no sirve.')
    setWait(60)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const errs: Record<string, string> = {}
    if (!/^\d{6}$/.test(code)) errs.code = 'El código tiene 6 dígitos.'
    const p = validatePassword(password, { email })
    if (p) errs.password = p
    else if (password !== confirm) errs.confirm = 'Las contraseñas no coinciden.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setNotice('')
    const res = await resetPassword(email.trim().toLowerCase(), code, password)
    setBusy(false)
    if (res.ok) return onDone(email.trim().toLowerCase())
    setErrors(res.errors)
    setCode('')
    if (res.restart) {
      setStep('email')
      if (siteKey) setCaptchaReset((n) => n + 1)
    }
  }

  if (step === 'email') {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-4" noValidate>
        {errors.form && <Alert kind="error">{errors.form}</Alert>}
        <Field label="Correo institucional" error={errors.email} required htmlFor="reset-email">
          <input id="reset-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
        </Field>
        {siteKey && (
          <Turnstile siteKey={siteKey} onToken={setCaptcha} resetKey={captchaReset} onError={(m) => setErrors({ form: m })} />
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full min-h-12">
          <IconMailCheck size={18} aria-hidden /> Enviar código
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-bold text-slate-500 hover:text-titulo cursor-pointer">
          Volver a iniciar sesión
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {notice && <Alert kind="info">{notice}</Alert>}
      {errors.form && <Alert kind="error">{errors.form}</Alert>}
      <p className="text-sm text-slate-600">Correo: <strong className="break-all">{email}</strong></p>
      <Field label="Código de verificación" required error={errors.code} htmlFor="reset-code">
        <input
          id="reset-code"
          className="input text-center text-2xl font-black tracking-[0.5em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          autoFocus
        />
      </Field>
      <Field label="Nueva contraseña" required error={errors.password} htmlFor="reset-pw" hint={`Mínimo ${PASSWORD_MIN} caracteres, con letras y números. No uses tu matrícula.`}>
        <input id="reset-pw" type="password" className="input" autoComplete="new-password" maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="Confirmar contraseña" required error={errors.confirm} htmlFor="reset-pw2">
        <input id="reset-pw2" type="password" className="input" autoComplete="new-password" maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <button type="submit" disabled={busy} className="btn-primary w-full min-h-12">
        <IconKey size={18} aria-hidden /> Cambiar contraseña
      </button>
      <div className="flex items-center justify-between gap-3 text-sm">
        <button type="button" onClick={() => { setStep('email'); setErrors({}); setNotice('') }} className="font-bold text-slate-500 hover:text-titulo cursor-pointer">
          Usar otro correo
        </button>
        <button type="button" onClick={resend} disabled={wait > 0} className="font-bold text-acento-osc hover:underline cursor-pointer disabled:text-slate-400 disabled:no-underline disabled:cursor-default">
          {wait > 0 ? `Reenviar código (${wait} s)` : 'Reenviar código'}
        </button>
      </div>
    </form>
  )
}
