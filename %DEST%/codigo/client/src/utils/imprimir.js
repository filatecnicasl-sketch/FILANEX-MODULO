// Impresión individual de documentos y fichas.
// Genera una ventana con HTML limpio (solo negro sobre blanco) y llama a print().

let cacheEmpresa = null;
async function empresa() {
  if (!cacheEmpresa) {
    const r = await fetch("/api/empresa");
    cacheEmpresa = r.ok ? await r.json() : {};
  }
  return cacheEmpresa;
}

const euros = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(n) || 0);

const fechaEs = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "—");

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const ESTILOS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:"Segoe UI", Arial, sans-serif; color:#111; padding:36px 40px; font-size:13px; }
  .cab { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #111; padding-bottom:14px; margin-bottom:18px; }
  .cab .emp { font-size:16px; font-weight:700; }
  .cab .emp small { display:block; font-size:11px; font-weight:400; color:#444; margin-top:3px; }
  .cab .doc { text-align:right; }
  .cab .doc b { font-size:17px; text-transform:uppercase; letter-spacing:1px; }
  .cab .doc span { display:block; font-size:12px; color:#444; margin-top:3px; }
  .bloque { background:#f4f4f4; border:1px solid #ddd; border-radius:6px; padding:10px 14px; margin-bottom:16px; }
  .bloque .quien { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#666; margin-bottom:3px; }
  .bloque .nombre { font-weight:700; }
  .bloque .det { color:#444; font-size:12px; margin-top:2px; }
  table { width:100%; border-collapse:collapse; margin-bottom:16px; }
  th { text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:.6px; color:#555; border-bottom:1.5px solid #333; padding:6px 8px; }
  td { padding:7px 8px; border-bottom:1px solid #e3e3e3; vertical-align:top; }
  .num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .tot { margin-left:auto; width:260px; }
  .tot div { display:flex; justify-content:space-between; padding:4px 8px; }
  .tot .gran { border-top:2px solid #111; font-weight:800; font-size:15px; margin-top:4px; padding-top:8px; }
  .notas { color:#444; font-size:12px; border-top:1px dashed #bbb; padding-top:10px; white-space:pre-wrap; }
  .ficha { width:100%; border-collapse:collapse; }
  .ficha td { border-bottom:1px solid #e3e3e3; padding:8px 10px; }
  .ficha td.eti { width:220px; color:#555; font-size:11px; text-transform:uppercase; letter-spacing:.6px; }
  @media print { body { padding:0; } }
`;

function abrirVentana(titulo, cuerpo) {
  const w = window.open("", "_blank", "width=820,height=950");
  if (!w) return;
  w.document.write(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${ESTILOS}</style></head><body>${cuerpo}<script>window.onload=function(){window.print();}<\/script></body></html>`
  );
  w.document.close();
}

function cabecera(emp, tipoDoc, numero, fecha) {
  const dir = [emp.direccion?.calle, emp.direccion?.ciudad, emp.direccion?.cp, emp.direccion?.provincia]
    .filter(Boolean)
    .join(", ");
  return `
    <div class="cab">
      <div class="emp">${esc(emp.nombre ?? "")}
        <small>${esc(emp.nif ?? "")}${dir ? " · " + esc(dir) : ""}</small>
      </div>
      <div class="doc"><b>${esc(tipoDoc)}</b><span>${esc(numero ?? "")} · ${fechaEs(fecha)}</span></div>
    </div>`;
}

function bloqueContraparte(quien, c) {
  if (!c) return "";
  const dir = [c.direccion?.calle, c.direccion?.ciudad, c.direccion?.cp, c.direccion?.provincia]
    .filter(Boolean)
    .join(", ");
  return `
    <div class="bloque">
      <div class="quien">${esc(quien)}</div>
      <div class="nombre">${esc(c.nombre ?? "—")}</div>
      <div class="det">${[c.nif, dir, c.telefono, c.email].filter(Boolean).map(esc).join(" · ")}</div>
    </div>`;
}

// Documento comercial: factura/albarán/presupuesto/pedido (venta o compra).
// firma: { nombre, dni, imagen, fecha } → añade el bloque de entrega firmada.
export async function imprimirDocumento({ tipo, numero, fecha, contraparte, quienContraparte, lineas = [], notas, firma }) {
  const emp = await empresa();
  const filas = lineas
    .map((l) => {
      const importe = (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0);
      return `<tr>
        <td>${esc(l.descripcion)}</td>
        <td class="num">${l.cantidad ?? ""}</td>
        <td class="num">${euros(l.precioUnitario)}</td>
        <td class="num">${l.iva ?? ""}%</td>
        <td class="num">${euros(importe)}</td>
      </tr>`;
    })
    .join("");
  const base = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0), 0);
  const cuota = lineas.reduce(
    (s, l) => s + (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0) * ((Number(l.iva) || 0) / 100),
    0
  );
  abrirVentana(
    `${tipo} ${numero ?? ""}`,
    `${cabecera(emp, tipo, numero, fecha)}
     ${bloqueContraparte(quienContraparte ?? "Cliente", contraparte)}
     <table>
       <thead><tr><th>Concepto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">IVA</th><th class="num">Importe</th></tr></thead>
       <tbody>${filas || `<tr><td colspan="5" style="color:#888">Sin líneas</td></tr>`}</tbody>
     </table>
     <div class="tot">
       <div><span>Base imponible</span><b>${euros(base)}</b></div>
       <div><span>IVA</span><b>${euros(cuota)}</b></div>
       <div class="gran"><span>TOTAL</span><b>${euros(base + cuota)}</b></div>
     </div>
     ${notas ? `<div class="notas">${esc(notas)}</div>` : ""}
     ${firma ? `
     <div class="bloque" style="display:flex;gap:18px;align-items:center;margin-top:16px;">
       <div style="flex:1;">
         <div class="quien">Entrega conforme</div>
         <div class="nombre">${esc(firma.nombre ?? "")}</div>
         <div class="det">DNI/NIE: ${esc(firma.dni ?? "")} · Firmado el ${new Date(firma.fecha).toLocaleString("es-ES")}</div>
       </div>
       ${firma.imagen ? `<img src="${esc(firma.imagen)}" alt="Firma" style="width:180px;height:70px;object-fit:contain;border:1px solid #ddd;border-radius:6px;background:#fff;" />` : ""}
     </div>` : ""}`
  );
}

// Ficha de maestro: cliente, proveedor, artículo, vehículo…
export async function imprimirFicha({ titulo, subtitulo, campos }) {
  const emp = await empresa();
  const filas = campos
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([eti, val]) => `<tr><td class="eti">${esc(eti)}</td><td>${esc(val)}</td></tr>`)
    .join("");
  abrirVentana(
    titulo,
    `${cabecera(emp, titulo, subtitulo ?? "", null)}
     <table class="ficha"><tbody>${filas}</tbody></table>`
  );
}
