// Asistente IA de ayuda (módulo "asistente", contratable por empresa).
//
// Responde preguntas de uso del programa con Gemini: recibe la conversación,
// la envuelve con el manual interno (data/conocimiento-asistente.js) y con el
// estado real de ESTA empresa (módulos activos, precios, series…), de forma
// que las respuestas hablan de SU configuración y no de un programa genérico.
import { Router } from "express";
import Empresa from "../models/Empresa.js";
import { generarTextoIA } from "../services/gemini.js";
import { CONOCIMIENTO, REGLAS_ASISTENTE } from "../data/conocimiento-asistente.js";
import { MODULOS } from "../config/modulos.js";

const router = Router();

const MAX_MENSAJES = 20;
const MAX_CARACTERES = 2000;

const euros = (n) => `${Number(n || 0).toFixed(2)} €`;

// Resumen en texto del estado real de la empresa, para que la IA responda
// con datos concretos (qué módulos tiene, qué precios, qué está configurado).
function contextoEmpresa(emp) {
  const lineas = [];
  lineas.push(`Empresa: ${emp.nombre ?? "sin nombre"}${emp.nif ? ` (NIF ${emp.nif})` : ""}`);

  const activos = (emp.modulos ?? []).map((k) => MODULOS[k]?.nombre ?? k);
  lineas.push(`Módulos activos: ${activos.length ? activos.join(", ") : "solo facturación (ningún módulo contratado)"}`);

  const t = emp.taller ?? {};
  if ((emp.modulos ?? []).includes("taller")) {
    lineas.push(
      `Taller — precios por hora configurados: chapa ${euros(t.precioHoraChapa)}, pintura ${euros(t.precioHoraPintura)}, mecánica ${euros(t.precioHoraMecanica)}` +
        (Number(t.precioHoraChapa) || Number(t.precioHoraPintura) || Number(t.precioHoraMecanica)
          ? ""
          : " (a 0: hay que configurarlos en Ajustes → Configuración para que las partidas por horas calculen el importe)")
    );
  }

  const v = emp.verifactu ?? {};
  lineas.push(
    `VeriFactu: modalidad ${v.modalidad ?? "VERIFACTU"}, envío a la AEAT ${v.envioActivo ? "ACTIVADO" : "desactivado"}, certificado ${emp.certificado?.ruta ? "instalado" : "NO instalado"}`
  );

  const series = (emp.seriesVenta ?? []).map((s) => s.nombre);
  if (series.length) lineas.push(`Series de venta: ${series.join(", ")}`);

  const metodos = (emp.metodosPago ?? []).map((m) => m.nombre);
  if (metodos.length) lineas.push(`Métodos de pago: ${metodos.join(", ")}`);

  lineas.push(`Correo saliente: ${emp.correo?.activo ? `configurado (${emp.correo.tipo})` : "NO configurado (Ajustes → Correo)"}`);

  const wa = emp.notificaciones?.whatsapp ?? {};
  lineas.push(
    `WhatsApp: agenda ${wa.agenda?.activo ? "activo" : "inactivo"}, taller ${wa.taller?.activo ? "activo" : "inactivo"}`
  );

  return lineas.join("\n");
}

router.post("/chat", async (req, res) => {
  try {
    const mensajes = Array.isArray(req.body.mensajes) ? req.body.mensajes : [];
    if (mensajes.length === 0) {
      return res.status(400).json({ error: "Envía al menos un mensaje" });
    }
    const limpios = mensajes
      .slice(-MAX_MENSAJES)
      .filter((m) => m && typeof m.texto === "string" && m.texto.trim())
      .map((m) => ({
        rol: m.rol === "asistente" ? "asistente" : "usuario",
        texto: m.texto.slice(0, MAX_CARACTERES),
      }));
    if (limpios.length === 0 || limpios[limpios.length - 1].rol !== "usuario") {
      return res.status(400).json({ error: "La conversación debe terminar en un mensaje del usuario" });
    }

    const pagina = typeof req.body.pagina === "string" ? req.body.pagina.slice(0, 120) : "";

    const empresa = await Empresa.findOne().lean();
    if (!empresa) return res.status(503).json({ error: "No hay empresa configurada" });

    const sistema = [
      REGLAS_ASISTENTE,
      CONOCIMIENTO,
      "## ESTADO ACTUAL DE ESTA EMPRESA",
      contextoEmpresa(empresa),
      pagina ? `\nEl usuario está ahora mismo en la pantalla: ${pagina}` : "",
    ].join("\n");

    const respuesta = await generarTextoIA({ historial: limpios, sistema });
    res.json({ respuesta });
  } catch (err) {
    console.error("Asistente:", err?.message);
    res.status(502).json({ error: err?.message ?? "El asistente no está disponible ahora mismo" });
  }
});

export default router;
