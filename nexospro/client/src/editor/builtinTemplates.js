import { genId } from "./editorUtils.js";

let counter = 0;
function id() {
  counter += 1;
  return `tpl_${Date.now().toString(36)}_${counter}`;
}

function tx(text, x, y, w, h, fontSize = 8, bold = false, align = "left", color = "#000000") {
  return { id: id(), type: "text", x, y, w, h, text, fontSize, bold, align, color };
}
function fld(label, fieldKey, x, y, w, h = 6, fontSize = 9) {
  return { id: id(), type: "field", x, y, w, h, label, fieldKey, fontSize, boxed: true };
}
function area(label, fieldKey, x, y, w, h, fontSize = 8) {
  return { id: id(), type: "textarea", x, y, w, h, label, fieldKey, fontSize, boxed: true };
}
// Los bloques de los documentos comerciales no llevan recuadro: recargan el
// diseño. Se marca sólo una línea fina al pie del bloque.
function box(x, y, w, h, _borderWidth = 0.4, color = "#d1d5db") {
  return { id: id(), type: "rect", x, y: y + h, w, h: 0.3, borderWidth: 0, borderColor: "", background: color };
}
function img(src, x, y, w, h) {
  return { id: id(), type: "image", x, y, w, h, src };
}
function tabla(x, y, w, h, groupTitle, columns, rows = 12) {
  return {
    id: id(),
    type: "table",
    x,
    y,
    w,
    h,
    columns,
    rows,
    headerFontSize: 8,
    showRowNumbers: false,
    groupTitle,
    estilo: "limpia",
  };
}

function linea(x, y, w, color = "#000000") {
  return { id: id(), type: "rect", x, y, w, h: 0.6, borderWidth: 0, background: color };
}

function logo(x, y, w, h) {
  return img("{{empresa.logo}}", x, y, w, h);
}

// ---------- Documentos comerciales ----------

export function buildFacturaVenta() {
  const cols = [
    { title: "CONCEPTO", width: 0.46 },
    { title: "CANT.", width: 0.09 },
    { title: "PRECIO", width: 0.13 },
    { title: "DTO", width: 0.08 },
    { title: "IVA", width: 0.08 },
    { title: "IMPORTE", width: 0.16 },
  ];
  const t = tabla(20, 95, 170, 110, "DETALLE", cols, 14);
  return {
    id: id(),
    builtin: "factura-venta",
    name: "Factura de venta",
    tipoDocumento: "factura-venta",
    porDefecto: true,
    page: { size: "A4", orientation: "portrait" },
    elements: [
      logo(20, 14, 45, 22),
      tx("FACTURA", 130, 16, 60, 10, 18, true, "right", "#111827"),
      tx("{{documento.numero}}", 130, 27, 60, 6, 11, false, "right", "#4b5563"),
      tx("Fecha: {{documento.fecha}}", 130, 34, 60, 5, 9, false, "right", "#6b7280"),

      box(20, 42, 80, 28, 0.4, "#e5e7eb"),
      tx("EMISOR", 23, 45, 74, 5, 7, true, "left", "#6b7280"),
      tx("{{empresa.nombre}}", 23, 51, 74, 6, 10, true),
      tx("{{empresa.nif}}", 23, 58, 74, 5, 8, false, "left", "#374151"),
      tx("{{empresa.direccion}}", 23, 63, 74, 5, 8, false, "left", "#374151"),

      box(110, 42, 80, 28, 0.4, "#e5e7eb"),
      tx("CLIENTE", 113, 45, 74, 5, 7, true, "left", "#6b7280"),
      tx("{{cliente.nombre}}", 113, 51, 74, 6, 10, true),
      tx("{{cliente.nif}}", 113, 58, 74, 5, 8, false, "left", "#374151"),
      tx("{{cliente.direccion}}", 113, 63, 74, 5, 8, false, "left", "#374151"),

      t,

      box(130, 210, 60, 34, 0.4, "#e5e7eb"),
      tx("Base imponible", 134, 215, 34, 5, 9, false, "left", "#4b5563"),
      tx("{{totales.base}}", 170, 215, 16, 5, 9, true, "right"),
      tx("IVA", 134, 223, 34, 5, 9, false, "left", "#4b5563"),
      tx("{{totales.iva}}", 170, 223, 16, 5, 9, true, "right"),
      linea(134, 232, 52, "#9ca3af"),
      tx("TOTAL", 134, 236, 34, 7, 11, true, "left"),
      tx("{{totales.total}}", 170, 236, 16, 7, 11, true, "right"),

      tx("Forma de pago: {{pago.metodo}}", 20, 210, 90, 5, 9, false, "left", "#4b5563"),
      tx("Vencimiento: {{pago.vencimiento}}", 20, 218, 90, 5, 9, false, "left", "#4b5563"),
      tx("{{notas}}", 20, 228, 100, 16, 8, false, "left", "#6b7280"),

      tx("Gracias por confiar en nosotros", 20, 268, 170, 5, 8, false, "center", "#9ca3af"),
    ],
  };
}

