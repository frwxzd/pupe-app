import { IconCloudOff, IconLoader2 } from '@tabler/icons-react'
import { useEffect, type ReactNode } from 'react'
import { refresh } from '../lib/api'
import { getClientState, useClientState } from '../lib/storage'

/** Carga la sesión y los datos del servidor antes de mostrar la app y los mantiene al día. */
export function Boot({ children }: { children: ReactNode }) {
  const { status } = useClientState()

  useEffect(() => {
    refresh().catch(() => undefined)
    const onFocus = () => {
      if (document.visibilityState === 'visible') refresh().catch(() => undefined)
    }
    // Mientras haya sesión, se consultan cambios hechos por otras personas.
    const timer = window.setInterval(() => {
      if (getClientState().me && document.visibilityState === 'visible') refresh().catch(() => undefined)
    }, 30_000)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 gap-3">
        <IconLoader2 className="animate-spin text-acento" size={26} aria-hidden />
        <span className="text-sm font-bold">Cargando PUPE…</span>
      </div>
    )
  }

  if (status === 'offline' && !getClientState().me) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center flex flex-col items-center gap-3">
          <IconCloudOff size={34} className="text-slate-400" aria-hidden />
          <h1 className="text-xl">No se pudo conectar con el servidor</h1>
          <p className="text-sm text-slate-600">Revisa tu conexión a internet e inténtalo de nuevo.</p>
          <button type="button" className="btn-primary" onClick={() => refresh().catch(() => undefined)}>Reintentar</button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
