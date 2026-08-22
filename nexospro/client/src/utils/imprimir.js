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

// Importe neto de una línea: cantidad × precio con el descuento (%) aplicado.
const neto = (l) =>
  (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0) * (1 - (Number(l.descuento) || 0) / 100);

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
  // La columna Dto% solo aparece si alguna línea tiene descuento.
  const conDto = lineas.some((l) => (Number(l.descuento) || 0) > 0);
  const nCols = conDto ? 6 : 5;
  const filas = lineas
    .map((l) => {
      return `<tr>
        <td>${esc(l.descripcion)}</td>
        <td class="num">${l.cantidad ?? ""}</td>
        <td class="num">${euros(l.precioUnitario)}</td>
        ${conDto ? `<td class="num">${(Number(l.descuento) || 0) > 0 ? `${l.descuento}%` : ""}</td>` : ""}
        <td class="num">${l.iva ?? ""}%</td>
        <td class="num">${euros(neto(l))}</td>
      </tr>`;
    })
    .join("");
  const base = lineas.reduce((s, l) => s + neto(l), 0);
  const cuota = lineas.reduce((s, l) => s + neto(l) * ((Number(l.iva) || 0) / 100), 0);
  abrirVentana(
    `${tipo} ${numero ?? ""}`,
    `${cabecera(emp, tipo, numero, fecha)}
     ${bloqueContraparte(quienContraparte ?? "Cliente", contraparte)}
     <table>
       <thead><tr><th>Concepto</th><th class="num">Cant.</th><th class="num">Precio</th>${conDto ? '<th class="num">Dto%</th>' : ""}<th class="num">IVA</th><th class="num">Importe</th></tr></thead>
       <tbody>${filas || `<tr><td colspan="${nCols}" style="color:#888">Sin líneas</td></tr>`}</tbody>
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

// Impreso de la orden de trabajo con líneas e importes (parte de trabajo).
// La hoja de entrada NO está aquí: usa la plantilla oficial del editor de
// formatos (Sistema → Formatos), ver components/MenuImprimirOrden.jsx.
export async function imprimirOrdenTrabajo(o) {
  const emp = await empresa();
  const vehiculoTxt = [o.matricula, o.vehiculo && [o.vehiculo.marca, o.vehiculo.modelo].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" · ");
  const trabajosTxt = o.trabajos?.length ? o.trabajos.join(", ") : null;
  const seguroTxt = o.aseguradora?.nombre
    ? `${o.aseguradora.nombre}${o.numeroSiniestro ? ` · Siniestro ${o.numeroSiniestro}` : ""}`
    : null;

  const bloqueVehiculo = `
    <div class="bloque">
      <div class="quien">Vehículo</div>
      <div class="nombre">${esc(vehiculoTxt || "—")}</div>
      <div class="det">${[
        o.km != null && o.km !== "" ? `${Number(o.km).toLocaleString("es-ES")} km` : null,
        `Entrada: ${fechaEs(o.fechaEntrada)}`,
        o.fechaEntregaPrevista ? `Entrega prevista: ${fechaEs(o.fechaEntregaPrevista)}` : null,
        seguroTxt,
      ].filter(Boolean).map(esc).join(" · ")}</div>
    </div>`;

  const cajaFirma = (quien) => `
    <div style="display:flex;gap:24px;margin-top:34px;">
      <div style="flex:1;">
        <div style="border-top:1px solid #333;padding-top:6px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.6px;">${esc(quien)}</div>
        <div style="font-size:11px;color:#888;margin-top:14px;">Nombre:</div>
        <div style="font-size:11px;color:#888;margin-top:14px;">DNI/NIE:</div>
      </div>
      <div style="flex:1;">
        <div style="border:1px solid #999;border-radius:6px;height:90px;"></div>
        <div style="font-size:10px;color:#888;text-align:center;margin-top:4px;">Firma</div>
      </div>
    </div>`;

  // Parte de trabajo: con líneas e importes (como la futura factura).
  // Si las líneas llevan imputación (grupo), se imprimen agrupadas con
  // subtotal por trabajo, como las imputaciones de una valoración.
  const lineasOT = o.lineas ?? [];
  const conDto = lineasOT.some((l) => (Number(l.descuento) || 0) > 0);
  const nCols = conDto ? 6 : 5;
  const filaLinea = (l) => {
    return `<tr>
      <td>${esc(l.descripcion)}${l.tipo ? `<div style="font-size:10px;color:#777;text-transform:uppercase;letter-spacing:.5px;">${l.tipo === "mano_obra" ? "Mano de obra" : "Material"}</div>` : ""}</td>
      <td class="num">${l.cantidad ?? ""}</td>
      <td class="num">${euros(l.precioUnitario)}</td>
      ${conDto ? `<td class="num">${(Number(l.descuento) || 0) > 0 ? `${l.descuento}%` : ""}</td>` : ""}
      <td class="num">${l.iva ?? ""}%</td>
      <td class="num">${euros(neto(l))}</td>
    </tr>`;
  };

  let filas;
  if (lineasOT.some((l) => l.grupo && l.grupo.trim())) {
    const orden = [];
    const mapa = new Map();
    for (const l of lineasOT) {
      const g = (l.grupo ?? "").trim();
      if (!mapa.has(g)) {
        mapa.set(g, []);
        orden.push(g);
      }
      mapa.get(g).push(l);
    }
    orden.sort((a, b) => (a === "" ? 1 : b === "" ? -1 : 0)); // sin imputación al final
    filas = orden
      .map((g) => {
        const items = mapa.get(g);
        const subtotal = items.reduce((s, l) => s + neto(l), 0);
        const cabeceraGrupo = g
          ? `<tr><td colspan="${nCols}" style="background:#ececec;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.6px;color:#333;">${esc(g)}</td></tr>`
          : "";
        const pieGrupo = g
          ? `<tr><td colspan="${nCols - 1}" style="text-align:right;font-size:10.5px;color:#666;border-bottom:1.5px solid #999;">Subtotal ${esc(g)}</td><td class="num" style="font-weight:700;border-bottom:1.5px solid #999;">${euros(subtotal)}</td></tr>`
          : "";
        return `${cabeceraGrupo}${items.map(filaLinea).join("")}${pieGrupo}`;
      })
      .join("");
  } else {
    filas = lineasOT.map(filaLinea).join("");
  }

  const base = lineasOT.reduce((s, l) => s + neto(l), 0);
  const cuota = lineasOT.reduce((s, l) => s + neto(l) * ((Number(l.iva) || 0) / 100), 0);
  abrirVentana(
    `Parte de trabajo ${o.numero}`,
    `${cabecera(emp, "Parte de trabajo", o.numero, o.fechaEntrada)}
     ${bloqueContraparte("Cliente", { nombre: o.clienteNombre, telefono: o.telefono })}
     ${bloqueVehiculo}
     ${trabajosTxt ? `<div class="bloque"><div class="quien">Tipo de trabajo</div><div class="nombre">${esc(trabajosTxt)}</div>${o.motivo ? `<div class="det" style="white-space:pre-wrap;">${esc(o.motivo)}</div>` : ""}</div>` : o.motivo ? `<div class="bloque"><div class="quien">Descripción del trabajo</div><div style="white-space:pre-wrap;">${esc(o.motivo)}</div></div>` : ""}
     <table>
       <thead><tr><th>Concepto</th><th class="num">Cant.</th><th class="num">Precio</th>${conDto ? '<th class="num">Dto%</th>' : ""}<th class="num">IVA</th><th class="num">Importe</th></tr></thead>
       <tbody>${filas || `<tr><td colspan="${nCols}" style="color:#888">Sin líneas</td></tr>`}</tbody>
     </table>
     <div class="tot">
       <div><span>Base imponible</span><b>${euros(base)}</b></div>
       <div><span>IVA</span><b>${euros(cuota)}</b></div>
       <div class="gran"><span>TOTAL</span><b>${euros(base + cuota)}</b></div>
     </div>
     ${cajaFirma("Conforme a la entrega del vehículo")}`
  );
}

// Parte de trabajo de una orden del Servicio Técnico (SAT): aparato, avería,
// líneas con importes y conforme de entrega. La hoja de entrada usa la
// plantilla oficial del editor (ver components/MenuImprimirOrdenServicio.jsx).
export async function imprimirOrdenServicio(o) {
  const emp = await empresa();
  const dirIntervencion = o.tipoServicio === "domicilio"
    ? [o.direccionIntervencion?.calle, o.direccionIntervencion?.cp, o.direccionIntervencion?.ciudad, o.direccionIntervencion?.provincia].filter(Boolean).join(", ")
    : null;

  const bloqueAparato = `
    <div class="bloque">
      <div class="quien">Aparato · ${o.tipoServicio === "domicilio" ? "Servicio a domicilio" : "Recepción en tienda"}</div>
      <div class="nombre">${esc(o.aparatoDescripcion || "—")}</div>
      <div class="det">${[
        `Entrada: ${fechaEs(o.fechaEntrada)}`,
        o.fechaEntregaPrevista ? `Entrega prevista: ${fechaEs(o.fechaEntregaPrevista)}` : null,
        o.garantia === "en_garantia" ? "En garantía" : null,
        o.accesorios ? `Accesorios: ${o.accesorios}` : null,
        dirIntervencion ? `Intervención: ${dirIntervencion}` : null,
      ].filter(Boolean).map(esc).join(" · ")}</div>
    </div>`;

  const cajaFirma = `
    <div style="display:flex;gap:24px;margin-top:34px;">
      <div style="flex:1;">
        <div style="border-top:1px solid #333;padding-top:6px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.6px;">Conforme a la entrega del aparato</div>
        <div style="font-size:11px;color:#888;margin-top:14px;">Nombre:</div>
        <div style="font-size:11px;color:#888;margin-top:14px;">DNI/NIE:</div>
      </div>
      <div style="flex:1;">
        <div style="border:1px solid #999;border-radius:6px;height:90px;"></div>
        <div style="font-size:10px;color:#888;text-align:center;margin-top:4px;">Firma</div>
      </div>
    </div>`;

  const lineasOS = o.lineas ?? [];
  const conDto = lineasOS.some((l) => (Number(l.descuento) || 0) > 0);
  const nCols = conDto ? 6 : 5;
  const filas = lineasOS
    .map(
      (l) => `<tr>
      <td>${esc(l.descripcion)}${l.tipo ? `<div style="font-size:10px;color:#777;text-transform:uppercase;letter-spacing:.5px;">${l.tipo === "mano_obra" ? "Mano de obra" : "Material"}</div>` : ""}</td>
      <td class="num">${l.cantidad ?? ""}</td>
      <td class="num">${euros(l.precioUnitario)}</td>
      ${conDto ? `<td class="num">${(Number(l.descuento) || 0) > 0 ? `${l.descuento}%` : ""}</td>` : ""}
      <td class="num">${l.iva ?? ""}%</td>
      <td class="num">${euros(neto(l))}</td>
    </tr>`
    )
    .join("");

  const base = lineasOS.reduce((s, l) => s + neto(l), 0);
  const cuota = lineasOS.reduce((s, l) => s + neto(l) * ((Number(l.iva) || 0) / 100), 0);
  abrirVentana(
    `Parte de trabajo ${o.numero}`,
    `${cabecera(emp, "Parte de trabajo", o.numero, o.fechaEntrada)}
     ${bloqueContraparte("Cliente", { nombre: o.clienteNombre, telefono: o.telefono })}
     ${bloqueAparato}
     ${o.averia ? `<div class="bloque"><div class="quien">Avería descrita por el cliente</div><div style="white-space:pre-wrap;">${esc(o.averia)}</div></div>` : ""}
     ${o.diagnostico ? `<div class="bloque"><div class="quien">Diagnóstico / trabajo realizado</div><div style="white-space:pre-wrap;">${esc(o.diagnostico)}</div></div>` : ""}
     <table>
       <thead><tr><th>Concepto</th><th class="num">Cant.</th><th class="num">Precio</th>${conDto ? '<th class="num">Dto%</th>' : ""}<th class="num">IVA</th><th class="num">Importe</th></tr></thead>
       <tbody>${filas || `<tr><td colspan="${nCols}" style="color:#888">Sin líneas</td></tr>`}</tbody>
     </table>
     <div class="tot">
       <div><span>Base imponible</span><b>${euros(base)}</b></div>
       <div><span>IVA</span><b>${euros(cuota)}</b></div>
       <div class="gran"><span>TOTAL</span><b>${euros(base + cuota)}</b></div>
     </div>
     ${cajaFirma}`
  );
}
