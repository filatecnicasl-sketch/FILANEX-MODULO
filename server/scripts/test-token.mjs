import "dotenv/config";
import { firmarToken } from "../src/services/jwt.js";

const tk = firmarToken({
  id: "test",
  email: "stress.test@filanex.local",
  rol: "admin",
  tenant: "local",
  empresa: { slug: "local", dbName: "nexospro" },
});

const r = await fetch("http://localhost:4700/api/facturas-venta", {
  headers: { authorization: "Bearer " + tk },
});
console.log("Status:", r.status);
console.log("Body:", await r.text());
