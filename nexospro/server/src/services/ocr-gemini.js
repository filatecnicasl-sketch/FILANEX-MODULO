import { generarJsonGemini, MODELOS_CALIDAD, MODELOS_RAPIDOS } from "./gemini.js";
import { prepararParaOcr } from "./imagen-ocr.js";
import { revisarTicket, revisarDocumentoCompra, revisarValoracion, revisarFacturaEnergia, revisarCampanaPrecios } from "./validar-ocr.js";

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
    esGasto: {
      type: "BOOLEAN",
      description:
        "true si el documento es un ticket o factura de GASTO corriente (bar, restaurante, gasolinera, hotel, parking, peaje...) y no una compra de mercancía o servicios para el negocio",
    },
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
          familia: {
            type: "STRING",
            description:
              "Categoría comercial corta en minúsculas (informatica, telefonia, perifericos, componentes, papeleria, fontaneria, electricidad, ferreteria, alimentacion...). Vacío si no se puede deducir.",
          },
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
    retencionPorcentaje: { type: "NUMBER", description: "Porcentaje de retención de IRPF que aparece en la factura (15, 19, 7, 2, 1) o 0 si no hay" },
    retencionImporte: { type: "NUMBER", description: "Importe de la retención de IRPF, en positivo" },
    esArrendamiento: { type: "BOOLEAN", description: "true si es alquiler/arrendamiento de inmueble urbano (local, oficina, nave)" },
    confianza: { type: "NUMBER", description: "De 0 (ilegible) a 1 (perfecta)" },
  },
  required: ["tipoDocumento", "proveedor", "lineas", "total", "confianza"],
};

const PROMPT = `Analiza el documento adjunto (factura o albarán de COMPRA recibido por una empresa española) y extrae sus datos.
Reglas:
- esGasto: true si es un ticket o factura de gasto corriente (comida de restaurante, combustible, hotel, parking, peaje, taxi...). Esos gastos no generan artículos de inventario. false si es compra de mercancía, material o servicios del negocio (lo habitual en facturas de proveedores).
- lineas[].tipo: "servicio" si no es un bien físico almacenable (telefonía, luz, agua, alquiler, consultoría, reparaciones, seguros...); "articulo" si son unidades de un producto.
- lineas[].familia: categoría comercial corta en minúsculas y sin acentos (informatica, telefonia, perifericos, componentes, papeleria, fontaneria, electricidad, ferreteria, alimentacion...). Sirve para aplicar el margen de venta por familia. Vacío si no está claro.
- Fecha en formato YYYY-MM-DD. Importes numéricos sin símbolo de moneda ni separador de miles.
- iva como porcentaje (21, 10, 4, 0). Si una línea no indica IVA, usa el tipo general del documento.
- descuento: si la línea lleva descuento (columnas "dto", "%", "desc.", bonificaciones...), pon en precioUnitario el precio BRUTO (antes del descuento) y en descuento el porcentaje. Si el precio impreso ya es neto o no hay descuento, pon descuento 0. Así cantidad × precio × (1 - descuento/100) debe cuadrar con el importe de la línea.
- RETENCIÓN DE IRPF: muchas facturas de profesionales (asesores, gestores, técnicos, abogados) llevan una línea "Retención IRPF −15 %" o "Ret. a cta IRPF". Si aparece, pon el porcentaje en retencionPorcentaje (15, 19, 7, 2, 1...) y el importe en positivo en retencionImporte. Si NO hay retención, omítelos. NO la metas como línea más: es un descuento fiscal del total, no una línea del documento.
- esArrendamiento: true solo si la factura es claramente de alquiler de local, oficina o nave (arrendamiento urbano), porque esas retenciones van al modelo 115 y no al 111.
- total: el importe final que hay que PAGAR al proveedor. Si la factura tiene retención, es base + IVA − retención (el total impreso del papel, que ya la descuenta).
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
    matricula: { type: "STRING", description: "Matrícula sin espacios ni guiones" },
    marca: { type: "STRING" },
    modelo: { type: "STRING" },
    bastidor: { type: "STRING", description: "Número de bastidor / VIN (17 caracteres)" },
    kilometros: { type: "NUMBER", description: "Kilómetros del vehículo, número entero" },
    numeroSiniestro: { type: "STRING", description: "Número de siniestro o expediente" },
    poliza: { type: "STRING", description: "Número de póliza" },
    fechaSiniestro: { type: "STRING", description: "Fecha de ocurrencia del siniestro, formato YYYY-MM-DD" },
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
- matricula: sin espacios ni guiones (p.ej. "1834KZK").
- marca y modelo: del dato "VEHÍCULO" o similar (p.ej. "SEAT ARONA 2018 5P STYLE" -> marca "SEAT", modelo "ARONA 2018 5P STYLE").
- kilometros: número entero, sin separador de miles (44.814 -> 44814).
- bastidor: número de bastidor / VIN si aparece ("Nº BASTIDOR", "VIN", "CHASIS"); suele tener 17 caracteres alfanuméricos.
- numeroSiniestro: la referencia del siniestro/expediente tal como aparece (p.ej. "896.945 / 2026 - AP").
- compania: la aseguradora que emite el documento. Si el nombre comercial no aparece directamente, identifícala por el membrete, el pie de página (registro mercantil, NIF, dirección) o el formato del documento.
- fechaSiniestro: la fecha de ocurrencia ("FECHA SINIESTRO"), NO la fecha de emisión del documento ni la de apertura. Formato YYYY-MM-DD.
- secciones[]: agrupa las operaciones por imputaciones/grupos de trabajo tal como vienen en el documento (p.ej. "Chapa aleta delantera derecha", "Pintura paragolpes trasero"). Si no hay agrupación clara, usa una única sección con el tipo de trabajo general.
- operaciones[].tipo: "sustitucion" si se cambia una pieza/recambio; "reparacion" para mano de obra, pintura o reparaciones.
- Si una pieza y su mano de obra de sustitución vienen por separado, súmalos en la operación de la pieza.
- importe: importe total de la operación en euros, numérico sin símbolo de moneda ni separador de miles. No inventes importes: si no se lee, pon 0.
- Si el documento trae un resumen por conceptos (mano de obra de reparaciones, mano de obra de pintura, material de pintura...) con totales, y las operaciones individuales no tienen importe claro, usa ese resumen como operaciones.
- No uses Markdown. No inventes datos: si un campo no aparece, omítelo.`;

