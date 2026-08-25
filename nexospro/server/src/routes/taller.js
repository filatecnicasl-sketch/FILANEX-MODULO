import { Router } from "express";
import multer from "multer";
import Vehiculo from "../models/Vehiculo.js";
import OrdenTrabajo, { ESTADOS_OT } from "../models/OrdenTrabajo.js";
import Cita, { ESTADOS_CITA } from "../models/Cita.js";
import PrestamoCortesia from "../models/PrestamoCortesia.js";
import Valoracion, { ESTADOS_VALORACION } from "../models/Valoracion.js";
import Operario from "../models/Operario.js";
import Aseguradora from "../models/Aseguradora.js";
import Cliente from "../models/Cliente.js";
import Empresa from "../models/Empresa.js";
import FacturaVenta from "../models/FacturaVenta.js";
import Presupuesto from "../models/Presupuesto.js";
import { calcularTotales } from "../services/totales.js";
import { tomarNumeroOrdenTrabajoAtomico } from "../services/numeracion.js";
import { requiereModulo } from "../config/modulos.js";
import { validarNIF, normalizarNIF } from "../services/validacion.js";
import { extraerValoracion } from "../services/ocr-gemini.js";
import {
  presupuestosAbiertosCliente,
  validarPresupuestoVinculable,
  marcarPresupuestoAceptado,
} from "../services/presupuestoVinculable.js";
import aseguradoras from "./aseguradoras.js";
import { contextoTrasSubida } from "../middleware/empresa.js";
import { uploadMemoria, borrarSubida } from "../middleware/upload.js";
import { guardarArchivo, urlPublica } from "../services/storage.js";
import { slugActual } from "../models/tenant.js";

const router = Router();

const subidaFotos = uploadMemoria;
const subidaPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

router.use(requiereModulo("taller"));
router.use("/aseguradoras", aseguradoras);

