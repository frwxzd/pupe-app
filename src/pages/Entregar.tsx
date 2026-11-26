import { IconHeartHandshake } from '@tabler/icons-react'
import { Alert, PageHeader } from '../components/ui'
import { FINDER_DECLARATION } from '../lib/constants'
import { userName } from '../lib/format'
import { useDB } from '../lib/storage'

// Regla de oro: el alumno que encuentra un objeto no lo publica; lo entrega al encargado.
export default function Entregar() {
  const db = useDB()
  return (
    <div className="page">
      <PageHeader eyebrow="Hallazgo" title="¿Encontraste un objeto?" subtitle="Entrégalo al encargado del edificio. Él lo registra y lo publica." />
      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
        <div className="flex flex-col gap-4">
          <Alert kind="warning"><strong>Los alumnos no publican objetos encontrados.</strong> Así se evitan reclamos falsos y se garantiza el resguardo.</Alert>
          <ol className="card p-5 flex flex-col gap-3 text-sm list-decimal pl-10">
            <li>Lleva el objeto al encargado del edificio donde lo encontraste.</li>
            <li>El encargado lo revisa y registra tus datos: nombre, matrícula y correo.</li>
            <li>Se anotan la fecha, el lugar del hallazgo, la condición y los componentes.</li>
            <li>Firmas la entrega y aceptas la declaración.</li>
            <li>Recibes un <strong>folio de recibo</strong>.</li>
            <li>El encargado publica el objeto en el catálogo.</li>
          </ol>
          <div className="card p-5 text-sm">
            <p className="font-bold text-titulo flex items-center gap-2 mb-2"><IconHeartHandshake size={18} /> Declaración del hallador</p>
            <p className="italic">“{FINDER_DECLARATION}”</p>
          </div>
        </div>
        <div className="card overflow-hidden">
          <h2 className="text-lg p-5 pb-3">Encargados por edificio</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navbar text-white text-left">
                <tr><th className="px-4 py-2">Edificio</th><th className="px-4 py-2">Encargado</th><th className="px-4 py-2">Correo</th></tr>
              </thead>
              <tbody>
                {db.buildings.map((b) => {
                  const m = db.users.find((u) => u.id === b.managerId)
                  return (
                    <tr key={b.code} className="border-b border-slate-100">
                      <td className="px-4 py-2 font-bold">{b.code}{b.name ? ` · ${b.name}` : ''}</td>
                      <td className="px-4 py-2">{b.managerId ? userName(db, b.managerId) : <span className="text-slate-400">Sin encargado</span>}</td>
                      <td className="px-4 py-2 break-all">{m ? <a className="text-acento-osc underline" href={`mailto:${m.email}`}>{m.email}</a> : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 p-4">Si el edificio no tiene encargado, acude a la coordinación de EMA1.</p>
        </div>
      </div>
    </div>
  )
}