export function buildPresupuestoVenta() {
  const cols = [
    { title: "CONCEPTO", width: 0.46 },
    { title: "CANT.", width: 0.09 },
    { title: "PRECIO", width: 0.13 },
    { title: "DTO", width: 0.08 },
    { title: "IVA", width: 0.08 },
    { title: "IMPORTE", width: 0.16 },
  ];
  const t = tabla(20, 95, 170, 110, "DETALLE", cols, 14);
  return {
    id: id(),
    builtin: "presupuesto-venta",
    name: "Presupuesto de venta",
    tipoDocumento: "presupuesto-venta",
    porDefecto: true,
    page: { size: "A4", orientation: "portrait" },
    elements: [
      logo(20, 14, 45, 22),
      tx("PRESUPUESTO", 120, 16, 70, 10, 18, true, "right", "#111827"),
      tx("{{documento.numero}}", 120, 27, 70, 6, 11, false, "right", "#4b5563"),
      tx("Fecha: {{documento.fecha}}", 120, 34, 70, 5, 9, false, "right", "#6b7280"),
      tx("Validez: {{documento.validez}}", 120, 40, 70, 5, 9, false, "right", "#6b7280"),

      box(20, 42, 80, 28, 0.4, "#e5e7eb"),
      tx("EMISOR", 23, 45, 74, 5, 7, true, "left", "#6b7280"),
      tx("{{empresa.nombre}}", 23, 51, 74, 6, 10, true),
      tx("{{empresa.nif}}", 23, 58, 74, 5, 8, false, "left", "#374151"),
      tx("{{empresa.direccion}}", 23, 63, 74, 5, 8, false, "left", "#374151"),

      box(110, 42, 80, 28, 0.4, "#e5e7eb"),
      tx("CLIENTE", 113, 45, 74, 5, 7, true, "left", "#6b7280"),
      tx("{{cliente.nombre}}", 113, 51, 74, 6, 10, true),
      tx("{{cliente.nif}}", 113, 58, 74, 5, 8, false, "left", "#374151"),
      tx("{{cliente.direccion}}", 113, 63, 74, 5, 8, false, "left", "#374151"),

      t,

      box(130, 210, 60, 34, 0.4, "#e5e7eb"),
      tx("Base imponible", 134, 215, 34, 5, 9, false, "left", "#4b5563"),
      tx("{{totales.base}}", 170, 215, 16, 5, 9, true, "right"),
      tx("IVA", 134, 223, 34, 5, 9, false, "left", "#4b5563"),
      tx("{{totales.iva}}", 170, 223, 16, 5, 9, true, "right"),
      linea(134, 232, 52, "#9ca3af"),
      tx("TOTAL", 134, 236, 34, 7, 11, true, "left"),
      tx("{{totales.total}}", 170, 236, 16, 7, 11, true, "right"),

      tx("Este presupuesto no tiene carácter contractual hasta su aceptación.", 20, 268, 170, 5, 8, false, "center", "#9ca3af"),
    ],
  };
}

