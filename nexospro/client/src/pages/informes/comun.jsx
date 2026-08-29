// Piezas comunes de los informes (Informes → Ventas/Compras/IVA): filtro de
// fechas con atajos, carga de datos, tabla con pie de totales y exportación
// a CSV compatible con Excel (separador ; y BOM).
import { useEffect, useState } from "react";
import { euros } from "../../components/ui.jsx";

export { euros };

export const fmtFecha = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-ES") : "—";

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Atajos del filtro: calculan desde/hasta de un vistazo.
export const ATAJOS = [
  {
    clave: "mes",
    etiqueta: "Este mes",
    rango: () => {
      const h = new Date();
      return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), iso(h)];
    },
  },
  {
    clave: "mes-pasado",
    etiqueta: "Mes pasado",
    rango: () => {
      const h = new Date();
      return [iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), iso(new Date(h.getFullYear(), h.getMonth(), 0))];
    },
  },
  {
    clave: "trimestre",
    etiqueta: "Este trimestre",
    rango: () => {
      const h = new Date();
      const inicio = new Date(h.getFullYear(), Math.floor(h.getMonth() / 3) * 3, 1);
      return [iso(inicio), iso(h)];
    },
  },
  {
    clave: "ano",
    etiqueta: "Este año",
    rango: () => {
      const h = new Date();
      return [iso(new Date(h.getFullYear(), 0, 1)), iso(h)];
    },
  },
  { clave: "todo", etiqueta: "Todo", rango: () => ["", ""] },
];

export function rangoInicial() {
  return ATAJOS.find((a) => a.clave === "ano").rango();
}

export function FiltroFechas({ desde, hasta, onCambio, atajo, onAtajo }) {
  return (
    <div className="flex flex-wrap items-end gap-2 mb-4">
      <div className="flex flex-wrap gap-1">
        {ATAJOS.map((a) => (
          <button
            key={a.clave}
            type="button"
            onClick={() => onAtajo(a.clave)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              atajo === a.clave
                ? "bg-accent/15 text-accent border-accent/30"
                : "bg-white/5 text-slate-400 border-white/10 hover:text-slate-200"
            }`}
          >
            {a.etiqueta}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="text-xs text-slate-500 flex items-center gap-2">
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => onCambio(e.target.value, hasta)}
            className="input !w-auto"
          />
        </label>
        <label className="text-xs text-slate-500 flex items-center gap-2">
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => onCambio(desde, e.target.value)}
            className="input !w-auto"
          />
        </label>
      </div>
    </div>
  );
}

// Carga un endpoint de informes cada vez que cambian las fechas.
export function useInforme(url, desde, hasta) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    fetch(`${url}?${params}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "No se pudo cargar el informe");
        return j;
      })
      .then((j) => vivo && setDatos(j))
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [url, desde, hasta]);
  return { datos, error, cargando };
}

