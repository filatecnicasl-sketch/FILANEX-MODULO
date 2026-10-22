import { MongoClient } from "mongodb";

// Actualiza la plantilla "parte-taller" en todas las BD de tenant, pero SOLO
// cuando los elementos siguen teniendo los valores de la plantilla de fábrica
// antigua (caja pequeña de 15 mm y letra 14). Si el cliente personalizó esos
// elementos, no se tocan.
const client = new MongoClient("mongodb://localhost:27017");
await client.connect();
const admin = client.db("admin");
const dbs = await admin.admin().listDatabases();

for (const { name } of dbs.databases) {
  if (!name.startsWith("filanex_") || name === "filanex_plataforma") continue;
  const db = client.db(name);
  const formatos = db.collection("formatos");
  const plantillas = await formatos.find({ tipoDocumento: "parte-taller" }).toArray();
  for (const p of plantillas) {
    let tocado = false;
    const elements = (p.elements ?? []).map((el) => {
      // Cuadro del motivo (caja de 22 mm justo debajo de la etiqueta)
      if (el.type === "rect" && el.x === 20 && el.y === 80 && el.w === 170 && el.h === 22) {
        tocado = true;
        return { ...el, h: 30 };
      }
      // Texto del motivo
      if (el.type === "text" && el.text === "{{trabajos.motivo}}" && el.x === 23 && el.y === 84 && el.w === 164 && el.h === 15 && el.fontSize === 14) {
        tocado = true;
        return { ...el, y: 83, h: 26, fontSize: 12 };
      }
      // Tabla de trabajos: bajarla para dejar sitio a la caja nueva
      if (el.type === "table" && el.x === 20 && el.y === 110 && el.w === 170 && el.h === 90) {
        tocado = true;
        return { ...el, y: 116, h: 88 };
      }
      return el;
    });
    if (tocado) {
      await formatos.updateOne({ _id: p._id }, { $set: { elements } });
      console.log(`Actualizada en ${name}: "${p.nombre}"`);
    } else {
      console.log(`Sin tocar en ${name}: "${p.nombre}" (personalizada o ya nueva)`);
    }
  }
}
await client.close();
console.log("Hecho.");