export function buildAlbaranVenta() {
  const cols = [
    { title: "CONCEPTO", width: 0.55 },
    { title: "CANT.", width: 0.12 },
    { title: "PRECIO", width: 0.18 },
    { title: "IMPORTE", width: 0.15 },
  ];
  const t = tabla(20, 95, 170, 110, "DETALLE", cols, 14);
  return {
    id: id(),
    builtin: "albaran-venta",
    name: "Albarán de venta",
    tipoDocumento: "albaran-venta",
    porDefecto: true,
    page: { size: "A4", orientation: "portrait" },
    elements: [
      logo(20, 14, 45, 22),
      tx("ALBARÁN", 130, 16, 60, 10, 18, true, "right", "#111827"),
      tx("{{documento.numero}}", 130, 27, 60, 6, 11, false, "right", "#4b5563"),
      tx("Fecha: {{documento.fecha}}", 130, 34, 60, 5, 9, false, "right", "#6b7280"),

      box(20, 42, 80, 28, 0.4, "#e5e7eb"),
      tx("EMISOR", 23, 45, 74, 5, 7, true, "left", "#6b7280"),
      tx("{{empresa.nombre}}", 23, 51, 74, 6, 10, true),
      tx("{{empresa.nif}}", 23, 58, 74, 5, 8, false, "left", "#374151"),
      tx("{{empresa.direccion}}", 23, 63, 74, 5, 8, false, "left", "#374151"),

      box(110, 42, 80, 28, 0.4, "#e5e7eb"),
      tx("CLIENTE", 113, 45, 74, 5, 7, true, "left", "#6b7280"),
      tx("{{cliente.nombre}}", 113, 51, 74, 6, 10, true),
      tx("{{cliente.nif}}", 113, 58, 74, 5, 8, false, "left", "#374151"),
      tx("{{cliente.direccion}}", 113, 63, 74, 5, 8, false, "left", "#374151"),

      t,

      tx("Conforme recepción de mercancía:", 20, 218, 80, 5, 9, true, "left"),
      box(20, 225, 80, 20, 0.4, "#e5e7eb"),
      tx("Nombre y firma", 23, 238, 74, 5, 8, false, "left", "#6b7280"),

      tx("Gracias por confiar en nosotros", 20, 268, 170, 5, 8, false, "center", "#9ca3af"),
    ],
  };
}

export function buildPedidoCliente() {
  const cols = [
    { title: "CONCEPTO", width: 0.55 },
    { title: "CANT.", width: 0.12 },
    { title: "PRECIO", width: 0.18 },
    { title: "IMPORTE", width: 0.15 },
  ];
  const t = tabla(20, 95, 170, 110, "DETALLE DEL PEDIDO", cols, 14);
  return {
    id: id(),
    builtin: "pedido-cliente",
    name: "Pedido de cliente",
    tipoDocumento: "pedido-cliente",
    porDefecto: true,
    page: { size: "A4", orientation: "portrait" },
    elements: [
      logo(20, 14, 45, 22),
      tx("PEDIDO", 130, 16, 60, 10, 18, true, "right", "#111827"),
      tx("{{documento.numero}}", 130, 27, 60, 6, 11, false, "right", "#4b5563"),
      tx("Fecha: {{documento.fecha}}", 130, 34, 60, 5, 9, false, "right", "#6b7280"),

      box(20, 42, 80, 28, 0.4, "#e5e7eb"),
      tx("EMISOR", 23, 45, 74, 5, 7, true, "left", "#6b7280"),
      tx("{{empresa.nombre}}", 23, 51, 74, 6, 10, true),
      tx("{{empresa.nif}}", 23, 58, 74, 5, 8, false, "left", "#374151"),
      tx("{{empresa.direccion}}", 23, 63, 74, 5, 8, false, "left", "#374151"),

      box(110, 42, 80, 28, 0.4, "#e5e7eb"),
      tx("CLIENTE", 113, 45, 74, 5, 7, true, "left", "#6b7280"),
      tx("{{cliente.nombre}}", 113, 51, 74, 6, 10, true),
      tx("{{cliente.nif}}", 113, 58, 74, 5, 8, false, "left", "#374151"),
      tx("{{cliente.direccion}}", 113, 63, 74, 5, 8, false, "left", "#374151"),

      t,

      box(130, 210, 60, 34, 0.4, "#e5e7eb"),
      tx("Base imponible", 134, 215, 34, 5, 9, false, "left", "#4b5563"),
      tx("{{totales.base}}", 170, 215, 16, 5, 9, true, "right"),
      tx("IVA", 134, 223, 34, 5, 9, false, "left", "#4b5563"),
      tx("{{totales.iva}}", 170, 223, 16, 5, 9, true, "right"),
      linea(134, 232, 52, "#9ca3af"),
      tx("TOTAL", 134, 236, 34, 7, 11, true, "left"),
      tx("{{totales.total}}", 170, 236, 16, 7, 11, true, "right"),
    ],
  };
}

