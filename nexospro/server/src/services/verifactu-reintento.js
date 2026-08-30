// Reenvío a la AEAT de registros VeriFactu pendientes. Lo usan el endpoint
// manual (Sistema → VeriFactu) y el reintento automático periódico, para que
// las facturas emitidas durante un apagón de internet se remitan solas al
// volver la conexión (la AEAT admite subsanación de remisiones).
//
// Multiempresa: el certificado llega por parámetro (cada empresa tiene el
// suyo) y el reintento periódico itera las empresas activas abriendo el
// contexto de cada una.
import RegistroFacturacion from "../models/RegistroFacturacion.js";
import FacturaVenta from "../models/FacturaVenta.js";
import Tenant from "../models/plataforma/Tenant.js";
import { alsEmpresa, conexionTenant } from "../models/tenant.js";
import { remitirAeat } from "./verifactu.js";
import { certificadoActual } from "./certificadoEmpresa.js";
import { politicaEnvio, permiteEnviar } from "./verifactu-envio.js";

export async function reenviarPendientes(cert) {
  if (!cert) {
    return { procesados: 0, resultados: [], sinCertificado: true };
  }
  // Salvaguarda: sin envío activado no se remite nada, aunque haya
  // certificado. Evita que al instalarlo se manden de golpe a la AEAT todas
  // las facturas pendientes acumuladas de meses anteriores.
  const politica = await politicaEnvio();
  if (!politica.activo) {
    return { procesados: 0, resultados: [], envioDesactivado: true };
  }

  const todas = await RegistroFacturacion.find({
    estadoEnvio: { $in: ["pendiente", "rechazado"] },
  }).sort({ _id: 1 });
  const pendientes = todas.filter((r) => permiteEnviar(politica, r.fechaExpedicionFactura));

  const resultados = [];
  for (const registro of pendientes) {
    try {
      const resp = await remitirAeat(registro.xml, cert);
      const aceptado = /EstadoEnvio>Correcto</.test(resp.cuerpo);
      const conErrores = /AceptadoConErrores/.test(resp.cuerpo);
      registro.estadoEnvio = aceptado ? "aceptado" : conErrores ? "aceptado_con_errores" : "rechazado";
      registro.respuestaAeat = { httpStatus: resp.httpStatus, cuerpo: resp.cuerpo.slice(0, 4000) };
      await registro.save();
      if ((aceptado || conErrores) && registro.facturaVenta) {
        await FacturaVenta.findByIdAndUpdate(registro.facturaVenta, {
          "verifactu.enviada": true,
          "verifactu.estadoEnvio": registro.estadoEnvio,
        });
      }
      resultados.push({ numSerie: registro.numSerieFactura, estado: registro.estadoEnvio });
    } catch (e) {
      resultados.push({ numSerie: registro.numSerieFactura, estado: "error", detalle: e.message });
    }
  }
  return { procesados: resultados.length, resultados };
}

// Reintento automático: cada 15 minutos (primera pasada a los 2 minutos del
// arranque) recorre las empresas activas y reenvía lo pendiente de cada una
// con su propio certificado. Silencioso: solo deja traza si hubo trabajo.
const INTERVALO_MS = 15 * 60 * 1000;

async function pasadaTenant(tenant) {
  const store = {
    conn: conexionTenant(tenant.dbName),
    slug: tenant.slug,
    dbName: tenant.dbName,
  };
  return alsEmpresa.run(store, async () => {
    const cert = await certificadoActual();
    if (!cert) return { procesados: 0, resultados: [] };
    return reenviarPendientes(cert);
  });
}

export function iniciarReintentoVerifactu() {
  const pasada = async () => {
    let tenants = [];
    try {
      tenants = await Tenant.find({ estado: { $nin: ["inactivo", "suspendido"] } }).lean();
    } catch (e) {
      console.warn("[verifactu] No se pudieron listar las empresas:", e.message);
      return;
    }
    for (const tenant of tenants) {
      try {
        const { procesados, resultados } = await pasadaTenant(tenant);
        if (procesados > 0) {
          const enviados = resultados.filter((r) => r.estado.startsWith("aceptado")).length;
          console.log(
            `[verifactu] Reintento automático (${tenant.slug}): ${enviados}/${procesados} registro(s) remitidos a la AEAT`
          );
        }
      } catch (e) {
        console.warn(`[verifactu] Reintento fallido (${tenant.slug}):`, e.message);
      }
    }
  };
  setTimeout(pasada, 2 * 60 * 1000);
  setInterval(pasada, INTERVALO_MS);
}