// Lee una valoración de siniestro (PDF o imagen) y devuelve las secciones
// con sus operaciones e importes, listas para precargar una valoración.
export async function extraerValoracion(fichero) {
  return generarJson(fichero, PROMPT_VALORACION, esquemaValoracion, revisarValoracion);
}

// --- Facturas de energía (luz y gas) ---

const esquemaFacturaEnergia = {
  type: "OBJECT",
  properties: {
    cups: { type: "STRING", description: "Código CUPS completo, sin espacios ni guiones (empieza por ES)" },
    tipo: { type: "STRING", enum: ["luz", "gas"] },
    titular: {
      type: "OBJECT",
      description: "Cliente titular del suministro (a quien va dirigida la factura)",
      properties: {
        nombre: { type: "STRING" },
        nif: { type: "STRING" },
        calle: { type: "STRING" },
        cp: { type: "STRING" },
        ciudad: { type: "STRING" },
        provincia: { type: "STRING" },
      },
      required: ["nombre"],
    },
    comercializadora: {
      type: "OBJECT",
      description: "Empresa que emite la factura y cobra la energía",
      properties: {
        nombre: { type: "STRING" },
        nif: { type: "STRING" },
      },
      required: ["nombre"],
    },
    direccionSuministro: {
      type: "OBJECT",
      description: "Dirección del punto de suministro (donde está el contador); puede diferir de la del titular",
      properties: {
        calle: { type: "STRING" },
        cp: { type: "STRING" },
        ciudad: { type: "STRING" },
        provincia: { type: "STRING" },
      },
    },
    tarifa: { type: "STRING", description: "Tarifa de acceso (2.0TD, 3.0TD...) o peaje de gas (3.1, 3.2, 3.3, 3.4)" },
    potenciaPunta: { type: "NUMBER", description: "Potencia contratada en punta/franja 1, en kW (solo luz)" },
    potenciaValle: { type: "NUMBER", description: "Potencia contratada en valle/franja 2, en kW (solo luz)" },
    consumoPeriodo: { type: "NUMBER", description: "Consumo facturado en el periodo, en kWh" },
    diasPeriodo: { type: "NUMBER", description: "Días que cubre la factura" },
    consumoAnual: { type: "NUMBER", description: "Consumo anual en kWh si la factura lo indica; si no, se estima" },
    periodoDesde: { type: "STRING", description: "Inicio del periodo facturado, YYYY-MM-DD" },
    periodoHasta: { type: "STRING", description: "Fin del periodo facturado, YYYY-MM-DD" },
    importeTotal: { type: "NUMBER", description: "Importe total de la factura en euros" },
    confianza: { type: "NUMBER", description: "De 0 (ilegible) a 1 (perfecta)" },
  },
  required: ["cups", "tipo", "titular", "comercializadora", "confianza"],
};