// ---------- Taller / SAT ----------

export function buildParteTaller() {
  const cols = [
    { title: "CONCEPTO", width: 0.52 },
    { title: "TIPO", width: 0.14 },
    { title: "CANT.", width: 0.09 },
    { title: "PRECIO", width: 0.12 },
    { title: "IMPORTE", width: 0.13 },
  ];
  const t = tabla(20, 110, 170, 90, "TRABAJOS Y MATERIALES", cols, 12);
  return {
    id: id(),
    builtin: "parte-taller",
    name: "Parte de trabajo (taller)",
    tipoDocumento: "parte-taller",
    porDefecto: true,
    page: { size: "A4", orientation: "portrait" },
    elements: [
      logo(20, 14, 40, 18),
      tx("PARTE DE TRABAJO", 110, 16, 80, 10, 17, true, "right", "#111827"),
      tx("{{documento.numero}}", 110, 27, 80, 6, 11, false, "right", "#4b5563"),
      tx("Fecha entrada: {{vehiculo.entrada}}", 110, 34, 80, 5, 9, false, "right", "#6b7280"),

      box(20, 38, 80, 26, 0.4, "#e5e7eb"),
      tx("CLIENTE", 23, 41, 74, 5, 7, true, "left", "#6b7280"),
      tx("{{cliente.nombre}}", 23, 47, 74, 6, 10, true),
      tx("{{cliente.nif}}", 23, 54, 74, 5, 8, false, "left", "#374151"),
      tx("{{cliente.telefono}}", 23, 59, 74, 5, 8, false, "left", "#374151"),

      box(110, 38, 80, 26, 0.4, "#e5e7eb"),
      tx("VEHÍCULO", 113, 41, 74, 5, 7, true, "left", "#6b7280"),
      tx("{{vehiculo.matricula}}", 113, 47, 74, 6, 10, true),
      tx("{{vehiculo.marca}} {{vehiculo.modelo}}", 113, 54, 74, 5, 8, false, "left", "#374151"),
      tx("{{vehiculo.km}} km", 113, 59, 74, 5, 8, false, "left", "#374151"),

      tx("Trabajo solicitado", 20, 70, 170, 5, 8, true, "left", "#6b7280"),
      box(20, 76, 170, 22, 0.4, "#e5e7eb"),
      tx("{{trabajos.motivo}}", 23, 80, 164, 15, 9, false, "left", "#374151"),

      t,

      box(130, 210, 60, 30, 0.4, "#e5e7eb"),
      tx("TOTAL", 134, 228, 34, 7, 11, true, "left"),
      tx("{{totales.total}}", 170, 228, 16, 7, 11, true, "right"),

      tx("Firma conforme cliente", 20, 215, 80, 5, 9, true, "left"),
      box(20, 222, 80, 20, 0.4, "#e5e7eb"),
    ],
  };
}

