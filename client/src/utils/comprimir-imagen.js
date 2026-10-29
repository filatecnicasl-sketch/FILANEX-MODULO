// Comprime imágenes en el navegador antes de subirlas como documentación
// (clientes, suministros…). Los escaneos y fotos de móvil suelen pesar
// decenas de MB y el servidor los rechaza: aquí se reducen a un tamaño que
// se lee bien en pantalla (máx. 2600 px de lado mayor, JPEG de calidad) y
// pesa alrededor de 1-2 MB. Si algo falla, se devuelve el archivo original
// sin tocar: la subida sigue su curso normal.
const UMBRAL_BYTES = 1.5 * 1024 * 1024; // comprimir solo si pesa más de 1,5 MB
const LADO_MAX = 2600;

export async function comprimirArchivo(archivo) {
  const esImagen = /^image\/(png|jpeg|webp)$/.test(archivo.type);
  if (!esImagen || archivo.size <= UMBRAL_BYTES) return archivo;
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * escala));
    const h = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    // Fondo blanco: los PNG con transparencia no salen con el fondo negro
    // al convertirlos a JPEG (documentos escaneados, membretes…).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!blob || blob.size >= archivo.size) return archivo;
    const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return archivo;
  }
}

export async function comprimirArchivos(lista) {
  return Promise.all([...lista].map(comprimirArchivo));
}
