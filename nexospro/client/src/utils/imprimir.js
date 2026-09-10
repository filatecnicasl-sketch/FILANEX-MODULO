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
  /* Contrato de cesión de vehículo de cortesía */
  .contrato { font-size:11px; line-height:1.35; }
  .contrato .enc-emp { text-align:center; border-bottom:1px solid #333; padding-bottom:8px; margin-bottom:8px; }
  .contrato .enc-emp .nom { font-size:16px; font-weight:700; letter-spacing:1px; }
  .contrato .enc-emp .dir { font-size:9.5px; color:#333; }
  .contrato h1 { text-align:center; font-size:16px; font-weight:700; margin:4px 0 2px; }
  .contrato h2 { text-align:center; font-size:10px; font-weight:400; margin:0 0 8px; }
  .contrato .ncontrato { display:flex; justify-content:flex-end; align-items:center; gap:6px; margin-bottom:8px; font-size:11px; }
  .contrato .ncontrato input { width:90px; border:1px solid #333; height:18px; }
  .contrato .seccion { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; background:#e9e9e9; border:1px solid #333; padding:3px 6px; margin:8px 0 4px; }
  .contrato .aviso { font-size:9px; text-align:justify; margin-bottom:6px; }
  .contrato .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; }
  .contrato .campo { display:flex; align-items:baseline; gap:4px; margin-bottom:3px; font-size:10px; }
  .contrato .campo .et { white-space:nowrap; color:#333; }
  .contrato .campo .lin { flex:1; border-bottom:1px solid #555; min-width:40px; height:14px; }
  .contrato .campo .val { font-weight:600; border-bottom:1px solid #555; padding:0 4px; }
  .contrato .table-km { width:100%; border-collapse:collapse; margin:6px 0; font-size:9.5px; }
  .contrato .table-km th, .contrato .table-km td { border:1px solid #333; padding:4px 6px; text-align:center; }
  .contrato .table-km th { background:#e9e9e9; }
  .contrato .fuel-gauge { display:flex; justify-content:center; gap:8px; margin:4px 0; }
  .contrato .fuel-gauge .g { width:60px; height:30px; border:1px solid #333; border-radius:4px; position:relative; }
  .contrato .fuel-gauge .g .bar { position:absolute; bottom:0; left:0; right:0; background:#ddd; }
  .contrato .fuel-gauge .g .tick { position:absolute; top:-10px; font-size:8px; width:100%; text-align:center; }
  .contrato .fuel-gauge .g .label { position:absolute; bottom:-14px; font-size:8px; width:100%; text-align:center; }
  .contrato .cars { display:flex; justify-content:space-around; align-items:center; gap:12px; margin:8px 0; }
  .contrato .car { border:1px solid #333; width:90px; height:50px; display:flex; align-items:center; justify-content:center; font-size:8px; color:#777; }
  .contrato .checks { display:flex; gap:16px; flex-wrap:wrap; font-size:10px; margin:4px 0; }
  .contrato .box { border:1px solid #333; padding:4px; margin:4px 0; }
  .contrato .firmas-row { display:flex; gap:16px; margin-top:12px; }
  .contrato .firma-montiel { flex:1; border:1px solid #333; padding:6px; text-align:center; min-height:70px; }
  .contrato .firma-montiel .tit { font-size:9px; font-weight:700; margin-bottom:30px; }
  .contrato .firma-montiel .lin { border-top:1px solid #333; margin-top:8px; padding-top:2px; font-size:8px; }
  .contrato .nota-pie { font-size:8px; text-align:center; margin-top:8px; font-weight:700; }
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

// Contrato de préstamo / cesión de un vehículo de cortesía. Formato tipo
// «Talleres J. Montiel»: usuario, vehículo de sustitución, seguro, vehículo en
// reparación, estado del vehículo y firmas, en una sola hoja A4.
export async function imprimirContratoCortesia(p) {
  const emp = await empresa();
  const fmtFecha = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "__/__/____");
  const fmtFechaHora = (f) =>
    f
      ? `${new Date(f).toLocaleDateString("es-ES")} ${new Date(f).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
      : "__/__/____ __:__";
  const n = (v) => (v != null && v !== "" ? Number(v).toLocaleString("es-ES") : "");
  const eur = (v) => {
    if (v == null || v === "") return "";
    return `${Number(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  };
  const v = (val) => (val != null && String(val).trim() !== "" ? esc(String(val)) : "");

  const dirEmp = [emp.direccion?.calle, emp.direccion?.ciudad, emp.direccion?.cp, emp.direccion?.provincia]
    .filter(Boolean)
    .join(" - ");
  const telsEmp = [emp.telefono, emp.telefono2, emp.email].filter(Boolean).join(" - ");

  const vehiculoCortesiaMarca = p.vehiculo?.marca || "";
  const vehiculoCortesiaModelo = p.vehiculo?.modelo || "";
  const parteNumero = p.numeroOrden
    ? `OT ${p.numeroOrden}`
    : p._id
      ? String(p._id).slice(-6).toUpperCase()
      : "";

  const campo = (etiqueta, valor) => {
    const val = v(valor);
    return `<div class="campo">
      <span class="et">${esc(etiqueta)}${etiqueta.endsWith(":") ? "" : ":"}</span>
      ${val ? `<span class="val">${val}</span>` : `<span class="lin"></span>`}
    </div>`;
  };

  const fuelGauge = (nivel, label) => {
    const pct = Math.min(Math.max((Number(nivel) || 0) / 8, 0), 1) * 100;
    return `<div class="fuel-gauge">
      <div class="g">
        <div class="bar" style="height:${pct}%"></div>
        <div class="tick">${pct > 0 ? "●" : "○"}</div>
        <div class="label">${esc(label)}</div>
      </div>
    </div>`;
  };

  const cocheSvg = (orientacion) => {
    const ancho = orientacion === "lateral" ? 100 : 60;
    const alto = orientacion === "lateral" ? 35 : 45;
    return `<svg width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" style="stroke:#333;fill:none;stroke-width:1.2">
      ${orientacion === "lateral"
        ? `<rect x="5" y="10" width="90" height="18" rx="4" />
           <circle cx="22" cy="28" r="5" />
           <circle cx="78" cy="28" r="5" />
           <rect x="28" y="12" width="34" height="10" rx="2" fill="#f4f4f4" />`
        : orientacion === "frontal"
          ? `<rect x="10" y="8" width="40" height="28" rx="4" />
             <circle cx="18" cy="33" r="4" />
             <circle cx="42" cy="33" r="4" />
             <rect x="18" y="12" width="24" height="10" rx="2" fill="#f4f4f4" />`
          : `<rect x="10" y="8" width="40" height="28" rx="4" />
             <circle cx="18" cy="33" r="4" />
             <circle cx="42" cy="33" r="4" />
             <rect x="14" y="18" width="32" height="8" rx="2" fill="#f4f4f4" />`}
    </svg>`;
  };

  const cuerpo = `
    <div class="contrato">
      <div class="enc-emp">
        <div class="nom">${esc(emp.nombre ?? "TALLERES")}</div>
        <div class="dir">${esc(dirEmp)}${telsEmp ? ` · ${esc(telsEmp)}` : ""}</div>
      </div>
      <h1>VEHÍCULOS DE SUSTITUCIÓN</h1>
      <h2>Contrato de prestación con participación forfait Nº</h2>
      <div class="ncontrato">
        <span>${esc(parteNumero)}</span>
      </div>

      <div class="seccion">Usuario</div>
      <div class="aviso">
        Atención: Toda persona que conduzca el vehículo prestado, debe ser mayor de edad y poseer un permiso
        o licencia de conducir desde hace más de 1 año, y no estar en suspeso o anulado.
      </div>
      <div class="grid2">
        ${campo("Apellidos", p.clienteNombre?.split(" ").slice(1).join(" "))}
        ${campo("Nombre", p.clienteNombre?.split(" ")[0])}
      </div>
      <div class="grid2">
        ${campo("Fecha de nacimiento", fmtFecha(p.clienteFechaNacimiento))}
        ${campo("Lugar de nacimiento", p.clienteLugarNacimiento)}
      </div>
      <div class="grid2">
        ${campo("Dirección", p.clienteDireccion)}
        ${campo("DNI/NIE", p.clienteNIF)}
      </div>
      <div class="grid2">
        ${campo("Tlf. Particular", p.telefono)}
        ${campo("Móvil", p.telefono)}
        ${campo("Trabajo", p.telefonoTrabajo)}
      </div>
      <div class="grid2">
        ${campo("Permiso de conducir nº", p.permisoConducirNumero)}
        ${campo("Expedido el", fmtFecha(p.permisoConducirExpedicion))}
        ${campo("en", p.permisoConducirLugar)}
      </div>
      ${campo("Eventualmente, otros conductores admitidos", p.otroConductor)}

      <div class="seccion">Vehículo puesto a disposición</div>
      <div class="grid2">
        ${campo("Nº", vehiculoCortesiaMarca)}
        ${campo("Modelo", vehiculoCortesiaModelo)}
        ${campo("Nº Matrícula", p.matricula)}
        ${campo("V.I.N.", p.vinCortesia)}
      </div>
      ${campo("Participación forfait diaria", eur(p.participacionForfaitDiaria))}

      <table class="table-km">
        <thead>
          <tr>
            <th style="width:20%"></th>
            <th>SALIDA</th>
            <th>RETORNO PREVISTO</th>
            <th>RETORNO REAL</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align:left;font-weight:700">Fecha y hora</td>
            <td>${fmtFechaHora(p.fechaSalida)}</td>
            <td>${fmtFecha(p.fechaPrevista)} __:__</td>
            <td>__/__/____ __:__</td>
          </tr>
          <tr>
            <td style="text-align:left;font-weight:700">Km. En el contador</td>
            <td>${n(p.kmSalida)}</td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align:left;font-weight:700">Nivel de carburante</td>
            <td>${fuelGauge(p.combustibleSalida, "SALIDA")}</td>
            <td>${fuelGauge(null, "PREVISTO")}</td>
            <td>${fuelGauge(null, "REAL")}</td>
          </tr>
        </tbody>
      </table>

      <div class="grid2">
        <div class="box">
          <div style="text-align:center;font-weight:700;margin-bottom:4px">ESTADO DEL VEHÍCULO</div>
          <div class="cars">
            <div>${cocheSvg("frontal")}</div>
            <div>${cocheSvg("lateral")}</div>
            <div>${cocheSvg("trasera")}</div>
          </div>
        </div>
        <div class="box">
          <div style="text-align:center;font-weight:700;margin-bottom:4px">OBSERVACIONES</div>
          <div style="min-height:60px;font-size:9px;white-space:pre-wrap">${esc(p.notas || "")}</div>
        </div>
      </div>

      <div class="seccion">Seguro</div>
      <div class="grid2">
        ${campo("Asegurador", p.aseguradora)}
        ${campo("Nº de Contrato", p.numeroContratoSeguro)}
      </div>
      <div class="grid2">
        ${campo("Montante de las franquicias - Daños causados a terceros", eur(p.franquiciaTerceros))}
        ${campo("Daños causados al vehículo", eur(p.franquiciaVehiculo))}
        ${campo("Robo/Vandalismo", eur(p.franquiciaRobo))}
      </div>
      <div class="checks">
        <span>Rescate de franquicias: ${p.rescateFranquicia ? "☑ SI" : "☐ SI"} ${!p.rescateFranquicia ? "☑ NO" : "☐ NO"}</span>
        <span>Transferencia de seguro: ${p.transferenciaSeguro ? "☑ SI" : "☐ SI"} ${!p.transferenciaSeguro ? "☑ NO" : "☐ NO"}</span>
      </div>
      ${campo("Montante del rescate por día", eur(p.rescatePorDia))}

      <div class="seccion">Vehículo en reparación</div>
      <div class="grid2">
        ${campo("Modelo", p.vehiculoReparacionMarcaModelo)}
        ${campo("Nº de matrícula", p.vehiculoReparacionMatricula)}
        ${campo("V.I.N.", p.vehiculoReparacionVIN)}
      </div>
      <div class="grid2">
        ${campo("Nº de O.R.", p.numeroOrden)}
        ${campo("Entrega prevista", fmtFecha(p.fechaPrevista))}
      </div>

      <div class="firmas-row">
        <div class="firma-montiel">
          <div class="tit">Declaro haber tenido conocimiento de las condiciones generales de protección indicadas al dorso del presente Contrato.</div>
          <div class="lin">Realizado en _______ a ____/____/________ · Firma del cliente</div>
        </div>
        <div class="firma-montiel">
          <div class="tit">El cliente (firma) · El concesionario (nombre y firma)</div>
          <div class="lin">Fecha: ____/____/________</div>
        </div>
        <div class="firma-montiel">
          <div class="tit">Al retorno, el cliente (firma)</div>
          <div class="lin">Fecha: ____/____/________</div>
        </div>
      </div>

      <div class="nota-pie">
        ATENCIÓN: Este contrato debe ir acompañado al vehículo durante toda la duración de la prestación.
      </div>
    </div>`;

  abrirVentana(`Contrato cortesía ${p.matricula ?? ""}`, cuerpo);
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
        <td>${esc(l.descripcion)}${l.detalle ? `<div style="font-size:11px;color:#555;white-space:pre-wrap;margin-top:2px;">${esc(l.detalle)}</div>` : ""}</td>
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

// Impresión de una valoración/peritaje: las líneas solo llevan descripción e
// importe (sin cantidad/precio/iva), y el total es la suma directa.
export async function imprimirValoracion(v) {
  const emp = await empresa();
  const lineas = v.lineas ?? [];
  const filas = lineas
    .map((l) => `<tr><td>${esc(l.descripcion)}</td><td class="num">${euros(l.importe)}</td></tr>`)
    .join("");
  const total = v.total != null ? v.total : lineas.reduce((s, l) => s + (Number(l.importe) || 0), 0);
  const detContraparte = [
    v.numeroSiniestro ? `Siniestro ${v.numeroSiniestro}` : null,
    v.compania,
    v.fechaSiniestro ? `Siniestro del ${fechaEs(v.fechaSiniestro)}` : null,
  ].filter(Boolean).join(" · ");
  abrirVentana(
    `Valoración ${v.numero ?? ""}`,
    `${cabecera(emp, "Valoración", v.numero, v.fecha)}
     ${bloqueContraparte("Cliente / Vehículo", {
       nombre: `${v.clienteNombre ?? ""} · Vehículo ${v.matricula ?? ""}`,
       nif: detContraparte,
     })}
     <table>
       <thead><tr><th>Concepto</th><th class="num">Importe</th></tr></thead>
       <tbody>${filas || `<tr><td colspan="2" style="color:#888">Sin líneas</td></tr>`}</tbody>
     </table>
     <div class="tot">
       <div class="gran"><span>TOTAL VALORACIÓN</span><b>${euros(total)}</b></div>
     </div>
     ${v.observaciones ? `<div class="notas">${esc(v.observaciones)}</div>` : ""}`
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
