import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Layout from "./components/Layout.jsx";
import PanelPage from "./pages/PanelPage.jsx";
import VentasPage from "./pages/VentasPage.jsx";
import PresupuestosPage from "./pages/PresupuestosPage.jsx";
import AlbaranesPage from "./pages/AlbaranesPage.jsx";
import ComprasPage from "./pages/ComprasPage.jsx";
import ComprasPedidosPage from "./pages/ComprasPedidosPage.jsx";
import ComprasPresupuestosPage from "./pages/ComprasPresupuestosPage.jsx";
import ComprasAlbaranesPage from "./pages/ComprasAlbaranesPage.jsx";
import ComprasFacturasPage from "./pages/ComprasFacturasPage.jsx";
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
import FormatosPage from "./pages/FormatosPage.jsx";
import TallerPanelPage from "./pages/taller/TallerPanelPage.jsx";
import TallerVehiculosPage from "./pages/taller/TallerVehiculosPage.jsx";
import TallerOrdenesPage from "./pages/taller/TallerOrdenesPage.jsx";
import TallerAgendaPage from "./pages/taller/TallerAgendaPage.jsx";
import TallerCortesiaPage from "./pages/taller/TallerCortesiaPage.jsx";
import TallerValoracionesPage from "./pages/taller/TallerValoracionesPage.jsx";
import LlamadasPage from "./pages/LlamadasPage.jsx";

// Abre la aplicación en el módulo de inicio elegido (Sistema → Módulos).
function InicioRedirect() {
  const [destino, setDestino] = useState(null);
  useEffect(() => {
    fetch("/api/empresa")
      .then((r) => (r.ok ? r.json() : null))
      .then((e) => {
        const inicio = e?.moduloInicio ?? "panel";
        setDestino(inicio !== "panel" && (e?.modulos ?? []).includes(inicio) ? `/${inicio}` : null);
      })
      .catch(() => setDestino(null));
  }, []);
  if (destino === null) return <PanelPage />; // por defecto, panel principal
  return <Navigate to={destino} replace />;
}

export default function App() {
  return (
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
          <Route path="tesoreria" element={<TesoreriaPanelPage />} />
          <Route path="tesoreria/cobros" element={<TesoreriaCobrosPage />} />
          <Route path="tesoreria/pagos" element={<TesoreriaPagosPage />} />
          <Route path="recurrencias" element={<RecurrenciasPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="proveedores" element={<ProveedoresPage />} />
          <Route path="articulos" element={<ArticulosPage />} />
          <Route path="configuracion" element={<ConfigPage />} />
          <Route path="modulos" element={<ModulosPage />} />
          <Route path="series" element={<SeriesPage />} />
          <Route path="certificado" element={<CertificadoPage />} />
          <Route path="notificaciones" element={<NotificacionesPage />} />
          <Route path="usuarios" element={<UsuariosPage />} />
          <Route path="formatos" element={<FormatosPage />} />
          <Route path="taller" element={<TallerPanelPage />} />
          <Route path="taller/agenda" element={<TallerAgendaPage />} />
          <Route path="taller/vehiculos" element={<TallerVehiculosPage />} />
          <Route path="taller/ordenes" element={<TallerOrdenesPage />} />
          <Route path="taller/valoraciones" element={<TallerValoracionesPage />} />
          <Route path="taller/cortesia" element={<TallerCortesiaPage />} />
          <Route path="telefonia" element={<Navigate to="/telefonia/llamadas" replace />} />
          <Route path="telefonia/llamadas" element={<LlamadasPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
