import { createContext, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  IconPanel, IconVentas, IconPresupuestos, IconAlbaranes, IconOcr,
  IconTesoreria, IconRecurrencias, IconClientes, IconProveedores,
  IconArticulos, IconConfig, IconFormatos, IconTaller, IconVehiculo, IconOrdenes,
  IconAgenda, IconCortesia, IconValoracion, IconPedidos, IconFacturaRecibida, IconSeries,
  IconNotificaciones, IconCertificado, IconUsuarios, IconCobros, IconPagos, IconModulos,
  IconTelefono,
} from "./icons.jsx";
import LlamadaEntrante from "./LlamadaEntrante.jsx";

// Nodos de la barra superior donde CabeceraPagina inserta (portal) el
// título de la página y sus botones de acción.
export const CabeceraContext = createContext({ slotTitulo: null, slotAcciones: null });

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
  {
    titulo: "Compras",
    Icono: IconFacturaRecibida,
    items: [
      { to: "/proveedores", etiqueta: "Proveedores", Icono: IconProveedores, tono: "amber" },
      { to: "/compras/pedidos", etiqueta: "Pedidos", Icono: IconPedidos, tono: "sky" },
      { to: "/compras/presupuestos", etiqueta: "Presupuestos", Icono: IconPresupuestos, tono: "teal" },
      { to: "/compras/albaranes", etiqueta: "Albaranes", Icono: IconAlbaranes, tono: "emerald" },
      { to: "/compras/facturas", etiqueta: "Facturas", Icono: IconFacturaRecibida, tono: "orange" },
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
      { to: "/configuracion", etiqueta: "Configuración", Icono: IconConfig, tono: "slate" },
      { to: "/modulos", etiqueta: "Módulos", Icono: IconModulos, tono: "cyan" },
      { to: "/series", etiqueta: "Series", Icono: IconSeries, tono: "indigo" },
      { to: "/notificaciones", etiqueta: "Notificaciones", Icono: IconNotificaciones, tono: "amber" },
      { to: "/certificado", etiqueta: "Certificado", Icono: IconCertificado, tono: "teal" },
      { to: "/formatos", etiqueta: "Formatos", Icono: IconFormatos, tono: "sky" },
      { to: "/usuarios", etiqueta: "Usuarios", Icono: IconUsuarios, tono: "violet" },
      { to: "/compras/ocr", etiqueta: "Revisión OCR", Icono: IconOcr, tono: "emerald" },
    ],
  },
];