// ---------- Vehículos ----------
router.get("/vehiculos", async (req, res, next) => {
  try {
    const lista = await Vehiculo.find().sort({ matricula: 1 }).limit(500);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

// Historial del vehículo: recepciones (OT) con sus fotos del estado, de la
// más reciente a la más antigua.
router.get("/vehiculos/:id/historial", async (req, res, next) => {
  try {
    const vehiculo = await Vehiculo.findById(req.params.id).lean();
    if (!vehiculo) return res.status(404).json({ error: "Vehículo no encontrado" });
    const historial = [...(vehiculo.historial ?? [])].sort(
      (a, b) => new Date(b.fecha ?? 0) - new Date(a.fecha ?? 0)
    );
    res.json(historial);
  } catch (err) {
    next(err);
  }
});

router.post("/vehiculos", async (req, res, next) => {
  try {
    const { matricula } = req.body;
    if (!matricula) return res.status(400).json({ error: "La matrícula es obligatoria" });
    const existente = await Vehiculo.findOne({ matricula: matricula.toUpperCase().trim() });
    if (existente) return res.status(409).json({ error: "Ya existe un vehículo con esa matrícula" });
    const vehiculo = await Vehiculo.create(req.body);
    res.status(201).json(vehiculo);
  } catch (err) {
    next(err);
  }
});

router.put("/vehiculos/:id", async (req, res, next) => {
  try {
    const { matricula, marca, modelo, bastidor, color, combustible, anio, km, tipo, cliente, clienteNombre, notas } = req.body;
    const vehiculo = await Vehiculo.findByIdAndUpdate(
      req.params.id,
      { matricula: matricula?.toUpperCase().trim(), marca, modelo, bastidor, color, combustible, anio, km, tipo, cliente, clienteNombre, notas },
      { new: true, omitUndefined: true }
    );
    if (!vehiculo) return res.status(404).json({ error: "Vehículo no encontrado" });
    res.json(vehiculo);
  } catch (err) {
    next(err);
  }
});

router.delete("/vehiculos/:id", async (req, res, next) => {
  try {
    const enUso = await OrdenTrabajo.countDocuments({ vehiculo: req.params.id });
    if (enUso > 0) {
      return res.status(409).json({ error: `No se puede borrar: tiene ${enUso} orden(es) de trabajo` });
    }
    const vehiculo = await Vehiculo.findByIdAndDelete(req.params.id);
    if (!vehiculo) return res.status(404).json({ error: "Vehículo no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- Órdenes de trabajo ----------

// Presupuestos abiertos del cliente, para la recepción rápida y la ficha de
// orden. Incluye las líneas para cargarlas en la OT al vincularlo.
router.get("/presupuestos-abiertos", async (req, res, next) => {
  try {
    if (!req.query.cliente) return res.json([]);
    const lista = await presupuestosAbiertosCliente(OrdenTrabajo, req.query.cliente, req.query.excluirOrden);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});


router.get("/ordenes", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.abiertas === "1") filtro.estado = { $in: ["recepcion", "en_curso"] };
    const lista = await OrdenTrabajo.find(filtro)
      .populate("aseguradora", "nombre")
      .populate("vehiculo", "marca modelo color")
      .populate("cliente", "nombre nif direccion telefono email")
      .sort({ createdAt: -1 })
      .limit(300);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/ordenes", async (req, res, next) => {
  try {
    const { matricula } = req.body;
    if (!matricula) return res.status(400).json({ error: "La matrícula es obligatoria" });
    let pto = null;
    if (req.body.presupuesto) {
      const { presupuesto, error, codigo } = await validarPresupuestoVinculable(
        OrdenTrabajo,
        req.body.presupuesto,
        null,
        req.body.cliente
      );
      if (error) return res.status(codigo).json({ error });
      pto = presupuesto;
    }
    const orden = await crearOrden({
      ...req.body,
      presupuesto: pto?._id,
      presupuestoNumero: pto?.serieNumero,
    });
    if (pto) await marcarPresupuestoAceptado(pto);
    res.status(201).json(orden);
  } catch (err) {
    next(err);
  }
});

router.put("/ordenes/:id", async (req, res, next) => {
  try {
    const { estado, trabajos, motivo, km, clienteNombre, telefono, fechaEntregaPrevista, lineas } = req.body;
    if (estado !== undefined && !ESTADOS_OT.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido. Válidos: ${ESTADOS_OT.join(", ")}` });
    }
    const cambios = { estado, trabajos, motivo, km, clienteNombre, telefono, fechaEntregaPrevista };
    if (req.body.notasInternas !== undefined) cambios.notasInternas = req.body.notasInternas || null;
    if (req.body.fechaEntrada !== undefined) {
      cambios.fechaEntrada = req.body.fechaEntrada ? new Date(req.body.fechaEntrada) : null;
    }
    if (req.body.cliente !== undefined) cambios.cliente = req.body.cliente || null;
    // Vincular/desvincular el presupuesto del que nace la orden.
    if (req.body.presupuesto !== undefined) {
      if (!req.body.presupuesto) {
        cambios.presupuesto = null;
        cambios.presupuestoNumero = null;
      } else {
        // El cliente efectivo: el nuevo si se cambia en esta misma llamada,
        // si no el que ya tiene la orden guardada.
        let clienteEfectivo = req.body.cliente;
        if (clienteEfectivo === undefined) {
          clienteEfectivo = (await OrdenTrabajo.findById(req.params.id).lean())?.cliente;
        }
        const { presupuesto: pto, error: errPto, codigo } = await validarPresupuestoVinculable(
          OrdenTrabajo,
          req.body.presupuesto,
          req.params.id,
          clienteEfectivo
        );
        if (errPto) return res.status(codigo).json({ error: errPto });
        cambios.presupuesto = pto._id;
        cambios.presupuestoNumero = pto.serieNumero;
        await marcarPresupuestoAceptado(pto);
      }
    }
    if (Array.isArray(lineas)) {
      cambios.lineas = lineas.filter((l) => l.descripcion);
      cambios.total = calcularTotales(cambios.lineas).total;
    }
    // Compañía aseguradora y a quién se factura (cliente o compañía).
    if (req.body.aseguradora !== undefined) {
      cambios.aseguradora = req.body.aseguradora || null;
      if (!cambios.aseguradora) cambios.facturarA = "cliente";
    }
    if (req.body.numeroSiniestro !== undefined) {
      cambios.numeroSiniestro = req.body.numeroSiniestro?.trim() || null;
    }
    if (req.body.facturarA !== undefined) {
      if (!["cliente", "aseguradora"].includes(req.body.facturarA)) {
        return res.status(400).json({ error: "facturarA debe ser cliente o aseguradora" });
      }
      cambios.facturarA = req.body.facturarA;
    }
    if (cambios.facturarA === "aseguradora") {
      const ref = cambios.aseguradora ?? (await OrdenTrabajo.findById(req.params.id).lean())?.aseguradora;
      if (!ref) return res.status(400).json({ error: "Para facturar a la compañía primero elige la aseguradora" });
    }
    const orden = await OrdenTrabajo.findByIdAndUpdate(req.params.id, cambios, { new: true, omitUndefined: true });
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    res.json(orden);
  } catch (err) {
    next(err);
  }
});

// Genera la factura (borrador) de la OT: el cobro y la emisión VeriFactu
// se hacen desde Ventas, como cualquier otra factura.
// Si la OT se factura a la aseguradora, la factura va a nombre de la compañía
// (ficha de cliente auto-creada) y con sus descuentos negociados aplicados.
router.post("/ordenes/:id/facturar", async (req, res, next) => {
  try {
    const orden = await OrdenTrabajo.findById(req.params.id);
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    if (orden.factura) return res.status(409).json({ error: "Esta orden ya tiene factura" });
    if (!["finalizado", "entregado"].includes(orden.estado)) {
      return res.status(409).json({ error: "La orden debe estar finalizada para facturarla" });
    }
    let lineas = (orden.lineas ?? []).filter((l) => l.descripcion);
    if (lineas.length === 0) {
      return res.status(400).json({ error: "La orden no tiene líneas de facturación" });
    }

    let aseguradora = null;
    let clienteId = orden.cliente;
    let detalleFactura = `Orden de trabajo ${orden.numero} · ${orden.matricula}`;

    if (orden.facturarA === "aseguradora") {
      if (!orden.aseguradora) {
        return res.status(400).json({ error: "La orden se factura a la compañía pero no tiene aseguradora" });
      }
      aseguradora = await Aseguradora.findById(orden.aseguradora);
      if (!aseguradora) return res.status(404).json({ error: "La aseguradora ya no existe" });

      // Ficha de cliente de la compañía: se reutiliza o se crea la 1ª vez.
      clienteId = aseguradora.cliente;
      if (!clienteId) {
        const datosCliente = {
          nombre: aseguradora.nombre,
          nif: aseguradora.nif,
          telefono: aseguradora.telefono,
          email: aseguradora.email,
          calle: aseguradora.calle,
          ciudad: aseguradora.ciudad,
          cp: aseguradora.cp,
        };
        const filtro = aseguradora.nif ? { nif: aseguradora.nif } : { nombre: aseguradora.nombre };
        const cliente = await Cliente.findOneAndUpdate(
          filtro,
          { $setOnInsert: datosCliente },
          { new: true, upsert: true }
        );
        clienteId = cliente._id;
        aseguradora.cliente = clienteId;
        await aseguradora.save();
      }

      // Descuentos negociados: el global manda; si no, por tipo de línea.
      lineas = lineas.map((l) => {
        const plana = l.toObject();
        const dto =
          aseguradora.dtoTotal > 0
            ? aseguradora.dtoTotal
            : plana.tipo === "material"
              ? aseguradora.dtoMateriales
              : plana.tipo === "mano_obra"
                ? aseguradora.dtoManoObra
                : 0;
        if (!dto) return plana;
        return { ...plana, precioUnitario: Math.round(plana.precioUnitario * (1 - dto / 100) * 100) / 100 };
      });

      detalleFactura += orden.numeroSiniestro
        ? ` · Siniestro ${orden.numeroSiniestro} (${aseguradora.nombre})`
        : ` · ${aseguradora.nombre}`;
    }

    // Cliente: el vinculado o alta mínima por nombre (misma filosofía que el OCR).
    if (!clienteId) {
      const nombre = orden.clienteNombre?.trim();
      if (!nombre) {
        return res.status(400).json({ error: "La orden no tiene cliente: asígnale uno antes de facturar" });
      }
      const cliente = await Cliente.findOneAndUpdate(
        { nombre },
        { nombre },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      clienteId = cliente._id;
      orden.cliente = clienteId;
    }

    const empresa = await Empresa.findOne();
    const totales = calcularTotales(lineas);
    const factura = await FacturaVenta.create({
      empresa: empresa?._id,
      cliente: clienteId,
      lineas,
      ...totales,
      descripcion: detalleFactura,
      vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      origen: { ordenTrabajo: orden._id, presupuesto: orden.presupuesto || undefined },
    });

    orden.factura = factura._id;
    orden.total = totales.total;
    await orden.save();

    // El presupuesto que originó la OT queda facturado con la misma factura.
    if (orden.presupuesto) {
      await Presupuesto.findByIdAndUpdate(orden.presupuesto, {
        estado: "facturado",
        facturaVenta: factura._id,
      });
    }

    res.status(201).json({ orden, factura });
  } catch (err) {
    next(err);
  }
});

router.delete("/ordenes/:id", async (req, res, next) => {
  try {
    const orden = await OrdenTrabajo.findByIdAndDelete(req.params.id);
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- Recepción digital: fotos del estado + firma del cliente ----------

// Vuelca la recepción de la OT en el historial del vehículo: una entrada por
// orden con sus fotos del estado, que se actualiza al subir o quitar fotos.
async function sincronizarHistorialVehiculo(orden) {
  if (!orden.vehiculo) return;
  try {
    const entrada = {
      fecha: orden.fechaEntrada ?? orden.createdAt ?? new Date(),
      numeroOrden: orden.numero,
      orden: orden._id,
      motivo: orden.motivo || undefined,
      km: orden.km ?? undefined,
      fotos: orden.recepcionDigital?.fotos ?? [],
    };
    const vehiculo = await Vehiculo.findById(orden.vehiculo);
    if (!vehiculo) return;
    const historial = vehiculo.historial ?? [];
    const i = historial.findIndex((h) => String(h.orden) === String(orden._id));
    if (i >= 0) {
      const previa = historial[i].toObject?.() ?? historial[i];
      historial[i] = { ...previa, ...entrada };
    } else historial.push(entrada);
    vehiculo.historial = historial;
    await vehiculo.save();
  } catch {
    // El historial es un añadido: nunca debe romper la recepción.
  }
}

// Sube fotos del estado del vehículo (móvil/tableta, cámara o galería).
const rutasFotosRecepcion = [subidaFotos.array("fotos", 12), contextoTrasSubida];
router.post("/ordenes/:id/recepcion/fotos", rutasFotosRecepcion, async (req, res, next) => {
  try {
    const orden = await OrdenTrabajo.findById(req.params.id);
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    if (!req.files?.length) return res.status(400).json({ error: "No llegó ninguna foto" });
    const slug = slugActual();
    const rutas = [];
    for (const f of req.files) {
      if (!f.mimetype.startsWith("image/")) continue;
      const ext = f.mimetype === "image/png" ? ".png" : ".jpg";
      const archivo = `ot-${orden._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const remoto = `uploads/${slug}/taller/${archivo}`;
      await guardarArchivo(remoto, f.buffer, f.mimetype);
      rutas.push(urlPublica(remoto));
    }
    orden.recepcionDigital = orden.recepcionDigital ?? {};
    orden.recepcionDigital.fotos = [...(orden.recepcionDigital.fotos ?? []), ...rutas];
    await orden.save();
    await sincronizarHistorialVehiculo(orden);
    res.status(201).json(orden.recepcionDigital);
  } catch (err) {
    next(err);
  }
});

// Quita una foto de la recepción (body: { ruta }).
router.delete("/ordenes/:id/recepcion/fotos", async (req, res, next) => {
  try {
    const { ruta } = req.body;
    const orden = await OrdenTrabajo.findById(req.params.id);
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    const fotos = orden.recepcionDigital?.fotos ?? [];
    if (!fotos.includes(ruta)) return res.status(404).json({ error: "Foto no encontrada" });
    orden.recepcionDigital.fotos = fotos.filter((f) => f !== ruta);
    await orden.save();
    await borrarSubida(ruta).catch(() => {});
    await sincronizarHistorialVehiculo(orden);
    res.json(orden.recepcionDigital);
  } catch (err) {
    next(err);
  }
});

// Firma del cliente en la recepción: nombre + DNI de quien deja el vehículo
// y la imagen dibujada en pantalla. Se puede repetir (corrige errores).
router.post("/ordenes/:id/recepcion/firma", async (req, res, next) => {
  try {
    const { nombre, dni, imagen } = req.body;
    if (!String(nombre ?? "").trim()) {
      return res.status(400).json({ error: "El nombre de quien firma es obligatorio" });
    }
    if (!validarNIF(dni)) {
      return res.status(400).json({ error: "El DNI/NIE de quien firma no es válido" });
    }
    const m = String(imagen ?? "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return res.status(400).json({ error: "La firma es obligatoria" });
    const buffer = Buffer.from(m[1], "base64");
    if (buffer.length > 300 * 1024) {
      return res.status(400).json({ error: "Imagen de firma demasiado grande" });
    }
    const orden = await OrdenTrabajo.findById(req.params.id);
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    const archivo = `ot-${orden._id}.png`;
    const remoto = `uploads/${slugActual()}/firmas/${archivo}`;
    await guardarArchivo(remoto, buffer, "image/png");
    orden.recepcionDigital = orden.recepcionDigital ?? {};
    orden.recepcionDigital.firma = {
      nombre: String(nombre).trim(),
      dni: normalizarNIF(dni),
      imagen: urlPublica(remoto),
      fecha: new Date(),
    };
    await orden.save();
    res.json(orden.recepcionDigital.firma);
  } catch (err) {
    next(err);
  }
});

/**
 * Recepción exprés: alta del vehículo (si no existe) + apertura de la OT
 * en un solo paso, con cliente existente o datos sueltos del cliente.
 */
router.post("/recepcion", async (req, res, next) => {
  try {
    const { matricula, marca, modelo, km, clienteId, nombreCliente, telefono, trabajos, motivo, presupuestoId } = req.body;
    if (!matricula) return res.status(400).json({ error: "La matrícula es obligatoria" });

    let nombreFinal = nombreCliente || undefined;
    if (clienteId) {
      const cliente = await Cliente.findById(clienteId).lean();
      if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
      nombreFinal = cliente.nombre;
    }

    // Presupuesto abierto del cliente que se incluye en la orden: se vincula
    // y sus líneas (mano de obra y materiales) se cargan en la OT.
    let pto = null;
    if (presupuestoId) {
      const { presupuesto, error, codigo } = await validarPresupuestoVinculable(OrdenTrabajo, presupuestoId, null, clienteId);
      if (error) return res.status(codigo).json({ error });
      pto = presupuesto;
    }

    const mat = matricula.toUpperCase().trim();
    const vehiculo = await Vehiculo.findOneAndUpdate(
      { matricula: mat },
      { marca, modelo, km, cliente: clienteId || undefined, clienteNombre: nombreFinal },
      { new: true, upsert: true, omitUndefined: true, setDefaultsOnInsert: true }
    );

    const orden = await crearOrden({
      matricula: mat,
      vehiculo: vehiculo._id,
      cliente: clienteId || undefined,
      clienteNombre: nombreFinal,
      telefono,
      trabajos,
      motivo,
      km,
      presupuesto: pto?._id,
      presupuestoNumero: pto?.serieNumero,
      lineas: pto ? pto.lineas.map((l) => l.toObject?.() ?? l) : undefined,
    });

    if (pto) await marcarPresupuestoAceptado(pto);

    await sincronizarHistorialVehiculo(orden);

    res.status(201).json({ vehiculo, orden });
  } catch (err) {
    next(err);
  }
});

// ---------- Operarios y tiempos ----------
router.get("/operarios", async (req, res, next) => {
  try {
    const lista = await Operario.find().sort({ nombre: 1 }).limit(200);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

// Informe de productividad: horas invertidas por operario (registradas en
// las OT) vs horas facturadas (líneas de mano de obra de facturas emitidas).
router.get("/operarios/informe", async (req, res, next) => {
  try {
    const desde = diaLocal(req.query.desde) ?? (() => {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    })();
    const hasta = finDia(diaLocal(req.query.hasta) ?? new Date());

    const [operarios, invertidas, facturadas] = await Promise.all([
      Operario.find().lean(),
      OrdenTrabajo.aggregate([
        { $unwind: "$tiempos" },
        { $match: { "tiempos.fecha": { $gte: desde, $lte: hasta } } },
        { $group: { _id: "$tiempos.operario", horas: { $sum: "$tiempos.horas" } } },
      ]),
      FacturaVenta.aggregate([
        { $match: { estado: "emitida", fechaExpedicion: { $gte: desde, $lte: hasta } } },
        { $unwind: "$lineas" },
        { $match: { "lineas.tipo": "mano_obra" } },
        {
          $group: {
            _id: null,
            horas: { $sum: "$lineas.cantidad" },
            importe: { $sum: { $multiply: ["$lineas.cantidad", "$lineas.precioUnitario"] } },
          },
        },
      ]),
    ]);

    const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const porId = Object.fromEntries(invertidas.map((x) => [String(x._id), x.horas]));
    const porOperario = operarios.map((op) => {
      const horas = redondear(porId[String(op._id)]);
      return {
        operario: op._id,
        nombre: op.nombre,
        especialidad: op.especialidad,
        costeHora: op.costeHora ?? 0,
        horas,
        coste: redondear(horas * (op.costeHora ?? 0)),
      };
    });
    const totalInvertidas = redondear(porOperario.reduce((s, x) => s + x.horas, 0));
    const totalCoste = redondear(porOperario.reduce((s, x) => s + x.coste, 0));
    res.json({
      desde,
      hasta,
      porOperario,
      invertidas: totalInvertidas,
      costeInvertidas: totalCoste,
      facturadas: {
        horas: redondear(facturadas[0]?.horas),
        importe: redondear(facturadas[0]?.importe),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/operarios", async (req, res, next) => {
  try {
    const { nombre } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: "El nombre es obligatorio" });
    const operario = await Operario.create({
      nombre: nombre.trim(),
      especialidad: req.body.especialidad?.trim() || undefined,
      costeHora: Number(req.body.costeHora) || 0,
    });
    res.status(201).json(operario);
  } catch (err) {
    next(err);
  }
});

router.put("/operarios/:id", async (req, res, next) => {
  try {
    const { nombre, especialidad, costeHora, activo } = req.body;
    const operario = await Operario.findByIdAndUpdate(
      req.params.id,
      { nombre: nombre?.trim(), especialidad, costeHora: costeHora !== undefined ? Number(costeHora) : undefined, activo },
      { new: true, omitUndefined: true }
    );
    if (!operario) return res.status(404).json({ error: "Operario no encontrado" });
    res.json(operario);
  } catch (err) {
    next(err);
  }
});

router.delete("/operarios/:id", async (req, res, next) => {
  try {
    const conTiempos = await OrdenTrabajo.countDocuments({ "tiempos.operario": req.params.id });
    if (conTiempos > 0) {
      return res.status(409).json({ error: `Tiene horas registradas en ${conTiempos} orden(es): mejor desactívalo` });
    }
    const operario = await Operario.findByIdAndDelete(req.params.id);
    if (!operario) return res.status(404).json({ error: "Operario no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Registro de horas dentro de una orden de trabajo.
router.post("/ordenes/:id/tiempos", async (req, res, next) => {
  try {
    const orden = await OrdenTrabajo.findById(req.params.id);
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    const operario = await Operario.findById(req.body.operarioId).lean();
    if (!operario) return res.status(400).json({ error: "Elige el operario" });
    const horas = Number(req.body.horas);
    if (!horas || horas <= 0) return res.status(400).json({ error: "Las horas deben ser mayores que 0" });

    orden.tiempos.push({
      operario: operario._id,
      operarioNombre: operario.nombre,
      fecha: req.body.fecha ? new Date(req.body.fecha) : new Date(),
      horas,
      nota: req.body.nota?.trim() || undefined,
    });
    await orden.save();
    res.status(201).json(orden);
  } catch (err) {
    next(err);
  }
});

router.delete("/ordenes/:id/tiempos/:tiempoId", async (req, res, next) => {
  try {
    const orden = await OrdenTrabajo.findByIdAndUpdate(
      req.params.id,
      { $pull: { tiempos: { _id: req.params.tiempoId } } },
      { new: true }
    );
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    res.json(orden);
  } catch (err) {
    next(err);
  }
});

// Planning semanal: OTs vivas colocadas en su fecha prometida (o entrada si
// no tiene) + préstamos de cortesía activos (salida → devolución prevista).
router.get("/planning", async (req, res, next) => {
  try {
    const desde = diaLocal(req.query.desde);
    const hasta = diaLocal(req.query.hasta);
    if (!desde || !hasta) return res.status(400).json({ error: "Faltan desde/hasta" });
    const fin = finDia(hasta);

    const [ordenes, prestamos] = await Promise.all([
      OrdenTrabajo.find({ estado: { $in: ["recepcion", "en_curso", "finalizado"] } })
        .select("numero matricula clienteNombre estado fechaEntrada fechaPrometida trabajos")
        .lean(),
      PrestamoCortesia.find({ estado: { $ne: "devuelto" } })
        .populate("vehiculo", "matricula marca modelo")
        .lean(),
    ]);

    const dentro = (f) => f && f >= desde && f <= fin;
    const ordenesSemana = ordenes
      .map((o) => ({
        ...o,
        dia: o.fechaPrometida ?? o.fechaEntrada,
        porPromesa: Boolean(o.fechaPrometida),
      }))
      .filter((o) => dentro(o.dia));

    const prestamosSemana = prestamos
      .map((p) => ({ ...p, fechaFinEfectiva: p.fechaPrevista ?? fin }))
      .filter((p) => p.fechaSalida <= fin && p.fechaFinEfectiva >= desde);

    res.json({ desde, hasta, ordenes: ordenesSemana, prestamos: prestamosSemana });
  } catch (err) {
    next(err);
  }
});

// ---------- Citas (agenda) ----------
router.get("/citas", async (req, res, next) => {
  try {
    const filtro = { ambito: "taller" };
    const desde = req.query.desde ? diaLocal(req.query.desde) : null;
    const hasta = req.query.hasta ? diaLocal(req.query.hasta) : null;
    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = desde;
      if (hasta) filtro.fecha.$lte = finDia(hasta);
    }
    const lista = await Cita.find(filtro).sort({ fecha: 1, hora: 1 }).limit(500);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/citas", async (req, res, next) => {
  try {
    const { fecha, hora } = req.body;
    if (!fecha || !hora) return res.status(400).json({ error: "Fecha y hora son obligatorias" });
    const dia = diaLocal(fecha);
    if (!dia) return res.status(400).json({ error: "Fecha no válida" });

    let vehiculoId;
    if (req.body.matricula) {
      const v = await Vehiculo.findOne({ matricula: req.body.matricula.toUpperCase().trim() }).lean();
      if (v) vehiculoId = v._id;
    }

    const cita = await Cita.create({
      ambito: "taller",
      fecha: dia,
      hora,
      duracion: req.body.duracion || 60,
      clienteNombre: req.body.clienteNombre || undefined,
      telefono: req.body.telefono || undefined,
      vehiculo: vehiculoId,
      matricula: req.body.matricula?.toUpperCase().trim() || undefined,
      motivo: req.body.motivo || undefined,
      presupuesto: Boolean(req.body.presupuesto),
      notas: req.body.notas || undefined,
    });
    res.status(201).json(cita);
  } catch (err) {
    next(err);
  }
});

router.put("/citas/:id", async (req, res, next) => {
  try {
    const { fecha, hora, duracion, clienteNombre, telefono, matricula, motivo, presupuesto, estado, notas } = req.body;
    if (estado !== undefined && !ESTADOS_CITA.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido. Válidos: ${ESTADOS_CITA.join(", ")}` });
    }
    const cambios = { hora, duracion, clienteNombre, telefono, motivo, estado, notas };
    if (presupuesto !== undefined) cambios.presupuesto = Boolean(presupuesto);
    if (fecha) {
      const dia = diaLocal(fecha);
      if (!dia) return res.status(400).json({ error: "Fecha no válida" });
      cambios.fecha = dia;
    }
    if (matricula !== undefined) {
      cambios.matricula = matricula?.toUpperCase().trim() || undefined;
      if (cambios.matricula) {
        const v = await Vehiculo.findOne({ matricula: cambios.matricula }).lean();
        cambios.vehiculo = v?._id;
      } else {
        cambios.vehiculo = undefined;
      }
    }
    const cita = await Cita.findOneAndUpdate({ _id: req.params.id, ambito: "taller" }, cambios, { new: true, omitUndefined: true });
    if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
    res.json(cita);
  } catch (err) {
    next(err);
  }
});

router.delete("/citas/:id", async (req, res, next) => {
  try {
    const cita = await Cita.findOneAndDelete({ _id: req.params.id, ambito: "taller" });
    if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- Vehículos de cortesía (préstamos) ----------
router.get("/cortesia", async (req, res, next) => {
  try {
    const lista = await PrestamoCortesia.find().sort({ estado: 1, fechaPrevista: 1 }).limit(300).lean();
    const hoy = diaLocal();
    res.json(lista.map((p) => ({
      ...p,
      vencido: p.estado === "activo" && new Date(p.fechaPrevista) < hoy,
    })));
  } catch (err) {
    next(err);
  }
});

router.post("/cortesia", async (req, res, next) => {
  try {
    const { vehiculoId, clienteNombre, fechaPrevista } = req.body;
    if (!vehiculoId) return res.status(400).json({ error: "Elige el vehículo de cortesía" });
    if (!clienteNombre) return res.status(400).json({ error: "El nombre del cliente es obligatorio" });
    const prevista = diaLocal(fechaPrevista);
    if (!prevista) return res.status(400).json({ error: "La fecha prevista de devolución es obligatoria" });

    const vehiculo = await Vehiculo.findById(vehiculoId).lean();
    if (!vehiculo) return res.status(404).json({ error: "Vehículo no encontrado" });
    if (vehiculo.tipo !== "cortesia") {
      return res.status(400).json({ error: `${vehiculo.matricula} no es un vehículo de cortesía` });
    }
    const enUso = await PrestamoCortesia.countDocuments({ vehiculo: vehiculoId, estado: "activo" });
    if (enUso > 0) {
      return res.status(409).json({ error: `${vehiculo.matricula} ya está prestado` });
    }

    const prestamo = await PrestamoCortesia.create({
      vehiculo: vehiculoId,
      matricula: vehiculo.matricula,
      clienteNombre,
      telefono: req.body.telefono || undefined,
      orden: req.body.ordenId || undefined,
      numeroOrden: req.body.numeroOrden || undefined,
      fechaPrevista: prevista,
      kmSalida: req.body.kmSalida ? Number(req.body.kmSalida) : undefined,
      notas: req.body.notas || undefined,
    });
    res.status(201).json(prestamo);
  } catch (err) {
    next(err);
  }
});

router.put("/cortesia/:id", async (req, res, next) => {
  try {
    const { clienteNombre, telefono, fechaPrevista, notas } = req.body;
    const cambios = { clienteNombre, telefono, notas };
    if (fechaPrevista) {
      const prevista = diaLocal(fechaPrevista);
      if (!prevista) return res.status(400).json({ error: "Fecha prevista no válida" });
      cambios.fechaPrevista = prevista;
    }
    const prestamo = await PrestamoCortesia.findByIdAndUpdate(req.params.id, cambios, { new: true, omitUndefined: true });
    if (!prestamo) return res.status(404).json({ error: "Préstamo no encontrado" });
    res.json(prestamo);
  } catch (err) {
    next(err);
  }
});

// Registrar la devolución del vehículo de cortesía.
router.post("/cortesia/:id/devolver", async (req, res, next) => {
  try {
    const prestamo = await PrestamoCortesia.findById(req.params.id);
    if (!prestamo) return res.status(404).json({ error: "Préstamo no encontrado" });
    if (prestamo.estado !== "activo") return res.status(400).json({ error: "Este préstamo ya está devuelto" });

    prestamo.estado = "devuelto";
    prestamo.fechaDevolucion = new Date();
    if (req.body.kmEntrada != null && req.body.kmEntrada !== "") {
      prestamo.kmEntrada = Number(req.body.kmEntrada);
      // Actualiza también los km del vehículo de cortesía.
      await Vehiculo.findByIdAndUpdate(prestamo.vehiculo, { km: prestamo.kmEntrada });
    }
    if (req.body.notas) prestamo.notas = req.body.notas;
    await prestamo.save();
    res.json(prestamo);
  } catch (err) {
    next(err);
  }
});

router.delete("/cortesia/:id", async (req, res, next) => {
  try {
    const prestamo = await PrestamoCortesia.findByIdAndDelete(req.params.id);
    if (!prestamo) return res.status(404).json({ error: "Préstamo no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Resumen para el panel del taller.
router.get("/panel", async (req, res, next) => {
  try {
    const hoy = diaLocal();
    const [vehiculos, abiertas, porEstado, ultimas, citasHoy, cortesiaActivos, cortesiaVencidos] = await Promise.all([
      Vehiculo.countDocuments(),
      OrdenTrabajo.countDocuments({ estado: { $in: ["recepcion", "en_curso"] } }),
      OrdenTrabajo.aggregate([{ $group: { _id: "$estado", n: { $sum: 1 } } }]),
      OrdenTrabajo.find().sort({ createdAt: -1 }).limit(6).lean(),
      Cita.find({ ambito: "taller", fecha: { $gte: hoy, $lte: finDia(hoy) }, estado: { $ne: "cancelada" } }).sort({ hora: 1 }).lean(),
      PrestamoCortesia.countDocuments({ estado: "activo" }),
      PrestamoCortesia.countDocuments({ estado: "activo", fechaPrevista: { $lt: hoy } }),
    ]);
    const estados = Object.fromEntries(porEstado.map((e) => [e._id, e.n]));
    res.json({
      vehiculos,
      ordenesAbiertas: abiertas,
      estados: {
        recepcion: estados.recepcion ?? 0,
        en_curso: estados.en_curso ?? 0,
        finalizado: estados.finalizado ?? 0,
        entregado: estados.entregado ?? 0,
      },
      ultimas,
      citasHoy,
      cortesia: { activos: cortesiaActivos, vencidos: cortesiaVencidos },
    });
  } catch (err) {
    next(err);
  }
});

// ---------- Valoraciones / peritajes ----------
router.get("/valoraciones", async (req, res, next) => {
  try {
    const lista = await Valoracion.find()
      .populate("aseguradora", "nombre")
      .sort({ createdAt: -1 })
      .limit(300);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

// Importa una valoración de siniestro (Audatex, GT Estimate…) con OCR:
// Gemini lee el PDF/imagen y devuelve vehículo, siniestro y secciones con
// operaciones e importes para precargar el formulario.
router.post(
  "/valoraciones/importar-pdf",
  [subidaPdf.single("archivo"), contextoTrasSubida],
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Sube el PDF o la foto de la valoración" });
      const datos = await extraerValoracion(req.file);
      res.json(datos);
    } catch (err) {
      console.error("[taller] OCR de valoración fallido:", err.message);
      res.status(502).json({ error: `No se pudo leer la valoración: ${err.message}` });
    }
  }
);

router.post("/valoraciones", async (req, res, next) => {
  try {
    const { matricula } = req.body;
    if (!matricula) return res.status(400).json({ error: "La matrícula es obligatoria" });

    // Contador PER-000001 (pipeline: funciona aunque el campo no exista aún).
    const empresa = await Empresa.findOneAndUpdate(
      {},
      [{ $set: { "contadores.valoracion": { $add: [{ $ifNull: ["$contadores.valoracion", 0] }, 1] } } }],
      { new: true }
    );
    if (!empresa) return res.status(503).json({ error: "No hay empresa configurada" });
    const numero = `PER-${String(empresa.contadores.valoracion).padStart(6, "0")}`;

    const mat = matricula.toUpperCase().trim();
    const vehiculo = await Vehiculo.findOne({ matricula: mat }).lean();
    const lineas = Array.isArray(req.body.lineas) ? req.body.lineas.filter((l) => l.descripcion) : [];

    // Aseguradora elegida: su nombre rellena el texto "compañía".
    let compania = req.body.compania || undefined;
    let aseguradora = req.body.aseguradora || undefined;
    if (aseguradora) {
      const a = await Aseguradora.findById(aseguradora).lean();
      if (!a) return res.status(404).json({ error: "Aseguradora no encontrada" });
      compania = a.nombre;
    }

    const valoracion = await Valoracion.create({
      numero,
      vehiculo: vehiculo?._id,
      matricula: mat,
      clienteNombre: req.body.clienteNombre || undefined,
      telefono: req.body.telefono || undefined,
      compania,
      aseguradora,
      numeroSiniestro: req.body.numeroSiniestro || undefined,
      fechaSiniestro: req.body.fechaSiniestro ? new Date(req.body.fechaSiniestro) : undefined,
      lineas,
      total: sumarLineasValoracion(lineas),
      observaciones: req.body.observaciones || undefined,
    });
    res.status(201).json(valoracion);
  } catch (err) {
    next(err);
  }
});

router.put("/valoraciones/:id", async (req, res, next) => {
  try {
    const { matricula, clienteNombre, telefono, compania, numeroSiniestro, fechaSiniestro, estado, observaciones } = req.body;
    if (estado !== undefined && !ESTADOS_VALORACION.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido. Válidos: ${ESTADOS_VALORACION.join(", ")}` });
    }
    const cambios = { clienteNombre, telefono, compania, numeroSiniestro, estado, observaciones };
    if (req.body.aseguradora !== undefined) {
      cambios.aseguradora = req.body.aseguradora || null;
      if (cambios.aseguradora) {
        const a = await Aseguradora.findById(cambios.aseguradora).lean();
        if (!a) return res.status(404).json({ error: "Aseguradora no encontrada" });
        cambios.compania = a.nombre;
      }
    }
    if (matricula !== undefined) {
      cambios.matricula = matricula?.toUpperCase().trim() || undefined;
      const v = cambios.matricula ? await Vehiculo.findOne({ matricula: cambios.matricula }).lean() : null;
      cambios.vehiculo = v?._id;
    }
    if (fechaSiniestro !== undefined) {
      cambios.fechaSiniestro = fechaSiniestro ? new Date(fechaSiniestro) : null;
    }
    if (Array.isArray(req.body.lineas)) {
      cambios.lineas = req.body.lineas.filter((l) => l.descripcion);
      cambios.total = sumarLineasValoracion(cambios.lineas);
    }
    const valoracion = await Valoracion.findByIdAndUpdate(req.params.id, cambios, { new: true, omitUndefined: true });
    if (!valoracion) return res.status(404).json({ error: "Valoración no encontrada" });
    res.json(valoracion);
  } catch (err) {
    next(err);
  }
});

// Convierte la valoración en orden de trabajo (una sola vez).
router.post("/valoraciones/:id/crear-orden", async (req, res, next) => {
  try {
    const valoracion = await Valoracion.findById(req.params.id);
    if (!valoracion) return res.status(404).json({ error: "Valoración no encontrada" });
    if (valoracion.orden) {
      return res.status(409).json({ error: `Ya tiene la orden ${valoracion.numeroOrden}` });
    }
    const orden = await crearOrden({
      matricula: valoracion.matricula,
      vehiculo: valoracion.vehiculo,
      clienteNombre: valoracion.clienteNombre,
      telefono: valoracion.telefono,
      trabajos: ["Chapa", "Pintura"],
      motivo: `Siniestro ${valoracion.numeroSiniestro ?? valoracion.numero}` +
        (valoracion.compania ? ` · ${valoracion.compania}` : ""),
      aseguradora: valoracion.aseguradora ?? undefined,
      numeroSiniestro: valoracion.numeroSiniestro ?? undefined,
      facturarA: valoracion.aseguradora ? "aseguradora" : "cliente",
    });
    valoracion.orden = orden._id;
    valoracion.numeroOrden = orden.numero;
    if (valoracion.estado === "pendiente") valoracion.estado = "valorado";
    await valoracion.save();
    res.status(201).json({ valoracion, orden });
  } catch (err) {
    next(err);
  }
});

router.delete("/valoraciones/:id", async (req, res, next) => {
  try {
    const valoracion = await Valoracion.findByIdAndDelete(req.params.id);
    if (!valoracion) return res.status(404).json({ error: "Valoración no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- helpers ----------
function diaLocal(texto) {
  const d = texto ? new Date(`${texto}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function finDia(dia) {
  const fin = new Date(dia);
  fin.setHours(23, 59, 59, 999);
  return fin;
}
function sumarLineasValoracion(lineas) {
  return Math.round(lineas.reduce((s, l) => s + (Number(l.importe) || 0), 0) * 100) / 100;
}
async function crearOrden(datos) {
  // Contador atómico y desacoplado del documento Empresa: evita contención
  // y duplicados bajo alta concurrencia.
  const numero = await tomarNumeroOrdenTrabajoAtomico();

  let vehiculoId = datos.vehiculo;
  if (!vehiculoId && datos.matricula) {
    const v = await Vehiculo.findOne({ matricula: datos.matricula.toUpperCase().trim() }).lean();
    if (v) vehiculoId = v._id;
  }

  const lineas = Array.isArray(datos.lineas) ? datos.lineas.filter((l) => l.descripcion) : [];
  return OrdenTrabajo.create({
    numero,
    vehiculo: vehiculoId,
    matricula: datos.matricula.toUpperCase().trim(),
    cliente: datos.cliente,
    clienteNombre: datos.clienteNombre,
    telefono: datos.telefono,
    trabajos: Array.isArray(datos.trabajos) ? datos.trabajos : [],
    motivo: datos.motivo,
    notasInternas: datos.notasInternas,
    km: datos.km,
    estado: ESTADOS_OT.includes(datos.estado) ? datos.estado : "recepcion",
    fechaEntrada: datos.fechaEntrada ? new Date(datos.fechaEntrada) : undefined,
    fechaEntregaPrevista: datos.fechaEntregaPrevista ? new Date(datos.fechaEntregaPrevista) : undefined,
    lineas,
    total: lineas.length ? calcularTotales(lineas).total : 0,
    aseguradora: datos.aseguradora || undefined,
    numeroSiniestro: datos.numeroSiniestro,
    facturarA: datos.aseguradora && datos.facturarA === "aseguradora" ? "aseguradora" : "cliente",
    presupuesto: datos.presupuesto || undefined,
    presupuestoNumero: datos.presupuestoNumero || undefined,
  });
}

export default router;