export function buildParteSat() {
  const cols = [
    { title: "CONCEPTO", width: 0.52 },
    { title: "TIPO", width: 0.14 },
    { title: "CANT.", width: 0.09 },
    { title: "PRECIO", width: 0.12 },
    { title: "IMPORTE", width: 0.13 },
  ];
  const t = tabla(20, 130, 170, 80, "TRABAJOS Y PIEZAS", cols, 10);
  return {
    id: id(),
    builtin: "parte-sat",
    name: "Parte de trabajo (SAT)",
    tipoDocumento: "parte-sat",
    porDefecto: true,
    page: { size: "A4", orientation: "portrait" },
    elements: [
      logo(20, 14, 40, 18),
      tx("PARTE DE TRABAJO SAT", 100, 16, 90, 10, 16, true, "right", "#111827"),
      tx("{{documento.numero}}", 100, 27, 90, 6, 11, false, "right", "#4b5563"),
      tx("Fecha entrada: {{documento.fecha}}", 100, 34, 90, 5, 9, false, "right", "#6b7280"),

      box(20, 40, 80, 26, 0.4, "#e5e7eb"),
      tx("CLIENTE", 23, 43, 74, 5, 7, true, "left", "#6b7280"),
      tx("{{cliente.nombre}}", 23, 49, 74, 6, 10, true),
      tx("{{cliente.nif}}", 23, 56, 74, 5, 8, false, "left", "#374151"),
      tx("{{cliente.telefono}}", 23, 61, 74, 5, 8, false, "left", "#374151"),

      box(110, 40, 80, 26, 0.4, "#e5e7eb"),
      tx("APARATO", 113, 43, 74, 5, 7, true, "left", "#6b7280"),
      tx("{{aparato.descripcion}}", 113, 49, 74, 6, 9, true),
      tx("{{aparato.marca}} {{aparato.modelo}}", 113, 56, 74, 5, 8, false, "left", "#374151"),
      tx("S/N: {{aparato.serie}}", 113, 61, 74, 5, 8, false, "left", "#374151"),

      tx("Avería / síntoma", 20, 72, 170, 5, 8, true, "left", "#6b7280"),
      box(20, 78, 170, 18, 0.4, "#e5e7eb"),
      tx("{{aparato.averia}}", 23, 82, 164, 11, 9, false, "left", "#374151"),

      tx("Diagnóstico / trabajo realizado", 20, 100, 170, 5, 8, true, "left", "#6b7280"),
      box(20, 106, 170, 18, 0.4, "#e5e7eb"),
      tx("{{aparato.diagnostico}}", 23, 110, 164, 11, 9, false, "left", "#374151"),

      t,

      box(130, 220, 60, 26, 0.4, "#e5e7eb"),
      tx("TOTAL", 134, 236, 34, 7, 11, true, "left"),
      tx("{{totales.total}}", 170, 236, 16, 7, 11, true, "right"),

      tx("Firma conforme cliente", 20, 222, 80, 5, 9, true, "left"),
      box(20, 229, 80, 18, 0.4, "#e5e7eb"),
    ],
  };
}

// ---------- Recepciones (mantenemos las existentes, ajustadas al nuevo almacenamiento) ----------

function tx2(text, x, y, w, h, fontSize = 8, bold = false, align = "left") {
  return { id: id(), type: "text", x, y, w, h, text, fontSize, bold, align, color: "#000000" };
}
function fld2(label, fieldKey, x, y, w, h = 6, fontSize = 9) {
  return { id: id(), type: "field", x, y, w, h, label, fieldKey, fontSize, boxed: true };
}
function chk(label, fieldKey, x, y, w, h = 5, fontSize = 7, bold = false) {
  return { id: id(), type: "checkbox", x, y, w, h, label, fieldKey, fontSize, bold };
}
function box2(x, y, w, h, borderWidth = 1.5) {
  return { id: id(), type: "rect", x, y, w, h, borderWidth, borderColor: "#000000", background: "" };
}
function firma(label, sublabel, x, y, w, h) {
  return { id: id(), type: "signature", x, y, w, h, label, sublabel };
}

