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
  .contrato { font-size:10px; line-height:1.15; color:#000; }
  .contrato table { width:100%; border-collapse:collapse; margin:0 0 3px; }
  .contrato td, .contrato th { border:1.5px solid #000; padding:2px 4px; vertical-align:middle; }
  .contrato .enc-emp { text-align:center; border-bottom:1.5px solid #000; padding-bottom:3px; margin-bottom:4px; }
  .contrato .enc-emp .nom { font-size:15px; font-weight:700; letter-spacing:.5px; }
  .contrato .enc-emp .dir { font-size:8px; }
  .contrato .titulo-principal { text-align:center; font-size:14px; font-weight:700; margin:2px 0 1px; letter-spacing:1px; }
  .contrato .subtitulo { text-align:center; font-size:9px; margin-bottom:3px; }
  .contrato .nparte { text-align:right; font-size:9px; margin-bottom:3px; font-weight:700; }
  .contrato .seccion { background:#e6e6e6; font-weight:700; font-size:8.5px; text-align:center; padding:2px; letter-spacing:.5px; }
  .contrato .etiq { font-size:8px; white-space:nowrap; color:#000; }
  .contrato .linea { border-bottom:1px dotted #000; min-width:20px; height:12px; display:inline-block; color:#000; }
  .contrato .aviso { font-size:7.5px; text-align:justify; margin:2px 0; }
  .contrato .table-km { font-size:8px; }
  .contrato .table-km th { background:#e6e6e6; font-size:7.5px; padding:2px; }
  .contrato .table-km td { height:42px; padding:2px; }
  .contrato .car-sil { display:inline-block; }
  .contrato .car-sil svg { display:block; margin:0 auto; }
  .contrato .checks { font-size:8px; }
  .contrato .firma-box { border:1.5px solid #000; height:50px; padding:2px; text-align:center; position:relative; }
  .contrato .firma-box .tit { font-size:7px; font-weight:700; }
  .contrato .firma-box .lin { position:absolute; bottom:2px; left:2px; right:2px; border-top:1px solid #000; font-size:6px; padding-top:1px; }
  .contrato .nota-pie { font-size:7px; text-align:center; font-weight:700; margin-top:3px; }
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
// «Talleres J. Montiel»: una sola hoja A4 con tablas, líneas punteadas y
// cajas de firma, lo más fiel posible al documento escaneado.
export async function imprimirContratoCortesia(p) {
  const emp = await empresa();
  const fmtFecha = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "");
  const fmtFechaHora = (f) =>
    f
      ? `${new Date(f).toLocaleDateString("es-ES")} ${new Date(f).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
      : "";
  const n = (v) => (v != null && v !== "" ? Number(v).toLocaleString("es-ES") : "");
  const eur = (v) => {
    if (v == null || v === "") return "";
    return `${Number(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  };
  const val = (v) => (v != null && String(v).trim() !== "" ? esc(String(v)) : "");
  const lin = (v) => `<span class="linea">${val(v)}</span>`;
  const campo = (et, v) => `<span class="etiq">${esc(et)}${et.endsWith(":") ? "" : ":"}</span> ${lin(v)}`;

  const dirEmp = [emp.direccion?.calle, emp.direccion?.ciudad, emp.direccion?.cp, emp.direccion?.provincia]
    .filter(Boolean)
    .join(" - ");
  const telsEmp = [emp.telefono, emp.telefono2].filter(Boolean).join(" - ");

  const marcaCortesia = p.vehiculo?.marca || "";
  const modeloCortesia = p.vehiculo?.modelo || "";
  const parteNumero = p.numeroOrden
    ? `OT ${p.numeroOrden}`
    : p._id
      ? String(p._id).slice(-6).toUpperCase()
      : "";

  const fuel = (nivel, label) => {
    const pct = Math.min(Math.max((Number(nivel) || 0) / 8, 0), 1);
    const angle = 180 - pct * 180;
    const rad = (angle * Math.PI) / 180;
    const x = 30 + 24 * Math.cos(rad);
    const y = 28 - 24 * Math.sin(rad);
    return `
      <svg width="60" height="34" viewBox="0 0 60 34" style="display:block;margin:0 auto">
        <path d="M 6 28 A 24 24 0 0 1 54 28" fill="none" stroke="#000" stroke-width="1.5" />
        <line x1="6" y1="28" x2="10" y2="28" stroke="#000" stroke-width="1" />
        <line x1="30" y1="4" x2="30" y2="8" stroke="#000" stroke-width="1" />
        <line x1="54" y1="28" x2="50" y2="28" stroke="#000" stroke-width="1" />
        <text x="4" y="33" font-size="5" fill="#000">0</text>
        <text x="28" y="3" font-size="5" fill="#000">1/2</text>
        <text x="52" y="33" font-size="5" fill="#000">1</text>
        <line x1="30" y1="28" x2="${x}" y2="${y}" stroke="#000" stroke-width="1.2" />
        <circle cx="30" cy="28" r="2" fill="#000" />
        <text x="30" y="38" font-size="6" fill="#000" text-anchor="middle">${esc(label)}</text>
      </svg>`;
  };

  const cocheSvg = (vista) => {
    if (vista === "lateral") {
      return `<svg width="105" height="34" viewBox="0 0 105 34" style="stroke:#000;fill:none;stroke-width:1">
        <path d="M4,20 Q4,14 12,13 L30,12 Q38,5 55,5 Q72,5 80,12 L94,14 Q101,15 101,20 L101,23 Q101,26 97,26 L90,26 Q90,30 82,30 Q74,30 74,26 L33,26 Q33,30 25,30 Q17,30 17,26 L8,26 Q4,26 4,23 Z" />
        <circle cx="25" cy="26" r="5" />
        <circle cx="82" cy="26" r="5" />
        <path d="M12,13 L22,13 L28,18 L4,18 Z" />
        <path d="M36,12 L68,12 L68,18 L32,18 Z" />
        <path d="M72,12 L90,15 L90,18 L72,18 Z" />
        <rect x="45" y="13" width="12" height="5" rx="1" />
        <line x1="52" y1="5" x2="52" y2="18" />
      </svg>`;
    }
    if (vista === "cenital") {
      return `<svg width="105" height="42" viewBox="0 0 105 42" style="stroke:#000;fill:none;stroke-width:1">
        <path d="M10,8 Q25,3 52,3 Q79,3 95,8 Q102,12 102,21 Q102,30 95,34 Q79,39 52,39 Q25,39 10,34 Q3,30 3,21 Q3,12 10,8 Z" />
        <path d="M15,10 Q25,8 40,8 L40,34 Q25,34 15,32 Q10,28 10,21 Q10,14 15,10 Z" />
        <path d="M65,8 Q80,8 90,10 Q95,14 95,21 Q95,28 90,32 Q80,34 65,34 Z" />
        <path d="M42,8 L63,8 L63,34 L42,34 Z" />
        <path d="M30,8 Q38,3 52,3 Q66,3 74,8" />
        <path d="M30,34 Q38,39 52,39 Q66,39 74,34" />
        <ellipse cx="18" cy="21" rx="4" ry="6" />
        <ellipse cx="86" cy="21" rx="4" ry="6" />
      </svg>`;
    }
    if (vista === "frontal") {
      return `<svg width="48" height="42" viewBox="0 0 48 42" style="stroke:#000;fill:none;stroke-width:1">
        <path d="M8,16 Q10,5 24,5 Q38,5 40,16 L42,26 Q43,30 40,32 L40,38 L33,38 L33,33 L15,33 L15,38 L8,38 L8,32 Q5,30 6,26 Z" />
        <path d="M8,16 L40,16 L40,22 L8,22 Z" />
        <path d="M11,22 L18,22 L18,30 L11,30 Z" />
        <path d="M30,22 L37,22 L37,30 L30,30 Z" />
        <path d="M13,10 Q16,8 24,8 Q32,8 35,10" />
        <ellipse cx="6" cy="21" rx="2" ry="4" />
        <ellipse cx="42" cy="21" rx="2" ry="4" />
      </svg>`;
    }
    // trasera
    return `<svg width="48" height="42" viewBox="0 0 48 42" style="stroke:#000;fill:none;stroke-width:1">
      <path d="M6,18 Q8,5 24,5 Q40,5 42,18 L43,26 Q44,30 41,32 L41,38 L34,38 L34,33 L14,33 L14,38 L7,38 L7,32 Q4,30 5,26 Z" />
      <path d="M6,18 L42,18 L42,24 L6,24 Z" />
      <rect x="10" y="24" width="8" height="6" rx="1" />
      <rect x="30" y="24" width="8" height="6" rx="1" />
      <rect x="20" y="25" width="8" height="5" rx="1" />
      <path d="M12,10 Q16,8 24,8 Q32,8 36,10" />
      <circle cx="24" cy="32" r="3" />
    </svg>`;
  };

  const cuerpo = `
    <div class="contrato">
      <div class="enc-emp">
        <div class="nom">${esc(emp.nombre ?? "TALLERES")}</div>
        <div class="dir">${esc(dirEmp)}${telsEmp ? ` · Tlfs.: ${esc(telsEmp)}` : ""}${emp.email ? ` · ${esc(emp.email)}` : ""}</div>
      </div>

      <div class="titulo-principal">VEHÍCULOS DE SUSTITUCIÓN</div>
      <div class="subtitulo">Contrato de prestación con participación forfait Nº</div>
      <div class="nparte">${esc(parteNumero)}</div>

      <table>
        <tr><td colspan="4" class="seccion">USUARIO</td></tr>
        <tr>
          <td colspan="4" style="font-size:7.5px;text-align:justify;border-bottom:none">
            Atención: Toda persona que conduzca el vehículo prestado, debe ser mayor de edad y poseer un permiso o licencia de conducir desde hace más de 1 año, y no estar en suspeso o anulado.
          </td>
        </tr>
        <tr>
          <td colspan="2">${campo("Apellidos", p.clienteNombre?.split(" ").slice(1).join(" "))}</td>
          <td colspan="2">${campo("Nombre", p.clienteNombre?.split(" ")[0])}</td>
        </tr>
        <tr>
          <td colspan="2">${campo("Fecha de nacimiento", fmtFecha(p.clienteFechaNacimiento))}</td>
          <td colspan="2">${campo("Lugar de nacimiento", p.clienteLugarNacimiento)}</td>
        </tr>
        <tr><td colspan="4">${campo("Dirección", p.clienteDireccion)}</td></tr>
        <tr>
          <td>${campo("Tlf. Particular", p.telefono)}</td>
          <td>${campo("Móvil", p.telefono)}</td>
          <td colspan="2">${campo("Trabajo", p.telefonoTrabajo)}</td>
        </tr>
        <tr><td colspan="4">${campo("Permiso de conducir nº", p.permisoConducirNumero)}</td></tr>
        <tr>
          <td colspan="2">${campo("Expedido el", fmtFecha(p.permisoConducirExpedicion))}</td>
          <td colspan="2">${campo("en", p.permisoConducirLugar)}</td>
        </tr>
        <tr>
          <td colspan="2">${campo("Apellidos", "")}</td>
          <td colspan="2">${campo("Nombre", "")}</td>
        </tr>
        <tr><td colspan="4">${campo("Permiso de conducir nº", "")}</td></tr>
        <tr>
          <td colspan="2">${campo("Expedido el", "")}</td>
          <td colspan="2">${campo("en", "")}</td>
        </tr>
        <tr><td colspan="4">${campo("Eventualmente, otros conductores admitidos", p.otroConductor)}</td></tr>
      </table>

      <table style="margin-top:4px">
        <tr><td colspan="4" class="seccion">VEHÍCULO PUESTO A DISPOSICIÓN</td></tr>
        <tr>
          <td style="width:25%">${campo("Nº", marcaCortesia)}</td>
          <td style="width:25%">${campo("Modelo", modeloCortesia)}</td>
          <td style="width:25%">${campo("Nº Matrícula", p.matricula)}</td>
          <td style="width:25%">${campo("V.I.N.", p.vinCortesia)}</td>
        </tr>
        <tr>
          <td colspan="2">${campo("Participación forfait diaria", eur(p.participacionForfaitDiaria))}</td>
          <td colspan="2">${campo("PTE", "")}</td>
        </tr>
      </table>

      <table class="table-km" style="margin-top:4px">
        <thead>
          <tr>
            <th style="width:18%"></th>
            <th style="width:27%">SALIDA</th>
            <th style="width:27%">RETORNO PREVISTO</th>
            <th style="width:28%">RETORNO REAL</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align:left;font-weight:700">Fecha y hora:</td>
            <td>${fmtFechaHora(p.fechaSalida)}</td>
            <td>${fmtFecha(p.fechaPrevista)}</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align:left;font-weight:700">Km. En el contador:</td>
            <td>${n(p.kmSalida)}</td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align:left;font-weight:700">Nivel de carburante:</td>
            <td>${fuel(p.combustibleSalida, "SALIDA")}</td>
            <td>${fuel(null, "PREVISTO")}</td>
            <td>${fuel(null, "REAL")}</td>
          </tr>
        </tbody>
      </table>

      <table style="margin-top:4px">
        <tr>
          <td style="width:55%;text-align:center;vertical-align:top">
            <div style="font-weight:700;font-size:8.5px;margin-bottom:4px">ESTADO DEL VEHÍCULO</div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
              <div class="car-sil">${cocheSvg("lateral")}</div>
              <div class="car-sil">${cocheSvg("cenital")}</div>
              <div style="display:flex;justify-content:center;gap:8px">
                <div class="car-sil">${cocheSvg("frontal")}</div>
                <div class="car-sil">${cocheSvg("trasera")}</div>
              </div>
            </div>
          </td>
          <td style="width:45%;vertical-align:top">
            <div style="font-weight:700;font-size:8.5px;text-align:center;margin-bottom:4px">OBSERVACIONES</div>
            <div style="min-height:50px;font-size:8px;white-space:pre-wrap">${esc(p.notas || "")}</div>
          </td>
        </tr>
      </table>

      <table style="margin-top:4px">
        <tr><td colspan="3" class="seccion">SEGURO</td></tr>
        <tr>
          <td colspan="2">${campo("Asegurador", p.aseguradora)}</td>
          <td>${campo("Nº de Contrato", p.numeroContratoSeguro)}</td>
        </tr>
        <tr>
          <td colspan="3" style="font-size:7.5px">Montante de las franquicias:</td>
        </tr>
        <tr>
          <td>${campo("Daños causados a terceros", eur(p.franquiciaTerceros))}</td>
          <td>${campo("Daños causados al vehículo", eur(p.franquiciaVehiculo))}</td>
          <td>${campo("Robo/Vandalismo", eur(p.franquiciaRobo))}</td>
        </tr>
        <tr>
          <td colspan="3" class="checks">
            Rescate de franquicias: SI ${p.rescateFranquicia ? "☑" : "☐"} NO ${!p.rescateFranquicia ? "☑" : "☐"} · 
            Transferencia de seguro: SI ${p.transferenciaSeguro ? "☑" : "☐"} NO ${!p.transferenciaSeguro ? "☑" : "☐"}
          </td>
        </tr>
        <tr>
          <td colspan="3">${campo("Montante del rescate por día", eur(p.rescatePorDia))} *Aporta un justificante de alteración de seguro.</td>
        </tr>
      </table>

      <table style="margin-top:4px">
        <tr><td colspan="4" class="seccion">VEHÍCULO EN REPARACIÓN</td></tr>
        <tr>
          <td style="width:30%">${campo("Modelo", p.vehiculoReparacionMarcaModelo)}</td>
          <td style="width:30%">${campo("Nº de matrícula", p.vehiculoReparacionMatricula)}</td>
          <td colspan="2">${campo("V.I.N.", p.vehiculoReparacionVIN)}</td>
        </tr>
        <tr>
          <td colspan="2">${campo("Nº de O.R.", p.numeroOrden)}</td>
          <td colspan="2">${campo("Entrega prevista", fmtFecha(p.fechaPrevista))}</td>
        </tr>
      </table>

      <table style="margin-top:4px">
        <tr>
          <td style="width:33%">
            <div class="firma-box">
              <div class="tit">Declaro haber tenido conocimiento de las condiciones generales de protección indicadas al dorso del presente Contrato.</div>
              <div class="lin">Realizado en _______ a ____/____/________ · Firma del cliente</div>
            </div>
          </td>
          <td style="width:34%">
            <div class="firma-box">
              <div class="tit">El cliente (firma) · El concesionario (nombre y firma)</div>
              <div class="lin">Fecha: ____/____/________</div>
            </div>
          </td>
          <td style="width:33%">
            <div class="firma-box">
              <div class="tit">Al retorno, el cliente (firma)</div>
              <div class="lin">Fecha: ____/____/________</div>
            </div>
          </td>
        </tr>
      </table>

      <div class="nota-pie">ATENCIÓN: Este contrato debe ir acompañado al vehículo durante toda la duración de la prestación.</div>
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
