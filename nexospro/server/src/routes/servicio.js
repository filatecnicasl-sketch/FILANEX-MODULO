import { Router } from "express";
import Aparato from "../models/Aparato.js";
import OrdenServicio, { ESTADOS_OS } from "../models/OrdenServicio.js";
import Cita, { ESTADOS_CITA } from "../models/Cita.js";
import Cliente from "../models/Cliente.js";
import Empresa from "../models/Empresa.js";
import FacturaVenta from "../models/FacturaVenta.js";
import Presupuesto from "../models/Presupuesto.js";
import { calcularTotales } from "../services/totales.js";
import { requiereModulo } from "../config/modulos.js";
import { validarNIF, normalizarNIF } from "../services/validacion.js";
import {
  presupuestosAbiertosCliente,
  validarPresupuestoVinculable,
  marcarPresupuestoAceptado,
} from "../services/presupuestoVinculable.js";
import { contextoTrasSubida } from "../middleware/empresa.js";
import { uploadMemoria, borrarSubida } from "../middleware/upload.js";
import { guardarArchivo, urlPublica } from "../services/storage.js";
import { slugActual } from "../models/tenant.js";

const router = Router();

const subidaFotos = uploadMemoria;

router.use(requiereModulo("servicio"));

// ---------- helpers ----------

// Numeración correlativa con contador en la empresa (SAT-000001, AP-000001).
// Lectura + incremento: si el contador no existía (instalaciones previas al
// módulo) arranca en 1.
async function siguienteNumero(clave, prefijo) {
  const empresa = await Empresa.findOne();
  if (!empresa) throw new Error("No hay empresa configurada");
  empresa.contadores = empresa.contadores ?? {};
  const n = empresa.contadores[clave] ?? 1;
  empresa.contadores[clave] = n + 1;
  await empresa.save();
  return `${prefijo}-${String(n).padStart(6, "0")}`;
}

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

// Descripción corta del aparato para listados e impresos.
function describirAparato(a) {
  const partes = [a?.marca, a?.modelo].filter(Boolean).join(" ");
  const sn = a?.numeroSerie ? `S/N ${a.numeroSerie}` : a?.codigo;
  return [partes, sn].filter(Boolean).join(" · ");
}

async function crearOrden(datos) {
  const numero = await siguienteNumero("ordenServicio", "SAT");

  let aparatoId = datos.aparato;
  let descripcion = datos.aparatoDescripcion;
  if (aparatoId && !descripcion) {
    const a = await Aparato.findById(aparatoId).lean();
    descripcion = a ? describirAparato(a) : undefined;
  }

  const lineas = Array.isArray(datos.lineas) ? datos.lineas.filter((l) => l.descripcion) : [];
  return OrdenServicio.create({
    numero,
    aparato: aparatoId,
    aparatoDescripcion: descripcion,
    cliente: datos.cliente,
    clienteNombre: datos.clienteNombre,
    telefono: datos.telefono,
    tipoServicio: datos.tipoServicio === "domicilio" ? "domicilio" : "tienda",
    direccionIntervencion: datos.direccionIntervencion || undefined,
    averia: datos.averia,
    diagnostico: datos.diagnostico,
    notasInternas: datos.notasInternas,
    accesorios: datos.accesorios,
    estadoFisico: datos.estadoFisico,
    garantia: datos.garantia === "en_garantia" ? "en_garantia" : "sin_garantia",
    garantiaHasta: datos.garantiaHasta ? new Date(datos.garantiaHasta) : undefined,
    estado: ESTADOS_OS.includes(datos.estado) ? datos.estado : "recepcion",
    fechaEntrada: datos.fechaEntrada ? new Date(datos.fechaEntrada) : undefined,
    fechaEntregaPrevista: datos.fechaEntregaPrevista ? new Date(datos.fechaEntregaPrevista) : undefined,
    lineas,
    total: lineas.length ? calcularTotales(lineas).total : 0,
    presupuesto: datos.presupuesto || undefined,
    presupuestoNumero: datos.presupuestoNumero || undefined,
  });
}

