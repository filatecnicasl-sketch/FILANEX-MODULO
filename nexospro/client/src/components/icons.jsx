// Iconos SVG en línea (trazo 1.8, estilo lucide) para la navegación.
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const Svg = ({ children, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden="true">
    {children}
  </svg>
);

// Monograma de la marca (FX): la F y la X trazadas con el punto azul del
// acento en el cruce. Es el logotipo oficial de FILANEX y debe usarse
// siempre así (menú, acceso y asistente de configuración).
export function LogoFX({ size = 26 }) {
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

export const IconPanel = () => (
  <Svg>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Svg>
);

export const IconVentas = () => (
  <Svg>
    <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
    <path d="M14 2v6h6" />
    <path d="M9 15h6M9 18h4" />
  </Svg>
);

export const IconPresupuestos = () => (
  <Svg>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </Svg>
);

export const IconAlbaranes = () => (
  <Svg>
    <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
    <path d="M3 8l9 5 9-5M12 13v8" />
  </Svg>
);

export const IconOcr = () => (
  <Svg>
    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M7 12h10" />
  </Svg>
);

export const IconSeries = () => (
  <Svg>
    <path d="M12 2 2 7l10 5 10-5-10-5z" />
    <path d="m2 12 10 5 10-5" />
    <path d="m2 17 10 5 10-5" />
  </Svg>
);

export const IconNotificaciones = () => (
  <Svg>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </Svg>
);

export const IconCertificado = () => (
  <Svg>
    <path d="M12 2 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-4z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

export const IconUsuarios = () => (
  <Svg>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
);

export const IconTesoreria = () => (
  <Svg>
    <path d="M3 21h18M4 10h16M12 3l9 7H3l9-7z" />
    <path d="M6 10v11M18 10v11M10 14v4M14 14v4" />
  </Svg>
);

export const IconRecurrencias = () => (
  <Svg>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </Svg>
);

export const IconClientes = () => (
  <Svg>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6.2" />
  </Svg>
);

export const IconProveedores = () => (
  <Svg>
    <path d="M3 21V8l6 4V8l6 4V4h6v17H3z" />
    <path d="M8 17h2M13 17h2" />
  </Svg>
);

export const IconArticulos = () => (
  <Svg>
    <path d="M20.6 13.4L11 3.8A2 2 0 0 0 9.6 3H4a1 1 0 0 0-1 1v5.6c0 .5.2 1 .6 1.4l9.6 9.6a2 2 0 0 0 2.8 0l4.6-4.6a2 2 0 0 0 0-2.6z" />
    <circle cx="7.5" cy="7.5" r="1" />
  </Svg>
);

export const IconFormatos = () => (
  <Svg>
    <path d="M6 9V3h12v6" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </Svg>
);

export const IconConfig = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01A1.7 1.7 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1 1.55.61.26 1.32.13 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01c.26.6.87 1 1.55 1H21a2 2 0 1 1 0 4h-.09c-.68 0-1.3.4-1.51 1z" />
  </Svg>
);

export const IconTaller = () => (
  <Svg>
    <path d="M14.7 6.3a4.5 4.5 0 0 0-6 5.9L3 18v3h3l5.8-5.7a4.5 4.5 0 0 0 5.9-6l-3 3-2.1-.6-.6-2.1 2.7-3.3z" />
  </Svg>
);

export const IconVehiculo = () => (
  <Svg>
    <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
    <path d="M3 16v-2a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2" />
    <path d="M5 16v3M19 16v3" />
    <circle cx="7.5" cy="14" r="1" />
    <circle cx="16.5" cy="14" r="1" />
  </Svg>
);

export const IconOrdenes = () => (
  <Svg>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4a2 2 0 0 1 6 0" />
    <path d="M9 11h6M9 15h4" />
  </Svg>
);

export const IconAgenda = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
    <circle cx="8.5" cy="14.5" r="1" />
    <circle cx="12" cy="14.5" r="1" />
  </Svg>
);

export const IconPlanning = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18M3 14h18M3 18h18M12 10v11" />
  </Svg>
);

