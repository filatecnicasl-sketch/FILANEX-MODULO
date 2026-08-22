import { Router } from "express";
import clientes from "./clientes.js";
import proveedores from "./proveedores.js";
import articulos from "./articulos.js";
import facturasVenta from "./facturas-venta.js";
import facturasCompra from "./facturas-compra.js";
import pedidosCompra from "./pedidos-compra.js";
import albaranesCompra from "./albaranes-compra.js";
import presupuestosCompra from "./presupuestos-compra.js";
import presupuestos from "./presupuestos.js";
import albaranesVenta from "./albaranes-venta.js";
import remesas from "./remesas.js";
import recurrencias from "./recurrencias.js";
import empresa from "./empresa.js";
import resumen from "./resumen.js";
import verifactu from "./verifactu.js";
import taller from "./taller.js";
import certificado from "./certificado.js";
import notificaciones from "./notificaciones.js";
import usuarios from "./usuarios.js";
import telefonia from "./telefonia.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({ ok: true, servicio: "nexospro-api", version: "0.1.0" });
});

router.use("/clientes", clientes);
router.use("/proveedores", proveedores);
router.use("/articulos", articulos);
router.use("/facturas-venta", facturasVenta);
router.use("/facturas-compra", facturasCompra);
router.use("/pedidos-compra", pedidosCompra);
router.use("/albaranes-compra", albaranesCompra);
router.use("/presupuestos-compra", presupuestosCompra);
router.use("/presupuestos", presupuestos);
router.use("/albaranes-venta", albaranesVenta);
router.use("/remesas", remesas);
router.use("/recurrencias", recurrencias);
router.use("/empresa", empresa);
router.use("/resumen", resumen);
router.use("/verifactu", verifactu);
router.use("/taller", taller);
router.use("/certificado", certificado);
router.use("/notificaciones", notificaciones);
router.use("/usuarios", usuarios);
router.use("/telefonia", telefonia);

export default router;