// Grupos ligados a módulos activables (licencias): se insertan antes de Sistema.
const gruposModulos = {
  taller: {
    titulo: "Taller",
    Icono: IconTaller,
    items: [
      { to: "/taller", etiqueta: "Panel", fin: true, Icono: IconPanel, tono: "indigo" },
      { to: "/taller/agenda", etiqueta: "Agenda", Icono: IconAgenda, tono: "emerald" },
      { to: "/taller/vehiculos", etiqueta: "Vehículos", Icono: IconVehiculo, tono: "sky" },
      { to: "/taller/ordenes", etiqueta: "Órdenes", Icono: IconOrdenes, tono: "violet" },
      { to: "/taller/valoraciones", etiqueta: "Valoraciones", Icono: IconValoracion, tono: "amber" },
      { to: "/taller/cortesia", etiqueta: "Cortesía", Icono: IconCortesia, tono: "rose" },
    ],
  },
  telefonia: {
    titulo: "Telefonía",
    Icono: IconTelefono,
    items: [
      { to: "/telefonia/llamadas", etiqueta: "Llamadas", fin: true, Icono: IconTelefono, tono: "sky" },
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

// Logotipo FILANEX: monograma FX unido por el punto de conexión azul.
function LogoFX({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
        <path d="M9 25V7h8.5" />
        <path d="M9 13h4" />
        <path d="M13 13l4 4" />
        <path d="M17 17l7.5-7.5" />
        <path d="M17 17l7.5 7.5" />
        <path d="M17 17l-5 5" />
      </g>
      <circle cx="17" cy="17" r="2.5" fill="#0EA5E9" />
    </svg>
  );
}

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
          className={`flex flex-col items-center justify-center gap-1 w-[74px] py-1.5 rounded-xl transition-colors ${
            isActive ? "bg-white" : "hover:bg-white/[0.06]"
          }`}
        >
          <span
            className={`flex items-center justify-center w-8 h-8 rounded-lg ${isActive ? activa : inactiva}`}
          >
            <Icono />
          </span>
          <span
            className={`text-[10.5px] font-medium leading-none whitespace-nowrap ${
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
  const [abierto, setAbierto] = useState(null);
  const [plegado, setPlegado] = useState(false);
  const [slotTitulo, setSlotTitulo] = useState(null);
  const [slotAcciones, setSlotAcciones] = useState(null);

  useEffect(() => {
    fetch("/api/empresa")
      .then((r) => (r.ok ? r.json() : null))
      .then(setEmpresa)
      .catch(() => setEmpresa(null));
  }, [pathname]);

  const modulos = empresa?.modulos ?? [];
  const grupos = [
    ...gruposBase.slice(0, 4),
    ...Object.entries(gruposModulos)
      .filter(([clave]) => modulos.includes(clave))
      .map(([, g]) => g),
    ...gruposBase.slice(4),
  ];

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
      <aside
        className={`no-print shrink-0 border-r border-white/[0.06] flex flex-col bg-[#0B1220] transition-all duration-200 ${
          plegado ? "w-[68px]" : "w-60"
        }`}
      >
        <div className={`pt-5 pb-4 ${plegado ? "px-2" : "px-4"}`}>
          <Link
            to="/"
            title="Panel general"
            className={`flex items-center ${plegado ? "justify-center" : "gap-3"}`}
          >
            <span className="relative w-16 h-16 rounded-2xl flex items-center justify-center border border-white/10 bg-white/[0.04] text-white shrink-0">
              <LogoFX size={42} />
            </span>
            {!plegado && (
              <div className="min-w-0">
                <span className="block text-[22px] font-bold tracking-[0.16em] leading-none text-white">
                  FILANEX
                </span>
                <span className="block text-[10.5px] text-slate-500 mt-1.5 tracking-[0.14em] uppercase whitespace-nowrap">
                  Facturación VeriFactu
                </span>
              </div>
            )}
          </Link>
        </div>

        <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto ${plegado ? "px-2" : "px-2.5"}`}>
          {grupos.map((grupo) => {
            // Entrada directa (sin desplegable): navega al hacer clic.
            if (grupo.directo) {
              const activa = pathname.startsWith(grupo.directo);
              return (
                <NavLink
                  key={grupo.titulo}
                  to={grupo.directo}
                  title={grupo.titulo}
                  className={`flex items-center gap-3 py-2.5 rounded-lg text-[13.5px] transition-colors ${
                    plegado ? "justify-center px-0" : "px-3"
                  } ${
                    activa
                      ? "bg-white/[0.08] text-sky-300 font-medium"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="shrink-0 flex items-center justify-center w-5 h-5">
                    <grupo.Icono />
                  </span>
                  {!plegado && (
                    <>
                      <span className="flex-1">{grupo.titulo}</span>
                      {activa && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />}
                    </>
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
                    if (plegado) {
                      setPlegado(false);
                      setAbierto(grupo.titulo);
                    } else {
                      setAbierto(esAbierto ? null : grupo.titulo);
                    }
                  }}
                  title={grupo.titulo}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-[13.5px] transition-colors ${
                    plegado ? "justify-center px-0" : "px-3"
                  } ${
                    contieneActiva
                      ? "text-sky-300 font-medium"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="shrink-0 flex items-center justify-center w-5 h-5">
                    <grupo.Icono />
                  </span>
                  {!plegado && (
                    <>
                      <span className="flex-1 text-left">{grupo.titulo}</span>
                      <span className={contieneActiva ? "text-sky-400/70" : "text-slate-600"}>
                        <Chevron abierto={esAbierto} />
                      </span>
                    </>
                  )}
                </button>

                {esAbierto && !plegado && (
                  <div className="mt-0.5 mb-1.5 ml-[19px] pl-3.5 border-l border-white/[0.07] space-y-0.5">
                    {grupo.items.map(({ to, etiqueta, fin }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={fin}
                        className={({ isActive }) =>
                          `flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors ${
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

        <div className={`${plegado ? "px-2" : "px-3"} py-2 border-t border-white/[0.06]`}>
          <button
            onClick={() => setPlegado(!plegado)}
            title={plegado ? "Desplegar menú" : "Plegar menú"}
            className={`w-full flex items-center gap-2.5 py-2 rounded-lg text-[12.5px] text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors ${
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

        {plegado ? (
          <div
            className="py-4 border-t border-white/[0.06] flex justify-center"
            title={`${nombreEmpresa} · VeriFactu activo`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
        ) : (
          <div className="px-5 py-4 border-t border-white/[0.06]">
            <p className="text-[12.5px] font-bold text-white tracking-tight truncate">
              {nombreEmpresa}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{detalleEmpresa}</p>
            <p className="flex items-center gap-1.5 text-[11px] font-medium mt-2 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              VeriFactu activo
            </p>
          </div>
        )}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {!amplia && (
          <header className="no-print sticky top-0 z-20 flex items-center flex-wrap content-center gap-x-6 gap-y-2 px-6 py-3 min-h-[104px] shrink-0 bg-[#0B1220] border-b border-white/[0.07]">
            {/* Empresa + título de página (rellenado por CabeceraPagina vía portal) */}
            <div className="min-w-0 shrink-0">
              <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-slate-500 truncate mb-1.5">
                {nombreEmpresa}
              </p>
              <div ref={setSlotTitulo} className="min-w-0 max-w-[380px]" />
            </div>

            {/* Iconos de la sección activa (pegados al título; si no caben, scroll) */}
            <nav className="flex-1 min-w-max overflow-x-auto">
              <div className="flex items-center gap-0.5 w-max">
                {fichas.map((f) => (
                  <FichaNav key={f.to} {...f} />
                ))}
              </div>
            </nav>

            {/* Botones de acción de la página (rellenados vía portal) */}
            <div ref={setSlotAcciones} className="acciones-barra flex items-center gap-2 shrink-0" />

            <div className="flex items-center shrink-0">
              <span className="flex items-center gap-1.5 text-emerald-400 text-[12px] font-semibold whitespace-nowrap">
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
          </header>
        )}
        <div className={`relative flex-1 ${amplia ? "" : "tema-claro"}`}>
          <CabeceraContext.Provider value={{ slotTitulo, slotAcciones }}>
            <main className={`relative ${amplia ? "" : "px-4 py-6 max-w-[1400px]"}`}>
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
