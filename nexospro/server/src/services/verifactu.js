import crypto from "node:crypto";
import https from "node:https";

// Núcleo VeriFactu (RRSIF, RD 1007/2023).
// 100% determinista: ninguna IA interviene en este módulo.
// Referencias oficiales implementadas:
//  - Veri-Factu_especificaciones_huella_hash_registros.pdf (v0.1.2)
//  - DetalleEspecificacTecnCodigoQRfactura.pdf (v0.5.0)
//  - WSDL SistemaFacturacion (endpoints y namespaces)

const NS_LR =
  "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd";
const NS_SF =
  "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd";

const ENDPOINTS = {
  pruebas: "https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
  produccion:
    "https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
};

const URLS_QR = {
  pruebas: "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR",
  produccion: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR",
};

const pad = (x) => String(x).padStart(2, "0");

// Importe en formato AEAT: punto decimal, 2 posiciones.
export function formatoImporte(n) {
  return Number(n).toFixed(2);
}

export function fechaDDMMYYYY(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

// ISO 8601 con huso horario local: 2026-08-05T19:02:31+02:00
export function timestampRegistro(fecha = new Date()) {
  const off = -fecha.getTimezoneOffset();
  const signo = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return (
    `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}` +
    `T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}:${pad(fecha.getSeconds())}` +
    `${signo}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

export function sha256Mayus(cadena) {
  return crypto.createHash("sha256").update(cadena, "utf8").digest("hex").toUpperCase();
}

// Huella de un registro de ALTA, según especificación AEAT v0.1.2.
export function huellaAlta({
  nifEmisor,
  numSerie,
  fechaExpedicion, // DD-MM-AAAA
  tipoFactura, // F1, F2, R1...
  cuotaTotal,
  importeTotal,
  huellaAnterior = "",
  fechaHoraGen, // timestampRegistro()
}) {
  const cadena =
    `IDEmisorFactura=${nifEmisor.trim()}` +
    `&NumSerieFactura=${String(numSerie).trim()}` +
    `&FechaExpedicionFactura=${fechaExpedicion}` +
    `&TipoFactura=${tipoFactura}` +
    `&CuotaTotal=${formatoImporte(cuotaTotal)}` +
    `&ImporteTotal=${formatoImporte(importeTotal)}` +
    `&Huella=${huellaAnterior}` +
    `&FechaHoraHusoGenRegistro=${fechaHoraGen}`;
  return sha256Mayus(cadena);
}

// Huella de un registro de ANULACIÓN.
export function huellaAnulacion({
  nifEmisor,
  numSerie,
  fechaExpedicion,
  huellaAnterior = "",
  fechaHoraGen,
}) {
  const cadena =
    `IDEmisorFacturaAnulada=${nifEmisor.trim()}` +
    `&NumSerieFacturaAnulada=${String(numSerie).trim()}` +
    `&FechaExpedicionFacturaAnulada=${fechaExpedicion}` +
    `&Huella=${huellaAnterior}` +
    `&FechaHoraHusoGenRegistro=${fechaHoraGen}`;
  return sha256Mayus(cadena);
}

// Contenido del QR tributario de la factura (URL de cotejo AEAT).
export function contenidoQr({
  nif,
  numSerie,
  fechaExpedicion, // DD-MM-AAAA
  total,
  entorno = process.env.AEAT_ENTORNO || "pruebas",
}) {
  const base = URLS_QR[entorno] ?? URLS_QR.pruebas;
  const params = new URLSearchParams({
    nif: nif.trim(),
    numserie: String(numSerie).trim(),
    fecha: fechaExpedicion,
    importe: formatoImporte(total),
  });
  return `${base}?${params.toString()}`;
}

const escaparXml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function sistemaInformaticoXml() {
  return (
    `<sf:SistemaInformatico>` +
    `<sf:NombreRazon>${escaparXml(process.env.SIF_NOMBRE_RAZON || "FILA TECNICA SL")}</sf:NombreRazon>` +
    `<sf:NIF>${escaparXml(process.env.SIF_NIF || "B75418350")}</sf:NIF>` +
    `<sf:NombreSistemaInformatico>NEXOSPRO</sf:NombreSistemaInformatico>` +
    `<sf:IdSistemaInformatico>${escaparXml(process.env.SIF_ID || "NP")}</sf:IdSistemaInformatico>` +
    `<sf:Version>${escaparXml(process.env.SIF_VERSION || "0.1.0")}</sf:Version>` +
    `<sf:NumeroInstalacion>${escaparXml(process.env.SIF_NUM_INSTALACION || "1")}</sf:NumeroInstalacion>` +
    `<sf:TipoUsoPosibleSoloVerifactu>S</sf:TipoUsoPosibleSoloVerifactu>` +
    `<sf:TipoUsoPosibleMultiOT>N</sf:TipoUsoPosibleMultiOT>` +
    `<sf:IndicadorMultiplesOT>N</sf:IndicadorMultiplesOT>` +
    `</sf:SistemaInformatico>`
  );
}

function encadenamientoXml(registroAnterior) {
  if (!registroAnterior) {
    return `<sf:Encadenamiento><sf:PrimerRegistro>S</sf:PrimerRegistro></sf:Encadenamiento>`;
  }
  return (
    `<sf:Encadenamiento><sf:RegistroAnterior>` +
    `<sf:IDEmisorFactura>${escaparXml(registroAnterior.emisor)}</sf:IDEmisorFactura>` +
    `<sf:NumSerieFactura>${escaparXml(registroAnterior.numSerie)}</sf:NumSerieFactura>` +
    `<sf:FechaExpedicionFactura>${registroAnterior.fecha}</sf:FechaExpedicionFactura>` +
    `<sf:Huella>${registroAnterior.huella}</sf:Huella>` +
    `</sf:RegistroAnterior></sf:Encadenamiento>`
  );
}

function desgloseXml(lineas) {
  // Agrupa las líneas por tipo de IVA. MVP: IVA general repercutido (S1).
  const porTipo = new Map();
  for (const l of lineas) {
    const tipo = Number(l.iva ?? 0);
    // Base con el descuento de la línea (%) aplicado, igual que calcularTotales.
    const base = (l.cantidad ?? 0) * (l.precioUnitario ?? 0) * (1 - (l.descuento ?? 0) / 100);
    const acc = porTipo.get(tipo) ?? { base: 0, cuota: 0 };
    acc.base += base;
    acc.cuota += (base * tipo) / 100;
    porTipo.set(tipo, acc);
  }
  let detalles = "";
  for (const [tipo, { base, cuota }] of [...porTipo.entries()].sort((a, b) => b[0] - a[0])) {
    detalles +=
      `<sf:DetalleDesglose>` +
      `<sf:Impuesto>01</sf:Impuesto>` +
      `<sf:ClaveRegimen>01</sf:ClaveRegimen>` +
      `<sf:CalificacionOperacion>S1</sf:CalificacionOperacion>` +
      `<sf:TipoImpositivo>${formatoImporte(tipo)}</sf:TipoImpositivo>` +
      `<sf:BaseImponibleOimporteNoSujeto>${formatoImporte(base)}</sf:BaseImponibleOimporteNoSujeto>` +
      `<sf:CuotaRepercutida>${formatoImporte(cuota)}</sf:CuotaRepercutida>` +
      `</sf:DetalleDesglose>`;
  }
  return `<sf:Desglose>${detalles}</sf:Desglose>`;
}

// XML del registro de ALTA completo (RegistroFacturacionAltaType).
export function xmlRegistroAlta({
  empresa, // {nombre, nif}
  factura, // {serieNumero, fechaExpedicion, lineas, cuotaIva, total, cliente:{nombre,nif}, descripcion}
  huella,
  fechaHoraGen,
  registroAnterior = null, // {emisor, numSerie, fecha, huella}
  tipoFactura = "F1", // F1 normal · R1 rectificativa
  facturaRectificada = null, // {numSerie, fecha} para rectificativas
}) {
  const fecha = fechaDDMMYYYY(factura.fechaExpedicion);
  const cliente = factura.cliente ?? {};
  // Las facturas simplificadas (F2) y sus rectificativas (R5) no llevan
  // destinatario: son ventas de mostrador sin identificación del cliente.
  const sinDestinatario = tipoFactura === "F2" || tipoFactura === "R5";
  const bloqueDestinatarios = sinDestinatario
    ? ""
    : `<sf:Destinatarios><sf:IDDestinatario>` +
      `<sf:NombreRazon>${escaparXml(cliente.nombre ?? "")}</sf:NombreRazon>` +
      `<sf:NIF>${escaparXml(cliente.nif ?? "")}</sf:NIF>` +
      `</sf:IDDestinatario></sf:Destinatarios>`;
  const bloqueRectificada =
    tipoFactura.startsWith("R") && facturaRectificada
      ? `<sf:FacturasRectificadas><sf:IDFacturaRectificada>` +
        `<sf:IDEmisorFactura>${escaparXml(empresa.nif)}</sf:IDEmisorFactura>` +
        `<sf:NumSerieFactura>${escaparXml(facturaRectificada.numSerie)}</sf:NumSerieFactura>` +
        `<sf:FechaExpedicionFactura>${facturaRectificada.fecha}</sf:FechaExpedicionFactura>` +
        `</sf:IDFacturaRectificada></sf:FacturasRectificadas>` +
        `<sf:TipoRectificativa>I</sf:TipoRectificativa>`
      : "";
  return (
    `<sf:RegistroAlta>` +
    `<sf:IDFactura>` +
    `<sf:IDEmisorFactura>${escaparXml(empresa.nif)}</sf:IDEmisorFactura>` +
    `<sf:NumSerieFactura>${escaparXml(factura.serieNumero)}</sf:NumSerieFactura>` +
    `<sf:FechaExpedicionFactura>${fecha}</sf:FechaExpedicionFactura>` +
    `</sf:IDFactura>` +
    `<sf:NombreRazonEmisor>${escaparXml(empresa.nombre)}</sf:NombreRazonEmisor>` +
    `<sf:TipoFactura>${tipoFactura}</sf:TipoFactura>` +
    `<sf:DescripcionOperacion>${escaparXml(factura.descripcion || "Prestación de servicios / venta de bienes")}</sf:DescripcionOperacion>` +
    bloqueRectificada +
    bloqueDestinatarios +
    desgloseXml(factura.lineas ?? []) +
    `<sf:CuotaTotal>${formatoImporte(factura.cuotaIva)}</sf:CuotaTotal>` +
    `<sf:ImporteTotal>${formatoImporte(factura.total)}</sf:ImporteTotal>` +
    encadenamientoXml(registroAnterior) +
    sistemaInformaticoXml() +
    `<sf:FechaHoraHusoGenRegistro>${fechaHoraGen}</sf:FechaHoraHusoGenRegistro>` +
    `<sf:TipoHuella>01</sf:TipoHuella>` +
    `<sf:Huella>${huella}</sf:Huella>` +
    `</sf:RegistroAlta>`
  );
}

// XML del registro de ANULACIÓN (RegistroFacturacionAnulacionType).
export function xmlRegistroAnulacion({
  empresa,
  factura,
  huella,
  fechaHoraGen,
  registroAnterior = null,
}) {
  const fecha = fechaDDMMYYYY(factura.fechaExpedicion);
  return (
    `<sf:RegistroAnulacion>` +
    `<sf:IDFactura>` +
    `<sf:IDEmisorFacturaAnulada>${escaparXml(empresa.nif)}</sf:IDEmisorFacturaAnulada>` +
    `<sf:NumSerieFacturaAnulada>${escaparXml(factura.serieNumero)}</sf:NumSerieFacturaAnulada>` +
    `<sf:FechaExpedicionFacturaAnulada>${fecha}</sf:FechaExpedicionFacturaAnulada>` +
    `</sf:IDFactura>` +
    encadenamientoXml(registroAnterior) +
    sistemaInformaticoXml() +
    `<sf:FechaHoraHusoGenRegistro>${fechaHoraGen}</sf:FechaHoraHusoGenRegistro>` +
    `<sf:TipoHuella>01</sf:TipoHuella>` +
    `<sf:Huella>${huella}</sf:Huella>` +
    `</sf:RegistroAnulacion>`
  );
}

// Envoltura SOAP de la petición RegFactuSistemaFacturacion.
export function sobreSoap(empresa, registroXml, esAnulacion = false) {
  const contenido = esAnulacion
    ? `<sfLR:RegistroFactura>${registroXml}</sfLR:RegistroFactura>`
    : `<sfLR:RegistroFactura>${registroXml}</sfLR:RegistroFactura>`;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"` +
    ` xmlns:sfLR="${NS_LR}" xmlns:sf="${NS_SF}">` +
    `<soapenv:Header/><soapenv:Body>` +
    `<sfLR:RegFactuSistemaFacturacion>` +
    `<sfLR:Cabecera><sf:ObligadoEmision>` +
    `<sf:NombreRazon>${escaparXml(empresa.nombre)}</sf:NombreRazon>` +
    `<sf:NIF>${escaparXml(empresa.nif)}</sf:NIF>` +
    `</sf:ObligadoEmision></sfLR:Cabecera>` +
    contenido +
    `</sfLR:RegFactuSistemaFacturacion>` +
    `</soapenv:Body></soapenv:Envelope>`
  );
}

// Remisión a la AEAT con certificado electrónico (PFX/P12).
// El certificado llega por parámetro ({ buffer, pass }): cada empresa tiene el
// suyo (lo resuelve services/certificadoEmpresa.js dentro del contexto de la
// petición o del worker multiempresa).
export function remitirAeat(xml, cert) {
  return new Promise((resolve, reject) => {
    if (!cert?.buffer) {
      return reject(
        new Error("Certificado AEAT no configurado (Sistema → Certificado)")
      );
    }
    const entorno = process.env.AEAT_ENTORNO || "pruebas";
    const url = new URL(ENDPOINTS[entorno] ?? ENDPOINTS.pruebas);
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        path: url.pathname,
        pfx: cert.buffer,
        passphrase: cert?.pass || "",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "",
          "Content-Length": Buffer.byteLength(xml),
        },
        timeout: 30000,
      },
      (res) => {
        let cuerpo = "";
        res.on("data", (t) => (cuerpo += t));
        res.on("end", () => resolve({ httpStatus: res.statusCode, cuerpo }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("Timeout en la remisión a la AEAT")));
    req.on("error", reject);
    req.write(xml);
    req.end();
  });
}
