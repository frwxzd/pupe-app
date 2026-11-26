import {
  IconArrowRight, IconBuilding, IconCheck, IconClipboardList, IconFileCertificate,
  IconHelpCircle, IconLock, IconPackage, IconSearch, IconShieldCheck, IconUsers,
} from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui'

const STEPS = [
  { n: '01', title: 'Crea tu cuenta', text: 'Entra con tu correo institucional y tu matrícula.' },
  { n: '02', title: 'Acepta los términos', text: 'Sin aceptarlos no se muestra el catálogo ni se puede reclamar.' },
  { n: '03', title: 'Busca y reclama', text: 'Filtra por edificio, categoría o fecha y envía tu solicitud.' },
  { n: '04', title: 'Recoge tu objeto', text: 'El encargado valida y registra la entrega con acta.' },
]

export default function Manual() {
  return (
    <div className="page max-w-6xl">
      <PageHeader
        eyebrow="Ayuda"
        title="Manual de usuario"
        subtitle="Guía de uso para alumnos y encargados de edificio."
        actions={<Link to="/" className="btn-secondary">Volver al inicio</Link>}
      />

      <section className="relative overflow-hidden rounded-2xl bg-[#06283D] text-white p-6 md:p-9 mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(0,181,226,0.22),transparent_42%)]" />
        <div className="relative max-w-2xl">
          <p className="eyebrow text-cyan-300">Proceso general</p>
          <h2 className="text-2xl md:text-3xl font-black text-white mt-2">Cómo funciona la plataforma</h2>
          <p className="text-sm text-white/60 mt-2">Cada objeto se resguarda por edificio y se entrega con acta.</p>
        </div>
        <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-7">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <span className="text-xs font-black text-cyan-300">{s.n}</span>
              <p className="text-sm font-bold text-white mt-1">{s.title}</p>
              <p className="text-xs text-white/50 mt-1">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-5">
        <section className="card p-6">
          <div className="size-11 rounded-xl bg-cyan-50 text-acento-osc ring-1 ring-inset ring-cyan-100 flex items-center justify-center"><IconSearch size={22} aria-hidden /></div>
          <h2 className="text-lg mt-4">Si perdiste un objeto</h2>
          <ol className="mt-4 flex flex-col gap-3 text-sm text-slate-600">
            {[
              'Inicia sesión con tu correo BUAP y tu matrícula.',
              'Acepta los términos y condiciones.',
              'Busca por palabra clave, edificio, categoría o fecha.',
              'Abre el objeto y presiona “Este objeto es mío”.',
              'Describe marcas distintivas y adjunta evidencia.',
            ].map((t, i) => (
              <li key={t} className="flex items-start gap-3">
                <span className="size-6 shrink-0 rounded-full bg-cyan-50 text-acento-osc text-xs font-black flex items-center justify-center">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          <Link to="/catalogo" className="btn-primary w-full mt-5">Buscar objetos <IconArrowRight size={16} /></Link>
        </section>

        <section className="card p-6">
          <div className="size-11 rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100 flex items-center justify-center"><IconPackage size={22} aria-hidden /></div>
          <h2 className="text-lg mt-4">Si encontraste un objeto</h2>
          <ol className="mt-4 flex flex-col gap-3 text-sm text-slate-600">
            {[
              'Lleva el objeto al encargado del edificio.',
              'El encargado revisa el objeto y registra tus datos.',
              'Se anotan fecha, lugar, condición y componentes.',
              'Firmas la entrega y recibes un folio.',
              'El encargado publica el objeto en el catálogo.',
            ].map((t, i) => (
              <li key={t} className="flex items-start gap-3">
                <span className="size-6 shrink-0 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black flex items-center justify-center">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          <Link to="/entregar" className="btn-secondary w-full mt-5">Ver encargados <IconArrowRight size={16} /></Link>
        </section>

        <section className="card p-6">
          <div className="size-11 rounded-xl bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-100 flex items-center justify-center"><IconUsers size={22} aria-hidden /></div>
          <h2 className="text-lg mt-4">Si eres encargado</h2>
          <ol className="mt-4 flex flex-col gap-3 text-sm text-slate-600">
            {[
              'Entra a “Mi edificio” desde el panel.',
              'Publica los objetos que recibas de los halladores.',
              'Registra los datos y la firma de quien entrega.',
              'Revisa los reclamos y la evidencia de propiedad.',
              'Registra la entrega con identificación y acta.',
            ].map((t, i) => (
              <li key={t} className="flex items-start gap-3">
                <span className="size-6 shrink-0 rounded-full bg-orange-50 text-orange-700 text-xs font-black flex items-center justify-center">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          <Link to="/encargado" className="btn-secondary w-full mt-5">Ir a mi panel <IconArrowRight size={16} /></Link>
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-8">
        <section className="card p-6">
          <div className="flex items-center gap-2">
            <IconShieldCheck size={20} className="text-acento-osc" />
            <h2 className="text-lg">Seguridad y privacidad</h2>
          </div>
          <ul className="mt-4 flex flex-col gap-3 text-sm text-slate-600">
            <li className="flex gap-3"><IconLock size={17} className="text-slate-400 shrink-0 mt-0.5" /> Los datos sensibles —serie, IMEI, montos, identificaciones— no se muestran en el catálogo.</li>
            <li className="flex gap-3"><IconShieldCheck size={17} className="text-slate-400 shrink-0 mt-0.5" /> Solo el alumno que reclamó puede firmar el acta de entrega.</li>
            <li className="flex gap-3"><IconFileCertificate size={17} className="text-slate-400 shrink-0 mt-0.5" /> Cada entrega genera un folio y queda registrada en la bitácora.</li>
            <li className="flex gap-3"><IconCheck size={17} className="text-slate-400 shrink-0 mt-0.5" /> Los objetos devueltos no se pueden editar ni volver a reclamar.</li>
          </ul>
        </section>

        <section className="card p-6">
          <div className="flex items-center gap-2">
            <IconHelpCircle size={20} className="text-acento-osc" />
            <h2 className="text-lg">Preguntas frecuentes</h2>
          </div>
          <div className="mt-4 flex flex-col divide-y divide-slate-100">
            {[
              ['¿Quién puede publicar objetos encontrados?', 'Solo los encargados de cada edificio. Los alumnos no publican objetos encontrados.'],
              ['¿Puedo reclamar sin aceptar los términos?', 'No. Los términos son obligatorios antes de ver el catálogo y reclamar.'],
              ['¿Qué pasa si el objeto está incompleto?', 'El acta registra la condición y los componentes entregados. Así queda constancia.'],
              ['¿Dónde recojo mi objeto?', 'En el lugar de resguardo que indica la ficha, dentro del edificio correspondiente.'],
            ].map(([q, a]) => (
              <details key={q} className="py-3 group">
                <summary className="text-sm font-bold text-titulo cursor-pointer list-none flex items-center justify-between gap-3">
                  {q}
                  <IconArrowRight size={14} className="text-slate-400 group-open:rotate-90 transition-transform shrink-0" />
                </summary>
                <p className="text-sm text-slate-500 mt-2">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-8 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-start gap-3">
          <IconBuilding size={20} className="text-acento-osc shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-titulo text-sm">¿Necesitas ayuda adicional?</p>
            <p className="text-xs text-slate-500 mt-1">Acude con el encargado de tu edificio o consulta el aviso de privacidad.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/privacidad" className="btn-secondary">Aviso de privacidad</Link>
          <Link to="/entregar" className="btn-primary">Contacto <IconClipboardList size={16} /></Link>
        </div>
      </div>
    </div>
  )
}
