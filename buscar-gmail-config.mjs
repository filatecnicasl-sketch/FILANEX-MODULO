// Busca en todos los tenants si hay algún buzón Gmail configurado.
import mongoose from "mongoose";

const tenants = [
  "filanex_local",
  "filanex_montiel",
  "filanex_demomontiel",
  "filanex_demototal",
  "filanex_demofilanex",
  "filanex_rolusur",
  "filanex_gasen",
];
for (const t of tenants) {
  try {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${t}`, { dbName: t });
    const empresa = await mongoose.connection.db.collection("empresas").findOne({});
    const conf = empresa?.correoEntrante;
    if (conf?.usuario) {
      console.log(`${t}: ${conf.usuario} @ ${conf.host} (activo=${conf.activo}, password=${conf.passwordCifrada ? "sí" : "no"})`);
    }
    await mongoose.disconnect();
  } catch {
    try { await mongoose.disconnect(); } catch {}
  }
}
console.log("FIN");