// Vuelca la recepción de la orden en el historial del aparato: una entrada
// por orden con sus fotos del estado, que se actualiza al subir o quitar fotos.
async function sincronizarHistorialAparato(orden) {
  if (!orden.aparato) return;
  try {
    const entrada = {
      fecha: orden.fechaEntrada ?? orden.createdAt ?? new Date(),
      numeroOrden: orden.numero,
      orden: orden._id,
      motivo: orden.averia || undefined,
      fotos: orden.recepcionDigital?.fotos ?? [],
    };
    const aparato = await Aparato.findById(orden.aparato);
    if (!aparato) return;
    const historial = aparato.historial ?? [];
    const i = historial.findIndex((h) => String(h.orden) === String(orden._id));
    if (i >= 0) {
      const previa = historial[i].toObject?.() ?? historial[i];
      historial[i] = { ...previa, ...entrada };
    } else historial.push(entrada);
    aparato.historial = historial;
    await aparato.save();
  } catch {
    // El historial es un añadido: nunca debe romper la recepción.
  }
}

// ---------- Aparatos ----------
router.get("/aparatos", async (req, res, next) => {
  try {
    const lista = await Aparato.find().sort({ createdAt: -1 }).limit(500);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

// Historial del aparato: recepciones (órdenes) con sus fotos del estado, de
// la más reciente a la más antigua.
router.get("/aparatos/:id/historial", async (req, res, next) => {
  try {
    const aparato = await Aparato.findById(req.params.id).lean();
    if (!aparato) return res.status(404).json({ error: "Aparato no encontrado" });
    const historial = [...(aparato.historial ?? [])].sort(
      (a, b) => new Date(b.fecha ?? 0) - new Date(a.fecha ?? 0)
    );
    res.json(historial);
  } catch (err) {
    next(err);
  }
});

router.post("/aparatos", async (req, res, next) => {
  try {
    const codigo = await siguienteNumero("aparato", "AP");
    const aparato = await Aparato.create({ ...req.body, codigo });
    res.status(201).json(aparato);
  } catch (err) {
    next(err);
  }
});

router.put("/aparatos/:id", async (req, res, next) => {
  try {
    const { tipo, marca, modelo, numeroSerie, cliente, clienteNombre, accesorios, estadoFisico, garantiaHasta, notas } = req.body;
    const aparato = await Aparato.findByIdAndUpdate(
      req.params.id,
      {
        tipo, marca, modelo, numeroSerie, cliente, clienteNombre,
        accesorios, estadoFisico, notas,
        garantiaHasta: garantiaHasta ? new Date(garantiaHasta) : null,
      },
      { new: true, omitUndefined: true }
    );
    if (!aparato) return res.status(404).json({ error: "Aparato no encontrado" });
    res.json(aparato);
  } catch (err) {
    next(err);
  }
});

router.delete("/aparatos/:id", async (req, res, next) => {
  try {
    const enUso = await OrdenServicio.countDocuments({ aparato: req.params.id });
    if (enUso > 0) {
      return res.status(409).json({ error: `No se puede borrar: tiene ${enUso} orden(es) de servicio` });
    }
    const aparato = await Aparato.findByIdAndDelete(req.params.id);
    if (!aparato) return res.status(404).json({ error: "Aparato no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- Órdenes de servicio ----------

// Presupuestos abiertos del cliente, para la recepción rápida y la ficha de
// orden. Incluye las líneas para cargarlas en la orden al vincularlo.
router.get("/presupuestos-abiertos", async (req, res, next) => {
  try {
    if (!req.query.cliente) return res.json([]);
    const lista = await presupuestosAbiertosCliente(OrdenServicio, req.query.cliente, req.query.excluirOrden);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.get("/ordenes", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.abiertas === "1") filtro.estado = { $in: ["recepcion", "en_curso"] };
    const lista = await OrdenServicio.find(filtro)
      .populate("aparato", "tipo marca modelo numeroSerie codigo")
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
    if (!req.body.aparato) return res.status(400).json({ error: "El aparato es obligatorio" });
    let pto = null;
    if (req.body.presupuesto) {
      const { presupuesto, error, codigo } = await validarPresupuestoVinculable(
        OrdenServicio,
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
    await sincronizarHistorialAparato(orden);
    res.status(201).json(orden);
  } catch (err) {
    next(err);
  }
});

router.put("/ordenes/:id", async (req, res, next) => {
  try {
    const { estado, averia, diagnostico, clienteNombre, telefono, fechaEntregaPrevista, lineas } = req.body;
    if (estado !== undefined && !ESTADOS_OS.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido. Válidos: ${ESTADOS_OS.join(", ")}` });
    }
    const cambios = { estado, averia, diagnostico, clienteNombre, telefono, fechaEntregaPrevista };
    if (req.body.notasInternas !== undefined) cambios.notasInternas = req.body.notasInternas || null;
    if (req.body.accesorios !== undefined) cambios.accesorios = req.body.accesorios || null;
    if (req.body.estadoFisico !== undefined) cambios.estadoFisico = req.body.estadoFisico || null;
    if (req.body.garantia !== undefined) {
      if (!["sin_garantia", "en_garantia"].includes(req.body.garantia)) {
        return res.status(400).json({ error: "garantia debe ser sin_garantia o en_garantia" });
      }
      cambios.garantia = req.body.garantia;
    }
    if (req.body.garantiaHasta !== undefined) {
      cambios.garantiaHasta = req.body.garantiaHasta ? new Date(req.body.garantiaHasta) : null;
    }
    if (req.body.fechaEntrada !== undefined) {
      cambios.fechaEntrada = req.body.fechaEntrada ? new Date(req.body.fechaEntrada) : null;
    }
    if (req.body.tipoServicio !== undefined) {
      if (!["tienda", "domicilio"].includes(req.body.tipoServicio)) {
        return res.status(400).json({ error: "tipoServicio debe ser tienda o domicilio" });
      }
      cambios.tipoServicio = req.body.tipoServicio;
    }
    if (req.body.direccionIntervencion !== undefined) {
      cambios.direccionIntervencion = req.body.direccionIntervencion || null;
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
          clienteEfectivo = (await OrdenServicio.findById(req.params.id).lean())?.cliente;
        }
        const { presupuesto: pto, error: errPto, codigo } = await validarPresupuestoVinculable(
          OrdenServicio,
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
    const orden = await OrdenServicio.findByIdAndUpdate(req.params.id, cambios, { new: true, omitUndefined: true });
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    res.json(orden);
  } catch (err) {
    next(err);
  }
});

// Genera la factura de la orden en estado BORRADOR: no lleva número
// definitivo ni registro VeriFactu. La validación/emisión se hace después
// desde Ventas (botón "Validar y emitir"), como cualquier otra factura.
router.post("/ordenes/:id/facturar", async (req, res, next) => {
  try {
    const orden = await OrdenServicio.findById(req.params.id);
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    if (orden.factura) return res.status(409).json({ error: "Esta orden ya tiene factura" });
    if (!["finalizado", "entregado"].includes(orden.estado)) {
      return res.status(409).json({ error: "La orden debe estar finalizada para facturarla" });
    }
    const lineas = (orden.lineas ?? []).filter((l) => l.descripcion);
    if (lineas.length === 0) {
      return res.status(400).json({ error: "La orden no tiene líneas de facturación" });
    }

    // Cliente: el vinculado o alta mínima por nombre (misma filosofía que el OCR).
    let clienteId = orden.cliente;
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
      descripcion: `Orden de servicio ${orden.numero} · ${orden.aparatoDescripcion ?? ""}`.trim(),
      vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      origen: { ordenServicio: orden._id, presupuesto: orden.presupuesto || undefined },
    });

    orden.factura = factura._id;
    orden.total = totales.total;
    await orden.save();

    // El presupuesto que originó la orden queda facturado con la misma factura.
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
    const orden = await OrdenServicio.findByIdAndDelete(req.params.id);
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- Recepción digital: fotos del estado + firma del cliente ----------

// Sube fotos del estado del aparato (móvil/tableta, cámara o galería).
const rutasFotosRecepcion = [subidaFotos.array("fotos", 12), contextoTrasSubida];
router.post("/ordenes/:id/recepcion/fotos", rutasFotosRecepcion, async (req, res, next) => {
  try {
    const orden = await OrdenServicio.findById(req.params.id);
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    if (!req.files?.length) return res.status(400).json({ error: "No llegó ninguna foto" });
    const slug = req.empresa?.slug || "local";
    const rutas = [];
    for (const f of req.files) {
      if (!f.mimetype.startsWith("image/")) continue;
      const ext = f.mimetype === "image/png" ? ".png" : ".jpg";
      const archivo = `os-${orden._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const remoto = `uploads/${slug}/servicio/${archivo}`;
      await guardarArchivo(remoto, f.buffer, f.mimetype);
      rutas.push(urlPublica(remoto));
    }
    orden.recepcionDigital = orden.recepcionDigital ?? {};
    orden.recepcionDigital.fotos = [...(orden.recepcionDigital.fotos ?? []), ...rutas];
    await orden.save();
    await sincronizarHistorialAparato(orden);
    res.status(201).json(orden.recepcionDigital);
  } catch (err) {
    next(err);
  }
});

// Quita una foto de la recepción (body: { ruta }).
router.delete("/ordenes/:id/recepcion/fotos", async (req, res, next) => {
  try {
    const { ruta } = req.body;
    const orden = await OrdenServicio.findById(req.params.id);
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    const fotos = orden.recepcionDigital?.fotos ?? [];
    if (!fotos.includes(ruta)) return res.status(404).json({ error: "Foto no encontrada" });
    orden.recepcionDigital.fotos = fotos.filter((f) => f !== ruta);
    await orden.save();
    await borrarSubida(ruta).catch(() => {});
    await sincronizarHistorialAparato(orden);
    res.json(orden.recepcionDigital);
  } catch (err) {
    next(err);
  }
});

// Firma del cliente en la recepción: nombre + DNI de quien deja el aparato
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
    const orden = await OrdenServicio.findById(req.params.id);
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    const archivo = `os-${orden._id}.png`;
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
 * Recepción exprés: alta del aparato (si no existe) + apertura de la orden
 * en un solo paso, con cliente existente o datos sueltos del cliente.
 * El aparato se localiza por id o por nº de serie; si no existe se crea.
 */
router.post("/recepcion", async (req, res, next) => {
  try {
    const {
      aparatoId, tipo, marca, modelo, numeroSerie, accesorios, estadoFisico, garantiaHasta,
      clienteId, nombreCliente, telefono,
      tipoServicio, direccionIntervencion,
      averia, presupuestoId,
    } = req.body;

    let nombreFinal = nombreCliente || undefined;
    let clienteDoc = null;
    if (clienteId) {
      clienteDoc = await Cliente.findById(clienteId).lean();
      if (!clienteDoc) return res.status(404).json({ error: "Cliente no encontrado" });
      nombreFinal = clienteDoc.nombre;
    }

    // Presupuesto abierto del cliente que se incluye en la orden: se vincula
    // y sus líneas (mano de obra y piezas) se cargan en la orden.
    let pto = null;
    if (presupuestoId) {
      const { presupuesto, error, codigo } = await validarPresupuestoVinculable(OrdenServicio, presupuestoId, null, clienteId);
      if (error) return res.status(codigo).json({ error });
      pto = presupuesto;
    }

    // Aparato: existente (por id o por nº de serie) o alta nueva.
    let aparato = null;
    if (aparatoId) {
      aparato = await Aparato.findById(aparatoId);
      if (!aparato) return res.status(404).json({ error: "Aparato no encontrado" });
      aparato.cliente = clienteId || aparato.cliente;
      aparato.clienteNombre = nombreFinal || aparato.clienteNombre;
      await aparato.save();
    } else {
      const sn = String(numeroSerie ?? "").trim();
      if (sn) aparato = await Aparato.findOne({ numeroSerie: sn });
      if (aparato) {
        aparato.cliente = clienteId || aparato.cliente;
        aparato.clienteNombre = nombreFinal || aparato.clienteNombre;
        if (marca) aparato.marca = marca;
        if (modelo) aparato.modelo = modelo;
        if (tipo) aparato.tipo = tipo;
        await aparato.save();
      } else {
        aparato = await Aparato.create({
          codigo: await siguienteNumero("aparato", "AP"),
          tipo, marca, modelo,
          numeroSerie: sn || undefined,
          cliente: clienteId || undefined,
          clienteNombre: nombreFinal,
          accesorios, estadoFisico,
          garantiaHasta: garantiaHasta ? new Date(garantiaHasta) : undefined,
        });
      }
    }

    // Domicilio: por defecto la dirección fiscal del cliente; editable.
    let direccion = direccionIntervencion;
    if (tipoServicio === "domicilio" && !direccion && clienteDoc?.direccion) {
      const d = clienteDoc.direccion;
      direccion = { calle: d.calle, cp: d.cp, ciudad: d.ciudad, provincia: d.provincia };
    }

    const orden = await crearOrden({
      aparato: aparato._id,
      cliente: clienteId || undefined,
      clienteNombre: nombreFinal,
      telefono,
      tipoServicio,
      direccionIntervencion: direccion,
      averia,
      accesorios: accesorios ?? aparato.accesorios,
      estadoFisico: estadoFisico ?? aparato.estadoFisico,
      garantia: req.body.garantia,
      garantiaHasta: garantiaHasta ?? aparato.garantiaHasta,
      presupuesto: pto?._id,
      presupuestoNumero: pto?.serieNumero,
      lineas: pto ? pto.lineas.map((l) => l.toObject?.() ?? l) : undefined,
    });

    if (pto) await marcarPresupuestoAceptado(pto);

    await sincronizarHistorialAparato(orden);

    res.status(201).json({ aparato, orden });
  } catch (err) {
    next(err);
  }
});

// ---------- Citas del servicio técnico (agenda propia, ámbito "servicio") ----------
router.get("/citas", async (req, res, next) => {
  try {
    const filtro = { ambito: "servicio" };
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

    const cita = await Cita.create({
      ambito: "servicio",
      fecha: dia,
      hora,
      duracion: req.body.duracion || 60,
      cliente: req.body.cliente || undefined,
      clienteNombre: req.body.clienteNombre || undefined,
      telefono: req.body.telefono || undefined,
      aparato: req.body.aparato || undefined,
      aparatoDescripcion: req.body.aparatoDescripcion || undefined,
      direccion: req.body.direccion || undefined,
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
    const { fecha, hora, duracion, clienteNombre, telefono, aparatoDescripcion, direccion, motivo, presupuesto, estado, notas } = req.body;
    if (estado !== undefined && !ESTADOS_CITA.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido. Válidos: ${ESTADOS_CITA.join(", ")}` });
    }
    const cambios = { hora, duracion, clienteNombre, telefono, aparatoDescripcion, direccion, motivo, estado, notas };
    if (req.body.cliente !== undefined) cambios.cliente = req.body.cliente || null;
    if (req.body.aparato !== undefined) cambios.aparato = req.body.aparato || null;
    if (presupuesto !== undefined) cambios.presupuesto = Boolean(presupuesto);
    if (fecha) {
      const dia = diaLocal(fecha);
      if (!dia) return res.status(400).json({ error: "Fecha no válida" });
      cambios.fecha = dia;
    }
    const cita = await Cita.findOneAndUpdate({ _id: req.params.id, ambito: "servicio" }, cambios, { new: true, omitUndefined: true });
    if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
    res.json(cita);
  } catch (err) {
    next(err);
  }
});

router.delete("/citas/:id", async (req, res, next) => {
  try {
    const cita = await Cita.findOneAndDelete({ _id: req.params.id, ambito: "servicio" });
    if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Resumen para el panel del servicio técnico.
router.get("/panel", async (req, res, next) => {
  try {
    const hoy = diaLocal();
    const [aparatos, abiertas, porEstado, ultimas, citasHoy] = await Promise.all([
      Aparato.countDocuments(),
      OrdenServicio.countDocuments({ estado: { $in: ["recepcion", "en_curso"] } }),
      OrdenServicio.aggregate([{ $group: { _id: "$estado", n: { $sum: 1 } } }]),
      OrdenServicio.find().sort({ createdAt: -1 }).limit(6).lean(),
      Cita.find({ ambito: "servicio", fecha: { $gte: hoy, $lte: finDia(hoy) }, estado: { $ne: "cancelada" } }).sort({ hora: 1 }).lean(),
    ]);
    const estados = Object.fromEntries(porEstado.map((e) => [e._id, e.n]));
    res.json({
      aparatos,
      ordenesAbiertas: abiertas,
      estados: {
        recepcion: estados.recepcion ?? 0,
        en_curso: estados.en_curso ?? 0,
        finalizado: estados.finalizado ?? 0,
        entregado: estados.entregado ?? 0,
      },
      ultimas,
      citasHoy,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
