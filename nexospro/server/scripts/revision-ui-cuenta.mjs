// Crea una cuenta temporal de revisión en el tenant demototal para
// inspeccionar la UI. Se borra con: ... deleteOne
import mongoose from "mongoose";

await mongoose.connect("mongodb://127.0.0.1:27017/filanex_plataforma");
const Tenant = (await import("../src/models/plataforma/Tenant.js")).default;
const Cuenta = (await import("../src/models/plataforma/Cuenta.js")).default;
const { hashContrasena } = await import("../src/routes/usuarios.js");

const t = await Tenant.findOne({ slug: "demototal" });
if (!t) throw new Error("No existe el tenant demototal");

if (process.argv[2] === "borrar") {
  await Cuenta.deleteOne({ email: "revisar.ui@filanex.local" });
  console.log("cuenta de revisión eliminada");
} else {
  await Cuenta.deleteOne({ email: "revisar.ui@filanex.local" });
  await Cuenta.create({
    nombre: "Revision UI",
    email: "revisar.ui@filanex.local",
    passwordHash: hashContrasena("Revision123!"),
    rol: "admin",
    tenant: t._id,
  });
  console.log("cuenta de revisión creada: revisar.ui@filanex.local / Revision123!");
}
await mongoose.disconnect();
process.exit(0);
