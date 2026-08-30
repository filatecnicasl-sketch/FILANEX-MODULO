// Decide si una factura puede remitirse a la AEAT.
//
// La remisión está apagada por defecto: una factura se registra siempre
// (huella encadenada + QR), pero solo se envía cuando la empresa activa el
// envío de forma explícita en Sistema → VeriFactu. Así, instalar el
// certificado no dispara el envío retroactivo de todo lo acumulado.
import Empresa from "../models/Empresa.js";

export async function politicaEnvio() {
  const emp = await Empresa.findOne().select("verifactu").lean();
  return {
    activo: Boolean(emp?.verifactu?.envioActivo),
    desde: emp?.verifactu?.enviarDesde ? new Date(emp.verifactu.enviarDesde) : null,
  };
}

// `fecha` es la fecha de expedición de la factura del registro.
export function permiteEnviar(politica, fecha) {
  if (!politica?.activo) return false;
  if (!politica.desde) return true;
  return new Date(fecha) >= politica.desde;
}

// Atajo para los puntos de emisión (una sola factura).
export async function envioPermitido(fecha) {
  return permiteEnviar(await politicaEnvio(), fecha);
}
