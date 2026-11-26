import { IconEraser } from '@tabler/icons-react'
import SignaturePadLib from 'signature_pad'
import { useEffect, useRef } from 'react'

// Firma en canvas. Devuelve la firma como data URL (PNG) o '' si está vacía.
export default function SignaturePad({ onChange, label = 'Firma' }: { onChange: (dataUrl: string) => void; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadLib | null>(null)
  const onChangeRef = useRef(onChange)
  const lastWidthRef = useRef(-1)
  useEffect(() => { onChangeRef.current = onChange })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const pad = new SignaturePadLib(canvas, { penColor: '#1A1A2E', backgroundColor: 'rgb(255,255,255)' })
    padRef.current = pad
    // Ajusta el canvas a su tamaño real sin perder lo ya firmado
    // (en móvil, girar la pantalla o esconder la barra dispara "resize").
    const resize = () => {
      if (canvas.offsetWidth === lastWidthRef.current) return
      lastWidthRef.current = canvas.offsetWidth
      const strokes = pad.toData()
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      canvas.getContext('2d')?.scale(ratio, ratio)
      pad.clear()
      if (strokes.length) {
        pad.fromData(strokes)
        onChangeRef.current(pad.toDataURL('image/png'))
      }
    }
    resize()
    window.addEventListener('resize', resize)
    pad.addEventListener('endStroke', () => onChangeRef.current(pad.isEmpty() ? '' : pad.toDataURL('image/png')))
    return () => {
      window.removeEventListener('resize', resize)
      pad.off()
    }
  }, [])

  const clear = () => {
    padRef.current?.clear()
    onChange('')
  }

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white">
        <canvas ref={canvasRef} className="w-full h-40 touch-none rounded-xl" aria-label={`${label}: dibuja con el mouse o el dedo`} />
        <span className="pointer-events-none absolute bottom-2 left-3 text-xs text-slate-400">Firme aquí</span>
      </div>
      <button type="button" onClick={clear} className="btn-secondary mt-2">
        <IconEraser size={16} aria-hidden /> Borrar firma
      </button>
    </div>
  )
}
