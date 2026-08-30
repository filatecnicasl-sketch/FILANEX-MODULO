import { Router } from "express";
import clientes from "./clientes.js";
import proveedores from "./proveedores.js";
import articulos from "./articulos.js";
import facturasVenta from "./facturas-venta.js";
import facturasCompra from "./facturas-compra.js";
import pedidosCompra from "./pedidos-compra.js";
import albaranesCompra from "./albaranes-compra.js";
import presupuestosCompra from "./presupuestos-compra.js";
import gastos from "./gastos.js";
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
import telefonia, { webhookTelefonia } from "./telefonia.js";
import agenda from "./agenda.js";
import servicio from "./servicio.js";
import formatos from "./formatos.js";
import documentos from "./documentos.js";
import auditoria from "./auditoria.js";
import asesoria from "./asesoria.js";
import miAsesoria from "./mi-asesoria.js";
import tpv from "./tpv.js";
import cierres from "./cierres.js";
import auth from "./auth.js";
import adminTenants from "./admin/tenants.js";
import whatsapp from "./whatsapp.js";
import correo from "./correo.js";
import backups from "./backups.js";
import informes from "./informes.js";
import { requiereAuth } from "../middleware/auth.js";
import { middlewareEmpresa } from "../middleware/empresa.js";
import { idempotencia } from "../middleware/idempotencia.js";
import { auditoria as registroAuditoria } from "../middleware/auditoria.js";

const router = Router();

// Público: login y alta del primer administrador.
router.use("/auth", auth);
// Público con token propio de centralita (no hay sesión de usuario).
router.use("/telefonia", webhookTelefonia);

// Panel de plataforma: requiere auth pero no contexto de empresa.
router.use("/admin/tenants", adminTenants);

// Todo lo demás exige sesión y se ejecuta dentro del contexto de la empresa
// del token (sus consultas van a la base de datos de esa empresa).
router.use(requiereAuth, middlewareEmpresa);
// Reenvíos desde la cola sin conexión: la misma clave nunca se ejecuta dos veces.
router.use(idempotencia);
// Trazabilidad: cada alta/cambio/borrado queda registrado con su usuario.
router.use(registroAuditoria);

router.use("/clientes", clientes);
router.use("/proveedores", proveedores);
router.use("/articulos", articulos);
router.use("/facturas-venta", facturasVenta);
router.use("/facturas-compra", facturasCompra);
router.use("/pedidos-compra", pedidosCompra);
router.use("/albaranes-compra", albaranesCompra);
router.use("/presupuestos-compra", presupuestosCompra);
router.use("/gastos", gastos);
router.use("/presupuestos", presupuestos);
router.use("/albaranes-venta", albaranesVenta);
router.use("/remesas", remesas);
router.use("/recurrencias", recurrencias);
router.use("/empresa/cierres", cierres); // antes de /empresa para que no la capture
router.use("/empresa", empresa);
router.use("/resumen", resumen);
router.use("/verifactu", verifactu);
router.use("/taller", taller);
router.use("/certificado", certificado);
router.use("/notificaciones", notificaciones);
router.use("/usuarios", usuarios);
router.use("/telefonia", telefonia);
router.use("/agenda", agenda);
router.use("/servicio", servicio);
router.use("/formatos", formatos);
router.use("/documentos", documentos);
router.use("/auditoria", auditoria);
router.use("/asesoria", asesoria);
router.use("/mi-asesoria", miAsesoria);
router.use("/tpv", tpv);
router.use("/whatsapp", whatsapp);
router.use("/correo", correo);
router.use("/backups", backups);
router.use("/informes", informes);

export default router;
