import { useEffect } from 'react'
import { BrowserRouter, Link, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Boot } from './components/Boot'
import { Guard } from './components/Guard'
import { FloatingNav } from './components/FloatingNav'
import { Footer, Navbar, TopBar } from './components/Header'
import { EmptyState } from './components/ui'
import ActaEntrega from './pages/ActaEntrega'
import Bitacora from './pages/Bitacora'
import Catalogo from './pages/Catalogo'
import Detalle from './pages/Detalle'
import { ActaView, Recibo } from './pages/Documentos'
import Entregar from './pages/Entregar'
import Inicio from './pages/Inicio'
import Login from './pages/Login'
import Manual from './pages/Manual'
import MisReclamos from './pages/MisReclamos'
import NuevoEncontrado from './pages/NuevoEncontrado'
import PanelEncargado from './pages/PanelEncargado'
import PanelSuperAdmin from './pages/PanelSuperAdmin'
import Perfil from './pages/Perfil'
import Reclamo from './pages/Reclamo'
import Reporte from './pages/Reporte'
import { ReclamoDetalle, ReclamosPendientes } from './pages/Reclamos'
import Terminos, { Privacidad } from './pages/Terminos'

function Layout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Saltar al contenido</a>
      <TopBar />
      <Navbar />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
      <FloatingNav />
    </div>
  )
}

const STAFF = ['manager', 'super_admin'] as const
const CLAIMERS = ['student', 'super_admin'] as const

export default function App() {
  return (
    <Boot>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/manual" element={<Manual />} />

          <Route path="/" element={<Guard><Inicio /></Guard>} />
          <Route path="/catalogo" element={<Guard><Catalogo /></Guard>} />
          <Route path="/objeto/:id" element={<Guard><Detalle /></Guard>} />
          <Route path="/objeto/:id/reclamar" element={<Guard roles={[...CLAIMERS]}><Reclamo /></Guard>} />
          <Route path="/mis-reclamos" element={<Guard roles={[...CLAIMERS]}><MisReclamos /></Guard>} />
          <Route path="/entregar" element={<Guard skipTerms><Entregar /></Guard>} />
          <Route path="/perfil" element={<Guard skipTerms><Perfil /></Guard>} />
          <Route path="/acta/:deliveryId" element={<Guard><ActaView /></Guard>} />

          <Route path="/encargado" element={<Guard roles={[...STAFF]}><PanelEncargado /></Guard>} />
          <Route path="/encargado/nuevo" element={<Guard roles={[...STAFF]}><NuevoEncontrado /></Guard>} />
          <Route path="/encargado/objeto/:id/editar" element={<Guard roles={[...STAFF]}><NuevoEncontrado /></Guard>} />
          <Route path="/encargado/recibo/:itemId" element={<Guard roles={[...STAFF]}><Recibo /></Guard>} />
          <Route path="/encargado/reclamos" element={<Guard roles={[...STAFF]}><ReclamosPendientes /></Guard>} />
          <Route path="/encargado/reclamos/:id" element={<Guard roles={[...STAFF]}><ReclamoDetalle /></Guard>} />
          <Route path="/encargado/entrega/:claimId" element={<Guard roles={[...STAFF]}><ActaEntrega /></Guard>} />
          <Route path="/bitacora" element={<Guard roles={[...STAFF]}><Bitacora /></Guard>} />
          <Route path="/reportes" element={<Guard roles={[...STAFF]}><Reporte /></Guard>} />

          <Route path="/admin" element={<Guard roles={['super_admin']}><PanelSuperAdmin /></Guard>} />

          <Route path="*" element={<div className="page"><EmptyState title="Página no encontrada" action={<Link to="/" className="btn-primary">Ir al inicio</Link>} /></div>} />
        </Route>
      </Routes>
    </BrowserRouter>
    </Boot>
  )
}
