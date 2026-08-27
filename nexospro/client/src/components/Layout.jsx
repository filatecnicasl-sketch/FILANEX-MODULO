import { createContext, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  IconPanel, IconVentas, IconPresupuestos, IconAlbaranes, IconOcr,
  IconTesoreria, IconRecurrencias, IconClientes, IconProveedores,
  IconArticulos, IconConfig, IconFormatos, IconTaller, IconVehiculo, IconOrdenes,
  IconAgenda, IconCortesia, IconValoracion, IconPedidos, IconFacturaRecibida, IconTicket, IconSeries,
  IconPlanning, IconOperarios,
  IconNotificaciones, IconCertificado, IconUsuarios, IconCobros, IconPagos, IconModulos,
  IconTelefono, IconAseguradora, IconAyuda, IconServicio, IconAparato, IconLibro,
  LogoFX,
} from "./icons.jsx";
import LlamadaEntrante from "./LlamadaEntrante.jsx";
import PendientesSubida from "./PendientesSubida.jsx";
import { cerrarSesion, esSuperAdmin, payloadToken, rolUsuario } from "../lib/sesion.js";

// Nodo de la barra superior donde CabeceraPagina inserta (portal) el
// título de la página. Los botones de acción van en el propio contenido.
export const CabeceraContext = createContext({ slotTitulo: null });

// Menú en acordeón: solo un grupo abierto a la vez; se abre solo el grupo
// de la página activa. El Panel se abre desde el logotipo.
// Cada entrada tiene un `tono` para su ficha de la barra superior.
const gruposBase = [
  {
    titulo: "Tesorería",
    Icono: IconTesoreria,
    items: [
      { to: "/tesoreria", etiqueta: "Panel", Icono: IconPanel, tono: "indigo", fin: true },
      { to: "/tesoreria/cobros", etiqueta: "Cobros", Icono: IconCobros, tono: "emerald" },
      { to: "/tesoreria/pagos", etiqueta: "Pagos", Icono: IconPagos, tono: "rose" },
    ],
  },
  { titulo: "Artículos", Icono: IconArticulos, directo: "/articulos", tono: "violet" },
  { titulo: "Agenda", Icono: IconAgenda, directo: "/agenda", tono: "emerald" },
  {
    titulo: "Compras",
    Icono: IconFacturaRecibida,
    items: [
      { to: "/proveedores", etiqueta: "Proveedores", Icono: IconProveedores, tono: "amber" },
      { to: "/compras/pedidos", etiqueta: "Pedidos", Icono: IconPedidos, tono: "sky" },
      { to: "/compras/presupuestos", etiqueta: "Presupuestos", Icono: IconPresupuestos, tono: "teal" },
      { to: "/compras/albaranes", etiqueta: "Albaranes", Icono: IconAlbaranes, tono: "emerald" },
      { to: "/compras/facturas", etiqueta: "Facturas", Icono: IconFacturaRecibida, tono: "orange" },
      { to: "/compras/gastos", etiqueta: "Gastos (tickets)", Icono: IconTicket, tono: "rose" },
    ],
  },
  {
    titulo: "Ventas",
    Icono: IconVentas,
    items: [
      { to: "/clientes", etiqueta: "Clientes", Icono: IconClientes, tono: "emerald" },
      { to: "/presupuestos", etiqueta: "Presupuestos", Icono: IconPresupuestos, tono: "teal" },
      { to: "/albaranes", etiqueta: "Albaranes", Icono: IconAlbaranes, tono: "emerald" },
      { to: "/ventas", etiqueta: "Facturas", fin: true, Icono: IconVentas, tono: "violet" },
      { to: "/recurrencias", etiqueta: "Recurrencias", Icono: IconRecurrencias, tono: "slate" },
    ],
  },
  {
    titulo: "Sistema",
    Icono: IconConfig,
    items: [
      { to: "/compras/ocr", etiqueta: "Revisión OCR", Icono: IconOcr, tono: "emerald" },
      { to: "/admin/tenants", etiqueta: "Plataforma", Icono: IconUsuarios, tono: "rose" },
    ],
  },
  {
    titulo: "Ajustes",
    Icono: IconConfig,
    items: [
      { to: "/configuracion", etiqueta: "Configuración", Icono: IconConfig, tono: "slate" },
      { to: "/modulos", etiqueta: "Módulos", Icono: IconModulos, tono: "cyan" },
      { to: "/series", etiqueta: "Series", Icono: IconSeries, tono: "indigo" },
      { to: "/notificaciones", etiqueta: "Notificaciones", Icono: IconNotificaciones, tono: "amber" },
      { to: "/certificado", etiqueta: "Certificado", Icono: IconCertificado, tono: "teal" },
      { to: "/formatos", etiqueta: "Formatos", Icono: IconFormatos, tono: "sky" },
      { to: "/usuarios", etiqueta: "Usuarios", Icono: IconUsuarios, tono: "violet" },
      { to: "/actividad", etiqueta: "Actividad", Icono: IconNotificaciones, tono: "amber" },
    ],
  },
  {
    titulo: "Ayuda",
    Icono: IconAyuda,
    items: [
      { to: "/ayuda/facturacion", etiqueta: "Facturación", Icono: IconVentas, tono: "violet" },
      { to: "/ayuda/taller", etiqueta: "Taller", Icono: IconTaller, tono: "sky" },
      { to: "/ayuda/telefonia", etiqueta: "Telefonía", Icono: IconTelefono, tono: "emerald" },
      { to: "/ayuda/servicio", etiqueta: "Servicio Técnico", Icono: IconServicio, tono: "teal" },
    ],
  },
  { titulo: "Inicio", Icono: IconModulos, directo: "/inicio", tono: "cyan" },
];

