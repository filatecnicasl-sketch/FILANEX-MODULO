import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { euros } from "../../components/ui.jsx";

// Denominaciones de euros para el conteo del cajón en el arqueo.
const BILLETES = [500, 200, 100, 50, 20, 10, 5];
const MONEDAS = [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
const etiquetaDen = (d) => (d >= 1 ? `${d} €` : `${Math.round(d * 100)} ct`);

export default function TpvCajaPage() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState(null);
  const [sesiones, setSesiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [conteo, setConteo] = useState("");
  const [notas, setNotas] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [fondo, setFondo] = useState("100");
  const [abriendo, setAbriendo] = useState(false);
  const [movTipo, setMovTipo] = useState("entrada");
  const [movImporte, setMovImporte] = useState("");
  const [movConcepto, setMovConcepto] = useState("");
  const [guardandoMov, setGuardandoMov] = useState(false);
  // Conteo por denominaciones: { [denominacion]: unidades }
  const [desglose, setDesglose] = useState({});
  const [modoConteo, setModoConteo] = useState("directo"); // directo | desglose

  const totalDesglose = [...BILLETES, ...MONEDAS].reduce(
    (s, d) => s + d * (Number(desglose[d]) || 0),
    0
  );

  function cambiarDen(den, uds) {
    const n = Math.max(0, Math.floor(Number(uds) || 0));
    const nuevo = { ...desglose, [den]: n };
    setDesglose(nuevo);
    const total = [...BILLETES, ...MONEDAS].reduce((s, d) => s + d * (Number(nuevo[d]) || 0), 0);
    setConteo(total > 0 ? String(Math.round(total * 100) / 100) : "");
  }

  async function registrarMovimiento() {
    setGuardandoMov(true);
    setError(null);
    try {
      const r = await fetch("/api/tpv/caja/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: movTipo, importe: Number(movImporte) || 0, concepto: movConcepto }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo registrar");
      setMovImporte("");
      setMovConcepto("");
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardandoMov(false);
    }
  }

  const cargar = useCallback(async () => {
    try {
      const [rEstado, rSesiones] = await Promise.all([
        fetch("/api/tpv/estado"),
        fetch("/api/tpv/caja/sesiones"),
      ]);
      const datosEstado = await rEstado.json();
      const datosSesiones = await rSesiones.json();
      if (!rEstado.ok) throw new Error(datosEstado.error || "Error al cargar estado");
      if (!rSesiones.ok) throw new Error(datosSesiones.error || "Error al cargar sesiones");
      setEstado(datosEstado);
      setSesiones(datosSesiones);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function abrirCaja() {
    setAbriendo(true);
    setError(null);
    try {
      const r = await fetch("/api/tpv/caja/abrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fondo: Number(fondo) || 0 }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo abrir caja");
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setAbriendo(false);
    }
  }

  async function cerrarCaja() {
    setCerrando(true);
    setError(null);
    try {
      const desgloseLimpio = Object.fromEntries(
        Object.entries(desglose).filter(([, uds]) => Number(uds) > 0)
      );
      const r = await fetch("/api/tpv/caja/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conteoEfectivo: Number(conteo) || 0,
          notas,
          ...(Object.keys(desgloseLimpio).length ? { desgloseConteo: desgloseLimpio } : {}),
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo cerrar caja");
      setConteo("");
      setNotas("");
      setDesglose({});
      await cargar();
      // Imprime automáticamente el cierre Z recién hecho
      const rSes = await fetch("/api/tpv/caja/sesiones");
      const lista = await rSes.json();
      if (rSes.ok && lista?.[0]?._id) {
        window.open(`/api/tpv/caja/sesiones/${lista[0]._id}/imprimir`, "_blank", "width=400,height=640");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCerrando(false);
    }
  }

  function imprimirCierre(s) {
    window.open(`/api/tpv/caja/sesiones/${s._id}/imprimir`, "_blank", "width=400,height=640");
  }

  const abierta = estado?.caja;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <CabeceraPagina
        titulo="Caja TPV"
        subtitulo="Apertura, arqueo y cierre de sesiones"
        acciones={
          <button
            onClick={() => navigate("/tpv")}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
          >
            Volver al terminal
          </button>
        }
      />

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {cargando ? (
        <p className="text-slate-400">Cargando…</p>
      ) : (
        <div className="space-y-6">
          {/* Sesión actual */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
            <h2 className="text-lg font-bold mb-4">Sesión actual</h2>
            {abierta ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-800 rounded-xl p-4">
                    <p className="text-sm text-slate-400">Fondo</p>
                    <p className="text-2xl font-bold">{euros(abierta.apertura?.fondo)}</p>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-4">
                    <p className="text-sm text-slate-400">Apertura</p>
                    <p className="text-lg font-semibold">
                      {new Date(abierta.apertura?.fecha).toLocaleString("es-ES")}
                    </p>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-4">
                    <p className="text-sm text-slate-400">Ventas efectivo</p>
                    <p className={`text-2xl font-bold ${(estado?.totalesSesion?.efectivo ?? 0) < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {euros(estado?.totalesSesion?.efectivo)}
                    </p>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-4">
                    <p className="text-sm text-slate-400">Ventas tarjeta</p>
                    <p className={`text-2xl font-bold ${(estado?.totalesSesion?.tarjeta ?? 0) < 0 ? "text-rose-400" : "text-sky-400"}`}>
                      {euros(estado?.totalesSesion?.tarjeta)}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-400">
                  {estado?.totalesSesion?.numTickets ?? 0} tickets
                  {(estado?.totalesSesion?.numDevoluciones ?? 0) > 0 && (
                    <span className="text-rose-300">
                      {" · "}{estado.totalesSesion.numDevoluciones} devoluciones ({euros(estado.totalesSesion.devoluciones)})
                    </span>
                  )}
                  {(estado?.totalesSesion?.entradas ?? 0) > 0 && ` · Entradas ${euros(estado.totalesSesion.entradas)}`}
                  {(estado?.totalesSesion?.salidas ?? 0) > 0 && ` · Salidas −${euros(estado.totalesSesion.salidas)}`}
                  {" · Esperado en cajón: "}
                  <strong className="text-slate-200">
                    {euros(
                      (abierta.apertura?.fondo ?? 0) +
                        (estado?.totalesSesion?.efectivo ?? 0) +
                        (estado?.totalesSesion?.entradas ?? 0) -
                        (estado?.totalesSesion?.salidas ?? 0)
                    )}
                  </strong>
                </p>

                {/* Movimientos manuales de efectivo */}
                <div className="border-t border-slate-800 pt-4">
                  <h3 className="font-semibold mb-3">Entradas y salidas de efectivo</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      onClick={() => setMovTipo("entrada")}
                      className={`px-4 py-2 rounded-lg font-semibold ${
                        movTipo === "entrada"
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      Entrada
                    </button>
                    <button
                      onClick={() => setMovTipo("salida")}
                      className={`px-4 py-2 rounded-lg font-semibold ${
                        movTipo === "salida"
                          ? "bg-rose-600 text-white"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      Salida
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Importe"
                      value={movImporte}
                      onChange={(e) => setMovImporte(e.target.value)}
                      className="w-28 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="Concepto (p. ej. pago proveedor, cambio)"
                      value={movConcepto}
                      onChange={(e) => setMovConcepto(e.target.value)}
                      className="flex-1 min-w-40 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={registrarMovimiento}
                      disabled={guardandoMov || !(Number(movImporte) > 0)}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:bg-slate-700 disabled:text-slate-500"
                    >
                      {guardandoMov ? "…" : "Registrar"}
                    </button>
                  </div>
                  {(estado?.movimientos ?? []).length > 0 && (
                    <div className="space-y-1">
                      {estado.movimientos.map((m) => (
                        <div key={m._id} className="flex justify-between text-sm bg-slate-800 rounded-lg px-3 py-2">
                          <span>
                            {new Date(m.fecha).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                            {" · "}
                            {m.concepto || (m.tipo === "entrada" ? "Entrada" : "Salida")}
                          </span>
                          <span className={`font-bold ${m.tipo === "entrada" ? "text-emerald-400" : "text-rose-400"}`}>
                            {m.tipo === "entrada" ? "+" : "−"}{euros(m.importe)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Arqueo y cierre</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setModoConteo("directo")}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                          modoConteo === "directo" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        Importe directo
                      </button>
                      <button
                        onClick={() => setModoConteo("desglose")}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                          modoConteo === "desglose" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        Contar billetes y monedas
                      </button>
                    </div>
                  </div>

                  {modoConteo === "desglose" && (
                    <div className="bg-slate-800/60 rounded-xl p-4 mb-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {[...BILLETES, ...MONEDAS].map((d) => (
                          <div key={d} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
                            <span className="w-14 text-sm font-semibold text-slate-300">{etiquetaDen(d)}</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              inputMode="numeric"
                              value={desglose[d] ?? ""}
                              onChange={(e) => cambiarDen(d, e.target.value)}
                              placeholder="0"
                              className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-right font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-400 w-16 text-right">
                              {(Number(desglose[d]) || 0) > 0 ? euros(d * Number(desglose[d])) : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-700">
                        <span className="font-semibold">Total contado</span>
                        <span className="text-xl font-bold text-emerald-400">{euros(totalDesglose)}</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Efectivo contado</label>
                      <input
                        type="number"
                        step="0.01"
                        value={conteo}
                        onChange={(e) => { setConteo(e.target.value); if (modoConteo === "desglose") setDesglose({}); }}
                        className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {conteo !== "" && (
                        <p className={`mt-1 text-sm font-semibold ${
                          Math.abs(
                            (Number(conteo) || 0) -
                              ((abierta.apertura?.fondo ?? 0) +
                                (estado?.totalesSesion?.efectivo ?? 0) +
                                (estado?.totalesSesion?.entradas ?? 0) -
                                (estado?.totalesSesion?.salidas ?? 0))
                          ) < 0.005
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}>
                          Diferencia: {euros(
                            (Number(conteo) || 0) -
                              ((abierta.apertura?.fondo ?? 0) +
                                (estado?.totalesSesion?.efectivo ?? 0) +
                                (estado?.totalesSesion?.entradas ?? 0) -
                                (estado?.totalesSesion?.salidas ?? 0))
                          )}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Notas</label>
                      <input
                        type="text"
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={cerrarCaja}
                    disabled={cerrando || conteo === ""}
                    className="mt-4 w-full py-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 disabled:text-slate-500 text-xl font-bold transition"
                  >
                    {cerrando ? "Cerrando…" : "Cerrar caja e imprimir cierre Z"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-slate-400 mb-4">No hay ninguna sesión abierta.</p>
                <div className="max-w-xs mx-auto">
                  <label className="block text-sm text-slate-400 mb-1">Fondo inicial</label>
                  <input
                    type="number"
                    step="0.01"
                    value={fondo}
                    onChange={(e) => setFondo(e.target.value)}
                    className="w-full text-center text-2xl font-bold bg-slate-800 border border-slate-600 rounded-xl py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={abrirCaja}
                    disabled={abriendo}
                    className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-xl font-bold transition"
                  >
                    {abriendo ? "Abriendo…" : "Abrir caja"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Historial */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
            <h2 className="text-lg font-bold mb-4">Historial de cierres</h2>
            {!sesiones.length ? (
              <p className="text-slate-500">No hay sesiones cerradas.</p>
            ) : (
              <div className="space-y-3">
                {sesiones.map((s) => (
                  <div
                    key={s._id}
                    className="flex flex-wrap items-center justify-between gap-3 bg-slate-800 rounded-xl p-4"
                  >
                    <div>
                      <p className="font-semibold">
                        {new Date(s.apertura?.fecha).toLocaleDateString("es-ES")} ·{" "}
                        {new Date(s.apertura?.fecha).toLocaleTimeString("es-ES", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" — "}
                        {s.cierre?.fecha
                          ? new Date(s.cierre.fecha).toLocaleTimeString("es-ES", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </p>
                      <p className="text-sm text-slate-400">
                        {s.cierre?.numeroTickets ?? 0} tickets
                        {(s.cierre?.numeroDevoluciones ?? 0) > 0 &&
                          ` · ${s.cierre.numeroDevoluciones} devoluciones`}
                        {" · "}Fondo {euros(s.apertura?.fondo)}
                        {" · "}Efectivo {euros(s.cierre?.totalEfectivo)}
                        {" · "}Tarjeta {euros(s.cierre?.totalTarjeta)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex gap-4 text-right">
                        <div>
                          <p className="text-sm text-slate-400">Esperado</p>
                          <p className="font-bold">{euros(s.cierre?.esperadoEfectivo)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Contado</p>
                          <p className="font-bold">{euros(s.cierre?.conteoEfectivo)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Diferencia</p>
                          <p
                            className={`font-bold ${
                              (s.cierre?.diferencia ?? 0) === 0
                                ? "text-emerald-400"
                                : (s.cierre?.diferencia ?? 0) > 0
                                  ? "text-amber-400"
                                  : "text-rose-400"
                            }`}
                          >
                            {euros(s.cierre?.diferencia)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => imprimirCierre(s)}
                        title="Imprimir cierre Z"
                        className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold"
                      >
                        Imprimir Z
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
