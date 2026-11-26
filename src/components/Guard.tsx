import { IconShieldLock } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { needsTerms, useCurrentUser } from '../lib/auth'
import { useDB } from '../lib/storage'
import type { Role } from '../lib/types'

/** Protege rutas por sesión, rol y aceptación de términos. */
export function Guard({ roles, children, skipTerms }: { roles?: Role[]; children: ReactNode; skipTerms?: boolean }) {
  const user = useCurrentUser()
  const db = useDB()
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!skipTerms && needsTerms(db, user)) return <Navigate to="/terminos" replace state={{ from: location.pathname }} />
  if (roles && !roles.includes(user.role)) return <Forbidden />
  return <>{children}</>
}

export function Forbidden({ text = 'Tu cuenta no tiene permiso para ver esta página.' }: { text?: string }) {
  return (
    <div className="page">
      <div className="card p-10 text-center flex flex-col items-center gap-3 max-w-lg mx-auto">
        <div className="size-14 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
          <IconShieldLock size={30} aria-hidden />
        </div>
        <h1 className="text-xl">Acceso denegado</h1>
        <p className="text-sm text-slate-600">{text}</p>
        <Link to="/" className="btn-primary">Ir al inicio</Link>
      </div>
    </div>
  )
}