// Grupos ligados a módulos activables (licencias): se insertan antes de Sistema.
const gruposModulos = {
  taller: {
    titulo: "Taller",
    Icono: IconTaller,
    items: [
      { to: "/taller", etiqueta: "Panel", fin: true, Icono: IconPanel, tono: "indigo" },
      { to: "/taller/agenda", etiqueta: "Citas", Icono: IconAgenda, tono: "emerald" },
      { to: "/taller/vehiculos", etiqueta: "Vehículos", Icono: IconVehiculo, tono: "sky" },
      { to: "/taller/ordenes", etiqueta: "Órdenes", Icono: IconOrdenes, tono: "violet" },
      { to: "/taller/planning", etiqueta: "Planning", Icono: IconPlanning, tono: "emerald" },
      { to: "/taller/valoraciones", etiqueta: "Valoraciones", Icono: IconValoracion, tono: "amber" },
      { to: "/taller/aseguradoras", etiqueta: "Aseguradoras", Icono: IconAseguradora, tono: "teal" },
      { to: "/taller/cortesia", etiqueta: "Cortesía", Icono: IconCortesia, tono: "rose" },
      { to: "/taller/operarios", etiqueta: "Operarios", Icono: IconOperarios, tono: "cyan" },
    ],
  },
  telefonia: {
    titulo: "Telefonía",
    Icono: IconTelefono,
    items: [
      { to: "/telefonia/llamadas", etiqueta: "Llamadas", fin: true, Icono: IconTelefono, tono: "sky" },
    ],
  },
  servicio: {
    titulo: "Servicio Técnico",
    Icono: IconServicio,
    items: [
      { to: "/servicio", etiqueta: "Panel", fin: true, Icono: IconPanel, tono: "indigo" },
      { to: "/servicio/agenda", etiqueta: "Citas", Icono: IconAgenda, tono: "emerald" },
      { to: "/servicio/aparatos", etiqueta: "Aparatos", Icono: IconAparato, tono: "sky" },
      { to: "/servicio/ordenes", etiqueta: "Órdenes", Icono: IconOrdenes, tono: "violet" },
    ],
  },
  asesoria: {
    titulo: "Asesoría",
    Icono: IconLibro,
    items: [
      { to: "/asesoria", etiqueta: "Panel", fin: true, Icono: IconPanel, tono: "indigo" },
      { to: "/asesoria/cartera", etiqueta: "Cartera", Icono: IconClientes, tono: "emerald" },
      { to: "/asesoria/documentos", etiqueta: "Documentos", Icono: IconOcr, tono: "sky" },
      { to: "/asesoria/libros", etiqueta: "Libros IVA", Icono: IconLibro, tono: "violet" },
      { to: "/asesoria/prevision", etiqueta: "Previsión", Icono: IconTesoreria, tono: "amber" },
      { to: "/asesoria/fiscalidad", etiqueta: "Fiscalidad", Icono: IconAgenda, tono: "rose" },
      { to: "/asesoria/solicitudes", etiqueta: "Solicitudes", Icono: IconNotificaciones, tono: "orange" },
      { to: "/asesoria/cierres", etiqueta: "Cierres", Icono: IconPlanning, tono: "cyan" },
    ],
  },
};

