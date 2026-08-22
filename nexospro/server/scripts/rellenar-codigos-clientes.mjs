// Rellena el código de ficha de los clientes importados desde el Excel del
// programa antiguo (casando por nombre normalizado). Los que ya tenían
// código se respetan; los que el Excel no cubre quedan sin código.
import pkg from "xlsx";
const { readFile, utils } = pkg;

const base = "http://localhost:4700";
const norm = (s) => String(s ?? "").trim().toUpperCase().replace(/\s+/g, " ");

const wb = readFile("C:/Users/Francis/Downloads/CLIENTE FILATECNICA.xlsx");
const filas = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
// col 0 = Código, col 1 = Nombre
const codigoPorNombre = new Map();
for (const r of filas.slice(1)) {
  const nombre = norm(r[1]);
  const codigo = String(r[0] ?? "").trim();
  if (nombre && codigo && !codigoPorNombre.has(nombre)) codigoPorNombre.set(nombre, codigo);
}

const clientes = await (await fetch(`${base}/api/clientes`)).json();
let asignados = 0, conCodigo = 0, noEncontrados = [];

for (const c of clientes) {
  if (c.codigo) { conCodigo++; continue; }
  const codigo = codigoPorNombre.get(norm(c.nombre));
  if (codigo) {
    const r = await fetch(`${base}/api/clientes/${c._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo }),
    });
    if (r.ok) asignados++;
    else console.log(`FALLO ${c.nombre}: ${r.status}`);
  } else {
    noEncontrados.push(c.nombre);
  }
}

console.log(`Con código del Excel: ${asignados} (ya tenían: ${conCodigo})`);
console.log(`Sin coincidencia por nombre: ${noEncontrados.length}`);
console.log(noEncontrados.join(" | "));
