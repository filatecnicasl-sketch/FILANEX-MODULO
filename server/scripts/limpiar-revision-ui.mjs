// Elimina la cuenta temporal de revisión UI del tenant demototal.
import mongoose from "mongoose";

await mongoose.connect("mongodb://127.0.0.1:27017/filanex_plataforma");
const Cuenta = (await import("../src/models/plataforma/Cuenta.js")).default;
const r = await Cuenta.deleteOne({ email: "revisar.ui@filanex.local" });
console.log("cuenta de revisión eliminada:", r.deletedCount);
await mongoose.disconnect();
process.exit(0);
