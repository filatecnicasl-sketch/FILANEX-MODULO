import { useState, useEffect, useCallback } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { euros } from "../components/ui.jsx";
import { imprimirInforme, fmtFecha } from "./informes/comun.jsx";

const NOMBRES_TRIMESTRE = ["1.er trimestre", "2.º trimestre", "3.er trimestre", "4.º trimestre"];

export default function CierreEjercicioPage() {
  const [datos, setDatos] = useState(null);
  const [resumen, setResumen] = useState(null); // { ano, estado, resumen }
  const [empresa, setEmpresa] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [cerrando, setCerrando] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // { ano, accion: "cerrar"|"reabrir" }

  const cargar = useCallback(async () => {
    try {
      const [rCierres, rEmpresa] = await Promise.all([
        fetch("/api/empresa/cierres"),
        fetch("/api/empresa"),
      ]);
      const dCierres = await rCierres.json();
      if (!rCierres.ok) throw new Error(dCierres.error || "Error al cargar ejercicios");
      setDatos(dCierres);
      if (rEmpresa.ok) setEmpresa(await rEmpresa.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function verResumen(ano) {
    setError(null);
    try {
      const r = await fetch(`/api/empresa/cierres/${ano}/resumen`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar el resumen");
      setResumen(d);
    } catch (e) {
      setError(e.message);
    }
  }

  async function ejecutar() {
    const { ano, accion } = confirmar;
    setConfirmar(null);
    setCerrando(ano);
    setError(null);
    try {
      const r = await fetch(`/api/empresa/cierres/${ano}/${accion}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `No se pudo ${accion} el ejercicio`);
      await cargar();
      if (resumen?.ano === ano) await verResumen(ano);
    } catch (e) {
      setError(e.message);
    } finally {
      setCerrando(null);
    }
  }

  async function cambiarRenumeracion(activa) {
    try {
      const r = await fetch("/api/empresa/cierres/renumeracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo guardar");
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  function imprimirResumen() {
    const { ano, resumen: r } = resumen;
    imprimirInforme({
      titulo: `Resumen del ejercicio ${ano}`,
      subtitulo: "Bases y cuotas de IVA por trimestre — cierre de ejercicio",
      empresa,
      secciones: [
        {
          titulo: "IVA repercutido (facturas y tickets emitidos)",
          columnas: [
            { etiqueta: "Trimestre" },
            { etiqueta: "Documentos", num: true },
            { etiqueta: "Base imponible", num: true },
            { etiqueta: "Cuota IVA", num: true },
            { etiqueta: "Total", num: true },
          ],
          filas: r.trimestres.map((t, i) => [
            NOMBRES_TRIMESTRE[i],
            t.emitidas.numero,
            euros(t.emitidas.base),
            euros(t.emitidas.cuota),
            euros(t.emitidas.total),
          ]),
          pie: ["Total año", r.emitidas.numero, euros(r.emitidas.base), euros(r.emitidas.cuota), euros(r.emitidas.total)],
        },
        {
          titulo: "IVA soportado (facturas recibidas)",
          columnas: [
            { etiqueta: "Trimestre" },
            { etiqueta: "Documentos", num: true },
            { etiqueta: "Base imponible", num: true },
            { etiqueta: "Cuota IVA", num: true },
            { etiqueta: "Total", num: true },
          ],
          filas: r.trimestres.map((t, i) => [
            NOMBRES_TRIMESTRE[i],
            t.recibidas.numero,
            euros(t.recibidas.base),
            euros(t.recibidas.cuota),
            euros(t.recibidas.total),
          ]),
          pie: ["Total año", r.recibidas.numero, euros(r.recibidas.base), euros(r.recibidas.cuota), euros(r.recibidas.total)],
        },
        {
          titulo: "Composición de la facturación",
          columnas: [{ etiqueta: "Tipo" }, { etiqueta: "Documentos", num: true }],
          filas: [
            ["Facturas (F1)", r.facturas],
            ["Tickets TPV (facturas simplificadas F2)", r.tickets],
            ["Rectificativas", r.rectificativas],
          ],
        },
      ],
      notaFinal: `Resultado de IVA del ejercicio: ${euros(r.emitidas.cuota - r.recibidas.cuota)} (repercutido − soportado).`,
    });
  }

  const Insignia = ({ estado }) =>
    estado === "cerrado" ? (
      <span className="px-3 py-1 rounded-full bg-rose-400/10 border border-rose-400/25 text-rose-400 text-sm font-semibold">
        Cerrado
      </span>
    ) : estado === "reabierto" ? (
      <span className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/25 text-amber-300 text-sm font-semibold">
        Reabierto
      </span>
    ) : (
      <span className="px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/25 text-emerald-300 text-sm font-semibold">
        Abierto
      </span>
    );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <CabeceraPagina
        titulo="Cierre de ejercicio"
        subtitulo="Cierra el año fiscal: se guarda el resumen y el ejercicio queda bloqueado"
      />

      {error && <p className="text-sm text-rose-400 mb-4">{error}</p>}

      {/* Renumeración anual */}
      {datos && (
        <div className="panel p-5 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-200">Renumeración anual de series</p>
            <p className="text-sm text-slate-500">
              Cada 1 de enero la numeración vuelve a 1 con el año en la serie (A-2027-1, T-2027-1…).
              La cadena de huella VeriFactu continúa entre años.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={datos.renumerarAnual}
              onChange={(e) => cambiarRenumeracion(e.target.checked)}
              className="w-5 h-5 accent-cyan-500"
            />
            <span className="font-semibold text-slate-200">{datos.renumerarAnual ? "Activa" : "Desactivada"}</span>
          </label>
        </div>
      )}

      {cargando ? (
        <p className="text-slate-400">Cargando…</p>
      ) : (
        <div className="panel p-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Ejercicios</h2>
          <div className="space-y-2">
            {datos.ejercicios.map((e) => (
              <div key={e.ano} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="min-w-0">
                  <p className="text-xl font-bold text-slate-200">{e.ano}</p>
                  <p className="text-sm text-slate-500">
                    {e.estado === "cerrado"
                      ? `Cerrado el ${fmtFecha(e.cerradoEn)} por ${e.cerradoPor}`
                      : e.estado === "reabierto"
                        ? `Reabierto el ${fmtFecha(e.reabiertoEn)} por ${e.reabiertoPor}`
                        : e.documentos
                          ? `${e.documentos.emitidas} emitidas · ${e.documentos.recibidas} recibidas`
                          : "Sin documentos"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Insignia estado={e.estado} />
                  <button onClick={() => verResumen(e.ano)} className="btn-ghost">
                    Resumen
                  </button>
                  {e.estado !== "cerrado" ? (
                    <button
                      onClick={() => setConfirmar({ ano: e.ano, accion: "cerrar" })}
                      disabled={cerrando === e.ano}
                      className="btn-peligro"
                    >
                      {cerrando === e.ano ? "…" : "Cerrar ejercicio"}
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmar({ ano: e.ano, accion: "reabrir" })}
                      disabled={cerrando === e.ano}
                      className="btn-ghost"
                    >
                      {cerrando === e.ano ? "…" : "Reabrir"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-500 mt-4">
            Al cerrar un ejercicio no se pueden crear, modificar ni borrar documentos con fecha de ese año
            (facturas, tickets, facturas de compra). Las correcciones se hacen con rectificativas del ejercicio en curso.
          </p>
        </div>
      )}

      {/* Resumen del ejercicio */}
      {resumen && (
        <div className="panel p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-200">
              Resumen {resumen.ano} <Insignia estado={resumen.estado} />
            </h2>
            <button onClick={imprimirResumen} className="btn-ghost">Imprimir</button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Base emitida</p>
              <p className="num text-xl font-bold text-slate-200">{euros(resumen.resumen.emitidas.base)}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">IVA repercutido</p>
              <p className="num text-xl font-bold text-emerald-300">{euros(resumen.resumen.emitidas.cuota)}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">IVA soportado</p>
              <p className="num text-xl font-bold text-rose-400">{euros(resumen.resumen.recibidas.cuota)}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Resultado IVA</p>
              <p className="num text-xl font-bold text-cyan-300">
                {euros(resumen.resumen.emitidas.cuota - resumen.resumen.recibidas.cuota)}
              </p>
            </div>
          </div>

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-left text-slate-500 border-b border-white/10">
                <th className="py-2">Trimestre</th>
                <th className="py-2 text-right">Emitidas (base + IVA)</th>
                <th className="py-2 text-right">Recibidas (base + IVA)</th>
              </tr>
            </thead>
            <tbody>
              {resumen.resumen.trimestres.map((t, i) => (
                <tr key={t.trimestre} className="border-b border-white/5">
                  <td className="py-2 text-slate-300">{NOMBRES_TRIMESTRE[i]}</td>
                  <td className="py-2 text-right num text-slate-200">
                    {euros(t.emitidas.base)} + {euros(t.emitidas.cuota)}
                  </td>
                  <td className="py-2 text-right num text-slate-200">
                    {euros(t.recibidas.base)} + {euros(t.recibidas.cuota)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-sm text-slate-500">
            {resumen.resumen.facturas} facturas · {resumen.resumen.tickets} tickets TPV ·{" "}
            {resumen.resumen.rectificativas} rectificativas
          </p>
        </div>
      )}

      {/* Confirmación */}
      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-panel w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-200 mb-2">
              {confirmar.accion === "cerrar" ? `¿Cerrar el ejercicio ${confirmar.ano}?` : `¿Reabrir el ejercicio ${confirmar.ano}?`}
            </h3>
            <p className="text-sm text-slate-500 mb-5">
              {confirmar.accion === "cerrar"
                ? "Se guardará el resumen fiscal del año y quedará bloqueado: ya no se podrán crear, modificar ni borrar documentos con fecha de ese ejercicio. Podrás reabrirlo si hace falta, y quedará registrado."
                : "El ejercicio volverá a admitir cambios. La reapertura quedará registrada con tu usuario y la fecha."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmar(null)} className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-semibold">
                Cancelar
              </button>
              <button onClick={ejecutar} className={confirmar.accion === "cerrar" ? "btn-peligro flex-1 py-3" : "btn-primary flex-1 py-3 justify-center"}>
                {confirmar.accion === "cerrar" ? "Sí, cerrar" : "Sí, reabrir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