export const IconOperarios = () => (
  <Svg>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5" />
    <path d="M17.5 4.8l2.6 2.6-4.4 4.4-2.6-2.6zM13.6 8.7l-1.9 1.9" />
  </Svg>
);

export const IconCortesia = () => (
  <Svg>
    <circle cx="8" cy="15" r="4" />
    <path d="M10.8 12.2 21 2M15 8l3 3M18 5l2 2" />
  </Svg>
);

export const IconValoracion = () => (
  <Svg>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
    <path d="M8 10.5h5M10.5 8v5" />
  </Svg>
);

export const IconAseguradora = () => (
  <Svg>
    <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" />
    <path d="M12 7.5v4" />
    <path d="M10 9.5h4" />
    <path d="M9.5 15.5h5" />
  </Svg>
);

export const IconPedidos = () => (
  <Svg>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4a3 3 0 0 1 6 0M9 11l2 2 4-4" />
  </Svg>
);

export const IconFacturaRecibida = () => (
  <Svg>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M12 8v6M9.5 11.5 12 14l2.5-2.5M9 17h6" />
  </Svg>
);

// Ticket de gasto: papel de caja con el borde inferior dentado.
export const IconTicket = () => (
  <Svg>
    <path d="M6 3h12v16l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 19Z" />
    <path d="M9 8h6M9 12h6" />
  </Svg>
);

export const IconEditar = () => (
  <Svg size={15}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
);

export const IconBorrar = () => (
  <Svg size={15}>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
);

export const IconImprimir = () => (
  <Svg size={15}>
    <path d="M6 9V3h12v6" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="7" rx="1" />
  </Svg>
);

export const IconPdf = () => (
  <Svg size={15}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M9 17v-4h1.5a1.5 1.5 0 0 1 0 3H9" />
    <path d="M14 17v-4h1.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5H14z" />
  </Svg>
);

export const IconOjo = () => (
  <Svg size={15}>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
);

export const IconXml = () => (
  <Svg size={15}>
    <path d="m8 6-6 6 6 6" />
    <path d="m16 6 6 6-6 6" />
    <path d="m13.5 4-3 16" />
  </Svg>
);

export const IconAnular = () => (
  <Svg size={15}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </Svg>
);

export const IconCobros = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v8m0 0-3-3m3 3 3-3" />
  </Svg>
);

export const IconPagos = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 15V7m0 0-3 3m3-3 3 3" />
  </Svg>
);

export const IconModulos = () => (
  <Svg>
    <rect x="3" y="3" width="8" height="8" rx="2" />
    <rect x="13" y="3" width="8" height="8" rx="2" />
    <rect x="3" y="13" width="8" height="8" rx="2" />
    <path d="M17 14v6m-3-3h6" />
  </Svg>
);

export const IconTelefono = ({ size }) => (
  <Svg size={size}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9z" />
  </Svg>
);

export const IconFirma = () => (
  <Svg size={15}>
    <path d="m14 4 6 6L9 21H3v-6L14 4z" />
    <path d="m12 6 6 6" />
  </Svg>
);

export const IconAyuda = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.6-3 4.2" />
    <path d="M12 17.2h.01" />
  </Svg>
);

export const IconLibro = () => (
  <Svg>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z" />
    <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
  </Svg>
);

// Servicio Técnico (SAT): chip de circuito.
export const IconServicio = () => (
  <Svg>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <rect x="10" y="10" width="4" height="4" />
    <path d="M9 2v2.5M15 2v2.5M9 19.5V22M15 19.5V22M2 9h2.5M2 15h2.5M19.5 9H22M19.5 15H22" />
  </Svg>
);

// Aparato (portátil).
export const IconAparato = () => (
  <Svg>
    <rect x="4" y="4" width="16" height="11" rx="2" />
    <path d="M2 19h20" />
  </Svg>
);