// Descarga las filas mostradas como CSV que Excel abre directamente.
export function descargarCSV(nombre, cabeceras, filas) {
  const celda = (v) => {
    if (typeof v === "number") return String(v).replace(".", ",");
    const t = String(v ?? "");
    return /[;";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lineas = [cabeceras, ...filas].map((f) => f.map(celda).join(";"));
  const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `${nombre}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

export function BotonCSV({ nombre, cabeceras, filas }) {
  return (
    <button
      type="button"
      onClick={() => descargarCSV(nombre, cabeceras, filas)}
      className="btn-ghost text-xs px-3 py-1.5"
    >
      Exportar CSV
    </button>
  );
}

// Tabla de informe con cabecera fija, números a la derecha y pie de totales.
export function TablaInforme({ columnas, filas, pie, cargando, vacio = "No hay datos en este periodo." }) {
  if (cargando) return <p className="text-sm text-slate-500 py-8 text-center">Cargando…</p>;
  if (!filas?.length) return <p className="text-sm text-slate-500 py-8 text-center">{vacio}</p>;
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            {columnas.map((c) => (
              <th
                key={c.etiqueta}
                className={`py-2 pr-3 text-xs font-semibold text-slate-500 whitespace-nowrap ${c.num ? "text-right" : ""}`}
              >
                {c.etiqueta}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{filas}</tbody>
        {pie && (
          <tfoot>
            <tr className="border-t-2 border-line font-semibold text-white">{pie}</tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export const TdNum = ({ children, fuerte }) => (
  <td className={`py-2.5 pr-3 text-right whitespace-nowrap num ${fuerte ? "text-white font-semibold" : "text-slate-300"}`}>
    {children}
  </td>
);

export const Td = ({ children }) => <td className="py-2.5 pr-3 text-slate-300">{children}</td>;

// Desglose de IVA en una línea: "21 %: 1.000,00 € + 210,00 €".
export const textoDesglose = (iva) =>
  (iva ?? []).map((d) => `${d.tipo} %: ${euros(d.base)} + ${euros(d.cuota)}`).join("  ·  ");

// Subtítulo del periodo para las impresiones: "Del 01/01/2026 al 29/08/2026".
export const textoPeriodo = (desde, hasta) =>
  desde && hasta ? `Del ${fmtFecha(desde + "T00:00:00")} al ${fmtFecha(hasta + "T00:00:00")}`
    : desde ? `Desde el ${fmtFecha(desde + "T00:00:00")}`
    : hasta ? `Hasta el ${fmtFecha(hasta + "T00:00:00")}`
    : "Todos los datos";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Imprime el informe en una ventana limpia (A4, sin recuadros, estilo
// documento): el usuario elige impresora o "Guardar como PDF".
// secciones: [{ titulo, columnas: [{ etiqueta, num }], filas: [[...]], pie: [...] }]
export function imprimirInforme({ titulo, subtitulo, empresa, secciones, notaFinal, horizontal }) {
  const ventana = window.open("", "_blank");
  if (!ventana) return;

  const seccionHtml = (s) => `
    ${s.titulo ? `<h2>${esc(s.titulo)}</h2>` : ""}
    <table>
      <thead><tr>${s.columnas.map((c) => `<th class="${c.num ? "num" : ""}">${esc(c.etiqueta)}</th>`).join("")}</tr></thead>
      <tbody>
        ${s.filas.map((f) => `<tr>${f.map((v, i) => `<td class="${s.columnas[i]?.num ? "num" : ""}">${esc(v)}</td>`).join("")}</tr>`).join("")}
      </tbody>
      ${s.pie ? `<tfoot><tr>${s.pie.map((v, i) => `<td class="${s.columnas[i]?.num ? "num" : ""}">${esc(v)}</td>`).join("")}</tr></tfoot>` : ""}
    </table>`;

  ventana.document.write(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(titulo)}</title>
<style>
  @page { size: A4 ${horizontal ? "landscape" : "portrait"}; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #1a1a1a; font-size: 10pt; margin: 0; }
  .cab { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #0f172a; padding-bottom: 8px; margin-bottom: 14px; }
  .marca { font-size: 15pt; font-weight: 800; letter-spacing: 3px; color: #0f172a; }
  .marca span { color: #0891b2; }
  .empresa { text-align: right; font-size: 9pt; color: #444; }
  .empresa b { font-size: 10pt; color: #1a1a1a; }
  h1 { font-size: 14pt; margin: 0 0 2px; }
  .periodo { color: #666; font-size: 9pt; margin-bottom: 14px; }
  h2 { font-size: 11pt; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: .4px; color: #555; border-bottom: 1.5px solid #333; padding: 4px 6px; }
  td { border-bottom: .5px solid #ddd; padding: 5px 6px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tfoot td { border-top: 2px solid #333; border-bottom: none; font-weight: 700; padding-top: 6px; }
  .nota { margin-top: 14px; font-size: 8pt; color: #777; }
  .pie-pagina { margin-top: 22px; font-size: 8pt; color: #999; display: flex; justify-content: space-between; border-top: .5px solid #ddd; padding-top: 6px; }
  tr { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="cab">
    <div class="marca">FI<span>LA</span>NEX</div>
    <div class="empresa"><b>${esc(empresa?.nombre ?? "")}</b>${empresa?.nif ? `<br>NIF ${esc(empresa.nif)}` : ""}</div>
  </div>
  <h1>${esc(titulo)}</h1>
  <p class="periodo">${esc(subtitulo)}</p>
  ${secciones.map(seccionHtml).join("")}
  ${notaFinal ? `<p class="nota">${esc(notaFinal)}</p>` : ""}
  <div class="pie-pagina"><span>Generado el ${new Date().toLocaleString("es-ES")}</span><span>FILANEX — Facturación VeriFactu</span></div>
  <script>window.onload = () => window.print();<\/script>
</body>
</html>`);
  ventana.document.close();
}

export function BotonImprimir({ titulo, subtitulo, secciones, notaFinal, horizontal }) {
  const [empresa, setEmpresa] = useState(null);
  useEffect(() => {
    fetch("/api/empresa").then((r) => r.json()).then(setEmpresa).catch(() => {});
  }, []);
  return (
    <button
      type="button"
      onClick={() => imprimirInforme({ titulo, subtitulo, empresa, secciones, notaFinal, horizontal })}
      className="btn-ghost text-xs px-3 py-1.5"
    >
      Imprimir / PDF
    </button>
  );
}
