import mongoose from "mongoose";

const conn = await mongoose.createConnection("mongodb://localhost:27017/filanex_montiel").asPromise();
const formatos = conn.db.collection("formatos");
const ordenes = conn.db.collection("ordentrabajos");

const fmt = await formatos.find({ tipoDocumento: "parte-taller" }).toArray();
console.log("=== PLANTILLAS parte-taller:", fmt.length);
for (const f of fmt) {
  console.log("-", f.nombre, "| porDefecto:", f.porDefecto, "| actualizada:", f.updatedAt);
  for (const el of f.elements ?? []) {
    const txt = el.text ?? el.fieldKey ?? "";
    if (/motivo|trabajo|descripcion/i.test(String(txt)) || el.type === "textarea") {
      console.log("   el:", el.type, "| x", el.x, "y", el.y, "w", el.w, "h", el.h, "| fontSize:", el.fontSize, "|", String(txt).slice(0, 60));
    }
  }
}

const ot = await ordenes.findOne({ numero: "OT-000058" });
if (ot) {
  console.log("\n=== OT-000058 ===");
  console.log("fechaEntrada:", ot.fechaEntrada);
  console.log("motivo:\n" + (ot.motivo ?? "(vacío)"));
} else {
  const ultima = await ordenes.find().sort({ createdAt: -1 }).limit(1).toArray();
  console.log("\nNo existe OT-000058. Última:", ultima[0]?.numero);
}
await conn.close();
