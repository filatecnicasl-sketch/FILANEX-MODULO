import Cliente from "../models/Cliente.js";
import FacturaVenta from "../models/FacturaVenta.js";
import Presupuesto from "../models/Presupuesto.js";
import AlbaranVenta from "../models/AlbaranVenta.js";
import OrdenTrabajo from "../models/OrdenTrabajo.js";
import OrdenServicio from "../models/OrdenServicio.js";
import Empresa from "../models/Empresa.js";

const euros = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
const fechaEs = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "");
const dirTexto = (d) => [d?.calle, d?.cp, d?.ciudad, d?.provincia].filter(Boolean).join(", ");

function netoLinea(l) {
  return (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0) * (1 - (Number(l.descuento) || 0) / 100);
}

async function datosEmpresa() {
  const e = await Empresa.findOne().lean();
  return {
    nombre: e?.nombre ?? "",
    nif: e?.nif ?? "",
    direccion: dirTexto(e?.direccion),
    telefono: e?.telefono ?? "",
    email: e?.email ?? "",
    logoUrl: e?.logoUrl ?? "",
  };
}

async function datosFacturaVenta(id) {
  const f = await FacturaVenta.findById(id).populate("cliente").lean();
  if (!f) throw new Error("Factura no encontrada");
  const emp = await datosEmpresa();
  const c = f.cliente ?? {};
  const conDto = (f.lineas ?? []).some((l) => (Number(l.descuento) || 0) > 0);

  const formData = {
    "empresa.nombre": emp.nombre,
    "empresa.nif": emp.nif,
    "empresa.direccion": emp.direccion,
    "empresa.telefono": emp.telefono,
    "empresa.email": emp.email,
    "empresa.logo": "{{empresa.logo}}",
    "documento.tipo": f.estado === "borrador" ? "FACTURA (BORRADOR)" : "FACTURA",
    "documento.numero": f.serieNumero ?? "",
    "documento.fecha": fechaEs(f.fechaExpedicion),
    "documento.estado": f.estado ?? "",
    "cliente.nombre": c.nombre ?? "",
    "cliente.nif": c.nif ?? "",
    "cliente.direccion": dirTexto(c.direccion),
    "cliente.telefono": c.telefono ?? "",
    "cliente.email": c.email ?? "",
    "totales.base": euros(f.baseImponible),
    "totales.iva": euros(f.cuotaIva),
    "totales.total": euros(f.total),
    "pago.metodo": f.metodoPago ?? "",
    "pago.vencimiento": fechaEs(f.vencimiento),
    "notas": f.descripcion ?? "",
  };

  // Tabla de líneas: usamos la primera tabla de la plantilla
  formData.lineas = (f.lineas ?? []).map((l) => ({
    concepto: l.descripcion ?? "",
    cantidad: l.cantidad ?? "",
    precio: euros(l.precioUnitario),
    dto: conDto ? ((Number(l.descuento) || 0) > 0 ? `${l.descuento}%` : "") : null,
    iva: `${l.iva ?? 0}%`,
    importe: euros(netoLinea(l)),
  }));

  return { formData, logoUrl: emp.logoUrl, qrContenido: f.verifactu?.qrContenido, estado: f.estado };
}

