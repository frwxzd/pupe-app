import { IconArrowLeft, IconArrowUp } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Píxeles de desplazamiento a partir de los cuales aparece "Ir arriba". */
const SHOW_TOP_AFTER = 400
/** Pantallas sin botón "Regresar": son puntos de partida. */
const NO_BACK = ['/', '/login']

/**
 * Botones flotantes de navegación: "Regresar" (página anterior del historial)
 * e "Ir arriba" (aparece al bajar en páginas largas).
 */
export function FloatingNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SHOW_TOP_AFTER)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const goBack = () => {
    // React Router guarda la posición en el historial; si se entró directo a esta
    // página (enlace o recarga) no hay página anterior dentro de PUPE.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/')
  }

  const goTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    document.getElementById('main')?.focus({ preventScroll: true })
  }

  const showBack = !NO_BACK.includes(pathname)

  return (
    <>
      {showBack && (
        <button
          type="button"
          onClick={goBack}
          aria-label="Regresar a la página anterior"
          title="Regresar a la página anterior"
          className="back-tab group no-print fixed left-0 top-1/2 -translate-y-1/2 z-40 inline-flex items-center gap-2 h-12 pl-2.5 pr-3 sm:h-14 sm:pl-3 sm:pr-4 rounded-r-2xl text-white font-bold text-sm shadow-lg shadow-titulo/25 ring-1 ring-white/30 focus-visible:outline-offset-4"
        >
          <IconArrowLeft size={20} stroke={2.4} aria-hidden className="shrink-0 transition-transform duration-300 group-hover:-translate-x-0.5" />
          <span className="hidden sm:inline-block overflow-hidden whitespace-nowrap max-w-0 opacity-0 transition-all duration-300 group-hover:max-w-24 group-hover:opacity-100 group-focus-visible:max-w-24 group-focus-visible:opacity-100">
            Regresar
          </span>
        </button>
      )}
      <button
        type="button"
        onClick={goTop}
        aria-label="Ir al inicio de la página"
        title="Ir arriba"
        tabIndex={scrolled ? 0 : -1}
        aria-hidden={!scrolled}
        className={`no-print fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 top-btn group inline-flex items-center justify-center size-12 rounded-full text-white ring-2 ring-white/80 shadow-lg shadow-slate-900/15 focus-visible:outline-offset-4 ${scrolled ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}
      >
        <IconArrowUp size={22} stroke={2.4} aria-hidden className="group-hover:animate-bounce" />
      </button>
    </>
  )
}
