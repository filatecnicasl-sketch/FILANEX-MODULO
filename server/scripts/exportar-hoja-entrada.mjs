// Genera /tmp/recepcion-vehiculo.json con la plantilla de fábrica actualizada
// (hoja de entrada de taller) para instalarla en los tenants.
import fs from "fs";
import { buildRecepcionVehiculo } from "../../client/src/editor/builtinTemplates.js";

const t = buildRecepcionVehiculo();
const salida = {
  tipoDocumento: t.tipoDocumento,
  nombre: t.name,
  page: t.page,
  elements: t.elements,
};
fs.writeFileSync(process.argv[2] || "/tmp/recepcion-vehiculo.json", JSON.stringify(salida, null, 2));
console.log("Plantilla generada:", salida.nombre, "-", salida.elements.length, "elementos");