export function buildRecepcionVehiculo() {
  const tablaReparaciones = {
    id: id(), type: "table", x: 18, y: 62, w: 132, h: 112,
    columns: [
      { title: "DESCRIPCIÓN", width: 0.67 },
      { title: "MANO DE OBRA", width: 0.165 },
      { title: "MATERIALES", width: 0.165 },
    ],
    rows: 21, headerFontSize: 6, showRowNumbers: true,
    groupTitle: "REPARACIONES A REALIZAR",
  };

  return {
    id: id(),
    builtin: "recepcion-vehiculo",
    name: "Recepción de Vehículo",
    tipoDocumento: "entrada-taller",
    porDefecto: true,
    page: { size: "A4", orientation: "landscape" },
    elements: [
      tx2("EJEMPLAR PARA EL PRESTADOR DEL SERVICIO", 18, 8, 266, 7, 15, true, "center"),
      fld2("NOMBRE DEL TALLER", "taller.nombre", 18, 15, 84, 8),
      fld2("CIF", "taller.cif", 107, 15, 35, 8),
      fld2("DIRECCIÓN", "taller.direccion", 18, 25, 84, 8),
      fld2("TELÉFONO", "taller.telefono", 107, 25, 35, 8),
      fld2("MAIL", "taller.mail", 18, 35, 84, 8),
      tx2("RESGUARDO DE DEPÓSITO SIN PRESUPUESTO Nº:", 152, 16.5, 88, 4, 7, true),
      fld2("", "resguardo.numero", 240, 15.5, 44, 6),
      fld2("TITULAR DEL VEHÍCULO", "cliente.titular", 152, 23, 80, 8),
      fld2("CIF/DNI TITULAR", "cliente.cifTitular", 236, 23, 48, 8),
      fld2("PERSONA SOLICITANTE", "cliente.solicitante", 152, 31.5, 80, 8),
      fld2("CIF/DNI SOLICITANTE", "cliente.cifSolicitante", 236, 31.5, 48, 8),
      fld2("DIRECCIÓN TITULAR", "cliente.direccion", 152, 40, 80, 8),
      fld2("TELÉFONO", "cliente.telefono", 236, 40, 48, 8),
      fld2("MAIL", "cliente.mail", 152, 48.5, 80, 8),
      fld2("FECHA", "vehiculo.fecha", 183, 57, 30, 8),
      fld2("MATRÍCULA", "vehiculo.matricula", 217, 57, 32, 8),
      fld2("MARCA", "vehiculo.marca", 253, 57, 31, 8),
      fld2("KM", "vehiculo.km", 183, 67, 30, 8),
      tx2("SEGURO", 217, 70, 14, 4, 6, true),
      chk("SI", "vehiculo.seguroSi", 232, 69, 11, 5),
      chk("NO", "vehiculo.seguroNo", 244, 69, 12, 5),
      fld2("MODELO", "vehiculo.modelo", 260, 67, 24, 8),
      tx2("COMBUSTIBLE", 183, 79, 24, 4, 6, true),
      chk("R", "vehiculo.combR", 208, 78, 9, 5),
      chk("1/4", "vehiculo.comb14", 218, 78, 11, 5),
      chk("1/2", "vehiculo.comb12", 230, 78, 11, 5),
      chk("3/4", "vehiculo.comb34", 242, 78, 11, 5),
      chk("1", "vehiculo.comb1", 254, 78, 9, 5),
      area("OBSERVACIONES", "vehiculo.observaciones", 183, 85, 101, 9),
      tablaReparaciones,
      box2(152, 97, 132, 53, 2),
      tx2("RENUNCIA A LA ELABORACIÓN", 156, 99, 124, 6, 12, true, "center"),
      tx2("DE PRESUPUESTO PREVIO", 156, 105.5, 124, 6, 12, true, "center"),
      tx2("EL CLIENTE TIENE DERECHO A LA ELABORACIÓN DE UN PRESUPUESTO PREVIO. MEDIANTE LA PRESENTE FIRMA EL USUARIO RENUNCIA A LA ELABORACIÓN DE PRESUPUESTO PREVIO Y AUTORIZA A REALIZAR LOS TRABAJOS NECESARIOS PARA LA REPARACIÓN DEL VEHÍCULO Y/O SERVICIOS SOLICITADOS CONFORME A LO REFLEJADO EN ESTE RESGUARDO DE DEPÓSITO.", 157, 113, 122, 12, 5, true),
      tx2("EL PRESTADOR DEL SERVICIO", 157, 137, 62, 3.5, 6, true),
      tx2("CONFORME CLIENTE", 224, 137, 56, 3.5, 6, true),
      tx2("NOMBRE DEL TALLER", 157, 141.5, 62, 4, 7, false),
      firma("", "", 224, 140, 56, 9),
      tx2("FECHA PREVISTA DE ENTREGA DEL VEHÍCULO REPARADO", 160, 153, 88, 4, 7, true),
      fld2("", "entrega.fechaPrevista", 250, 152, 34, 6),
      tx2("EL CLIENTE CON LA FIRMA ANTERIOR AUTORIZA AL TALLER A:", 152, 160, 132, 4, 7, true),
      chk("REALIZAR DESPLAZAMIENTOS DE DIAGNÓSTICO", "autoriza.desplazamientos", 152, 166, 64, 8, 5, true),
      chk("UTILIZAR ELEMENTOS, EQUIPOS O CONJUNTOS USADOS O NO ESPECÍFICOS (ART 9 Y 10 DECRETO 9/2003)", "autoriza.usados", 220, 166, 64, 8, 5, true),
      chk("UTILIZAR ELEMENTOS, EQUIPOS O CONJUNTOS RECONSTRUIDOS (ART 9 Y 10 DECRETO 9/2003)", "autoriza.reconstruidos", 152, 175, 64, 8, 5, true),
      chk("RENUNCIA A RETIRAR ELEMENTOS SUSTITUIDOS TRAS REPARACIÓN", "autoriza.renunciaRetirar", 220, 175, 64, 8, 5, true),
      tx2("Protección de Datos de Carácter Personal: con la firma del presente usted, presta su consentimiento para que sus datos, sean tratados mientras que no comunique lo contrario por este taller, con la finalidad de gestión contable/administrativa de los servicios. Podrá ejercitar sus derechos de acceso, rectificación, supresión, oposición, y los demás reconocidos en esta norma, enviando solicitud a la dirección indicada, remitiendo copia de su DNI. Puede ejercitar el derecho a presentar una reclamación ante la Agencia Española de Protección de Datos.", 18, 179, 130, 17, 4.5, false),
      tx2("SI TRANSCURRIDOS TRES DÍAS DESDE LA PUESTA EN CONOCIMIENTO DEL CLIENTE DE LA FINALIZACIÓN DE LOS TRABAJOS DE ELABORACIÓN DEL PRESUPUESTO O REPARACIÓN DEL VEHÍCULO, NO PROCEDE EL CLIENTE AL PRONUNCIAMIENTO SOBRE LA ACEPTACIÓN O NO DEL PRESUPUESTO O A LA RETIRADA DEL VEHÍCULO, SE DEVENGARÁN UNOS GASTOS DIARIOS DE ESTANCIA DE          € MÁS IVA.", 152, 179, 132, 17, 4.5, true),
    ],
  };
}

