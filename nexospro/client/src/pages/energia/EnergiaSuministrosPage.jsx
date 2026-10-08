import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";
import SelectorContacto from "../../components/SelectorContacto.jsx";
import { IconEditar, IconBorrar, IconFirma, IconGraficas, IconComparativas } from "../../components/icons.jsx";
import ModalImportarEnergia from "./ModalImportarEnergia.jsx";
import ModalConsumos from "./ModalConsumos.jsx";
import { cargarClientesLigeros } from "../../lib/clientesLigeros.js";

const VACIO = {
  cups: "", tipo: "luz", clienteId: "", comercializadoraId: "", canalDistribucionId: "",
  calle: "", cp: "", ciudad: "", provincia: "",
  tarifa: "", potenciaPunta: "", potenciaValle: "", consumoAnual: "", presupuestoAnual: "",
  estado: "activo", fechaAlta: "", fechaFin: "", notas: "",
};

const TONO_TIPO = {
  luz: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  gas: "bg-sky-400/10 text-sky-300 border-sky-400/30",
};
const TONO_ESTADO = {
  activo: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  inactivo: "bg-slate-400/10 text-slate-400 border-slate-400/30",
  baja: "bg-rose-400/10 text-rose-300 border-rose-400/30",
};

function Badge({ tono, children }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${tono}`}>
      {children}
    </span>
  );
}

export default function EnergiaSuministrosPage() {
  const [lista, setLista] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [comercializadoras, setComercializadoras] = useState([]);
  const [canales, setCanales] = useState([]);
  const [canalesFiltrados, setCanalesFiltrados] = useState([]);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [q, setQ] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroGrupo, setFiltroGrupo] = useState("");
  const [importar, setImportar] = useState(false);
  const [consumosDe, setConsumosDe] = useState(null);

  const grupos = [...new Set(clientes.map((c) => c.grupo).filter(Boolean))].sort();

  const filtrada = (lista ?? []).filter((s) => {
    if (filtroTipo !== "todos" && s.tipo !== filtroTipo) return false;
    if (filtroEstado !== "todos" && s.estado !== filtroEstado) return false;
    if (filtroGrupo && s.cliente?.grupo !== filtroGrupo) return false;
    return coincideBusqueda(
      q,
      s.cups,
      s.clienteNombre ?? s.cliente?.nombre,
      s.comercializadoraNombre ?? s.comercializadora?.nombre,
      s.canalDistribucionNombre ?? s.canalDistribucion?.nombre,
      s.tarifa,
      s.direccion?.calle,
      s.direccion?.ciudad,
      s.cliente?.grupo
    );
  });

  async function cargar() {
    try {
      const r = await fetch("/api/energia/suministros");
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar");
      setLista(datos);
    } catch (e) {
      setError(e.message);
      setLista([]);
    }
  }

  useEffect(() => {
    cargar();
    cargarClientesLigeros().then((d) => setClientes(Array.isArray(d) ? d : []));
    fetch("/api/energia/comercializadoras")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setComercializadoras(Array.isArray(d) ? d : []))
      .catch(() => setComercializadoras([]));
    fetch("/api/energia/canales")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        setCanales(Array.isArray(d) ? d : []);
        setCanalesFiltrados(Array.isArray(d) ? d : []);
      })
      .catch(() => {
        setCanales([]);
        setCanalesFiltrados([]);
      });
  }, []);

  function abrirNuevo() {
    setEditando(null);
    setForm(VACIO);
    setCanalesFiltrados(canales);
    setModal(true);
  }

  function abrirEdicion(s) {
    setEditando(s);
    const comercializadoraId = s.comercializadora?._id ?? "";
    setForm({
      cups: s.cups ?? "",
      tipo: s.tipo ?? "luz",
      clienteId: s.cliente?._id ?? "",
      comercializadoraId,
      canalDistribucionId: s.canalDistribucion?._id ?? "",
      calle: s.direccion?.calle ?? "",
      cp: s.direccion?.cp ?? "",
      ciudad: s.direccion?.ciudad ?? "",
      provincia: s.direccion?.provincia ?? "",
      tarifa: s.tarifa ?? "",
      potenciaPunta: s.potenciaPunta || "",
      potenciaValle: s.potenciaValle || "",
      consumoAnual: s.consumoAnual || "",
      presupuestoAnual: s.presupuestoAnual || "",
      estado: s.estado ?? "activo",
      fechaAlta: s.fechaAlta ? new Date(s.fechaAlta).toISOString().slice(0, 10) : "",
      fechaFin: s.fechaFin ? new Date(s.fechaFin).toISOString().slice(0, 10) : "",
      notas: s.notas ?? "",
    });
    setCanalesFiltrados(
      comercializadoraId
        ? canales.filter((c) =>
            (c.comercializadoras ?? []).some((x) => (x._id ?? x) === comercializadoraId)
          )
        : canales
    );
    setModal(true);
  }

  async function guardar(e) {
    e.preventDefault();
    const cuerpo = {
      cups: form.cups,
      tipo: form.tipo,
      cliente: form.clienteId || null,
      comercializadora: form.comercializadoraId || null,
      canalDistribucion: form.canalDistribucionId || null,
      direccion: { calle: form.calle, cp: form.cp, ciudad: form.ciudad, provincia: form.provincia },
      tarifa: form.tarifa,
      potenciaPunta: form.potenciaPunta,
      potenciaValle: form.potenciaValle,
      consumoAnual: form.consumoAnual,
      presupuestoAnual: form.presupuestoAnual,
      estado: form.estado,
      fechaAlta: form.fechaAlta || null,
      fechaFin: form.fechaFin || null,
      notas: form.notas,
    };
    const r = await fetch(`/api/energia/suministros${editando ? `/${editando._id}` : ""}`, {
      method: editando ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const datos = await r.json();
    if (r.ok) {
      setModal(false);
      cargar();
    } else alert(datos.error || "Error al guardar");
  }

  async function borrar(s) {
    if (!window.confirm(`¿Borrar el suministro ${s.cups}?`)) return;
    const r = await fetch(`/api/energia/suministros/${s._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  const poner = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const esLuz = form.tipo === "luz";

  return (
    <CabeceraPagina titulo="Suministros" descripcion="Puntos de suministro (CUPS) de luz y gas de tus clientes.">
      {error && <div className="panel px-4 py-3 text-sm text-rose-400 mb-3">{error}</div>}

      {lista === null ? (
        <div className="panel px-4 py-10 text-center text-slate-500">Cargando…</div>
      ) : lista.length === 0 ? (
        <div className="panel px-6 py-12 text-center space-y-4">
          <p className="text-slate-300 font-medium">Aún no hay suministros dados de alta.</p>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">
            La forma más rápida es <b>importar la factura de luz o gas</b> del cliente: la IA lee el
            CUPS, el titular, la comercializadora, la tarifa, la potencia y el consumo, y tú solo
            revisas y confirmas. También puedes darlo de alta a mano.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setImportar(true)} className="btn-primary">Importar factura (IA)</button>
            <button onClick={abrirNuevo} className="btn-ghost">Nuevo suministro</button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <InputBusqueda value={q} onChange={setQ} placeholder="Buscar por CUPS, cliente, grupo, comercializadora…" />
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="input w-auto">
              <option value="todos">Tipo: todos</option>
              <option value="luz">Luz</option>
              <option value="gas">Gas</option>
            </select>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="input w-auto">
              <option value="todos">Estado: todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
              <option value="baja">Bajas</option>
            </select>
            {grupos.length > 0 && (
              <select value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)} className="input w-auto">
                <option value="">Grupo: todos</option>
                {grupos.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2 ms-auto">
              <button onClick={() => setImportar(true)} className="btn-ghost whitespace-nowrap">Importar factura (IA)</button>
              <button onClick={abrirNuevo} className="btn-primary whitespace-nowrap">Nuevo suministro</button>
            </div>
          </div>

          <div className="panel overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>CUPS</th>
                  <th>Cliente</th>
                  <th>Comercializadora</th>
                  <th>Canal</th>
                  <th>Tarifa</th>
                  <th className="num">Potencia</th>
                  <th className="num" title="Coste medio de los últimos 12 meses: factura ÷ kWh. Los más caros son candidatos a estudio de ahorro">€/kWh (12 m.)</th>
                  <th>Alta</th>
                  <th>Creado</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center text-slate-500 py-6">
                      Ningún suministro coincide con esos filtros.
                    </td>
                  </tr>
                )}
                {filtrada.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <p className="num text-[0.8rem] text-slate-200 whitespace-nowrap">{s.cups}</p>
                      <p className="mt-0.5"><Badge tono={TONO_TIPO[s.tipo]}>{s.tipo.toUpperCase()}</Badge></p>
                    </td>
                    <td>
                      <p className="text-slate-300">{s.clienteNombre ?? s.cliente?.nombre ?? "—"}</p>
                      {(s.cliente?.grupo) && (
                        <p className="text-xs text-slate-500 whitespace-nowrap">{s.cliente.grupo}</p>
                      )}
                    </td>
                    <td className="text-slate-300">{s.comercializadoraNombre ?? s.comercializadora?.nombre ?? "—"}</td>
                    <td className="text-slate-300">{s.canalDistribucionNombre ?? s.canalDistribucion?.nombre ?? "—"}</td>
                    <td className="num text-slate-300 whitespace-nowrap">
                      {s.tarifa || "—"}
                      {s.consumoAnual > 0 && (
                        <p className="text-xs text-slate-500">{Number(s.consumoAnual).toLocaleString("es-ES")} kWh/año</p>
                      )}
                    </td>
                    <td className="num text-slate-300 whitespace-nowrap">
                      {s.tipo === "luz"
                        ? [s.potenciaPunta, s.potenciaValle].filter((p) => Number(p) > 0).map((p) => `${p} kW`).join(" / ") || "—"
                        : "—"}
                    </td>
                    <td className="num whitespace-nowrap">
                      {s.costeMedioKwh ? (
                        <span
                          className={Number(s.costeMedioKwh) >= 0.25 ? "text-amber-300 font-semibold" : "text-slate-300"}
                          title={
                            Number(s.costeMedioKwh) >= 0.25
                              ? "Contrato caro: buen candidato a estudio de ahorro"
                              : "Facturado ÷ consumido de los últimos 12 meses"
                          }
                        >
                          {Number(s.costeMedioKwh).toLocaleString("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} €
                        </span>
                      ) : (
                        <span className="text-slate-600" title="Apunta consumos mensuales para verlo">—</span>
                      )}
                      {s.desviacionPresupuesto !== null && s.desviacionPresupuesto !== undefined && (
                        <p className={`text-xs num ${s.desviacionPresupuesto > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                          {s.desviacionPresupuesto > 0 ? "+" : ""}
                          {Number(s.desviacionPresupuesto).toLocaleString("es-ES", { maximumFractionDigits: 0 })} € vs presupuesto
                        </p>
                      )}
                    </td>
                    <td className="text-slate-300 whitespace-nowrap text-xs">
                      {s.fechaAlta ? new Date(s.fechaAlta).toLocaleDateString("es-ES") : "—"}
                    </td>
                    <td className="text-slate-400 whitespace-nowrap text-xs">
                      {s.createdAt ? new Date(s.createdAt).toLocaleDateString("es-ES") : "—"}
                    </td>
                    <td><Badge tono={TONO_ESTADO[s.estado]}>{s.estado}</Badge>
                      {s.fechaFin && (() => {
                        const dias = Math.ceil((new Date(s.fechaFin).getTime() - Date.now()) / 86400000);
                        return dias <= 60 ? (
                          <p className={`text-xs mt-0.5 whitespace-nowrap ${dias < 0 ? "text-rose-400" : "text-amber-300"}`}>
                            {dias < 0 ? "Contrato vencido" : `Renueva en ${dias} días`}
                          </p>
                        ) : null;
                      })()}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        onClick={() => setConsumosDe(s)}
                        className="p-1.5 text-slate-400 hover:text-amber-400"
                        title="Consumos mensuales"
                      >
                        <IconGraficas />
                      </button>
                      <Link
                        to={`/energia/estudios?nuevo=${s._id}`}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 inline-block align-middle"
                        title="Abrir estudio de ahorro con este CUPS"
                      >
                        <IconComparativas />
                      </Link>
                      <Link
                        to={`/energia/tramites?nuevo=${s._id}`}
                        className="p-1.5 text-slate-400 hover:text-sky-400 inline-block align-middle"
                        title="Iniciar trámite (alta, cambio de comercializadora, titular o baja)"
                      >
                        <IconFirma />
                      </Link>
                      <button onClick={() => abrirEdicion(s)} className="p-1.5 text-slate-400 hover:text-sky-400" title="Editar">
                        <IconEditar />
                      </button>
                      <button onClick={() => borrar(s)} className="p-1.5 text-slate-400 hover:text-rose-400" title="Borrar">
                        <IconBorrar />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {importar && (
        <ModalImportarEnergia
          clientes={clientes}
          comercializadoras={comercializadoras}
          onGuardado={() => {
            setImportar(false);
            cargar();
          }}
          onCerrar={() => setImportar(false)}
        />
      )}

      {consumosDe && (
        <ModalConsumos suministro={consumosDe} onCerrar={() => setConsumosDe(null)} />
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(false)}>
          <form
            className="panel max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={guardar}
          >
            <h2 className="text-lg font-bold text-white">
              {editando ? `Editar ${editando.cups}` : "Nuevo suministro"}
            </h2>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm text-slate-400 sm:col-span-2">
                CUPS *
                <input
                  value={form.cups}
                  onChange={(e) => setForm((f) => ({ ...f, cups: e.target.value.toUpperCase().replace(/[\s-]/g, "") }))}
                  className="input num"
                  placeholder="ES0021000000000000XX"
                  autoFocus
                  required
                />
                <span className="text-xs text-slate-500">22 caracteres: ES + 20</span>
              </label>
              <label className="text-sm text-slate-400">
                Tipo *
                <select value={form.tipo} onChange={poner("tipo")} className="input">
                  <option value="luz">Luz</option>
                  <option value="gas">Gas</option>
                </select>
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="text-sm text-slate-400">
                Cliente
                <SelectorContacto
                  tipo="cliente"
                  contactos={clientes}
                  valor={form.clienteId}
                  onChange={(id) => setForm((f) => ({ ...f, clienteId: id ?? "" }))}
                />
              </div>
              <div className="text-sm text-slate-400">
                Comercializadora actual
                <select
                  value={form.comercializadoraId}
                  onChange={(e) => {
                    const comercializadoraId = e.target.value;
                    setForm((f) => ({
                      ...f,
                      comercializadoraId,
                      canalDistribucionId: "",
                    }));
                    setCanalesFiltrados(
                      comercializadoraId
                        ? canales.filter((c) =>
                            (c.comercializadoras ?? []).some(
                              (x) => (x._id ?? x) === comercializadoraId
                            )
                          )
                        : canales
                    );
                  }}
                  className="input"
                >
                  <option value="">— Sin asignar —</option>
                  {comercializadoras.map((c) => (
                    <option key={c._id} value={c._id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="text-sm text-slate-400">
                Canal de distribución
                <select
                  value={form.canalDistribucionId}
                  onChange={(e) => setForm((f) => ({ ...f, canalDistribucionId: e.target.value }))}
                  className="input"
                  disabled={!form.comercializadoraId}
                >
                  <option value="">{form.comercializadoraId ? "— Sin canal —" : "Elige comercializadora"}</option>
                  {canalesFiltrados.map((c) => (
                    <option key={c._id} value={c._id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-slate-600/40 p-4">
              <p className="text-sm font-semibold text-slate-300 mb-3">Dirección del suministro</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm text-slate-400 sm:col-span-2">
                  Calle
                  <input value={form.calle} onChange={poner("calle")} className="input" placeholder="Puede ser distinta a la fiscal del cliente" />
                </label>
                <label className="text-sm text-slate-400">
                  Código postal
                  <input value={form.cp} onChange={poner("cp")} className="input" />
                </label>
                <label className="text-sm text-slate-400">
                  Ciudad
                  <input value={form.ciudad} onChange={poner("ciudad")} className="input" />
                </label>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm text-slate-400">
                Tarifa / peaje
                <input value={form.tarifa} onChange={poner("tarifa")} className="input" placeholder={esLuz ? "2.0TD, 3.0TD…" : "3.1, 3.2, 3.4…"} />
              </label>
              {esLuz && (
                <>
                  <label className="text-sm text-slate-400">
                    Potencia punta (kW)
                    <input value={form.potenciaPunta} onChange={poner("potenciaPunta")} className="input num" inputMode="decimal" />
                  </label>
                  <label className="text-sm text-slate-400">
                    Potencia valle (kW)
                    <input value={form.potenciaValle} onChange={poner("potenciaValle")} className="input num" inputMode="decimal" />
                  </label>
                </>
              )}
              {!esLuz && (
                <label className="text-sm text-slate-400">
                  Consumo anual (kWh)
                  <input value={form.consumoAnual} onChange={poner("consumoAnual")} className="input num" inputMode="decimal" />
                </label>
              )}
            </div>

            {esLuz && (
              <label className="text-sm text-slate-400 block sm:w-1/3">
                Consumo anual (kWh)
                <input value={form.consumoAnual} onChange={poner("consumoAnual")} className="input num" inputMode="decimal" />
              </label>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm text-slate-400">
                Presupuesto anual (€)
                <input value={form.presupuestoAnual} onChange={poner("presupuestoAnual")} className="input num" inputMode="decimal" placeholder="Lo que el cliente debería pagar al año" />
                <span className="text-xs text-slate-500">Se compara con lo facturado en los últimos 12 meses</span>
              </label>
              <label className="text-sm text-slate-400">
                Estado
                <select value={form.estado} onChange={poner("estado")} className="input">
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="baja">Baja</option>
                </select>
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm text-slate-400">
                Fecha de alta (comercializadora actual)
                <input type="date" value={form.fechaAlta} onChange={poner("fechaAlta")} className="input" />
              </label>
              <label className="text-sm text-slate-400">
                Fin del contrato
                <input type="date" value={form.fechaFin} onChange={poner("fechaFin")} className="input" />
                <span className="text-xs text-slate-500">Para las alertas de renovación</span>
              </label>
            </div>

            {editando?.createdAt && (
              <div className="text-xs text-slate-500">
                Suministro creado el {new Date(editando.createdAt).toLocaleDateString("es-ES")}
                {editando.updatedAt && editando.updatedAt !== editando.createdAt && (
                  <> · última modificación el {new Date(editando.updatedAt).toLocaleDateString("es-ES")}</>
                )}
              </div>
            )}

            <label className="text-sm text-slate-400 block">
              Notas
              <textarea value={form.notas} onChange={poner("notas")} className="input" rows={2} />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
              <button type="submit" className="btn-primary">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </CabeceraPagina>
  );
}
