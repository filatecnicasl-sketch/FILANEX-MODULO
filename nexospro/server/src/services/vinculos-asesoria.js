// Lógica del vínculo empresa ↔ asesoría: códigos, resolución segura del
// tenant cliente y lectura cross-tenant de sus documentos fiscales.
//
// REGLA DE SEGURIDAD: la base de datos del cliente nunca viene en la
// petición; siempre se resuelve en el servidor desde el vínculo activo
// guardado en la BD plataforma. Las lecturas son .lean() y de solo lectura.
import crypto from "node:crypto";
import Tenant from "../models/plataforma/Tenant.js";
import VinculoAsesoria from "../models/plataforma/VinculoAsesoria.js";
import { conexionTenant, conContexto } from "../models/tenant.js";
// Importar los modelos registra sus esquemas en cualquier conexión tenant
// que se abra después (conexionTenant los propaga con registrarEsquemas).
import "../models/FacturaVenta.js";
import "../models/FacturaCompra.js";
import "../models/Gasto.js";
import "../models/Cliente.js";
import "../models/Proveedor.js";
import "../models/Empresa.js";
import ClienteAsesoria from "../models/ClienteAsesoria.js";

const CARACTERES_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I
const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ------------------------------------------------------------- código ASC-

// Devuelve el código público de la asesoría, generándolo la primera vez.
export async function codigoDeAsesoria(tenant) {
  if (tenant.codigoAsesoria) return tenant.codigoAsesoria;
  for (let intento = 0; intento < 10; intento++) {
    const aleatorio = [...crypto.randomBytes(6)]
      .map((b) => CARACTERES_CODIGO[b % CARACTERES_CODIGO.length])
      .join("");
    const codigo = `ASC-${aleatorio}`;
    // eslint-disable-next-line no-await-in-loop
    const ocupado = await Tenant.exists({ codigoAsesoria: codigo });
    if (!ocupado) {
      tenant.codigoAsesoria = codigo;
      await tenant.save();
      return codigo;
    }
  }
  throw new Error("No se pudo generar un código de asesoría único");
}

export async function buscarAsesoriaPorCodigo(codigo) {
  const limpio = String(codigo ?? "").trim().toUpperCase();
  if (!limpio) return null;
  const tenant = await Tenant.findOne({ codigoAsesoria: limpio }).lean();
  if (!tenant) return null;
  if (!["activo", "demo"].includes(tenant.estado)) return null;
  // El módulo activo se mira en la Empresa del tenant (es lo que usa
  // requiereModulo); Tenant.modulos puede quedar desincronizado.
  const conn = conexionTenant(tenant.dbName);
  const empresa = await conn.model("Empresa").findOne().select("modulos").lean();
  if (!(empresa?.modulos ?? []).includes("asesoria")) return null;
  // Solo lo imprescindible para mostrar antes de firmar.
  return { _id: tenant._id, nombre: tenant.nombre, nif: tenant.nif ?? "", ciudad: tenant.ciudad ?? "" };
}

// ------------------------------------------------------------- vínculos ---

// Vínculo vigente de una empresa cliente (activo o pendiente de firma).
export function vinculoVigenteDeCliente(clienteTenantId) {
  return VinculoAsesoria.findOne({
    cliente: clienteTenantId,
    estado: { $in: ["activo", "pendiente"] },
  });
}

// Alta (o actualización) del cliente en la cartera de la asesoría. Se
// ejecuta abriendo el contexto de la BD de la asesoría.
export async function asegurarClienteEnCartera(vinculo, tenantAsesoria, datosEmpresa) {
  return conContexto(
    { conn: conexionTenant(tenantAsesoria.dbName), slug: tenantAsesoria.slug, dbName: tenantAsesoria.dbName },
    async () => {
      const nif = String(datosEmpresa.nif ?? "").toUpperCase().replace(/[\s.-]/g, "");
      let cliente = nif ? await ClienteAsesoria.findOne({ nif }) : null;
      if (!cliente) {
        const codigo = `FLX-${String(vinculo._id).slice(-6).toUpperCase()}`;
        cliente = new ClienteAsesoria({
          codigo,
          nombre: datosEmpresa.nombre,
          nif: nif || codigo,
          email: datosEmpresa.email ?? "",
          telefono: datosEmpresa.telefono ?? "",
          notas: "Alta automática por vínculo FILANEX",
        });
      } else {
        cliente.nombre = cliente.nombre || datosEmpresa.nombre;
      }
      await cliente.save();
      return cliente._id;
    }
  );
}

