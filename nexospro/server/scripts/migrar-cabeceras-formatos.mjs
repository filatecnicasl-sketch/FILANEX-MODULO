// Migra las cabeceras de las plantillas de fábrica a la nueva geometría:
// nombre con sitio para 2 líneas, NIF y dirección desplazados, y la línea
// separadora por debajo de la dirección. Solo toca elementos que siguen con
// los valores originales; lo que el usuario haya personalizado se respeta.
//
// Uso: node scripts/migrar-cabeceras-formatos.mjs <db> [<db> ...]

import mongoose from "mongoose";

const uriBase = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
const dbs = process.argv.slice(2);
if (dbs.length === 0) {
  console.error("Falta la base de datos: node migrar-cabeceras-formatos.mjs <db>");
  process.exit(1);
}

function migrarElemento(el) {
  if (el.type === "text" && /^\{\{(empresa|cliente)\.nombre\}\}$/.test(el.text ?? "") && el.y === 51 && el.h === 6) {
    el.h = 8; // nombre: cabe en 2 líneas a 10pt
    return true;
  }
  if (el.type === "text" && /^\{\{(empresa|cliente)\.nif\}\}$/.test(el.text ?? "") && el.y === 58) {
    el.y = 60;
    return true;
  }
  if (el.type === "text" && /^\{\{(empresa|cliente)\.direccion\}\}$/.test(el.text ?? "") && el.y === 63 && el.h === 5) {
    el.y = 65;
    el.h = 7;
    return true;
  }
  if (el.type === "rect" && el.y === 70 && el.h === 0.3 && el.w === 80 && (el.x === 20 || el.x === 110)) {
    el.y = 74; // separador por debajo de la dirección
    return true;
  }
  // Título de factura: se desplaza a la izquierda para dejar libre la
  // esquina superior derecha, donde va el QR tributario VeriFactu.
  if (
    el.type === "text" &&
    el.x === 130 &&
    el.w === 60 &&
    [16, 27, 34].includes(el.y) &&
    /^(FACTURA|\{\{documento\.numero\}\}|Fecha: \{\{documento\.fecha\}\})$/.test(el.text ?? "")
  ) {
    el.x = 102;
    return true;
  }
  return false;
}

for (const db of dbs) {
  const cx = await mongoose.createConnection(`${uriBase}/${db}`).asPromise();
  const Formatos = cx.collection("formatos");
  const plantillas = await Formatos.find({}).toArray();
  let tocadas = 0;
  for (const p of plantillas) {
    let cambios = 0;
    for (const el of p.elements ?? []) {
      if (migrarElemento(el)) cambios++;
    }
    if (cambios > 0) {
      await Formatos.updateOne({ _id: p._id }, { $set: { elements: p.elements } });
      tocadas++;
      console.log(`  ${db}: "${p.nombre}" (${p.tipoDocumento}) — ${cambios} elementos`);
    }
  }
  console.log(`${db}: ${tocadas} plantilla(s) actualizadas de ${plantillas.length}`);
  await cx.close();
}
