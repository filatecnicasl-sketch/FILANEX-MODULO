// Certificado VeriFactu de la empresa de la petición actual (cada empresa
// tiene el suyo en su ficha, con la contraseña cifrada). Devuelve
// { ruta, pass, buffer } listo para remitirAeat, o null si no hay certificado
// utilizable (no cargado, archivo perdido o contraseña indescifrable).
import Empresa from "../models/Empresa.js";
import { descifrar } from "./cifrado.js";
import { existeArchivo, leerArchivo } from "./storage.js";

export async function certificadoActual() {
  const empresa = await Empresa.findOne().select("certificado").lean();
  const cert = empresa?.certificado;
  if (!cert?.ruta) return null;

  let pass = "";
  try {
    pass = cert.passCifrada ? descifrar(cert.passCifrada) : "";
  } catch {
    return null;
  }

  const remoto = String(cert.ruta).replace(/^\/+/, "");
  if (!(await existeArchivo(remoto))) return null;

  try {
    const buffer = await leerArchivo(remoto);
    if (!buffer) return null;
    return { ruta: cert.ruta, pass, buffer };
  } catch {
    return null;
  }
}