// --------------------------------------------- lectura de documentos -----
// Normaliza los documentos fiscales del tenant cliente al formato que usa el
// módulo de asesoría (DocumentoFiscal). Solo estados "cerrados": la
// asesoría no ve borradores ni papelera.

function rango(campo, desde, hasta) {
  const r = {};
  if (desde) r.$gte = new Date(desde);
  if (hasta) {
    const h = new Date(hasta);
    h.setHours(23, 59, 59, 999);
    r.$lte = h;
  }
  return Object.keys(r).length ? { [campo]: r } : {};
}

export async function documentosDeVinculo(vinculo, tenantCliente, { tipo, desde, hasta }) {
  const conn = conexionTenant(tenantCliente.dbName);
  const salida = [];

  if ((tipo === "ventas" || tipo === "todos") && vinculo.compartir.ventas) {
    const FacturaVenta = conn.model("FacturaVenta");
    const docs = await FacturaVenta.find({ estado: "emitida", ...rango("fechaExpedicion", desde, hasta) })
      .populate("cliente", "nombre nif")
      .sort({ fechaExpedicion: 1 })
      .lean();
    for (const f of docs) {
      salida.push({
        coleccion: "facturaventas",
        tipo: "emitida",
        documentoId: String(f._id),
        numero: f.serieNumero ?? `${f.serie ?? "A"}-${f.numero ?? "?"}`,
        fecha: f.fechaExpedicion,
        tercero: f.cliente?.nombre ?? "—",
        nifTercero: f.cliente?.nif ?? "",
        base: redondear(f.baseImponible),
        cuotaIva: redondear(f.cuotaIva),
        total: redondear(f.total),
      });
    }
  }

  if ((tipo === "compras" || tipo === "todos") && vinculo.compartir.compras) {
    const FacturaCompra = conn.model("FacturaCompra");
    const docs = await FacturaCompra.find({ estado: "validada", ...rango("fechaRecepcion", desde, hasta) })
      .populate("proveedor", "nombre nif")
      .sort({ fechaRecepcion: 1 })
      .lean();
    for (const f of docs) {
      salida.push({
        coleccion: "facturacompras",
        tipo: "recibida",
        documentoId: String(f._id),
        numero: f.numeroFacturaProveedor ?? "—",
        fecha: f.fechaExpedicion ?? f.fechaRecepcion ?? f.createdAt,
        tercero: f.proveedor?.nombre ?? "—",
        nifTercero: f.proveedor?.nif ?? "",
        base: redondear(f.baseImponible),
        cuotaIva: redondear(f.cuotaIva),
        total: redondear(f.total),
      });
    }
  }

  if ((tipo === "tickets" || tipo === "todos") && vinculo.compartir.tickets) {
    const Gasto = conn.model("Gasto");
    const docs = await Gasto.find({ estado: "validado", ...rango("fecha", desde, hasta) })
      .sort({ fecha: 1 })
      .lean();
    for (const g of docs) {
      // En el libro de la asesoría solo entra la parte deducible del ticket.
      const deducible = g.conDatosFiscales
        ? redondear(((g.cuotaIva ?? 0) * (g.ivaDeduciblePct ?? 0)) / 100)
        : 0;
      salida.push({
        coleccion: "gastos",
        tipo: "gasto",
        documentoId: String(g._id),
        numero: "",
        fecha: g.fecha,
        tercero: g.comercio ?? "—",
        nifTercero: g.nifComercio ?? "",
        base: redondear(g.base),
        cuotaIva: deducible,
        total: redondear(g.total),
      });
    }
  }

  return salida.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

// Tipo de IVA efectivo para el libro: la cuota ya viene exacta del
// documento; el tipo es orientativo cuando hay varios tipos mezclados.
export function tipoIvaEfectivo(base, cuotaIva) {
  if (!base) return 21;
  const efectivo = Math.round((cuotaIva / base) * 100);
  return [0, 4, 10, 21].includes(efectivo) ? efectivo : 21;
}