async function datosPresupuestoVenta(id) {
  const p = await Presupuesto.findById(id).populate("cliente").lean();
  if (!p) throw new Error("Presupuesto no encontrado");
  const emp = await datosEmpresa();
  const c = p.cliente ?? {};
  const conDto = (p.lineas ?? []).some((l) => (Number(l.descuento) || 0) > 0);

  const formData = {
    "empresa.nombre": emp.nombre,
    "empresa.nif": emp.nif,
    "empresa.direccion": emp.direccion,
    "empresa.telefono": emp.telefono,
    "empresa.email": emp.email,
    "empresa.logo": "{{empresa.logo}}",
    "documento.tipo": "PRESUPUESTO",
    "documento.numero": p.serieNumero ?? "",
    "documento.fecha": fechaEs(p.fecha),
    "documento.validez": p.validezDias ? `${p.validezDias} días` : "",
    "documento.estado": p.estado ?? "",
    "cliente.nombre": c.nombre ?? "",
    "cliente.nif": c.nif ?? "",
    "cliente.direccion": dirTexto(c.direccion),
    "cliente.telefono": c.telefono ?? "",
    "cliente.email": c.email ?? "",
    "totales.base": euros(p.baseImponible),
    "totales.iva": euros(p.cuotaIva),
    "totales.total": euros(p.total),
    "notas": "",
  };

  formData.lineas = (p.lineas ?? []).map((l) => ({
    concepto: l.descripcion ?? "",
    cantidad: l.cantidad ?? "",
    precio: euros(l.precioUnitario),
    dto: conDto ? ((Number(l.descuento) || 0) > 0 ? `${l.descuento}%` : "") : null,
    iva: `${l.iva ?? 0}%`,
    importe: euros(netoLinea(l)),
  }));

  return { formData, logoUrl: emp.logoUrl };
}

async function datosAlbaranVenta(id) {
  const a = await AlbaranVenta.findById(id).populate("cliente").lean();
  if (!a) throw new Error("Albarán no encontrado");
  const emp = await datosEmpresa();
  const c = a.cliente ?? {};
  const conDto = (a.lineas ?? []).some((l) => (Number(l.descuento) || 0) > 0);

  const formData = {
    "empresa.nombre": emp.nombre,
    "empresa.nif": emp.nif,
    "empresa.direccion": emp.direccion,
    "empresa.telefono": emp.telefono,
    "empresa.email": emp.email,
    "empresa.logo": "{{empresa.logo}}",
    "documento.tipo": "ALBARÁN",
    "documento.numero": a.serieNumero ?? "",
    "documento.fecha": fechaEs(a.fecha),
    "documento.estado": a.estado ?? "",
    "cliente.nombre": c.nombre ?? "",
    "cliente.nif": c.nif ?? "",
    "cliente.direccion": dirTexto(c.direccion),
    "cliente.telefono": c.telefono ?? "",
    "cliente.email": c.email ?? "",
    "notas": "",
  };

  formData.lineas = (a.lineas ?? []).map((l) => ({
    concepto: l.descripcion ?? "",
    cantidad: l.cantidad ?? "",
    precio: euros(l.precioUnitario),
    dto: conDto ? ((Number(l.descuento) || 0) > 0 ? `${l.descuento}%` : "") : null,
    iva: `${l.iva ?? 0}%`,
    importe: euros(netoLinea(l)),
  }));

  return { formData, logoUrl: emp.logoUrl, firma: a.firmaEntrega };
}

async function datosOrdenTrabajo(id) {
  const o = await OrdenTrabajo.findById(id).populate("cliente vehiculo aseguradora").lean();
  if (!o) throw new Error("Orden no encontrada");
  const emp = await datosEmpresa();
  const c = o.cliente ?? {};
  const v = o.vehiculo ?? {};
  const aseg = o.aseguradora ?? {};

  const formData = {
    "empresa.nombre": emp.nombre,
    "empresa.nif": emp.nif,
    "empresa.direccion": emp.direccion,
    "empresa.telefono": emp.telefono,
    "empresa.email": emp.email,
    "empresa.logo": "{{empresa.logo}}",
    "documento.tipo": "PARTE DE TRABAJO",
    "documento.numero": o.numero ?? "",
    "documento.fecha": fechaEs(o.fechaEntrada),
    "cliente.nombre": c.nombre ?? o.clienteNombre ?? "",
    "cliente.nif": c.nif ?? "",
    "cliente.direccion": dirTexto(c.direccion),
    "cliente.telefono": c.telefono ?? o.telefono ?? "",
    "cliente.email": c.email ?? "",
    "vehiculo.matricula": o.matricula ?? "",
    "vehiculo.marca": v.marca ?? "",
    "vehiculo.modelo": v.modelo ?? "",
    "vehiculo.km": o.km != null ? Number(o.km).toLocaleString("es-ES") : "",
    "vehiculo.entrada": fechaEs(o.fechaEntrada),
    "vehiculo.entregaPrevista": fechaEs(o.fechaEntregaPrevista),
    "seguro.compania": aseg.nombre ?? "",
    "seguro.siniestro": o.numeroSiniestro ?? "",
    "trabajos.tipo": (o.trabajos ?? []).join(", "),
    "trabajos.motivo": o.motivo ?? "",
    "totales.total": euros((o.lineas ?? []).reduce((s, l) => s + netoLinea(l) * (1 + (Number(l.iva) || 0) / 100), 0)),
  };

  formData.lineas = (o.lineas ?? []).map((l) => ({
    concepto: l.descripcion ?? "",
    tipo: l.tipo === "mano_obra" ? "Mano de obra" : l.tipo === "material" ? "Material" : "",
    cantidad: l.cantidad ?? "",
    precio: euros(l.precioUnitario),
    dto: (Number(l.descuento) || 0) > 0 ? `${l.descuento}%` : "",
    iva: `${l.iva ?? 0}%`,
    importe: euros(netoLinea(l)),
  }));

  return { formData, logoUrl: emp.logoUrl };
}

