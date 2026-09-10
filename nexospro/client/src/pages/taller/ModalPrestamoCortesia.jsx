import { useEffect, useState } from "react";
import BuscadorEntidad from "../../components/BuscadorEntidad.jsx";
import { aFechaInput } from "./datos.js";

const campo = "input w-full";

// Modal de préstamo de vehículo de cortesía. Se abre desde Taller → Cortesía
// o desde una cita (con `inicial` se precargan cliente, teléfono y fecha).
// El vehículo se busca por matrícula y el cliente se busca en la cartera o
// se escribe a mano (cliente nuevo).
// Si se pasa `prestamo`, el modal entra en modo edición y actualiza con PUT.
export default function ModalPrestamoCortesia({ inicial, prestamo, onCerrar, onCreado }) {
  const modoEdicion = Boolean(prestamo);

  function prestamoAForm(p) {
    return {
      vehiculoId: p?.vehiculo?._id ?? p?.vehiculo ?? "",
      clienteNombre: p?.clienteNombre ?? inicial?.clienteNombre ?? "",
      clienteNIF: p?.clienteNIF ?? "",
      clienteDireccion: p?.clienteDireccion ?? "",
      clienteFechaNacimiento: p?.clienteFechaNacimiento ? aFechaInput(new Date(p.clienteFechaNacimiento)) : "",
      clienteLugarNacimiento: p?.clienteLugarNacimiento ?? "",
      telefono: p?.telefono ?? inicial?.telefono ?? "",
      telefonoTrabajo: p?.telefonoTrabajo ?? "",
      permisoConducirNumero: p?.permisoConducirNumero ?? "",
      permisoConducirExpedicion: p?.permisoConducirExpedicion ? aFechaInput(new Date(p.permisoConducirExpedicion)) : "",
      permisoConducirLugar: p?.permisoConducirLugar ?? "",
      otroConductor: p?.otroConductor ?? "",
      ordenId: p?.orden?._id ?? p?.orden ?? "",
      vehiculoReparacionMatricula: p?.vehiculoReparacionMatricula ?? "",
      vehiculoReparacionMarcaModelo: p?.vehiculoReparacionMarcaModelo ?? "",
      vehiculoReparacionVIN: p?.vehiculoReparacionVIN ?? "",
      fechaPrevista: p?.fechaPrevista ? aFechaInput(new Date(p.fechaPrevista)) : (inicial?.fechaPrevista ?? ""),
      kmSalida: p?.kmSalida ?? "",
      combustibleSalida: p?.combustibleSalida ?? "",
      vinCortesia: p?.vinCortesia ?? "",
      aseguradora: p?.aseguradora ?? "",
      numeroContratoSeguro: p?.numeroContratoSeguro ?? "",
      franquiciaTerceros: p?.franquiciaTerceros ?? "",
      franquiciaVehiculo: p?.franquiciaVehiculo ?? "",
      franquiciaRobo: p?.franquiciaRobo ?? "",
      rescateFranquicia: p?.rescateFranquicia ?? false,
      transferenciaSeguro: p?.transferenciaSeguro ?? false,
      rescatePorDia: p?.rescatePorDia ?? "",
      participacionForfaitDiaria: p?.participacionForfaitDiaria ?? "",
      kmMaximoDia: p?.kmMaximoDia ?? "",
      kmMaximoTotal: p?.kmMaximoTotal ?? "",
      importeExcesoKm: p?.importeExcesoKm ?? "",
      notas: p?.notas ?? "",
    };
  }

  const [cortesia, setCortesia] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [form, setForm] = useState(prestamoAForm(prestamo));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Vehículos de cortesía libres (sin préstamo activo ahora mismo).
    // En edición se incluye también el vehículo actual del préstamo.
    Promise.all([
      fetch("/api/taller/vehiculos").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/taller/cortesia").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([vehiculos, prestamos]) => {
        const ocupados = new Set(prestamos.filter((p) => p.estado === "activo").map((p) => String(p.vehiculo)));
        const vehiculosLibres = vehiculos.filter((v) => v.tipo === "cortesia" && !ocupados.has(String(v._id)));
        if (modoEdicion && prestamo?.vehiculo) {
          const actual = vehiculos.find((v) => String(v._id) === String(prestamo.vehiculo._id ?? prestamo.vehiculo));
          if (actual && !vehiculosLibres.some((v) => String(v._id) === String(actual._id))) {
            vehiculosLibres.push(actual);
          }
        }
        setCortesia(vehiculosLibres);
      })
      .catch(() => setCortesia([]));
    fetch("/api/clientes")
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
      .catch(() => setClientes([]));
    fetch("/api/taller/ordenes?abiertas=1")
      .then((r) => (r.ok ? r.json() : []))
      .then(setOrdenes)
      .catch(() => setOrdenes([]));
  }, [modoEdicion, prestamo?.vehiculo]);

  // Opciones del buscador: matrícula como nombre (se busca por ella) y
  // marca/modelo como dato secundario.
  const opcionesVehiculos = cortesia.map((v) => ({
    _id: v._id,
    nombre: v.matricula,
    secundario: [v.marca, v.modelo].filter(Boolean).join(" ") || undefined,
  }));

  function actualizar(nombre, valor) {
    setForm((f) => ({ ...f, [nombre]: valor }));
  }

  function elegirVehiculo(op) {
    const v = cortesia.find((x) => String(x._id) === String(op?._id));
    setForm((f) => ({ ...f, vehiculoId: op?._id ?? "", kmSalida: v?.km ?? f.kmSalida }));
  }

  function elegirOrden(id) {
    const o = ordenes.find((x) => x._id === id);
    setForm((f) => ({
      ...f,
      ordenId: id,
      clienteNombre: f.clienteNombre || o?.clienteNombre || "",
      clienteNIF: f.clienteNIF || o?.cliente?.nif || "",
      telefono: f.telefono || o?.telefono || "",
      vehiculoReparacionMatricula: f.vehiculoReparacionMatricula || o?.matricula || "",
      vehiculoReparacionMarcaModelo:
        f.vehiculoReparacionMarcaModelo
        || [o?.vehiculo?.marca, o?.vehiculo?.modelo].filter(Boolean).join(" ")
        || "",
    }));
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const orden = ordenes.find((o) => o._id === form.ordenId);
      const payload = {
        clienteNombre: form.clienteNombre,
        clienteNIF: form.clienteNIF || undefined,
        clienteDireccion: form.clienteDireccion || undefined,
        clienteFechaNacimiento: form.clienteFechaNacimiento || undefined,
        clienteLugarNacimiento: form.clienteLugarNacimiento || undefined,
        telefono: form.telefono || undefined,
        telefonoTrabajo: form.telefonoTrabajo || undefined,
        permisoConducirNumero: form.permisoConducirNumero || undefined,
        permisoConducirExpedicion: form.permisoConducirExpedicion || undefined,
        permisoConducirLugar: form.permisoConducirLugar || undefined,
        otroConductor: form.otroConductor || undefined,
        vehiculoReparacionMatricula: form.vehiculoReparacionMatricula || undefined,
        vehiculoReparacionMarcaModelo: form.vehiculoReparacionMarcaModelo || undefined,
        vehiculoReparacionVIN: form.vehiculoReparacionVIN || undefined,
        fechaPrevista: form.fechaPrevista,
        kmSalida: form.kmSalida || undefined,
        combustibleSalida: form.combustibleSalida || undefined,
        vinCortesia: form.vinCortesia || undefined,
        aseguradora: form.aseguradora || undefined,
        numeroContratoSeguro: form.numeroContratoSeguro || undefined,
        franquiciaTerceros: form.franquiciaTerceros || undefined,
        franquiciaVehiculo: form.franquiciaVehiculo || undefined,
        franquiciaRobo: form.franquiciaRobo || undefined,
        rescateFranquicia: form.rescateFranquicia || undefined,
        transferenciaSeguro: form.transferenciaSeguro || undefined,
        rescatePorDia: form.rescatePorDia || undefined,
        participacionForfaitDiaria: form.participacionForfaitDiaria || undefined,
        kmMaximoDia: form.kmMaximoDia || undefined,
        kmMaximoTotal: form.kmMaximoTotal || undefined,
        importeExcesoKm: form.importeExcesoKm || undefined,
        notas: form.notas || undefined,
      };

      let r;
      if (modoEdicion) {
        r = await fetch(`/api/taller/cortesia/${prestamo._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        r = await fetch("/api/taller/cortesia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            vehiculoId: form.vehiculoId,
            ordenId: form.ordenId || undefined,
            numeroOrden: orden?.numero,
            citaId: inicial?.citaId || undefined,
          }),
        });
      }
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || (modoEdicion ? "No se pudo actualizar el préstamo" : "No se pudo crear el préstamo"));
      onCreado();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">{modoEdicion ? "Editar préstamo de cortesía" : "Nuevo préstamo de cortesía"}</h2>
        <form onSubmit={guardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Vehículo de cortesía</label>
              {modoEdicion ? (
                <input
                  className={campo}
                  value={form.vehiculoId ? cortesia.find((v) => String(v._id) === String(form.vehiculoId))?.matricula || "" : ""}
                  readOnly
                  placeholder="Matrícula del vehículo"
                />
              ) : (
                <>
                  <BuscadorEntidad
                    opciones={opcionesVehiculos}
                    valorId={form.vehiculoId}
                    onElegir={elegirVehiculo}
                    placeholder="Buscar por matrícula…"
                    required
                  />
                  {cortesia.length === 0 && (
                    <p className="text-xs text-amber-300 mt-1">
                      No hay vehículos de cortesía libres. Márcalos como «Cortesía» en Vehículos.
                    </p>
                  )}
                </>
              )}
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Orden vinculada</label>
              <select className={campo} value={form.ordenId} onChange={(e) => elegirOrden(e.target.value)} disabled={modoEdicion}>
                <option value="">— Ninguna —</option>
                {ordenes.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.numero} · {o.matricula}{o.clienteNombre ? ` · ${o.clienteNombre}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 pt-1">Usuario / conductor</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Cliente *</label>
              <BuscadorEntidad
                opciones={clientes}
                valorTexto={form.clienteNombre}
                onTexto={(t) => actualizar("clienteNombre", t)}
                onElegir={(op) =>
                  op
                    && setForm((f) => ({
                      ...f,
                      clienteNombre: op.nombre,
                      clienteNIF: f.clienteNIF || op.nif || "",
                      telefono: f.telefono || op.telefono || "",
                      clienteDireccion: f.clienteDireccion
                        || [op.direccion?.calle, op.direccion?.ciudad, op.direccion?.cp].filter(Boolean).join(", ")
                        || "",
                    }))
                }
                placeholder="Buscar en la cartera o escribir…"
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">DNI/NIF</label>
              <input className={campo} value={form.clienteNIF} onChange={(e) => actualizar("clienteNIF", e.target.value)} placeholder="12345678A / B12345678" />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-slate-400 block mb-1">Dirección</label>
              <input className={campo} value={form.clienteDireccion} onChange={(e) => actualizar("clienteDireccion", e.target.value)} placeholder="Calle, ciudad, CP…" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Fecha de nacimiento</label>
              <input type="date" className={campo} value={form.clienteFechaNacimiento} onChange={(e) => actualizar("clienteFechaNacimiento", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Lugar de nacimiento</label>
              <input className={campo} value={form.clienteLugarNacimiento} onChange={(e) => actualizar("clienteLugarNacimiento", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Móvil / particular</label>
              <input className={campo} value={form.telefono} onChange={(e) => actualizar("telefono", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Teléfono trabajo</label>
              <input className={campo} value={form.telefonoTrabajo} onChange={(e) => actualizar("telefonoTrabajo", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Permiso de conducir nº</label>
              <input className={campo} value={form.permisoConducirNumero} onChange={(e) => actualizar("permisoConducirNumero", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Expedido en / fecha</label>
              <div className="flex gap-2">
                <input type="date" className={campo} value={form.permisoConducirExpedicion} onChange={(e) => actualizar("permisoConducirExpedicion", e.target.value)} />
                <input className={campo} value={form.permisoConducirLugar} onChange={(e) => actualizar("permisoConducirLugar", e.target.value)} placeholder="Lugar" />
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-sm text-slate-400 block mb-1">Otros conductores admitidos</label>
              <input className={campo} value={form.otroConductor} onChange={(e) => actualizar("otroConductor", e.target.value)} placeholder="Nombre y permiso de otros conductores…" />
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 pt-1">Vehículo de cortesía</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Marca</label>
              <input className={campo} value={form.vehiculoId ? cortesia.find((v) => String(v._id) === String(form.vehiculoId))?.marca || "" : ""} readOnly placeholder="Se rellena al elegir vehículo" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Modelo</label>
              <input className={campo} value={form.vehiculoId ? cortesia.find((v) => String(v._id) === String(form.vehiculoId))?.modelo || "" : ""} readOnly placeholder="Se rellena al elegir vehículo" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Matrícula</label>
              <input className={campo} value={form.vehiculoId ? cortesia.find((v) => String(v._id) === String(form.vehiculoId))?.matricula || "" : ""} readOnly placeholder="Se rellena al elegir vehículo" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">V.I.N.</label>
              <input className={campo} value={form.vinCortesia} onChange={(e) => actualizar("vinCortesia", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Participación forfait diaria (€)</label>
              <input type="number" min="0" step="0.01" className={campo} value={form.participacionForfaitDiaria} onChange={(e) => actualizar("participacionForfaitDiaria", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Devolución prevista *</label>
              <input type="date" className={campo} value={form.fechaPrevista} onChange={(e) => actualizar("fechaPrevista", e.target.value)} min={aFechaInput(new Date())} required />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">KM salida</label>
              <input type="number" min="0" className={campo} value={form.kmSalida} onChange={(e) => actualizar("kmSalida", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Combustible salida (0/8 a 8/8)</label>
              <input type="range" min="0" max="8" step="1" className="w-full" value={form.combustibleSalida || 0} onChange={(e) => actualizar("combustibleSalida", e.target.value)} />
              <div className="text-xs text-slate-400 text-center">{form.combustibleSalida || 0}/8</div>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 pt-1">Seguro del vehículo de cortesía</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Asegurador</label>
              <input className={campo} value={form.aseguradora} onChange={(e) => actualizar("aseguradora", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Nº de contrato</label>
              <input className={campo} value={form.numeroContratoSeguro} onChange={(e) => actualizar("numeroContratoSeguro", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Franquicia daños a terceros (€)</label>
              <input type="number" min="0" step="0.01" className={campo} value={form.franquiciaTerceros} onChange={(e) => actualizar("franquiciaTerceros", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Franquicia daños al vehículo (€)</label>
              <input type="number" min="0" step="0.01" className={campo} value={form.franquiciaVehiculo} onChange={(e) => actualizar("franquiciaVehiculo", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Franquicia robo/vandalismo (€)</label>
              <input type="number" min="0" step="0.01" className={campo} value={form.franquiciaRobo} onChange={(e) => actualizar("franquiciaRobo", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Rescate por día (€)</label>
              <input type="number" min="0" step="0.01" className={campo} value={form.rescatePorDia} onChange={(e) => actualizar("rescatePorDia", e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.rescateFranquicia} onChange={(e) => actualizar("rescateFranquicia", e.target.checked)} /> Rescate de franquicias
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.transferenciaSeguro} onChange={(e) => actualizar("transferenciaSeguro", e.target.checked)} /> Transferencia de seguro
              </label>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 pt-1">Vehículo en reparación</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Matrícula</label>
              <input className={campo} value={form.vehiculoReparacionMatricula} onChange={(e) => actualizar("vehiculoReparacionMatricula", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Modelo</label>
              <input className={campo} value={form.vehiculoReparacionMarcaModelo} onChange={(e) => actualizar("vehiculoReparacionMarcaModelo", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">V.I.N.</label>
              <input className={campo} value={form.vehiculoReparacionVIN} onChange={(e) => actualizar("vehiculoReparacionVIN", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Nº O.R.</label>
              <input className={campo} value={form.numeroOrden || ""} readOnly placeholder="Se rellena desde la orden" />
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-1">Observaciones / daños preexistentes</label>
            <input
              className={campo}
              value={form.notas}
              onChange={(e) => actualizar("notas", e.target.value)}
              placeholder="Depósito, rayones, golpes…"
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCerrar} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={guardando || (!modoEdicion && cortesia.length === 0)} className="btn-primary disabled:opacity-50">
              {guardando ? "Guardando…" : (modoEdicion ? "Guardar cambios" : "Prestar")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
