import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Layout from "./components/Layout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import SetupWizard from "./pages/SetupWizard.jsx";
import { obtenerToken } from "./lib/sesion.js";
import VentasPage from "./pages/VentasPage.jsx";
import PresupuestosPage from "./pages/PresupuestosPage.jsx";
import AlbaranesPage from "./pages/AlbaranesPage.jsx";
import ComprasPage from "./pages/ComprasPage.jsx";
import ComprasPedidosPage from "./pages/ComprasPedidosPage.jsx";
import ComprasPresupuestosPage from "./pages/ComprasPresupuestosPage.jsx";
import ComprasAlbaranesPage from "./pages/ComprasAlbaranesPage.jsx";
import ComprasFacturasPage from "./pages/ComprasFacturasPage.jsx";
import ComprasGastosPage from "./pages/ComprasGastosPage.jsx";
import TesoreriaPanelPage from "./pages/TesoreriaPanelPage.jsx";
import TesoreriaCobrosPage from "./pages/TesoreriaCobrosPage.jsx";
import TesoreriaPagosPage from "./pages/TesoreriaPagosPage.jsx";
import RecurrenciasPage from "./pages/RecurrenciasPage.jsx";
import ClientesPage from "./pages/ClientesPage.jsx";
import ProveedoresPage from "./pages/ProveedoresPage.jsx";
import ArticulosPage from "./pages/ArticulosPage.jsx";
import ConfigPage from "./pages/ConfigPage.jsx";
import ModulosPage from "./pages/ModulosPage.jsx";
import SeriesPage from "./pages/SeriesPage.jsx";
import CertificadoPage from "./pages/CertificadoPage.jsx";
import NotificacionesPage from "./pages/NotificacionesPage.jsx";
import UsuariosPage from "./pages/UsuariosPage.jsx";
import ActividadPage from "./pages/ActividadPage.jsx";
import FormatosPage from "./pages/FormatosPage.jsx";
import AgendaPage from "./pages/AgendaPage.jsx";
import TallerPanelPage from "./pages/taller/TallerPanelPage.jsx";
import TallerVehiculosPage from "./pages/taller/TallerVehiculosPage.jsx";
import TallerOrdenesPage from "./pages/taller/TallerOrdenesPage.jsx";
import TallerAgendaPage from "./pages/taller/TallerAgendaPage.jsx";
import TallerCortesiaPage from "./pages/taller/TallerCortesiaPage.jsx";
import OperariosPage from "./pages/taller/OperariosPage.jsx";
import PlanningPage from "./pages/taller/PlanningPage.jsx";
import TallerValoracionesPage from "./pages/taller/TallerValoracionesPage.jsx";
import TallerAseguradorasPage from "./pages/taller/TallerAseguradorasPage.jsx";
import LlamadasPage from "./pages/LlamadasPage.jsx";
import AyudaFacturacionPage from "./pages/ayuda/AyudaFacturacionPage.jsx";
import AyudaTallerPage from "./pages/ayuda/AyudaTallerPage.jsx";
import AyudaTelefoniaPage from "./pages/ayuda/AyudaTelefoniaPage.jsx";
import AyudaServicioPage from "./pages/ayuda/AyudaServicioPage.jsx";
import ServicioPanelPage from "./pages/servicio/ServicioPanelPage.jsx";
import ServicioAgendaPage from "./pages/servicio/ServicioAgendaPage.jsx";
import ServicioAparatosPage from "./pages/servicio/ServicioAparatosPage.jsx";
import ServicioOrdenesPage from "./pages/servicio/ServicioOrdenesPage.jsx";
import AsesoriaPanelPage from "./pages/asesoria/AsesoriaPanelPage.jsx";
import AsesoriaCarteraPage from "./pages/asesoria/AsesoriaCarteraPage.jsx";
import AsesoriaDocumentosPage from "./pages/asesoria/AsesoriaDocumentosPage.jsx";
import AsesoriaLibrosPage from "./pages/asesoria/AsesoriaLibrosPage.jsx";
import AsesoriaFiscalPage from "./pages/asesoria/AsesoriaFiscalPage.jsx";
import AsesoriaPrevisionPage from "./pages/asesoria/AsesoriaPrevisionPage.jsx";
import AsesoriaSolicitudesPage from "./pages/asesoria/AsesoriaSolicitudesPage.jsx";
import AsesoriaCierresPage from "./pages/asesoria/AsesoriaCierresPage.jsx";
import AdminTenantsPage from "./pages/AdminTenantsPage.jsx";
import PreferenciasPage from "./pages/PreferenciasPage.jsx";
import WhatsAppPage from "./pages/WhatsAppPage.jsx";
import CorreoPage from "./pages/CorreoPage.jsx";
import CopiasSeguridadPage from "./pages/CopiasSeguridadPage.jsx";
import { obtenerInicioDispositivo } from "./lib/preferenciaInicio.js";

// Cada clave de inicio corresponde a una ruta real de la aplicación.
const RUTAS_INICIO = {
  taller: "/taller",
  telefonia: "/telefonia",
  servicio: "/servicio",
  asesoria: "/asesoria",
  agenda: "/agenda",
};

function InicioRedirect() {
  const [destino, setDestino] = useState(null);
  useEffect(() => {
    fetch("/api/empresa")
      .then((r) => (r.ok ? r.json() : null))
      .then((e) => {
        const inicio = obtenerInicioDispositivo(e?.moduloInicio ?? "panel");
        // La agenda siempre está disponible; los módulos solo si están activos.
        const permitida =
          RUTAS_INICIO[inicio] &&
          (inicio === "agenda" || (e?.modulos ?? []).includes(inicio));
        setDestino(permitida ? RUTAS_INICIO[inicio] : "/tesoreria");
      })
      .catch(() => setDestino("/tesoreria"));
  }, []);
  if (destino === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400 text-sm">Cargando…</p>
      </div>
    );
  }
  return <Navigate to={destino} replace />;
}

