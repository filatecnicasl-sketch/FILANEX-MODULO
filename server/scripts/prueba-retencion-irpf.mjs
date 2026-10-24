/* Prueba E2E de la retención de IRPF en facturas de compra:
   1) Alta con 15 % (modelo 111): total = base + IVA − retención.
   2) Alta con 19 % (modelo 115, arrendamiento).
   3) Importe explícito distinto del calculado (redondeo del proveedor).
   4) Edición: cambiar el porcentaje recalcula retención y total.
   5) Quitar la retención (0 %) restaura el total a base + IVA.
   6) Sin retención: no se guarda el campo.
   7) Validación y resumen /api/informes/compras/retenciones por modelo
      y por proveedor.
   Al terminar borra facturas, proveedor y cuenta de la prueba.
   Uso: node scripts/prueba-retencion-irpf.mjs  (desde server/, API en 4700) */
import mongoose from "mongoose";
import "dotenv/config";

const EMAIL = "stress.test@filanex.local";
const PASSWORD = "StressTest123!";
const BASE = process.env.API_BASE || "http://localhost:4700";
const uriBase = process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017";

await mongoose.connect(`${uriBase}/filanex_plataforma`);
const Tenant = (await import("../src/models/plataforma/Tenant.js")).default;
const Cuenta = (await import("../src/models/plataforma/Cuenta.js")).default;
const { hashContrasena } = await import("../src/routes/usuarios.js");
const tenant = await Tenant.findOne({ slug: "demototal" });
await Cuenta.deleteOne({ email: EMAIL });
await Cuenta.create({
  nombre: "Prueba retencion IRPF",
  email: EMAIL,
  passwordHash: hashContrasena(PASSWORD),
  rol: "admin",
  tenant: tenant._id,
});
await mongoose.disconnect();

let fallos = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK " : "FALLO"} - ${msg}`);
  if (!cond) fallos++;
};
const igual = (a, b) => Math.abs((a ?? 0) - (b ?? 0)) < 0.005;