const PROMPT_ENERGIA = `Analiza la factura de LUZ o GAS adjunta (empresa española) y extrae sus datos para dar de alta el punto de suministro.
Reglas:
- cups: el código CUPS completo, SIN espacios ni guiones, en mayúsculas (empieza por ES y suele tener 20-22 caracteres). Es el dato más importante: verifícalo carácter a carácter.
- tipo: "luz" si es una factura de electricidad (habrá potencia en kW, tarifa 2.0TD/3.0TD...); "gas" si es de gas natural (peaje 3.1-3.4, consumo en kWh de gas).
- titular: el CLIENTE al que va dirigida la factura (nombre y NIF tal como aparecen, normalmente arriba o en "Titular"/"Cliente"). NO lo confundas con la comercializadora emisora.
- comercializadora: la empresa que EMITE la factura y cobra (membrete: Iberdrola, Endesa, Naturgy, Repsol, Holaluz, Podo, Factor Energía...).
- direccionSuministro: la dirección del inmueble donde está el contador ("Dirección del suministro", "Punto de suministro", "Dirección de envío"). Si solo aparece una dirección, ponla en los dos sitios.
- tarifa: la tarifa de acceso de luz (2.0TD, 3.0TD, 6.1TD...) o el peaje de gas (3.1, 3.2, 3.3, 3.4).
- potenciaPunta/potenciaValle: solo en luz: los kW contratados por franja. En 2.0TD suele haber una sola potencia: ponla en las dos.
- consumoPeriodo: los kWh consumidos en el periodo de esta factura. diasPeriodo: los días que cubre.
- consumoAnual: el consumo anual en kWh si la factura lo muestra ("consumo anual estimado", histórico); si no aparece, estímalo: consumoPeriodo × 365 / diasPeriodo.
- importeTotal: el total a pagar en euros, numérico.
- Fechas en YYYY-MM-DD.
- No inventes datos: si un campo no aparece, omítelo.
- confianza: tu seguridad global en la extracción (0 = ilegible, 1 = perfecta).`;

// Lee una factura de luz o gas y devuelve los datos del suministro listos
// para el modal de verificación (nada se crea sin confirmación del usuario).
export async function extraerFacturaEnergia(fichero) {
  return generarJson(fichero, PROMPT_ENERGIA, esquemaFacturaEnergia, revisarFacturaEnergia);
}

// --- Campañas de precios de comercializadoras ---

