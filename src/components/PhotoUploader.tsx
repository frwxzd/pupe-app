import { IconCamera, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { compressImage } from '../lib/images'

export default function PhotoUploader({ photos, onChange, max = 5, label = 'Agregar fotos' }: {
  photos: string[]
  onChange: (photos: string[]) => void
  max?: number
  label?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError('')
    const room = max - photos.length
    if (room <= 0) {
      setError(`Máximo ${max} fotos.`)
      return
    }
    setBusy(true)
    try {
      const list = Array.from(files).slice(0, room)
      const compressed = await Promise.all(list.map((f) => compressImage(f)))
      onChange([...photos, ...compressed])
      if (files.length > room) setError(`Solo se agregaron ${room}; el máximo es ${max}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar la imagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {photos.map((p, i) => (
          <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
            <img src={p} alt={`Foto ${i + 1}`} className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 size-8 rounded-full bg-white/90 text-red-600 flex items-center justify-center shadow cursor-pointer"
              aria-label={`Quitar foto ${i + 1}`}
            >
              <IconTrash size={16} />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <label className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-acento flex flex-col items-center justify-center gap-1 text-xs font-bold text-slate-500 cursor-pointer text-center p-2">
            <IconCamera size={24} aria-hidden />
            {busy ? 'Procesando…' : label}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = '' }} disabled={busy} />
          </label>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-1">{photos.length}/{max} · Se comprimen a 800 px antes de guardarse.</p>
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}
