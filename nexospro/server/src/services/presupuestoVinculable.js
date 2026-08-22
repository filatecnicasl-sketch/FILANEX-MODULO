// Vinculación de presupuestos de venta a órdenes (taller y servicio técnico).
// Compartido por routes/taller.js y routes/servicio.js: las mismas reglas en
// ambos módulos — el presupuesto debe estar abierto, libre y ser del cliente.
import Presupuesto from "../models/Presupuesto.js";

// Estados en los que un presupuesto sigue "abierto" para vincularlo.
export const ESTADOS_PTO_ABIERTO = ["borrador", "enviado", "aceptado"];

// Presupuestos abiertos de un cliente que aún no están vinculados a otra
// orden. `ModeloOrden` es OrdenTrabajo u OrdenServicio (ambos tienen el
// campo `presupuesto`).
export function presupuestosAbiertosCliente(ModeloOrden, clienteId, excluirOrdenId) {
  return ModeloOrden.find({
    presupuesto: { $ne: null },
    ...(excluirOrdenId ? { _id: { $ne: excluirOrdenId } } : {}),
  })
    .distinct("presupuesto")
    .then((vinculados) =>
      Presupuesto.find({
        cliente: clienteId,
        estado: { $in: ESTADOS_PTO_ABIERTO },
        _id: { $nin: vinculados },
      })
        .sort({ createdAt: -1 })
        .limit(20)
    );
}

// Comprueba que un presupuesto puede vincularse a una orden: debe estar
// abierto, libre y —si la orden tiene cliente— ser de ese mismo cliente.
export async function validarPresupuestoVinculable(ModeloOrden, id, ordenId, clienteId) {
  const p = await Presupuesto.findById(id);
  if (!p) return { error: "Presupuesto no encontrado", codigo: 404 };
  if (p.estado === "facturado") return { error: "El presupuesto ya está facturado", codigo: 409 };
  if (p.estado === "rechazado") return { error: "El presupuesto está rechazado", codigo: 409 };
  if (clienteId && String(p.cliente) !== String(clienteId)) {
    return { error: `El presupuesto ${p.serieNumero} está a nombre de otro cliente`, codigo: 409 };
  }
  const ocupado = await ModeloOrden.exists({
    presupuesto: p._id,
    ...(ordenId ? { _id: { $ne: ordenId } } : {}),
  });
  if (ocupado) return { error: `El presupuesto ${p.serieNumero} ya está vinculado a otra orden`, codigo: 409 };
  return { presupuesto: p };
}

// Al vincularse a una orden, el presupuesto queda aceptado.
export async function marcarPresupuestoAceptado(p) {
  if (["borrador", "enviado"].includes(p.estado)) {
    p.estado = "aceptado";
    await p.save();
  }
}
