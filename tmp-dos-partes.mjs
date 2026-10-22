import { MongoClient } from "mongodb";

// 1) En todos los tenants: la caja "Trabajo solicitado" del parte pasa de 30
//    a 37 mm (el motivo vuelve a ir en lista vertical) y la tabla baja.
//    Solo se tocan los elementos que coinciden con la plantilla de fábrica.
// 2) En filanex_montiel: se añade el formato "Trabajos a realizar".
const mongo = new MongoClient("mongodb://localhost:27017");
await mongo.connect();
const dbs = (await mongo.db("admin").admin().listDatabases()).databases;

const DOC2 = {
  tipoDocumento: "parte-taller",
  nombre: "Trabajos a realizar",
  porDefecto: false,
  page: { size: "A4", orientation: "portrait" },
  elements: [
    { type: "image", x: 20, y: 14, w: 40, h: 18, src: "{{empresa.logo}}" },
    { type: "text", x: 100, y: 16, w: 90, h: 10, text: "TRABAJOS A REALIZAR", fontSize: 16, bold: true, align: "right", color: "#111827" },
    { type: "text", x: 100, y: 27, w: 90, h: 6, text: "{{documento.numero}}", fontSize: 11, bold: false, align: "right", color: "#4b5563" },
    { type: "text", x: 100, y: 34, w: 90, h: 5, text: "Fecha entrada: {{vehiculo.entrada}}", fontSize: 9, bold: false, align: "right", color: "#6b7280" },

    { type: "rect", x: 20, y: 64, w: 80, h: 0.3, borderWidth: 0, borderColor: "", background: "#e5e7eb" },
    { type: "text", x: 23, y: 41, w: 74, h: 5, text: "CLIENTE", fontSize: 7, bold: true, align: "left", color: "#6b7280" },
    { type: "text", x: 23, y: 47, w: 74, h: 6, text: "{{cliente.nombre}}", fontSize: 10, bold: true, align: "left", color: "#000000" },
    { type: "text", x: 23, y: 54, w: 74, h: 5, text: "{{cliente.nif}}", fontSize: 8, bold: false, align: "left", color: "#374151" },
    { type: "text", x: 23, y: 59, w: 74, h: 5, text: "{{cliente.telefono}}", fontSize: 8, bold: false, align: "left", color: "#374151" },

    { type: "rect", x: 110, y: 68, w: 80, h: 0.3, borderWidth: 0, borderColor: "", background: "#e5e7eb" },
    { type: "text", x: 113, y: 41, w: 74, h: 5, text: "VEHÍCULO", fontSize: 7, bold: true, align: "left", color: "#6b7280" },
    { type: "text", x: 113, y: 47, w: 74, h: 6, text: "{{vehiculo.matricula}}", fontSize: 10, bold: true, align: "left", color: "#000000" },
    { type: "text", x: 113, y: 54, w: 74, h: 5, text: "{{vehiculo.marca}} {{vehiculo.modelo}}", fontSize: 8, bold: false, align: "left", color: "#374151" },
    { type: "text", x: 113, y: 59, w: 74, h: 5, text: "{{vehiculo.km}} km", fontSize: 8, bold: false, align: "left", color: "#374151" },
    { type: "text", x: 113, y: 64, w: 74, h: 5, text: "{{seguro.texto}}", fontSize: 8, bold: true, align: "left", color: "#1e40af" },

    { type: "text", x: 20, y: 74, w: 170, h: 5, text: "Trabajos a realizar", fontSize: 8, bold: true, align: "left", color: "#6b7280" },
    { type: "rect", x: 20, y: 280, w: 170, h: 0.3, borderWidth: 0, borderColor: "", background: "#e5e7eb" },
    { type: "text", x: 23, y: 84, w: 164, h: 192, text: "{{trabajos.motivo}}", fontSize: 12, bold: true, align: "left", color: "#111827" },
  ],
};
DOC2.elements.forEach((el, i) => (el.id = `doc2_${i + 1}`));

for (const { name } of dbs) {
  if (!name.startsWith("filanex_") || name === "filanex_plataforma") continue;
  const db = mongo.db(name);
  const formatos = db.collection("formatos");
  const plantillas = await formatos.find({ tipoDocumento: "parte-taller" }).toArray();
  for (const p of plantillas) {
    if (p.nombre === "Trabajos a realizar") continue;
    let tocado = false;
    const elements = (p.elements ?? []).map((el) => {
      // Línea inferior de la caja del motivo (box 20,80 → línea en y=110)
      if (el.type === "rect" && el.x === 20 && el.y === 110 && el.w === 170 && el.h === 0.3) {
        tocado = true;
        return { ...el, y: 117 };
      }
      // Texto del motivo
      if (el.type === "text" && el.text === "{{trabajos.motivo}}" && el.x === 23 && el.y === 83 && el.w === 164 && el.h === 26 && el.fontSize === 12) {
        tocado = true;
        return { ...el, h: 32 };
      }
      // Tabla de trabajos
      if (el.type === "table" && el.x === 20 && el.y === 116 && el.w === 170 && el.h === 88) {
        tocado = true;
        return { ...el, y: 120, h: 84 };
      }
      return el;
    });
    if (tocado) {
      await formatos.updateOne({ _id: p._id }, { $set: { elements } });
      console.log(`Caja ampliada en ${name}: "${p.nombre}"`);
    } else {
      console.log(`Sin tocar en ${name}: "${p.nombre}"`);
    }
  }

  if (name === "filanex_montiel") {
    const ya = await formatos.findOne({ tipoDocumento: "parte-taller", nombre: "Trabajos a realizar" });
    if (!ya) {
      await formatos.insertOne({ ...DOC2, createdAt: new Date(), updatedAt: new Date() });
      console.log("Insertado 'Trabajos a realizar' en filanex_montiel");
    } else {
      await formatos.updateOne({ _id: ya._id }, { $set: { elements: DOC2.elements, page: DOC2.page } });
      console.log("Actualizado 'Trabajos a realizar' en filanex_montiel");
    }
  }
}
await mongo.close();
console.log("Hecho.");