// Colores de las fichas de la barra superior: [inactiva (sobre oscuro), activa (sobre blanco)].
// Clases completas para que Tailwind las genere.
const TONOS_FICHA = {
  indigo: ["bg-indigo-500/15 text-indigo-300", "bg-indigo-100 text-indigo-600"],
  violet: ["bg-violet-500/15 text-violet-300", "bg-violet-100 text-violet-600"],
  emerald: ["bg-emerald-500/15 text-emerald-300", "bg-emerald-100 text-emerald-600"],
  amber: ["bg-amber-500/15 text-amber-300", "bg-amber-100 text-amber-600"],
  sky: ["bg-sky-500/15 text-sky-300", "bg-sky-100 text-sky-600"],
  teal: ["bg-teal-500/15 text-teal-300", "bg-teal-100 text-teal-600"],
  orange: ["bg-orange-500/15 text-orange-300", "bg-orange-100 text-orange-600"],
  rose: ["bg-rose-500/15 text-rose-300", "bg-rose-100 text-rose-600"],
  slate: ["bg-slate-500/20 text-slate-300", "bg-slate-200 text-slate-600"],
};

const rutaActiva = (item, pathname) =>
  item.fin ? pathname === item.to : pathname.startsWith(item.to);

// Logotipo FILANEX: el monograma FX vive en icons.jsx (LogoFX) para poder
// reutilizarlo en el acceso y en el asistente de configuración.
function Chevron({ abierto }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform duration-200 ${abierto ? "rotate-90" : ""}`}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

// Ficha de sub-navegación de la barra superior (icono en tarjeta + etiqueta).
function FichaNav({ to, fin, etiqueta, Icono, tono }) {
  const [inactiva, activa] = TONOS_FICHA[tono] ?? TONOS_FICHA.slate;
  return (
    <NavLink to={to} end={fin} title={etiqueta} className="shrink-0">
      {({ isActive }) => (
        <span
          className={`flex flex-col items-center justify-center gap-1 min-w-[74px] px-2 py-1.5 rounded-xl transition-colors ${
            isActive ? "bg-white" : "hover:bg-white/[0.06]"
          }`}
        >
          <span
            className={`flex items-center justify-center w-8 h-8 rounded-lg ${isActive ? activa : inactiva}`}
          >
            <Icono />
          </span>
          <span
            className={`text-[0.65625rem] font-medium leading-none whitespace-nowrap ${
              isActive ? "text-slate-900" : "text-slate-400"
            }`}
          >
            {etiqueta}
          </span>
        </span>
      )}
    </NavLink>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const amplia = pathname.startsWith("/formatos");
  const [empresa, setEmpresa] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [plegado, setPlegado] = useState(false);
  const [menuMovil, setMenuMovil] = useState(false);
  const [slotTitulo, setSlotTitulo] = useState(null);

  // En móvil el menú es un cajón: se cierra solo al navegar.
  useEffect(() => {
    setMenuMovil(false);
  }, [pathname]);

  useEffect(() => {
    fetch("/api/empresa")
      .then((r) => (r.ok ? r.json() : null))
      .then(setEmpresa)
      .catch(() => setEmpresa(null));
  }, [pathname]);

  useEffect(() => {
    const tokenPayload = payloadToken();
    if (tokenPayload) {
      setUsuario({
        nombre: tokenPayload.nombre || "Usuario",
        email: tokenPayload.email || "",
        rol: tokenPayload.rol || "usuario",
      });
    }
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setUsuario(data);
      })
      .catch(() => {});
  }, []);

  const modulos = empresa?.modulos ?? [];
  const esUsuarioAdmin = rolUsuario() === "admin";
  const esUsuarioSuperAdmin = esSuperAdmin();
  const grupos = [
    ...gruposBase.slice(0, 5),
    ...Object.entries(gruposModulos)
      .filter(([clave]) => modulos.includes(clave))
      .map(([, g]) => g),
    ...(esUsuarioSuperAdmin ? [gruposBase.find((g) => g.titulo === "Sistema")] : []),
    ...(esUsuarioAdmin ? [gruposBase.find((g) => g.titulo === "Ajustes")] : []),
    gruposBase.find((g) => g.titulo === "Inicio"),
    gruposBase.find((g) => g.titulo === "Ayuda"),
  ].filter(Boolean);

  // Al cambiar de página, se abre el grupo que la contiene.
  useEffect(() => {
    const g = grupos.find((grupo) => grupo.items?.some((item) => rutaActiva(item, pathname)));
    if (g) setAbierto(g.titulo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, modulos]);

  // Fichas de la barra superior: las sub-páginas de la sección activa
  // (o una sola ficha para accesos directos y el Panel).
  const seccion = grupos.find((g) => g.items?.some((i) => rutaActiva(i, pathname)));
  const directa = !seccion && grupos.find((g) => g.directo && pathname.startsWith(g.directo));
  const fichas = seccion
    ? seccion.items
    : directa
      ? [{ to: directa.directo, etiqueta: directa.titulo, Icono: directa.Icono, tono: directa.tono }]
      : [{ to: "/", fin: true, etiqueta: "Panel", Icono: IconPanel, tono: "indigo" }];

  const nombreEmpresa = empresa?.nombre ?? "FILA TÉCNICA S.L.";
  const detalleEmpresa =
    [empresa?.nif, empresa?.poblacion ?? empresa?.ciudad].filter(Boolean).join(" · ") ||
    "B75418350 · San Fernando";

  return (
    <div className="min-h-screen flex">
      {/* Fondo oscuro del cajón en móvil */}
      {menuMovil && (
        <div
          className="no-print fixed inset-0 z-30 bg-black/55 lg:hidden"
          onClick={() => setMenuMovil(false)}
        />
      )}
      <aside
        className={`no-print shrink-0 border-r border-white/[0.06] flex flex-col bg-[#0B1220] transition-all duration-200 w-60 ${
          plegado ? "lg:w-[68px]" : "lg:w-60"
        } fixed inset-y-0 left-0 z-40 lg:static lg:z-auto ${
          menuMovil ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className={`pt-5 pb-4 ${plegado ? "lg:px-2 px-4" : "px-4"}`}>
          <div className="flex items-center">
            <Link
              to="/tesoreria"
              title="Tesorería"
              className={`flex items-center ${plegado ? "lg:justify-center gap-3" : "gap-3"}`}
            >
              <span className="relative w-16 h-16 rounded-2xl flex items-center justify-center border border-white/10 bg-white/[0.04] text-white shrink-0">
                <LogoFX size={42} />
              </span>
              <span className={plegado ? "lg:hidden" : ""}>
                <span className="block text-[1.375rem] font-bold tracking-[0.16em] leading-none text-white">
                  FILANEX
                </span>
                <span className="block text-[0.65625rem] text-slate-500 mt-1.5 tracking-[0.14em] uppercase leading-tight">
                  Facturación
                  <br />
                  VeriFactu
                </span>
              </span>
            </Link>
            {/* Cerrar cajón (solo móvil) */}
            <button
              onClick={() => setMenuMovil(false)}
              className="ml-auto lg:hidden text-slate-500 hover:text-white text-2xl leading-none px-2"
              aria-label="Cerrar menú"
            >
              ×
            </button>
          </div>
        </div>

        <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto ${plegado ? "lg:px-2 px-2.5" : "px-2.5"}`}>
          {grupos.map((grupo) => {
            // Entrada directa (sin desplegable): navega al hacer clic.
            if (grupo.directo) {
              const activa = pathname.startsWith(grupo.directo);
              return (
                <NavLink
                  key={grupo.titulo}
                  to={grupo.directo}
                  title={grupo.titulo}
                  className={`flex items-center gap-3 py-2.5 rounded-lg text-[0.84375rem] transition-colors px-3 ${
                    plegado ? "lg:justify-center lg:px-0" : ""
                  } ${
                    activa
                      ? "bg-white/[0.08] text-sky-300 font-medium"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="shrink-0 flex items-center justify-center w-5 h-5">
                    <grupo.Icono />
                  </span>
                  <span className={`flex-1 ${plegado ? "lg:hidden" : ""}`}>{grupo.titulo}</span>
                  {activa && (
                    <span className={`w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0 ${plegado ? "lg:hidden" : ""}`} />
                  )}
                </NavLink>
              );
            }

            const esAbierto = abierto === grupo.titulo;
            const contieneActiva = grupo.items.some((item) => rutaActiva(item, pathname));
            return (
              <div key={grupo.titulo}>
                <button
                  onClick={() => {
                    if (plegado && window.innerWidth >= 1024) {
                      setPlegado(false);
                      setAbierto(grupo.titulo);
                    } else {
                      setAbierto(esAbierto ? null : grupo.titulo);
                    }
                  }}
                  title={grupo.titulo}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-[0.84375rem] transition-colors px-3 ${
                    plegado ? "lg:justify-center lg:px-0" : ""
                  } ${
                    contieneActiva
                      ? "text-sky-300 font-medium"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="shrink-0 flex items-center justify-center w-5 h-5">
                    <grupo.Icono />
                  </span>
                  <span className={`flex-1 text-left ${plegado ? "lg:hidden" : ""}`}>{grupo.titulo}</span>
                  <span className={`${contieneActiva ? "text-sky-400/70" : "text-slate-600"} ${plegado ? "lg:hidden" : ""}`}>
                    <Chevron abierto={esAbierto} />
                  </span>
                </button>

                {esAbierto && (
                  <div className={`mt-0.5 mb-1.5 ml-[19px] pl-3.5 border-l border-white/[0.07] space-y-0.5 ${plegado ? "lg:hidden" : ""}`}>
                    {grupo.items.map(({ to, etiqueta, fin }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={fin}
                        className={({ isActive }) =>
                          `flex items-center gap-2 px-3 py-2 rounded-lg text-[0.8125rem] transition-colors ${
                            isActive
                              ? "bg-white/[0.08] text-sky-300 font-medium"
                              : "text-slate-500 hover:text-white hover:bg-white/[0.05]"
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span className="flex-1">{etiqueta}</span>
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                            )}
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className={`hidden lg:block ${plegado ? "px-2" : "px-3"} py-2 border-t border-white/[0.06]`}>
          <button
            onClick={() => setPlegado(!plegado)}
            title={plegado ? "Desplegar menú" : "Plegar menú"}
            className={`w-full flex items-center gap-2.5 py-2 rounded-lg text-[0.78125rem] text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors ${
              plegado ? "justify-center px-0" : "px-3"
            }`}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`transition-transform duration-200 ${plegado ? "rotate-180" : ""}`}
            >
              <path d="m11 7-5 5 5 5" />
              <path d="m18 7-5 5 5 5" />
            </svg>
            {!plegado && "Plegar"}
          </button>
        </div>

        {plegado && (
          <div
            className="hidden lg:flex py-4 border-t border-white/[0.06] justify-center"
            title={`${nombreEmpresa} · VeriFactu activo`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
        )}
        <div className={`px-5 py-4 border-t border-white/[0.06] ${plegado ? "lg:hidden" : ""}`}>
          <p className="text-[0.78125rem] font-bold text-white tracking-tight truncate">
            {nombreEmpresa}
          </p>
          <p className="text-[0.6875rem] text-slate-500 mt-0.5 truncate">{detalleEmpresa}</p>
          <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium mt-2 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            VeriFactu activo
          </p>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {!amplia && (
          <header className="no-print sticky top-0 z-20 flex items-center flex-wrap content-center gap-x-3 sm:gap-x-6 gap-y-2 px-3 sm:px-6 py-3 min-h-[64px] lg:min-h-[104px] shrink-0 bg-[#0B1220] border-b border-white/[0.07]">
            {/* Abrir menú (solo móvil) */}
            <button
              onClick={() => setMenuMovil(true)}
              aria-label="Abrir menú"
              className="lg:hidden shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:bg-white/[0.07]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            {/* Empresa + título de página (rellenado por CabeceraPagina vía portal) */}
            <div className="min-w-0 shrink-0">
              <p className="text-[0.625rem] font-medium tracking-[0.18em] uppercase text-slate-500 truncate mb-1.5 hidden sm:block">
                {nombreEmpresa}
              </p>
              <div ref={setSlotTitulo} className="min-w-0 max-w-[380px]" />
            </div>

            {/* Iconos de la sección activa (pegados al título; si no caben, scroll) */}
            <nav className="order-last basis-full -mx-1 px-1 overflow-x-auto lg:order-none lg:basis-auto lg:flex-1 lg:min-w-0">
              <div className="flex items-center gap-0.5 w-max">
                {fichas.map((f) => (
                  <FichaNav key={f.to} {...f} />
                ))}
              </div>
            </nav>

            <div className="hidden sm:flex items-center shrink-0">
              <span className="flex items-center gap-1.5 text-emerald-400 text-[0.75rem] font-semibold whitespace-nowrap">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                Compatible VeriFactu
              </span>
            </div>

            <PendientesSubida />

            {/* Sesión: usuario conectado y salir */}
            {usuario && (
              <div className="flex items-center gap-2 shrink-0 pl-3 border-l border-white/[0.09]">
                <span
                  className="hidden md:inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent/20 text-accent text-[0.6875rem] font-bold"
                  title={`${usuario.nombre} · ${usuario.email}`}
                >
                  {usuario.nombre?.slice(0, 1).toUpperCase()}
                </span>
                <button
                  onClick={cerrarSesion}
                  title={`Cerrar sesión (${usuario.nombre})`}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-rose-400 text-[0.75rem] font-medium transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="m16 17 5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </div>
            )}
          </header>
        )}
        <div className={`relative flex-1 ${amplia ? "" : "tema-claro"}`}>
          <CabeceraContext.Provider value={{ slotTitulo }}>
            <main className={`relative ${amplia ? "" : "px-3 py-4 sm:px-6 sm:py-6 max-w-[100rem]"}`}>
              <Outlet />
            </main>
          </CabeceraContext.Provider>
        </div>
      </div>
      {/* Aviso de llamada entrante de la centralita IP (global, flotante) */}
      <LlamadaEntrante />
    </div>
  );
}
