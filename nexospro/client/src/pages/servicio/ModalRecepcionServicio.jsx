import { useRef, useState } from "react";
import { SignatureField } from "../../editor/SignatureField.jsx";
import { imprimirHojaEntradaServicio } from "../../components/MenuImprimirOrdenServicio.jsx";

const campo = "input w-full";

// Dato del resumen de la orden: etiqueta pequeña y valor (o "—" si falta).
function Dato({ etiqueta, valor, ancho = false }) {
  return (
    <div className={ancho ? "sm:col-span-2" : ""}>
      <dt className="text-[0.65625rem] font-semibold uppercase tracking-wider text-slate-500">{etiqueta}</dt>
      <dd className="text-sm text-slate-200">{valor || "—"}</dd>
    </div>
  );
}

// Recepción digital de la orden de servicio: fotos del estado del aparato y
// firma del cliente (nombre + DNI) en tableta/móvil. Sustituye al resguardo
// en papel. Con `recienCreada` se muestra el banner de alta y la opción de
// imprimir la hoja de entrada al terminar (flujo de la Recepción rápida).
export default function ModalRecepcionServicio({ orden, recienCreada = false, onCerrar, onGuardada }) {
  const [fotos, setFotos] = useState(orden.recepcionDigital?.fotos ?? []);
  const [firma, setFirma] = useState(orden.recepcionDigital?.firma ?? null);
  const [refirmando, setRefirmando] = useState(false);
  const [nombre, setNombre] = useState(orden.recepcionDigital?.firma?.nombre ?? orden.clienteNombre ?? "");
  const [dni, setDni] = useState(orden.recepcionDigital?.firma?.dni ?? "");
  const [trazo, setTrazo] = useState(null); // dataURL del lienzo
  const [lienzoKey, setLienzoKey] = useState(0); // remontar para limpiar
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const inputFotos = useRef(null);

  // Cada respuesta del servidor trae la recepción digital completa: fotos y
  // firma de la orden se recargan con ella.
  function aplicarRecepcion(rd) {
    setFotos(rd?.fotos ?? []);
    if (rd?.firma) setFirma(rd.firma);
  }

  async function subirFotos(e) {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!archivos.length) return;
    setSubiendo(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const a of archivos) fd.append("fotos", a);
      const r = await fetch(`/api/servicio/ordenes/${orden._id}/recepcion/fotos`, { method: "POST", body: fd });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudieron subir las fotos");
      aplicarRecepcion(datos);
      onGuardada?.();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function quitarFoto(ruta) {
    const r = await fetch(`/api/servicio/ordenes/${orden._id}/recepcion/fotos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruta }),
    });
    if (r.ok) {
      aplicarRecepcion(await r.json());
      onGuardada?.();
    }
  }

  async function guardarFirma() {
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(`/api/servicio/ordenes/${orden._id}/recepcion/firma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), dni: dni.trim(), imagen: trazo }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo guardar la firma");
      setFirma(datos);
      setRefirmando(false);
      setTrazo(null);
      onGuardada?.();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setGuardando(false);
    }
  }

  // Al terminar se puede imprimir la hoja de entrada (2 copias: prestador y
  // cliente) con las fotos y la firma ya subidas.
  function finalizar(imprimir) {
    if (imprimir) {
      imprimirHojaEntradaServicio({
        ...orden,
        recepcionDigital: { ...(orden.recepcionDigital ?? {}), fotos, firma },
      });
    }
    onGuardada?.();
  }

  const mostrandoLienzo = !firma || refirmando;

  const textoGarantia =
    orden.garantia === "en_garantia"
      ? `En garantía${orden.garantiaHasta ? ` hasta ${new Date(orden.garantiaHasta).toLocaleDateString("es-ES")}` : ""}`
      : "Sin garantía";
  const dir = orden.direccionIntervencion ?? {};
  const direccionTexto = [dir.calle, dir.cp, dir.ciudad, dir.provincia].filter(Boolean).join(", ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        className="modal-panel w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Recepción digital · {orden.numero}</h2>
            <p className="text-sm text-slate-400">
              {[orden.aparatoDescripcion, orden.clienteNombre ?? "sin cliente"].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button onClick={onCerrar} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {recienCreada && (
          <p className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            <span className="font-semibold">Orden {orden.numero} creada{orden.aparatoDescripcion ? ` para ${orden.aparatoDescripcion}` : ""}.</span>{" "}
            Añade las fotos del estado y la firma del cliente; las fotos quedan en el historial del aparato.
          </p>
        )}

        <div className="space-y-5">
          <section className="rounded-lg border border-white/10 bg-white/5 p-3.5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <Dato etiqueta="Orden" valor={orden.numero} />
              <Dato etiqueta="Aparato" valor={orden.aparatoDescripcion} />
              <Dato etiqueta="Cliente" valor={orden.clienteNombre} />
              <Dato etiqueta="Garantía" valor={textoGarantia} />
              <Dato etiqueta="Avería" valor={orden.averia} ancho />
              <Dato etiqueta="Accesorios" valor={orden.accesorios} />
              <Dato etiqueta="Estado físico" valor={orden.estadoFisico} />
              {orden.tipoServicio === "domicilio" && (
                <Dato etiqueta="Dirección de la intervención" valor={direccionTexto} ancho />
              )}
            </dl>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Fotos del estado del aparato
              </h3>
              <button
                type="button"
                onClick={() => inputFotos.current?.click()}
                disabled={subiendo}
                className="btn-primary !py-1.5 !px-3 text-xs disabled:opacity-50"
              >
                {subiendo ? "Subiendo…" : "+ Añadir fotos"}
              </button>
              <input
                ref={inputFotos}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={subirFotos}
              />
            </div>
            {fotos.length === 0 ? (
              <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-300 p-4 text-center">
                Sin fotos todavía. Desde el móvil se abre la cámara directamente.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {fotos.map((f) => (
                  <div key={f} className="relative group">
                    <img src={f} alt="estado" className="w-full h-24 object-cover rounded-lg border border-slate-200" />
                    <button
                      type="button"
                      onClick={() => quitarFoto(f)}
                      title="Quitar foto"
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Firma del cliente
            </h3>
            {firma && !refirmando ? (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Firmado por {firma.nombre}</p>
                    <p className="text-xs text-emerald-700">
                      DNI {firma.dni} · {new Date(firma.fecha).toLocaleString("es-ES")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRefirmando(true)}
                    className="text-xs text-slate-500 hover:text-white underline underline-offset-2"
                  >
                    Volver a firmar
                  </button>
                </div>
                <img
                  src={firma.imagen}
                  alt="Firma del cliente"
                  className="mt-2 h-20 rounded border border-emerald-200 bg-white"
                />
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    placeholder="Nombre de quien firma *"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className={campo}
                  />
                  <input
                    placeholder="DNI / NIE *"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.toUpperCase())}
                    className={`${campo} uppercase`}
                  />
                </div>
                <div className="rounded-lg border border-slate-300 bg-white overflow-hidden" style={{ height: 160 }}>
                  <SignatureField
                    key={lienzoKey}
                    value={null}
                    onChange={setTrazo}
                    widthPx={Math.min(520, Math.max(260, window.innerWidth - 130))}
                    heightPx={160}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setLienzoKey((k) => k + 1); setTrazo(null); }}
                    className="text-xs text-slate-500 hover:text-white"
                  >
                    Limpiar
                  </button>
                  <span className="flex-1" />
                  {refirmando && (
                    <button type="button" onClick={() => setRefirmando(false)} className="btn-ghost !py-1.5 text-xs">
                      Cancelar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={guardarFirma}
                    disabled={guardando || !trazo || !nombre.trim() || !dni.trim()}
                    className="btn-primary !py-1.5 !px-3.5 text-xs disabled:opacity-50"
                  >
                    {guardando ? "Guardando…" : "Guardar firma"}
                  </button>
                </div>
              </div>
            )}
          </section>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          {recienCreada ? (
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => finalizar(false)} className="btn-ghost">
                Finalizar sin imprimir
              </button>
              <button type="button" onClick={() => finalizar(true)} className="btn-primary">
                Imprimir hoja y finalizar
              </button>
            </div>
          ) : (
            <div className="flex justify-end pt-1">
              <button type="button" onClick={onCerrar} className="btn-ghost">Cerrar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
