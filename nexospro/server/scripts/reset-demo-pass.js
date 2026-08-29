const crypto = require("crypto");
const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync("Demo@2026", salt, 64).toString("hex");
const r = db.cuentas.updateOne(
  { email: "info@filanex.es" },
  { $set: { passwordHash: salt + ":" + hash, activa: true } }
);
print("modificadas:", r.modifiedCount);
