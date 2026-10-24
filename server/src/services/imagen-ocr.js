import sharp from "sharp";

// Preparación de la foto antes de mandarla a la IA.
//
// Por qué importa: una foto de móvil llega a 4000x3000 px y 5-8 MB. Ese peso
// es lo que más tiempo consume del OCR (subirla a Google), y encima muchas
// llegan giradas porque el móvil no rota el píxel, solo marca la orientación
// en los metadatos EXIF: la IA la lee de lado y falla.
//
// Aquí se corrige la orientación y se reduce a un tamaño donde el texto de un
// ticket sigue siendo legible pero pesa una fracción.

const LADO_MAXIMO = 2000; // suficiente para leer letra pequeña de ticket
const PESO_ACEPTABLE = 900 * 1024; // por debajo de esto no compensa recomprimir

export async function prepararParaOcr(fichero) {
  // Los PDF se envían tal cual: ya son texto o imagen embebida y sharp no los
  // procesa.
  if (fichero.mimetype === "application/pdf") return fichero;

  try {
    const imagen = sharp(fichero.buffer, { failOn: "none" }).rotate(); // rotate() sin ángulo aplica el EXIF
    const meta = await imagen.metadata();
    const ladoMayor = Math.max(meta.width ?? 0, meta.height ?? 0);

    // Ya es pequeña y está bien orientada: no se toca.
    if (ladoMayor <= LADO_MAXIMO && fichero.buffer.length <= PESO_ACEPTABLE && !meta.orientation) {
      return fichero;
    }

    const buffer = await imagen
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    // Si por lo que sea no hemos ganado nada, se queda el original.
    if (buffer.length >= fichero.buffer.length && !meta.orientation) return fichero;

    return { ...fichero, buffer, mimetype: "image/jpeg" };
  } catch (err) {
    // Ante cualquier problema (formato raro, imagen corrupta) se sigue con el
    // original: es preferible un OCR lento a un OCR que no se hace.
    console.warn("No se pudo preparar la imagen para OCR:", err.message);
    return fichero;
  }
}