// Tras el login, si la instalación aún no tiene empresa configurada
// (GET /api/empresa responde 404), muestra el asistente de primera
// configuración en lugar de la aplicación.
function GuardSetup({ children }) {
  const [estado, setEstado] = useState("cargando"); // cargando | setup | ok
  useEffect(() => {
    let vivo = true;
    fetch("/api/empresa")
      .then((r) => {
        if (vivo) setEstado(r.status === 404 ? "setup" : "ok");
      })
      .catch(() => {
        if (vivo) setEstado("ok"); // error de red: no bloquear la aplicación
      });
    return () => { vivo = false; };
  }, []);
  if (estado === "cargando") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Cargando…</p>
      </div>
    );
  }
  if (estado === "setup") return <SetupWizard />;
  return children;
}

export default function App() {
  // Sin sesión no hay aplicación: solo la pantalla de acceso.
  if (!obtenerToken()) return <LoginPage />;
  return (
    <GuardSetup>
      <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<InicioRedirect />} />
          <Route path="ventas" element={<VentasPage />} />
          <Route path="presupuestos" element={<PresupuestosPage />} />
          <Route path="albaranes" element={<AlbaranesPage />} />
          <Route path="compras" element={<Navigate to="/compras/facturas" replace />} />
          <Route path="compras/ocr" element={<ComprasPage />} />
          <Route path="compras/pedidos" element={<ComprasPedidosPage />} />
          <Route path="compras/presupuestos" element={<ComprasPresupuestosPage />} />
          <Route path="compras/albaranes" element={<ComprasAlbaranesPage />} />
          <Route path="compras/facturas" element={<ComprasFacturasPage />} />
          <Route path="compras/gastos" element={<ComprasGastosPage />} />
          <Route path="tesoreria" element={<TesoreriaPanelPage />} />
          <Route path="tesoreria/cobros" element={<TesoreriaCobrosPage />} />
          <Route path="tesoreria/pagos" element={<TesoreriaPagosPage />} />
          <Route path="recurrencias" element={<RecurrenciasPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="proveedores" element={<ProveedoresPage />} />
          <Route path="articulos" element={<ArticulosPage />} />
          <Route path="agenda" element={<AgendaPage />} />
          <Route path="configuracion" element={<ConfigPage />} />
          <Route path="modulos" element={<ModulosPage />} />
          <Route path="series" element={<SeriesPage />} />
          <Route path="certificado" element={<CertificadoPage />} />
          <Route path="notificaciones" element={<NotificacionesPage />} />
          <Route path="correo" element={<CorreoPage />} />
          <Route path="copias" element={<CopiasSeguridadPage />} />
          <Route path="whatsapp" element={<WhatsAppPage />} />
          <Route path="usuarios" element={<UsuariosPage />} />
          <Route path="actividad" element={<ActividadPage />} />
          <Route path="inicio" element={<PreferenciasPage />} />
          <Route path="preferencias" element={<Navigate to="/inicio" replace />} />
          <Route path="formatos" element={<FormatosPage />} />
          <Route path="taller" element={<TallerPanelPage />} />
          <Route path="taller/agenda" element={<TallerAgendaPage />} />
          <Route path="taller/vehiculos" element={<TallerVehiculosPage />} />
          <Route path="taller/ordenes" element={<TallerOrdenesPage />} />
          <Route path="taller/valoraciones" element={<TallerValoracionesPage />} />
          <Route path="taller/aseguradoras" element={<TallerAseguradorasPage />} />
          <Route path="taller/cortesia" element={<TallerCortesiaPage />} />
          <Route path="taller/operarios" element={<OperariosPage />} />
          <Route path="taller/planning" element={<PlanningPage />} />
          <Route path="telefonia" element={<Navigate to="/telefonia/llamadas" replace />} />
          <Route path="telefonia/llamadas" element={<LlamadasPage />} />
          <Route path="servicio" element={<ServicioPanelPage />} />
          <Route path="servicio/agenda" element={<ServicioAgendaPage />} />
          <Route path="servicio/aparatos" element={<ServicioAparatosPage />} />
          <Route path="servicio/ordenes" element={<ServicioOrdenesPage />} />
          <Route path="asesoria" element={<AsesoriaPanelPage />} />
          <Route path="asesoria/cartera" element={<AsesoriaCarteraPage />} />
          <Route path="asesoria/documentos" element={<AsesoriaDocumentosPage />} />
          <Route path="asesoria/libros" element={<AsesoriaLibrosPage />} />
          <Route path="asesoria/fiscalidad" element={<AsesoriaFiscalPage />} />
          <Route path="asesoria/prevision" element={<AsesoriaPrevisionPage />} />
          <Route path="asesoria/solicitudes" element={<AsesoriaSolicitudesPage />} />
          <Route path="asesoria/cierres" element={<AsesoriaCierresPage />} />
          <Route path="ayuda" element={<Navigate to="/ayuda/facturacion" replace />} />
          <Route path="ayuda/facturacion" element={<AyudaFacturacionPage />} />
          <Route path="ayuda/taller" element={<AyudaTallerPage />} />
          <Route path="ayuda/telefonia" element={<AyudaTelefoniaPage />} />
          <Route path="ayuda/servicio" element={<AyudaServicioPage />} />
          <Route path="admin/tenants" element={<AdminTenantsPage />} />
          {/* Cualquier dirección desconocida vuelve al inicio en vez de quedarse en negro */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </BrowserRouter>
    </GuardSetup>
  );
}
