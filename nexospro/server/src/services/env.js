// Actualiza claves del .env sin tocar el resto de líneas (API keys, etc.).
// También refresca process.env para que el cambio aplique sin reiniciar.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const RUTA_ENV = path.resolve(process.cwd(), ".env");

export function actualizarEnv(cambios) {
  let lineas = [];
  if (existsSync(RUTA_ENV)) {
    lineas = readFileSync(RUTA_ENV, "utf8").split(/\r?\n/);
    if (lineas.at(-1) === "") lineas.pop(); // salto final del archivo
  }
  for (const [clave, valor] of Object.entries(cambios)) {
    const i = lineas.findIndex((l) => l.startsWith(`${clave}=`));
    if (i >= 0) lineas[i] = `${clave}=${valor}`;
    else lineas.push(`${clave}=${valor}`);
    process.env[clave] = valor;
  }
  writeFileSync(RUTA_ENV, lineas.join("\n") + "\n");
}

export function borrarEnv(claves) {
  if (existsSync(RUTA_ENV)) {
    const lineas = readFileSync(RUTA_ENV, "utf8")
      .split(/\r?\n/)
      .filter((l) => !claves.some((c) => l.startsWith(`${c}=`)));
    writeFileSync(RUTA_ENV, lineas.join("\n"));
  }
  for (const clave of claves) delete process.env[clave];
}