async function datosOrdenServicio(id) {
  const o = await OrdenServicio.findById(id).populate("cliente aparato").lean();
  if (!o) throw new Error("Orden SAT no encontrada");
  const emp = await datosEmpresa();
  const c = o.cliente ?? {};
  const ap = o.aparato ?? {};

  const formData = {
    "empresa.nombre": emp.nombre,
    "empresa.nif": emp.nif,
    "empresa.direccion": emp.direccion,
    "empresa.telefono": emp.telefono,
    "empresa.email": emp.email,
    "empresa.logo": "{{empresa.logo}}",
    "documento.tipo": "PARTE DE TRABAJO SAT",
    "documento.numero": o.numero ?? "",
    "documento.fecha": fechaEs(o.fechaEntrada),
    "cliente.nombre": c.nombre ?? o.clienteNombre ?? "",
    "cliente.nif": c.nif ?? "",
    "cliente.direccion": dirTexto(c.direccion),
    "cliente.telefono": c.telefono ?? o.telefono ?? "",
    "cliente.email": c.email ?? "",
    "aparato.descripcion": o.aparatoDescripcion ?? "",
    "aparato.tipo": ap.tipo ?? "",
    "aparato.marca": ap.marca ?? "",
    "aparato.modelo": ap.modelo ?? "",
    "aparato.serie": ap.numeroSerie ?? "",
    "aparato.accesorios": o.accesorios ?? "",
    "aparato.estadoFisico": o.estadoFisico ?? "",
    "aparato.averia": o.averia ?? "",
    "aparato.diagnostico": o.diagnostico ?? "",
    "aparato.garantia": o.garantia === "en_garantia" ? "En garantía" : "Sin garantía",
    "totales.total": euros((o.lineas ?? []).reduce((s, l) => s + netoLinea(l) * (1 + (Number(l.iva) || 0) / 100), 0)),
  };

  formData.lineas = (o.lineas ?? []).map((l) => ({
    concepto: l.descripcion ?? "",
    tipo: l.tipo === "mano_obra" ? "Mano de obra" : l.tipo === "material" ? "Material" : "",
    cantidad: l.cantidad ?? "",
    precio: euros(l.precioUnitario),
    dto: (Number(l.descuento) || 0) > 0 ? `${l.descuento}%` : "",
    iva: `${l.iva ?? 0}%`,
    importe: euros(netoLinea(l)),
  }));

  return { formData, logoUrl: emp.logoUrl };
}

export async function datosParaPdf(tipo, id) {
  switch (tipo) {
    case "factura-venta":
      return datosFacturaVenta(id);
    case "presupuesto-venta":
      return datosPresupuestoVenta(id);
    case "albaran-venta":
      return datosAlbaranVenta(id);
    case "parte-taller":
      return datosOrdenTrabajo(id);
    case "parte-sat":
      return datosOrdenServicio(id);
    default:
      throw new Error(`Tipo de documento no soportado: ${tipo}`);
  }
}

export { netoLinea, euros, fechaEs, dirTexto };
