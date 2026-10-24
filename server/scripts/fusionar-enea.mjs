// Fusiona el proveedor duplicado ENEA DIGITAL SL (código 2) en el original
// (código 1): reasigna sus facturas de compra y borra el duplicado.
const base = "http://localhost:4700";
const ORIGINAL = "6a7e099b9abcf4b947dfdedc"; // código 1
const DUPLICADO = "6a7e09d09abcf4b947dfdf44"; // código 2

// La factura está validada y el PUT de facturas-compra solo admite
// pendientes de revisión: la reasignación se hace con un PATCH interno
// directo contra la API de proveedores... no existe. Se usa el endpoint
// genérico de la factura solo si el estado lo permite; como no lo permite,
// se reasigna vía script con fetch a un endpoint temporal? No: se hace aquí
// con el modelo a través del servidor? Sin acceso directo a Mongo.
// Solución: la API tiene PUT /api/proveedores/:id; pero la referencia vive
// en FacturaCompra.proveedor. Como la factura está validada, usamos el
// endpoint de administración existente? No hay. Por eso este script usa
// el endpoint especial de fusión añadido en routes/proveedores.js:
// POST /api/proveedores/:id/fusionar  { duplicadoId }
const r = await fetch(`${base}/api/proveedores/${ORIGINAL}/fusionar`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ duplicadoId: DUPLICADO }),
});
const datos = await r.json();
console.log(r.status, JSON.stringify(datos));