const esquemaCampanaPrecios = {
  type: "OBJECT",
  properties: {
    comercializadora: { type: "STRING", description: "Nombre de la comercializadora que ofrece la campaña" },
    tipo: { type: "STRING", enum: ["luz", "gas"] },
    nombreCampana: { type: "STRING", description: "Nombre comercial de la campaña o tarifa ofertada" },
    tarifa: { type: "STRING", description: "Tarifa de acceso (2.0TD, 3.0TD...) o peaje de gas (3.1, 3.2...)" },
    vigenciaDesde: { type: "STRING", description: "Inicio de la vigencia de la campaña, YYYY-MM-DD" },
    vigenciaHasta: { type: "STRING", description: "Fin de la vigencia de la campaña, YYYY-MM-DD" },
    energiaUnica: { type: "NUMBER", description: "Precio único del término de energía en €/kWh (si la campaña no discrimina por tramos)" },
    energiaPunta: { type: "NUMBER", description: "€/kWh del término de energía en punta (P1)" },
    energiaLlano: { type: "NUMBER", description: "€/kWh del término de energía en llano (P2)" },
    energiaValle: { type: "NUMBER", description: "€/kWh del término de energía en valle (P3 o valle)" },
    potenciaPunta: { type: "NUMBER", description: "Precio del término de potencia en punta, en la unidad que indique potenciaUnidad" },
    potenciaValle: { type: "NUMBER", description: "Precio del término de potencia en valle, en la unidad que indique potenciaUnidad" },
    potenciaUnidad: { type: "STRING", enum: ["dia", "ano"], description: "Unidad de los precios de potencia: dia = €/kW·día, ano = €/kW·año" },
    mantenimientoMensual: { type: "NUMBER", description: "Cuota o mantenimiento en €/mes si la campaña lo tiene" },
    descuento: { type: "STRING", description: "Descuentos y condiciones promocionales, resumidos" },
    confianza: { type: "NUMBER", description: "De 0 (ilegible) a 1 (perfecta)" },
  },
  required: ["comercializadora", "tipo", "confianza"],
};

const PROMPT_CAMPANA = `Analiza el documento adjunto: es una CAMPAÑA DE PRECIOS de una comercializadora española de luz o gas (la "tarifa" que ofrece a sus agentes o clientes), normalmente un PDF con tablas de precios.
Reglas:
- comercializadora: la empresa que ofrece la campaña (membrete o pie del documento).
- tipo: "luz" si es electricidad (habrá término de energía en €/kWh y de potencia en €/kW), "gas" si es gas natural (solo energía).
- nombreCampana: el nombre comercial de la oferta si aparece ("Plan Estable", "Tarifa Verano 2027"...).
- tarifa: la tarifa de acceso a la que aplica (2.0TD, 3.0TD...) o el peaje de gas (3.1, 3.2...).
- vigenciaDesde/vigenciaHasta: las fechas de vigencia de la campaña si se indican ("válida del 01/10/2026 al 31/12/2026"). Formato YYYY-MM-DD.
- Energía: si la campaña tiene UN solo precio de energía, ponlo en energiaUnica. Si discrimina por tramos horarios (punta/llano/valle o P1/P2/P3), reparte los precios en energiaPunta/energiaLlano/energiaValle. Los precios SIEMPRE en €/kWh, con punto decimal (0,1432 €/kWh -> 0.1432). Ojo: si el precio viene en céntimos de €/kWh (14,32 cts), conviértelo (0.1432).
- potenciaPunta/potenciaValle: el término de potencia, en la unidad EXACTA en que viene impreso. Si está en €/kW·día (lo habitual), pon los números tal cual y potenciaUnidad = "dia"; si está en €/kW·año, potenciaUnidad = "ano". Si solo hay un precio de potencia, ponlo en potenciaPunta.
- IMPORTANTE: no confundas el término de energía (€/kWh) con el de potencia (€/kW·día o €/kW·año): son líneas distintas de la tabla.
- mantenimientoMensual: la cuota fija mensual en €/mes si la tiene ("cuota de mantenimiento", "servicio", "alquiler de contador"...). Si no hay, omítelo.
- descuento: resume los descuentos y promociones ("15 % de descuento sobre el término de energía durante 12 meses", "regalo de X €"...). Si no hay, omítelo.
- No inventes datos: si un campo no aparece en el documento, omítelo. Si hay varias campañas o tarifas en el documento, extrae la PRINCIPAL (la primera o la más destacada).
- confianza: tu seguridad global en la extracción (0 = ilegible, 1 = perfecta).`;

// Lee una campaña de precios (PDF, foto o captura) y devuelve los términos
// listos para el modal de revisión. La campaña nace siempre "pendiente":
// nada se publica sin que el usuario lo confirme.
export async function extraerCampanaPrecios(fichero) {
  return generarJson(fichero, PROMPT_CAMPANA, esquemaCampanaPrecios, revisarCampanaPrecios);
}
