// Decide si un registro VeriFactu puede remitirse a la AEAT.
//
// La remisión está apagada por defecto: una factura se registra siempre
// (huella encadenada + QR), pero solo se envía cuando la empresa activa el
// envío de forma explícita en Ajustes → Certificado.
//
// Al activarlo, lo pendiente acumulado NO se manda: se marca como
// "no_remitido" (ver routes/verifactu.js) y además se filtra aquí por la
// fecha y hora de activación. A partir de ese momento cada factura nueva se
// remite en el acto, como exige la norma.
import Empresa from "../models/Empresa.js";

export async function politicaEnvio() {
  const emp = await Empresa.findOne().select("verifactu").lean();
  return {
    activo: Boolean(emp?.verifactu?.envioActivo),
    desde: emp?.verifactu?.enviarDesde ? new Date(emp.verifactu.enviarDesde) : null,
  };
}

// Para los registros que se reintentan: se compara con `fechaHoraGeneracion`,
// que es una fecha real. La de expedición es un texto DD-MM-AAAA y no sirve
// para comparar (new Date("30-08-2026") es una fecha inválida).
export function permiteEnviarRegistro(politica, registro) {
  if (!politica?.activo) return false;
  if (!politica.desde) return true;
  const generado = registro?.fechaHoraGeneracion ? new Date(registro.fechaHoraGeneracion) : null;
  if (!generado || Number.isNaN(generado.getTime())) return false;
  return generado >= politica.desde;
}

// Para los puntos de emisión: la factura se está generando ahora mismo, así
// que basta con saber si el envío está activado.
export async function envioPermitido() {
  return (await politicaEnvio()).activo;
}