const facturas = [];
let proveedorId = null;
try {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  const H = { "Content-Type": "application/json", Authorization: `Bearer ${login.token}` };
  const api = async (metodo, ruta, cuerpo) => {
    const r = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: H,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return { status: r.status, datos: await r.json().catch(() => ({})) };
  };

  const prov = await api("POST", "/api/proveedores", { nombre: "PRUEBA IRPF Profesional" });
  ok(prov.status === 201, `proveedor de prueba creado (${prov.status})`);
  proveedorId = prov.datos._id;

  const linea = (precio) => [{ descripcion: "Servicio profesional prueba", cantidad: 1, precioUnitario: precio, iva: 21 }];

  // 1) 15 % modelo 111: base 100, IVA 21, retención 15 → total 106.
  const f1 = await api("POST", "/api/facturas-compra", {
    proveedor: proveedorId,
    numeroFacturaProveedor: "IRPF-TEST-1",
    fechaExpedicion: "2026-10-01",
    lineas: linea(100),
    retencionIrpf: { porcentaje: 15, modelo: "111" },
  });
  ok(f1.status === 201, `alta con 15 % 111 (${f1.status})`);
  facturas.push(f1.datos._id);
  ok(igual(f1.datos.retencionIrpf?.importe, 15), `retención calculada 15,00 (${f1.datos.retencionIrpf?.importe})`);
  ok(f1.datos.retencionIrpf?.modelo === "111", "modelo 111");
  ok(igual(f1.datos.total, 106), `total a pagar 106,00 (${f1.datos.total})`);

  // 2) 19 % modelo 115: base 200, IVA 42, retención 38 → total 204.
  const f2 = await api("POST", "/api/facturas-compra", {
    proveedor: proveedorId,
    numeroFacturaProveedor: "IRPF-TEST-2",
    fechaExpedicion: "2026-10-02",
    lineas: linea(200),
    retencionIrpf: { porcentaje: 19, modelo: "115" },
  });
  facturas.push(f2.datos._id);
  ok(f2.status === 201 && f2.datos.retencionIrpf?.modelo === "115", "alta con 19 % modelo 115");
  ok(igual(f2.datos.retencionIrpf?.importe, 38) && igual(f2.datos.total, 204),
    `retención 38,00 y total 204,00 (${f2.datos.retencionIrpf?.importe} / ${f2.datos.total})`);

  // 3) Importe explícito (redondeo del proveedor): 15 % sobre 231,10 = 34,665
  //    pero el proveedor imprime 34,67 → total 231,10 + 48,53 − 34,67 = 244,96.
  const f3 = await api("POST", "/api/facturas-compra", {
    proveedor: proveedorId,
    numeroFacturaProveedor: "IRPF-TEST-3",
    fechaExpedicion: "2026-10-03",
    lineas: linea(231.1),
    retencionIrpf: { porcentaje: 15, importe: 34.67, modelo: "111" },
  });
  facturas.push(f3.datos._id);
  ok(f3.status === 201 && igual(f3.datos.retencionIrpf?.importe, 34.67),
    `importe explícito respetado (${f3.datos.retencionIrpf?.importe})`);
  ok(igual(f3.datos.total, 244.96), `total con redondeo del proveedor 244,96 (${f3.datos.total})`);

  // 4) Editar: bajar al 7 % → retención 7, total 114.
  const f1b = await api("PUT", `/api/facturas-compra/${f1.datos._id}`, {
    retencionIrpf: { porcentaje: 7, modelo: "111" },
  });
  ok(f1b.status === 200 && igual(f1b.datos.retencionIrpf?.importe, 7) && igual(f1b.datos.total, 114),
    `edición recalcula: 7 % → total 114,00 (${f1b.datos.retencionIrpf?.importe} / ${f1b.datos.total})`);

  // 5) Quitar la retención → total vuelve a 121.
  const f1c = await api("PUT", `/api/facturas-compra/${f1.datos._id}`, {
    retencionIrpf: { porcentaje: 0 },
  });
  ok(f1c.status === 200 && !(f1c.datos.retencionIrpf?.importe > 0) && igual(f1c.datos.total, 121),
    `quitar retención restaura total 121,00 (${f1c.datos.total})`);

  // 6) Sin retención: importe 0 y total = base + IVA.
  const f4 = await api("POST", "/api/facturas-compra", {
    proveedor: proveedorId,
    numeroFacturaProveedor: "IRPF-TEST-4",
    fechaExpedicion: "2026-10-04",
    lineas: linea(50),
    retencionIrpf: { porcentaje: 0 },
  });
  facturas.push(f4.datos._id);
  ok(f4.status === 201 && !(f4.datos.retencionIrpf?.importe > 0) && igual(f4.datos.total, 60.5),
    "sin retención: importe 0 y el total es base + IVA");

  // 7) Validar las dos con retención y consultar el resumen del informe.
  const v2 = await api("POST", `/api/facturas-compra/${f2.datos._id}/validar`);
  ok(v2.status === 200 && v2.datos.estado === "validada", `factura 115 validada (${v2.status})`);
  const v3 = await api("POST", `/api/facturas-compra/${f3.datos._id}/validar`);
  ok(v3.status === 200 && v3.datos.estado === "validada", `factura 111 validada (${v3.status})`);
  ok(igual(v3.datos.total, 244.96), "la validación no altera el total con retención");

  const inf = await api("GET", "/api/informes/compras/retenciones?desde=2026-10-01&hasta=2026-10-31");
  ok(inf.status === 200, `informe de retenciones responde (${inf.status})`);
  // f2 (115) y f3 (111) validadas: el proveedor aparece en ambos modelos.
  const filasProv = (inf.datos.filas ?? []).filter((f) => f.nombre === "PRUEBA IRPF Profesional");
  ok(filasProv.length === 2, `el proveedor aparece en 111 y 115 (${filasProv.length})`);
  const f111 = filasProv.find((f) => f.modelo === "111");
  const f115 = filasProv.find((f) => f.modelo === "115");
  ok(f111 && igual(f111.retencion, 34.67) && igual(f111.base, 231.1),
    `modelo 111: base 231,10 retención 34,67 (${f111?.base} / ${f111?.retencion})`);
  ok(f115 && igual(f115.retencion, 38) && igual(f115.base, 200),
    `modelo 115: base 200,00 retención 38,00 (${f115?.base} / ${f115?.retencion})`);
  ok((inf.datos.filas ?? []).every((f) => f.modelo === "111" || f.modelo === "115"), "todas las filas llevan modelo");
  console.log(`     (total retenciones del periodo en la empresa: ${inf.datos.totalRetencion})`);
} catch (err) {
  console.error("ERROR en la prueba:", err.message);
  fallos++;
} finally {
  const H = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json()).then((l) => ({ Authorization: `Bearer ${l.token}` })).catch(() => null);
  for (const id of facturas) {
    if (id && H) await fetch(`${BASE}/api/facturas-compra/${id}`, { method: "DELETE", headers: H }).catch(() => {});
  }
  if (proveedorId && H) await fetch(`${BASE}/api/proveedores/${proveedorId}`, { method: "DELETE", headers: H }).catch(() => {});
  await mongoose.connect(`${uriBase}/filanex_plataforma`);
  await Cuenta.deleteOne({ email: EMAIL });
  await mongoose.disconnect();
}

console.log(fallos === 0 ? "\nTODAS LAS PRUEBAS OK" : `\n${fallos} PRUEBAS FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
