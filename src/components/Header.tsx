import {
  IconClipboardList, IconHelpCircle, IconHistory, IconHome, IconLayoutDashboard, IconListCheck, IconLogout,
  IconMail, IconMenu2, IconReportAnalytics, IconSearch, IconUserCircle, IconWorld, IconX,
} from '@tabler/icons-react'
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { logout, useCurrentUser } from '../lib/auth'
import { ROLE_LABEL } from '../lib/constants'
import type { User } from '../lib/types'

type NavItem = { to: string; label: string; icon: typeof IconHome; end?: boolean }

function navFor(user: User | null): NavItem[] {
  if (!user) return []
  const base: NavItem[] = [
    { to: '/', label: 'Inicio', icon: IconHome, end: true },
    { to: '/catalogo', label: 'Buscar', icon: IconSearch },
  ]
  if (user.role === 'student') base.push({ to: '/mis-reclamos', label: 'Mis reclamos', icon: IconListCheck })
  if (user.role === 'manager' || user.role === 'super_admin') {
    base.push({ to: '/encargado', label: 'Panel', icon: IconLayoutDashboard, end: true })
    base.push({ to: '/encargado/reclamos', label: 'Reclamos', icon: IconClipboardList })
    base.push({ to: '/bitacora', label: 'Bitácora', icon: IconHistory })
    base.push({ to: '/reportes', label: 'Reportes', icon: IconReportAnalytics })
  }
  if (user.role === 'super_admin') base.push({ to: '/admin', label: 'Panel global', icon: IconWorld })
  return base
}

export function TopBar() {
  return (
    <div className="no-print bg-navbar text-white/80 text-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-end gap-5">
        <a href="https://outlook.office365.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">
          <IconMail size={14} aria-hidden /> Correo BUAP
        </a>
        <a href="https://autoservicios.buap.mx/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">
          <IconUserCircle size={14} aria-hidden /> Autoservicios
        </a>
      </div>
    </div>
  )
}

export function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3 min-w-0" aria-label="PUPE, ir al inicio">
      <img src="/brand/buap-white.svg" alt="Escudo BUAP" className="h-11 w-11 shrink-0" />
      <span className="h-8 w-px bg-white/25 shrink-0" aria-hidden />
      <img src="/brand/cu2.png" alt="CU2" className="h-7 w-auto shrink-0" />
      <span className="hidden sm:flex flex-col leading-tight min-w-0">
        <span className="text-white font-black tracking-wide">PUPE</span>
        <span className="text-white/70 text-[11px] truncate">Objetos perdidos · CU2</span>
      </span>
    </Link>
  )
}

export function Navbar() {
  const user = useCurrentUser()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const items = navFor(user)

  const doLogout = async () => {
    await logout()
    setOpen(false)
    navigate('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 rounded-lg px-3 min-h-11 text-sm transition-all ${isActive ? 'bg-white/10 text-white font-bold shadow-[inset_0_-2px_0_#00B5E2]' : 'text-white/75 hover:text-white hover:bg-white/5'}`

  return (
    <nav className="bg-navbar border-b-[3px] border-acento sticky top-0 z-30" aria-label="Principal">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-[68px] flex items-center justify-between gap-4">
        <Brand />
        {user && (
          <>
            <div className="hidden xl:flex items-center gap-1">
              {items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} className={linkClass}>
                  <it.icon size={18} aria-hidden /> {it.label}
                </NavLink>
              ))}
              <NavLink to="/manual" className={linkClass} title="Manual de usuario" aria-label="Manual de usuario">
                <IconHelpCircle size={18} aria-hidden />
              </NavLink>
              <NavLink to="/perfil" className={linkClass} title={`${user.name} · ${ROLE_LABEL[user.role]}`}>
                <IconUserCircle size={18} aria-hidden /> Perfil
              </NavLink>
            </div>
            <button
              type="button"
              className="xl:hidden text-white size-11 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="menu-movil"
              aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            >
              {open ? <IconX /> : <IconMenu2 />}
            </button>
          </>
        )}
      </div>
      {user && open && (
        <div id="menu-movil" className="xl:hidden border-t border-white/10 px-4 pb-4 pt-2 flex flex-col gap-1">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={linkClass} onClick={() => setOpen(false)}>
              <it.icon size={18} aria-hidden /> {it.label}
            </NavLink>
          ))}
          <NavLink to="/manual" className={linkClass} onClick={() => setOpen(false)}>
            <IconHelpCircle size={18} aria-hidden /> Manual de usuario
          </NavLink>
          <NavLink to="/perfil" className={linkClass} onClick={() => setOpen(false)}>
            <IconUserCircle size={18} aria-hidden /> Perfil · {ROLE_LABEL[user.role]}
          </NavLink>
          <button type="button" onClick={doLogout} className="inline-flex items-center gap-2 rounded-lg px-3 min-h-11 text-sm text-white/80 hover:text-white cursor-pointer">
            <IconLogout size={18} aria-hidden /> Cerrar sesión
          </button>
        </div>
      )}
    </nav>
  )
}

export function Footer() {
  return (
    <footer className="bg-navbar text-white/65 text-sm mt-16 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex items-start gap-3">
          <img src="/brand/buap-white.svg" alt="" className="h-11 w-11 shrink-0" />
          <div className="leading-snug">
            <p className="text-white font-black tracking-wide">PUPE · CU2 · BUAP</p>
            <p className="text-xs mt-1 max-w-sm">Plataforma Universitaria de Objetos Perdidos y Encontrados de Ciudad Universitaria 2.</p>
            <p className="text-[11px] text-white/40 mt-2">Prototipo académico · No es un sistema en producción</p>
          </div>
        </div>
        <div>
          <p className="text-white font-bold mb-3 text-xs uppercase tracking-[0.14em]">Plataforma</p>
          <ul className="flex flex-col gap-2 text-xs">
            <li><Link to="/catalogo" className="hover:text-white">Buscar objetos</Link></li>
            <li><Link to="/entregar" className="hover:text-white">Entregar al encargado</Link></li>
            <li><Link to="/manual" className="hover:text-white">Manual de usuario</Link></li>
            <li><Link to="/terminos" className="hover:text-white">Términos y condiciones</Link></li>
            <li><Link to="/privacidad" className="hover:text-white">Aviso de privacidad</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-white font-bold mb-3 text-xs uppercase tracking-[0.14em]">Enlaces</p>
          <ul className="flex flex-col gap-2 text-xs">
            <li><a href="https://www.buap.mx/" target="_blank" rel="noreferrer" className="hover:text-white">BUAP</a></li>
            <li><a href="https://cu2.buap.mx/" target="_blank" rel="noreferrer" className="hover:text-white">Ciudad Universitaria 2</a></li>
            <li><Link to="/entregar" className="hover:text-white">Contacto con encargados</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="text-center text-[11px] text-white/35 py-4 px-4">Ciudad Universitaria 2 · Benemérita Universidad Autónoma de Puebla</p>
      </div>
    </footer>
  )
}
