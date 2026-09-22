// Parche: agranda la letra del "Trabajo solicitado" (motivo) en las
// plantillas "parte-taller" ya sembradas en cada empresa. Solo toca el
// elemento de texto {{trabajos.motivo}} (fontSize 14, negrita); si una
// empresa personalizó la plantilla y ya no tiene ese elemento, se respeta.
import "dotenv/config";
import mongoose from "mongoose";

const base = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
const empresas = ["filanex_montiel", "filanex_demomontiel", "filanex_demofilanex", "filanex_local"];

for (const db of empresas) {
  const conn = await mongoose.createConnection(`${base}/${db}`).asPromise();
  try {
    const col = conn.db.collection("formatos");
    const docs = await col.find({ $or: [{ builtin: "parte-taller" }, { tipoDocumento: "parte-taller" }] }).toArray();
    if (!docs.length) {
      console.log(`${db}: sin plantilla parte-taller`);
      continue;
    }
    for (const doc of docs) {
      let tocado = false;
      for (const el of doc.elements ?? []) {
        if (el.type === "text" && el.text === "{{trabajos.motivo}}") {
          el.fontSize = 14;
          el.bold = true;
          el.color = "#111827";
          tocado = true;
        }
      }
      if (tocado) {
        await col.updateOne({ _id: doc._id }, { $set: { elements: doc.elements } });
        console.log(`${db}: plantilla "${doc.name ?? doc._id}" parcheada (motivo a 14 negrita)`);
      } else {
        console.log(`${db}: plantilla "${doc.name ?? doc._id}" sin el elemento de fábrica — no se toca`);
      }
    }
  } finally {
    await conn.close();
  }
}
