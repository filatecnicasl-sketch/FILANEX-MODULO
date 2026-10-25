// Clasifica las 6 liquidaciones por comisiones como autofacturas:
// tipoDocumento "autofactura" + serie interna AUTO-2026 + numero secuencial.
// Idempotente: se puede reejecutar sin duplicar nada.
import mongoose from "mongoose";
import "dotenv/config";
import { uriBase } from "./src/config/db.js";
import FacturaVenta from "./src/models/FacturaVenta.js";
import Cliente from "./src/models/Cliente.js";

const numeros = ["FS-26-1-01", "FS-26-2-01", "FS-26-3-01", "5569-26-00001", "ACI/0001", "INFA202606090100864"];
await mongoose.connect(`${uriBase().replace(/\/+$/, "")}/filanex_local`);
try {
  const facturas = await FacturaVenta.find({ serieNumero: { $in: numeros } });
  if (facturas.length !== 6) throw new Error(`Se esperaban 6 documentos, hay ${facturas.length}`);
  // Orden cronológico para el numero interno de la serie AUTO-2026.
  facturas.sort((a, b) => new Date(a.fechaExpedicion) - new Date(b.fechaExpedicion));
  let cambios = 0;
  for (const [i, f] of facturas.entries()) {
    if (f.tipoDocumento === "autofactura" && f.serie === "AUTO-2026" && f.numero === i + 1) continue;
    // Salvaguarda: no tocar nada más que las 6 esperadas.
    if (!numeros.includes(f.serieNumero)) throw new Error(`Documento inesperado: ${f.serieNumero}`);
    f.tipoDocumento = "autofactura";
    f.serie = "AUTO-2026";
    f.numero = i + 1;
    await f.save();
    cambios++;
  }
  const verificadas = await FacturaVenta.find({ tipoDocumento: "autofactura" })
    .select("serieNumero serie numero fechaExpedicion baseImponible cuotaIva total estado documentoOriginal cobros verifactu.estadoEnvio cliente")
    .sort({ numero: 1 })
    .lean();
  // Sin populate: resolvemos el nombre con una consulta manual por _id.
  const clientes = {};
  for (const f of verificadas) {
    if (!clientes[String(f.cliente)]) {
      clientes[String(f.cliente)] = await Cliente.findById(f.cliente).select("nombre nif").lean();
    }
  }
  console.log(JSON.stringify({ cambios, total: verificadas.length, autofacturas: verificadas.map((f) => ({
    interna: `${f.serie}-${f.numero}`,
    documento: f.serieNumero,
    fecha: new Date(f.fechaExpedicion).toISOString().slice(0, 10),
    total: f.total,
    cliente: clientes[String(f.cliente)]?.nombre,
    pdf: Boolean(f.documentoOriginal),
    cobros: (f.cobros ?? []).length,
    verifactu: f.verifactu?.estadoEnvio,
  })) }, null, 2));
} finally {
  await mongoose.disconnect();
}