export function buildRecepcionAparato() {
  const tablaTrabajos = {
    id: id(), type: "table", x: 18, y: 62, w: 132, h: 112,
    columns: [
      { title: "DESCRIPCIÓN", width: 0.67 },
      { title: "MANO DE OBRA", width: 0.165 },
      { title: "MATERIALES", width: 0.165 },
    ],
    rows: 21, headerFontSize: 6, showRowNumbers: true,
    groupTitle: "TRABAJOS A REALIZAR",
  };

  return {
    id: id(),
    builtin: "recepcion-aparato",
    name: "Recepción de Aparato",
    tipoDocumento: "entrada-sat",
    porDefecto: true,
    page: { size: "A4", orientation: "landscape" },
    elements: [
      tx2("EJEMPLAR PARA EL PRESTADOR DEL SERVICIO", 18, 8, 266, 7, 15, true, "center"),
      fld2("NOMBRE", "taller.nombre", 18, 15, 84, 8),
      fld2("CIF", "taller.cif", 107, 15, 35, 8),
      fld2("DIRECCIÓN", "taller.direccion", 18, 25, 84, 8),
      fld2("TELÉFONO", "taller.telefono", 107, 25, 35, 8),
      fld2("MAIL", "taller.mail", 18, 35, 84, 8),
      tx2("RESGUARDO DE DEPÓSITO Nº:", 152, 16.5, 62, 4, 7, true),
      fld2("", "resguardo.numero", 218, 15.5, 44, 6),
      fld2("CLIENTE", "cliente.titular", 152, 23, 80, 8),
      fld2("CIF/DNI", "cliente.cifTitular", 236, 23, 48, 8),
      fld2("DIRECCIÓN", "cliente.direccion", 152, 31.5, 80, 8),
      fld2("TELÉFONO", "cliente.telefono", 236, 31.5, 48, 8),
      fld2("MAIL", "cliente.mail", 152, 40, 80, 8),
      fld2("FECHA", "aparato.fecha", 152, 51, 30, 8),
      fld2("TIPO", "aparato.tipo", 186, 51, 40, 8),
      fld2("MARCA", "aparato.marca", 230, 51, 26, 8),
      fld2("MODELO", "aparato.modelo", 260, 51, 24, 8),
      fld2("Nº DE SERIE", "aparato.serie", 152, 61, 44, 8),
      tx2("GARANTÍA", 200, 64, 22, 4, 6, true),
      chk("SI", "aparato.garantiaSi", 224, 63, 11, 5),
      chk("NO", "aparato.garantiaNo", 236, 63, 12, 5),
      fld2("ACCESORIOS QUE ENTREGA", "aparato.accesorios", 152, 71, 132, 8),
      area("ESTADO FÍSICO / DESPERFECTOS VISIBLES", "aparato.estadoFisico", 152, 81, 132, 12),
      area("AVERÍA / SÍNTOMA DESCRITO POR EL CLIENTE", "aparato.averia", 152, 95, 132, 12),
      fld2("DIRECCIÓN DE LA INTERVENCIÓN (SERVICIO A DOMICILIO)", "aparato.direccion", 152, 109, 132, 8),
      tablaTrabajos,
      box2(152, 121, 132, 29, 2),
      tx2("RENUNCIA A LA ELABORACIÓN", 156, 123, 124, 6, 12, true, "center"),
      tx2("DE PRESUPUESTO PREVIO", 156, 129.5, 124, 6, 12, true, "center"),
      tx2("EL CLIENTE TIENE DERECHO A LA ELABORACIÓN DE UN PRESUPUESTO PREVIO. MEDIANTE LA PRESENTE FIRMA EL USUARIO RENUNCIA A LA ELABORACIÓN DE PRESUPUESTO PREVIO Y AUTORIZA A REALIZAR LOS TRABAJOS NECESARIOS PARA LA REPARACIÓN DEL APARATO Y/O SERVICIOS SOLICITADOS CONFORME A LO REFLEJADO EN ESTE RESGUARDO DE DEPÓSITO.", 157, 137, 122, 12, 5, true),
      tx2("EL PRESTADOR DEL SERVICIO", 157, 153, 62, 3.5, 6, true),
      tx2("CONFORME CLIENTE", 224, 153, 56, 3.5, 6, true),
      tx2("NOMBRE Y FIRMA", 157, 157.5, 62, 4, 7, false),
      firma("", "", 224, 156, 56, 10),
      tx2("FECHA PREVISTA DE ENTREGA DEL APARATO REPARADO", 160, 170, 88, 4, 7, true),
      fld2("", "entrega.fechaPrevista", 250, 169, 34, 6),
      tx2("Protección de Datos de Carácter Personal: con la firma del presente usted, presta su consentimiento para que sus datos, sean tratados mientras que no comunique lo contrario por esta empresa, con la finalidad de gestión contable/administrativa de los servicios. Podrá ejercitar sus derechos de acceso, rectificación, supresión, oposición, y los demás reconocidos en esta norma, enviando solicitud a la dirección indicada, remitiendo copia de su DNI. Puede ejercitar el derecho a presentar una reclamación ante la Agencia Española de Protección de Datos.", 18, 179, 130, 17, 4.5, false),
      tx2("SI TRANSCURRIDOS TRES DÍAS DESDE LA PUESTA EN CONOCIMIENTO DEL CLIENTE DE LA FINALIZACIÓN DE LOS TRABAJOS DE ELABORACIÓN DEL PRESUPUESTO O REPARACIÓN DEL APARATO, NO PROCEDE EL CLIENTE AL PRONUNCIAMIENTO SOBRE LA ACEPTACIÓN O NO DEL PRESUPUESTO O A LA RETIRADA DEL APARATO, SE DEVENGARÁN UNOS GASTOS DIARIOS DE ESTANCIA DE          € MÁS IVA.", 152, 179, 132, 17, 4.5, true),
    ],
  };
}

export const BUILTIN_TEMPLATES = [
  buildFacturaVenta,
  buildPresupuestoVenta,
  buildAlbaranVenta,
  buildPedidoCliente,
  buildParteTaller,
  buildParteSat,
  buildRecepcionVehiculo,
  buildRecepcionAparato,
];
