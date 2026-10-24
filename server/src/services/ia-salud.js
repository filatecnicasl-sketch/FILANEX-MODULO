// Vigilancia del servicio de IA (lectura de facturas, albaranes, tickets,
// valoraciones y asistente). Es la función más vendible del programa y un
// fallo de configuración puede quedar "dormido" durante días si nadie usa la
// función (pasó el 23/09/2026: la llave de Vertex desapareció del servidor y
// se descubrió cuando un cliente importó una factura).
//
// Qué hace este módulo:
//   1. Al arrancar: comprueba que las credenciales configuradas existen de
//      verdad en disco (no solo que la variable esté puesta) y hace una
//      prueba en vivo contra la IA. Cualquier problema queda gritado en el
//      registro y se intenta avisar por correo al administrador.
//   2. Todos los días (IA_HORA, 08:15 por defecto): repite la prueba en vivo.
//      Si el servicio se rompe a mitad de semana, nos enteramos ese mismo día
//      y no cuando lo use un cliente.
//   3. Expone el último resultado (estadoSaludIa) para que /api/health lo
//      incluya y un vigilante externo (UptimeRobot) pueda mirarlo.
//
// Aviso por correo: solo si hay SMTP_* configurado en server/.env (SMTP_HOST,
// SMTP_PORT, SMTP_USER, SMTP_PASS y AVISO_ADMIN_EMAIL). Sin eso, el aviso se
// queda en el registro del servidor.
import fs from "node:fs";
import nodemailer from "nodemailer";
import { generarJsonGemini } from "./gemini.js";

const HORA = process.env.IA_HORA || "08:15";
const PRUEBA_ARRANQUE = process.env.IA_PRUEBA_ARRANQUE !== "false";

let estado = {
  ok: null, // null = aún no se ha probado
  ultimaPrueba: null,
  ultimoError: null,
  problemas: [],
};

export function estadoSaludIa() {
  return { ...estado, problemas: [...estado.problemas] };
}

// --- Diagnóstico estático: lo configurado existe de verdad ---

export function diagnosticoIa() {
  const problemas = [];
  const proveedores = [];

  if (process.env.VERTEX_PROJECT_ID) {
    proveedores.push("vertex");
    const ruta = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!ruta) {
      problemas.push("VERTEX_PROJECT_ID está configurado pero falta GOOGLE_APPLICATION_CREDENTIALS en server/.env");
    } else if (!fs.existsSync(ruta)) {
      problemas.push(`La llave de Vertex AI no existe en el servidor: ${ruta}`);
    } else {
      try {
        const datos = JSON.parse(fs.readFileSync(ruta, "utf8"));
        if (!datos?.client_email || !datos?.private_key) {
          problemas.push(`La llave de Vertex AI (${ruta}) no es una cuenta de servicio válida`);
        }
      } catch {
        problemas.push(`La llave de Vertex AI (${ruta}) no se puede leer como JSON`);
      }
    }
  }

  if (process.env.GEMINI_API_KEY) proveedores.push("gemini");
  if (process.env.OPENAI_API_KEY) proveedores.push("openai");

  if (!proveedores.length) {
    problemas.push("No hay ningún proveedor de IA configurado (Vertex, Gemini u OpenAI)");
  }

  return { ok: problemas.length === 0, proveedores, problemas };
}

// --- Prueba en vivo: una llamada mínima con esquema ---

export async function pruebaEnVivoIa() {
  try {
    const r = await generarJsonGemini({
      contents: [{ text: 'Responde con el JSON: {"ok": true}' }],
      esquema: {
        type: "OBJECT",
        properties: { ok: { type: "BOOLEAN" } },
        required: ["ok"],
      },
      timeoutMs: 25000,
      etiqueta: "La prueba de salud de la IA",
    });
    return { ok: r?.ok === true };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err).slice(0, 300) };
  }
}

// --- Aviso al administrador ---

function transporteAdmin() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15000,
    socketTimeout: 30000,
  });
}

async function avisarAdmin(asunto, mensaje) {
  console.error(`[ia] AVISO ADMINISTRADOR — ${asunto}: ${mensaje}`);
  const transporte = transporteAdmin();
  const para = process.env.AVISO_ADMIN_EMAIL;
  if (!transporte || !para) return;
  try {
    await transporte.sendMail({
      from: `"FILANEX servidor" <${process.env.SMTP_USER}>`,
      to: para,
      subject: `[FILANEX] ${asunto}`,
      text: mensaje,
    });
    console.log(`[ia] Aviso enviado por correo a ${para}`);
  } catch (err) {
    console.error("[ia] No se pudo enviar el aviso por correo:", err?.message);
  }
}

// --- Pasada completa (arranque y diaria) ---

async function pasada({ motivo }) {
  const diag = diagnosticoIa();
  let vivo = { ok: null };
  if (diag.ok) {
    vivo = await pruebaEnVivoIa();
  }

  const estabaRoto = estado.ok === false;
  estado = {
    ok: diag.ok && vivo.ok !== false,
    ultimaPrueba: new Date().toISOString(),
    ultimoError: vivo.error ?? null,
    problemas: diag.problemas,
  };

  if (estado.ok) {
    console.log(`[ia] Salud IA (${motivo}): correcta (${diag.proveedores.join(", ")})`);
    if (estabaRoto) {
      await avisarAdmin(
        "La IA vuelve a funcionar",
        `El servicio de lectura automática se ha recuperado (${motivo}, ${estado.ultimaPrueba}).`
      );
    }
    return;
  }

  const detalle = [...diag.problemas, vivo.error].filter(Boolean).join("\n- ");
  await avisarAdmin(
    "La IA de lectura NO funciona",
    `Motivo de la comprobación: ${motivo}\nHora: ${estado.ultimaPrueba}\n\nProblemas detectados:\n- ${detalle}\n\n` +
      `La lectura automática de facturas, albaranes, tickets y valoraciones no está disponible hasta que se corrija.\n` +
      `Revisa el registro del servidor (pm2 logs filanex-server) y la configuración de IA en server/.env.`
  );
}

// Programador diario, mismo patrón que las copias de seguridad.
function msHastaProxima() {
  const [h, m] = HORA.split(":").map(Number);
  const ahora = new Date();
  const proxima = new Date(ahora);
  proxima.setHours(h || 8, m || 15, 0, 0);
  if (proxima <= ahora) proxima.setDate(proxima.getDate() + 1);
  return proxima - ahora;
}

export function iniciarVigilanciaIa() {
  if (process.env.IA_VIGILANCIA_DESACTIVADA === "true") return;
  setTimeout(() => {
    pasada({ motivo: "arranque del servidor" }).catch((e) =>
      console.error("[ia] Error en la comprobación de arranque:", e?.message)
    );
  }, PRUEBA_ARRANQUE ? 20000 : 1000);
  setTimeout(() => {
    pasada({ motivo: "comprobación diaria" }).catch((e) =>
      console.error("[ia] Error en la comprobación diaria:", e?.message)
    );
    setInterval(
      () =>
        pasada({ motivo: "comprobación diaria" }).catch((e) =>
          console.error("[ia] Error en la comprobación diaria:", e?.message)
        ),
      24 * 60 * 60 * 1000
    );
  }, msHastaProxima());
  console.log(`[ia] Vigilancia de la IA activa: comprobación al arranque y diaria a las ${HORA}`);
}
