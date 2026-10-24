// Copia diaria de TODAS las empresas de esta instalación local, pensada para
// el Programador de tareas de Windows. A diferencia del programador interno
// de la app, funciona aunque FILANEX esté cerrado: solo necesita MongoDB en
// marcha (que en Windows suele ir como servicio automático).
//
// Registrar la tarea (una sola vez, en cada instalación de cliente):
//   scripts\instalar-tarea-backup.cmd
// Ejecución manual:
//   node scripts\backup-local.mjs
import "dotenv/config";
import mongoose from "mongoose";

const base = process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017";
const plataforma = process.env.BD_PLATAFORMA || "filanex_plataforma";

try {
  await mongoose.connect(`${base}/${plataforma}`);
  const { ejecutarCopiasDiarias } = await import("../src/services/backup.js");
  await ejecutarCopiasDiarias();
  console.log("[backup-local] Pasada terminada");
} catch (e) {
  console.error("[backup-local] ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
