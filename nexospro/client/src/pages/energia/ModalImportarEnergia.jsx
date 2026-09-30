import { useRef, useState } from "react";
import { euros } from "../../components/ui.jsx";
import SelectorContacto from "../../components/SelectorContacto.jsx";

// Importar una factura de luz o gas con IA para dar de alta el suministro.
// Flujo: subir PDF/foto → la IA lee CUPS, titular, comercializadora, tarifa,
// potencia y consumo → el usuario revisa (todo editable) → se crea el
// suministro (y el cliente/comercializadora si hacen falta).
//
// Igual que el OCR de compras: nada se crea sin confirmación del usuario.
export default function ModalImportarEnergia({ clientes, comercializadoras, onGuardado, onCerrar }) {
  const [paso, setPaso] = useState("subir"); // subir | leyendo | revisar
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  // Campos editables tras la lectura.
  const [cups, setCups] = useState("");
  const [tipo, setTipo] = useState("luz");
  const [clienteId, setClienteId] = useState("");
  const [comercializadoraId, setComercializadoraId] = useState(""); // "" | id | "__nueva__"
  const [calle, setCalle] = useState("");
  const [cp, setCp] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [tarifa, setTarifa] = useState("");
  const [potenciaPunta, setPotenciaPunta] = useState("");
  const [potenciaValle, setPotenciaValle] = useState("");
  const [consumoAnual, setConsumoAnual] = useState("");
  const inputRef = useRef(null);

  async function leer(fichero) {
    setPaso("leyendo");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("documento", fichero);
      const r = await fetch("/api/energia/suministros/ocr", { method: "POST", body: fd });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo leer la factura");

      const e = datos.extraccion;
      setCups(e.cups ?? "");
      setTipo(e.tipo ?? "luz");
      setClienteId(datos.clienteSugerido?._id ?? "");
      setComercializadoraId(
        datos.comercializadoraSugerida?._id ?? (e.comercializadora?.nombre ? "__nueva__" : "")
      );
      setCalle(e.direccionSuministro?.calle ?? "");
      setCp(e.direccionSuministro?.cp ?? "");
      setCiudad(e.direccionSuministro?.ciudad ?? "");
      setTarifa(e.tarifa ?? "");
      setPotenciaPunta(e.potenciaPunta ?? "");
      setPotenciaValle(e.potenciaValle ?? "");
      setConsumoAnual(e.consumoAnual ?? "");
      setResultado(datos);
      setPaso("revisar");
    } catch (err) {
      setError(err.message);
      setPaso("subir");
    }
  }

  async function confirmar(ev) {
    ev.preventDefault();
    setOcupado(true);
    setError(null);
    try {
      // 1. ¿Comercializadora nueva? Se crea con el nombre de la factura.
      let comId = comercializadoraId;
      if (comId === "__nueva__") {
        const r = await fetch("/api/energia/comercializadoras", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: resultado.extraccion.comercializadora.nombre }),
        });
        const datos = await r.json();
        if (!r.ok) throw new Error(datos.error || "No se pudo crear la comercializadora");
        comId = datos._id;
      }

      // 2. El suministro.
      const r = await fetch("/api/energia/suministros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cups,
          tipo,
          cliente: clienteId || null,
          comercializadora: comId || null,
          direccion: { calle, cp, ciudad },
          tarifa,
          potenciaPunta,
          potenciaValle,
          consumoAnual,
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo crear el suministro");

      onGuardado?.(datos);
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  const e = resultado?.extraccion;
  const yaExiste = Boolean(resultado?.suministroExistente);
  const nombreComNueva = e?.comercializadora?.nombre ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        className="panel max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Importar factura de luz o gas</h2>
            <p className="text-sm text-slate-500">
              La IA lee el CUPS, el titular, la comercializadora, la tarifa y el consumo; tú revisas y confirmas.
            </p>
          </div>
          <button onClick={onCerrar} className="btn-ghost !px-3 !py-1.5 text-sm">Cerrar</button>
        </div>

        {paso === "subir" && (
          <div className="space-y-4">
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-600/60 px-6 py-12 cursor-pointer hover:border-sky-500/60 hover:bg-sky-500/5 transition-colors"
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={(ev) => {
                ev.preventDefault();
                const f = ev.dataTransfer.files?.[0];
                if (f) leer(f);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f) leer(f);
                }}
              />
              <span className="text-4xl">⚡</span>
              <span className="text-slate-300 font-medium">
                Arrastra aquí la factura o pulsa para elegirla
              </span>
              <span className="text-xs text-slate-500">PDF, foto o captura · luz o gas</span>
            </label>
            {error && <p className="text-sm text-rose-400">{error}</p>}
          </div>
        )}

        {paso === "leyendo" && (
          <div className="flex flex-col items-center gap-3 py-14">
            <div className="h-8 w-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
            <p className="text-slate-300">Leyendo la factura con la IA…</p>
            <p className="text-xs text-slate-500">Suele tardar unos segundos</p>
          </div>
        )}

        {paso === "revisar" && e && (
          <form onSubmit={confirmar} className="space-y-4">
            {(resultado.avisos ?? []).length > 0 && (
              <ul className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-300 space-y-1">
                {resultado.avisos.map((a, i) => (
                  <li key={i}>⚠ {a}</li>
                ))}
              </ul>
            )}

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm text-slate-400 sm:col-span-2">
                CUPS *
                <input
                  value={cups}
                  onChange={(ev) => setCups(ev.target.value.toUpperCase().replace(/[\s-]/g, ""))}
                  className="input num"
                  required
                />
              </label>
              <label className="text-sm text-slate-400">
                Tipo *
                <select value={tipo} onChange={(ev) => setTipo(ev.target.value)} className="input">
                  <option value="luz">Luz</option>
                  <option value="gas">Gas</option>
                </select>
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="text-sm text-slate-400">
                Cliente (titular de la factura)
                {resultado.clienteSugerido && (
                  <p className="text-xs text-emerald-400 mb-1">
                    Detectado: {resultado.clienteSugerido.nombre}
                    {resultado.clienteSugerido.grupo ? ` · grupo ${resultado.clienteSugerido.grupo}` : ""}
                  </p>
                )}
                <SelectorContacto tipo="cliente" contactos={clientes} valor={clienteId} onChange={setClienteId} />
                {!clienteId && e.titular?.nombre && (
                  <p className="text-xs text-slate-500 mt-1">
                    Titular leído: <b>{e.titular.nombre}</b>
                    {e.titular.nif ? ` (${e.titular.nif})` : ""} — si no lo eliges ni lo creas, el suministro
                    quedará sin cliente asignado.
                  </p>
                )}
              </div>
              <label className="text-sm text-slate-400">
                Comercializadora (la que emite la factura)
                <select
                  value={comercializadoraId}
                  onChange={(ev) => setComercializadoraId(ev.target.value)}
                  className="input"
                >
                  <option value="">— Sin asignar —</option>
                  {comercializadoras.map((c) => (
                    <option key={c._id} value={c._id}>{c.nombre}</option>
                  ))}
                  {nombreComNueva && <option value="__nueva__">Crear nueva: «{nombreComNueva}»</option>}
                </select>
              </label>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm text-slate-400 sm:col-span-2">
                Dirección del suministro
                <input value={calle} onChange={(ev) => setCalle(ev.target.value)} className="input" />
              </label>
              <label className="text-sm text-slate-400">
                Código postal
                <input value={cp} onChange={(ev) => setCp(ev.target.value)} className="input" />
              </label>
              <label className="text-sm text-slate-400">
                Ciudad
                <input value={ciudad} onChange={(ev) => setCiudad(ev.target.value)} className="input" />
              </label>
              <label className="text-sm text-slate-400">
                Tarifa / peaje
                <input value={tarifa} onChange={(ev) => setTarifa(ev.target.value)} className="input" />
              </label>
              {tipo === "luz" ? (
                <>
                  <label className="text-sm text-slate-400">
                    Potencia punta (kW)
                    <input
                      value={potenciaPunta}
                      onChange={(ev) => setPotenciaPunta(ev.target.value)}
                      className="input num"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="text-sm text-slate-400">
                    Potencia valle (kW)
                    <input
                      value={potenciaValle}
                      onChange={(ev) => setPotenciaValle(ev.target.value)}
                      className="input num"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="text-sm text-slate-400 sm:col-span-2">
                    Consumo anual (kWh)
                    <input
                      value={consumoAnual}
                      onChange={(ev) => setConsumoAnual(ev.target.value)}
                      className="input num"
                      inputMode="decimal"
                    />
                  </label>
                </>
              ) : (
                <label className="text-sm text-slate-400 sm:col-span-2">
                  Consumo anual (kWh)
                  <input
                    value={consumoAnual}
                    onChange={(ev) => setConsumoAnual(ev.target.value)}
                    className="input num"
                    inputMode="decimal"
                  />
                </label>
              )}
            </div>

            {e.importeTotal != null && (
              <p className="text-xs text-slate-500">
                La factura leída es de <b className="num">{euros(e.importeTotal)}</b>
                {e.consumoPeriodo ? ` con ${Number(e.consumoPeriodo).toLocaleString("es-ES")} kWh` : ""}
                {e.diasPeriodo ? ` en ${e.diasPeriodo} días` : ""}. El histórico de consumos se
                registrará en una próxima fase.
              </p>
            )}

            {yaExiste && (
              <p className="text-sm text-amber-300">
                Este CUPS ya está dado de alta en la cartera. Corrige el CUPS si la lectura no es
                exacta, o cierra y edita el suministro existente desde el listado.
              </p>
            )}

            {error && <p className="text-sm text-rose-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setPaso("subir")} className="btn-ghost">
                Otra factura
              </button>
              <button type="submit" disabled={ocupado || yaExiste || !cups} className="btn-primary">
                {ocupado ? "Creando…" : "Crear suministro"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
