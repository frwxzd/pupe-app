import { useEffect, useLayoutEffect, useRef } from 'react'

// Captcha de Cloudflare Turnstile. Casi siempre se resuelve solo, sin que el
// usuario tenga que hacer nada. El token se valida en el servidor.

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let loader: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SRC
    s.async = true
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile no cargó')))
    s.onerror = () => {
      loader = null
      reject(new Error('No se pudo cargar la verificación de seguridad.'))
    }
    document.head.appendChild(s)
  })
  return loader
}

/** `resetKey`: cámbialo para pedir un token nuevo (cada token sirve una sola vez). */
export function Turnstile({ siteKey, onToken, resetKey, onError }: {
  siteKey: string
  onToken: (token: string) => void
  resetKey: number
  onError?: (message: string) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const cb = useRef({ onToken, onError })
  useLayoutEffect(() => {
    cb.current = { onToken, onError }
  })

  useEffect(() => {
    const effect = { alive: true }
    loadTurnstile()
      .then((t) => {
        if (!effect.alive || !box.current) return
        widget.current = t.render(box.current, {
          sitekey: siteKey,
          language: 'es',
          theme: 'light',
          size: 'flexible',
          callback: (token: string) => cb.current.onToken(token),
          'expired-callback': () => cb.current.onToken(''),
          'error-callback': () => {
            cb.current.onToken('')
            cb.current.onError?.('La verificación de seguridad falló. Recarga la página.')
          },
        })
      })
      .catch((e: Error) => cb.current.onError?.(e.message))
    return () => {
      effect.alive = false
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current)
      widget.current = null
    }
  }, [siteKey])

  useEffect(() => {
    if (resetKey === 0 || !widget.current || !window.turnstile) return
    window.turnstile.reset(widget.current)
    cb.current.onToken('')
  }, [resetKey])

  return <div ref={box} className="min-h-[65px]" aria-label="Verificación de seguridad" />
}
