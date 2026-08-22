import { GoogleGenAI } from "@google/genai";

// Extracción OCR de albaranes y facturas de COMPRA con Gemini (visión).
// Salida garantizada en JSON mediante responseSchema.

const MODELO = process.env.GEMINI_MODEL || "gemini-flash-latest";

const esquemaDocumento = {
  type: "OBJECT",
  properties: {
    tipoDocumento: { type: "STRING", enum: ["factura", "albaran"] },
    proveedor: {
      type: "OBJECT",
      properties: {
        nombre: { type: "STRING" },
        nif: { type: "STRING" },
        direccion: { type: "STRING" },
        email: { type: "STRING" },
        telefono: { type: "STRING" },
      },
      required: ["nombre"],
    },
    numeroDocumento: { type: "STRING" },
    fecha: { type: "STRING", description: "Formato YYYY-MM-DD" },
    lineas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          descripcion: { type: "STRING" },
          tipo: { type: "STRING", enum: ["articulo", "servicio"] },
          cantidad: { type: "NUMBER" },
          precioUnitario: { type: "NUMBER" },
          iva: { type: "NUMBER", description: "Porcentaje: 21, 10, 4 o 0" },
        },
        required: ["descripcion", "tipo", "cantidad", "precioUnitario", "iva"],
      },
    },
    baseImponible: { type: "NUMBER" },
    cuotaIva: { type: "NUMBER" },
    total: { type: "NUMBER" },
    confianza: { type: "NUMBER", description: "De 0 (ilegible) a 1 (perfecta)" },
  },
  required: ["tipoDocumento", "proveedor", "lineas", "total", "confianza"],
};

const PROMPT = `Analiza el documento adjunto (factura o albarán de COMPRA recibido por una empresa española) y extrae sus datos.
Reglas:
- lineas[].tipo: "servicio" si no es un bien físico almacenable (telefonía, luz, agua, alquiler, consultoría, reparaciones, seguros...); "articulo" si son unidades de un producto.
- Fecha en formato YYYY-MM-DD. Importes numéricos sin símbolo de moneda ni separador de miles.
- iva como porcentaje (21, 10, 4, 0). Si una línea no indica IVA, usa el tipo general del documento.
- confianza: tu seguridad global en la extracción (0 = ilegible, 1 = perfecta).
- No inventes datos: si un campo no aparece en el documento, omítelo.`;

export async function extraerDocumentoCompra(fichero) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no configurada en server/.env");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const respuesta = await ai.models.generateContent({
    model: MODELO,
    contents: [
      {
        inlineData: {
          mimeType: fichero.mimetype,
          data: fichero.buffer.toString("base64"),
        },
      },
      { text: PROMPT },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: esquemaDocumento,
    },
  });
  return JSON.parse(respuesta.text);
}
