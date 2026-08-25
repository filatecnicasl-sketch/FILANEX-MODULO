import { generarJsonGemini, MODELOS_CALIDAD, MODELOS_RAPIDOS } from "./gemini.js";
import { prepararParaOcr } from "./imagen-ocr.js";
import { revisarTicket, revisarDocumentoCompra, revisarValoracion } from "./validar-ocr.js";

// Extracción OCR de documentos con Gemini (visión).
// Salida garantizada en JSON mediante responseSchema.
// La elección de modelo, los reintentos y el tiempo máximo viven en
// services/gemini.js, compartidos con el resto de usos de IA.
//
// Estrategia de dos niveles (rápido y robusto a la vez):
//   1. Se prepara la imagen (orientación correcta y peso reducido).
//   2. Se lee con el modelo rápido, que tarda 1-2 s.
//   3. Se revisa el resultado con reglas duras (importes que cuadren, NIF con
//      letra correcta, fecha posible…). Si pasa, se devuelve: caso normal.
//   4. Si no pasa, se repite con el modelo de calidad. Solo los documentos
//      difíciles pagan la espera larga.
// El resultado indica en `_ocr` qué nivel se usó y qué quedó pendiente de
// revisar, para poder avisar al usuario.

async function generarJson(fichero, prompt, esquema, revisar) {
  const listo = await prepararParaOcr(fichero);
  const contents = [
    { inlineData: { mimeType: listo.mimetype, data: listo.buffer.toString("base64") } },
    { text: prompt },
  ];
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_OCR_MS) || 90000;

  let problemasRapido = [];
  if (revisar) {
    try {
      const t0 = Date.now();
      const rapido = await generarJsonGemini({
        contents,
        esquema,
        modelos: MODELOS_RAPIDOS,
        timeoutMs: Math.min(timeoutMs, 30000),
        etiqueta: "El servicio de OCR",
      });
      const { ok, problemas } = revisar(rapido);
      if (ok) {
        return { ...rapido, _ocr: { nivel: "rapido", ms: Date.now() - t0, avisos: [] } };
      }
      problemasRapido = problemas;
      console.warn(`OCR: primera lectura descartada (${problemas.join("; ")}), se repite con el modelo de calidad.`);
    } catch (err) {
      problemasRapido = [err.message];
    }
  }

  const t1 = Date.now();
  const bueno = await generarJsonGemini({
    contents,
    esquema,
    modelos: MODELOS_CALIDAD,
    // Un documento escaneado grande puede tardar bastante en analizarse: se
    // da margen amplio antes de pasar al siguiente modelo.
    timeoutMs,
    etiqueta: "El servicio de OCR",
  });
  // Si tampoco el modelo bueno cuadra, se entrega igualmente pero avisando:
  // es mejor que el usuario corrija cuatro campos a que no tenga nada.
  const revision = revisar ? revisar(bueno) : { ok: true, problemas: [] };
  return {
    ...bueno,
    _ocr: {
      nivel: "calidad",
      ms: Date.now() - t1,
      motivo: problemasRapido,
      avisos: revision.ok ? [] : revision.problemas,
    },
  };
}

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
          descuento: {
            type: "NUMBER",
            description: "Descuento de la línea en porcentaje (0 si no tiene)",
          },
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
- descuento: si la línea lleva descuento (columnas "dto", "%", "desc.", bonificaciones...), pon en precioUnitario el precio BRUTO (antes del descuento) y en descuento el porcentaje. Si el precio impreso ya es neto o no hay descuento, pon descuento 0. Así cantidad × precio × (1 - descuento/100) debe cuadrar con el importe de la línea.
- confianza: tu seguridad global en la extracción (0 = ilegible, 1 = perfecta).
- No inventes datos: si un campo no aparece en el documento, omítelo.`;

export async function extraerDocumentoCompra(fichero) {
  return generarJson(fichero, PROMPT, esquemaDocumento, revisarDocumentoCompra);
}

// --- Tickets de gasto (facturas simplificadas) ---

const esquemaTicket = {
  type: "OBJECT",
  properties: {
    comercio: { type: "STRING", description: "Nombre del establecimiento" },
    nifComercio: { type: "STRING", description: "NIF/CIF del establecimiento si aparece" },
    fecha: { type: "STRING", description: "Formato YYYY-MM-DD" },
    concepto: { type: "STRING", description: "Resumen corto de lo comprado" },
    categoria: {
      type: "STRING",
      enum: [
        "combustible",
        "peaje_parking",
        "transporte",
        "dietas",
        "atenciones",
        "material",
        "suministros",
        "reparaciones",
        "alojamiento",
        "otros",
      ],
    },
    base: { type: "NUMBER", description: "Base imponible si aparece desglosada" },
    tipoIva: { type: "NUMBER", description: "Porcentaje de IVA: 21, 10, 4 o 0" },
    cuotaIva: { type: "NUMBER", description: "Cuota de IVA si aparece desglosada" },
    total: { type: "NUMBER", description: "Importe total pagado" },
    conDatosFiscales: {
      type: "BOOLEAN",
      description: "true solo si el ticket lleva impresos el nombre y el NIF del comprador",
    },
    confianza: { type: "NUMBER", description: "De 0 (ilegible) a 1 (perfecta)" },
  },
  required: ["comercio", "total", "confianza"],
};

const PROMPT_TICKET = `Analiza el ticket de compra adjunto (factura simplificada española, normalmente una foto de papel) y extrae sus datos.
Reglas:
- comercio: el nombre del establecimiento que cobra, no el del cliente.
- conDatosFiscales: true SOLO si el ticket lleva impresos el nombre y el NIF de la empresa COMPRADORA. Un ticket normal de caja no los lleva: entonces false.
- categoria: elige la que mejor encaje con lo comprado. Gasolina o diésel -> combustible. Parking, peaje, ORA -> peaje_parking. Bar, restaurante, menú -> dietas. Regalos o invitaciones a clientes -> atenciones. Tornillería, consumibles, herramienta pequeña -> material. Luz, agua, teléfono -> suministros. Hotel o pensión -> alojamiento.
- Importes numéricos, con punto decimal, sin símbolo de moneda ni separador de miles.
- Si el ticket solo muestra el total y el tipo de IVA, deja base y cuotaIva sin rellenar: se calculan después.
- tipoIva como porcentaje (21, 10, 4 o 0).
- Fecha en formato YYYY-MM-DD. Si el ticket no la lleva, omítela.
- No inventes datos: si un campo no se lee, omítelo.
- confianza: tu seguridad global en la extracción (0 = ilegible, 1 = perfecta).`;

// Lee la foto de un ticket y devuelve los datos del gasto. Nada se da por
// bueno: el gasto nace pendiente de revisión, igual que el OCR de compras.
export async function extraerTicket(fichero) {
  return generarJson(fichero, PROMPT_TICKET, esquemaTicket, revisarTicket);
}

// --- Valoraciones de siniestro (Audatex, GT Estimate, peritaciones) ---

const esquemaValoracion = {
  type: "OBJECT",
  properties: {
    matricula: { type: "STRING" },
    marca: { type: "STRING" },
    modelo: { type: "STRING" },
    numeroSiniestro: { type: "STRING", description: "Número de siniestro o expediente" },
    compania: { type: "STRING", description: "Aseguradora que emite la valoración" },
    observaciones: { type: "STRING" },
    secciones: {
      type: "ARRAY",
      description: "Imputaciones o grupos de trabajo de la valoración",
      items: {
        type: "OBJECT",
        properties: {
          nombre: { type: "STRING" },
          operaciones: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                tipo: { type: "STRING", enum: ["reparacion", "sustitucion"] },
                descripcion: { type: "STRING" },
                importe: { type: "NUMBER" },
              },
              required: ["tipo", "descripcion", "importe"],
            },
          },
        },
        required: ["nombre", "operaciones"],
      },
    },
  },
  required: ["secciones"],
};

const PROMPT_VALORACION = `Analiza la valoración de siniestro adjunta (documento de taller de chapa/pintura tipo Audatex, GT Estimate o peritación de aseguradora) y extrae sus datos.
Reglas:
- secciones[]: agrupa las operaciones por imputaciones/grupos de trabajo tal como vienen en el documento (p.ej. "Chapa aleta delantera derecha", "Pintura paragolpes trasero"). Si no hay agrupación clara, usa una única sección con el tipo de trabajo general.
- operaciones[].tipo: "sustitucion" si se cambia una pieza/recambio; "reparacion" para mano de obra, pintura o reparaciones.
- Si una pieza y su mano de obra de sustitución vienen por separado, súmalos en la operación de la pieza.
- importe: importe total de la operación en euros, numérico sin símbolo de moneda ni separador de miles. No inventes importes: si no se lee, pon 0.
- No uses Markdown. No inventes datos: si un campo no aparece, omítelo.`;

// Lee una valoración de siniestro (PDF o imagen) y devuelve las secciones
// con sus operaciones e importes, listas para precargar una valoración.
export async function extraerValoracion(fichero) {
  return generarJson(fichero, PROMPT_VALORACION, esquemaValoracion, revisarValoracion);
}
