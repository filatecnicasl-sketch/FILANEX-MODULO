import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { esAdmin } from "../lib/sesion.js";
import { InputBusqueda, coincideBusqueda, Badge } from "../components/ui.jsx";

const VACIO = {
  slug: "",
  nombre: "",
  email: "",
  password: "",
  adminNombre: "",
  nif: "",
  direccion: "",
  codigoPostal: "",
  ciudad: "",
  provincia: "",
  telefono: "",
  emailContacto: "",
  estado: "activo",
  plan: "basico",
  importeMensual: "",
  fechaRenovacion: "",
  fechaCaducidad: "",
  limiteUsuarios: 1,
  limiteFacturasMes: 100,
  limiteAlmacenamientoMB: 1024,
  notas: "",
};

const PLANES_PRESETS = {
  basico: { limiteUsuarios: 1, limiteFacturasMes: 100, limiteAlmacenamientoMB: 1024 },
  profesional: { limiteUsuarios: 5, limiteFacturasMes: 1000, limiteAlmacenamientoMB: 5120 },
  empresarial: { limiteUsuarios: 999, limiteFacturasMes: 99999, limiteAlmacenamientoMB: 51200 },
};

const ESTADO_TONO = {
  activo: "green",
  demo: "cyan",
  inactivo: "slate",
  suspendido: "red",
  prueba_finalizada: "amber",
};

function formatearFecha(fecha) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-ES");
}

function ModalTenant({ inicial, editando, onCerrar, onGuardado, alerta }) {
  const [form, setForm] = useState(inicial);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const cambiarPlan = (plan) => {
    const preset = PLANES_PRESETS[plan] || {};
    setForm((f) => ({ ...f, plan, ...preset }));
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const body = { ...form };
      if (editando) delete body.slug;
      const r = await fetch(
        editando ? `/api/admin/tenants/${editando}` : "/api/admin/tenants",
        {
          method: editando ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Error al guardar");
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-3xl p-6 my-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-1">
          {editando ? "Editar empresa" : "Nueva empresa"}
        </h2>
        {alerta && <p className="text-sm text-amber-300 mb-4">{alerta}</p>}

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <form onSubmit={guardar} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Slug *</label>
              <input
                value={form.slug}
                disabled={!!editando}
                onChange={(e) => cambiar("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                required={!editando}
                placeholder="filatecnica"
                className="input disabled:opacity-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Nombre empresa *</label>
              <input value={form.nombre} onChange={(e) => cambiar("nombre", e.target.value)} required className="input" />
            </div>
          </div>

          {!editando && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-slate-400">Email admin *</label>
                <input type="email" value={form.email} onChange={(e) => cambiar("email", e.target.value)} required className="input" />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-400">Contraseña admin *</label>
                <input type="password" value={form.password} onChange={(e) => cambiar("password", e.target.value)} required={!editando} minLength={6} className="input" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm text-slate-400">Nombre del admin</label>
                <input value={form.adminNombre} onChange={(e) => cambiar("adminNombre", e.target.value)} className="input" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-slate-400">NIF/CIF</label>
              <input value={form.nif} onChange={(e) => cambiar("nif", e.target.value)} className="input" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm text-slate-400">Dirección</label>
              <input value={form.direccion} onChange={(e) => cambiar("direccion", e.target.value)} className="input" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Código postal</label>
              <input value={form.codigoPostal} onChange={(e) => cambiar("codigoPostal", e.target.value)} className="input" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Ciudad</label>
              <input value={form.ciudad} onChange={(e) => cambiar("ciudad", e.target.value)} className="input" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Provincia</label>
              <input value={form.provincia} onChange={(e) => cambiar("provincia", e.target.value)} className="input" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Teléfono contacto</label>
              <input value={form.telefono} onChange={(e) => cambiar("telefono", e.target.value)} className="input" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Email contacto</label>
              <input type="email" value={form.emailContacto} onChange={(e) => cambiar("emailContacto", e.target.value)} className="input" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Estado</label>
              <select value={form.estado} onChange={(e) => cambiar("estado", e.target.value)} className="input">
                <option value="activo">Activo</option>
                <option value="demo">Demo</option>
                <option value="suspendido">Suspendido</option>
                <option value="inactivo">Inactivo</option>
                <option value="prueba_finalizada">Prueba finalizada</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Plan</label>
              <select value={form.plan} onChange={(e) => cambiarPlan(e.target.value)} className="input">
                <option value="basico">Básico</option>
                <option value="profesional">Profesional</option>
                <option value="empresarial">Empresarial</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Importe mensual (€)</label>
              <input type="number" min={0} step={0.01} value={form.importeMensual} onChange={(e) => cambiar("importeMensual", e.target.value)} className="input" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Fecha caducidad</label>
              <input type="date" value={form.fechaCaducidad} onChange={(e) => cambiar("fechaCaducidad", e.target.value)} className="input" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Límite usuarios</label>
              <input type="number" min={1} value={form.limiteUsuarios} onChange={(e) => cambiar("limiteUsuarios", e.target.value)} className="input" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Límite facturas/mes</label>
              <input type="number" min={1} value={form.limiteFacturasMes} onChange={(e) => cambiar("limiteFacturasMes", e.target.value)} className="input" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Límite almacenamiento (MB)</label>
              <input type="number" min={1} value={form.limiteAlmacenamientoMB} onChange={(e) => cambiar("limiteAlmacenamientoMB", e.target.value)} className="input" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-400">Notas internas</label>
            <textarea value={form.notas} onChange={(e) => cambiar("notas", e.target.value)} rows={3} className="input" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCerrar} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary">
              {guardando ? "Guardando…" : (editando ? "Guardar cambios" : "Crear empresa")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalReset({ tenant, onCerrar, onGuardado }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    if (password.length < 6) return setError("Mínimo 6 caracteres");
    setError("");
    setGuardando(true);
    try {
      const r = await fetch(`/api/admin/tenants/${tenant._id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Error");
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">Resetear contraseña admin</h2>
        <p className="text-sm text-slate-400 mb-4">{tenant.nombre} — {tenant.adminEmail}</p>
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
        <form onSubmit={guardar} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nueva contraseña admin"
            minLength={6}
            className="input"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCerrar} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary">{guardando ? "Guardando…" : "Guardar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [modal, setModal] = useState(null);
  const [reset, setReset] = useState(null);
  const [alertas, setAlertas] = useState({ caducan: [], inactivos: [] });

  const cargar = async () => {
    setCargando(true);
    try {
      const [r, a] = await Promise.all([
        fetch("/api/admin/tenants"),
        fetch("/api/admin/tenants/alertas"),
      ]);
      if (!r.ok) throw new Error("No se pudieron cargar las empresas");
      const [data, alertasData] = await Promise.all([r.json(), a.json().catch(() => ({}))]);
      setTenants(data);
      setAlertas(alertasData);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const confirmarBorrar = async (t) => {
    if (!window.confirm(`¿Eliminar definitivamente "${t.nombre}"? Se borrarán sus usuarios y este registro. La base de datos ${t.dbName} quedará en MongoDB.`)) return;
    try {
      const r = await fetch(`/api/admin/tenants/${t._id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Error al eliminar");
      setMensaje(`Empresa "${t.nombre}" eliminada.`);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  const abrirEditar = (t) => {
    setModal({
      editando: t._id,
      inicial: {
        ...VACIO,
        nombre: t.nombre || "",
        nif: t.nif || "",
        direccion: t.direccion || "",
        codigoPostal: t.codigoPostal || "",
        ciudad: t.ciudad || "",
        provincia: t.provincia || "",
        telefono: t.telefono || "",
        emailContacto: t.emailContacto || "",
        estado: t.estado || "activo",
        plan: t.plan || "basico",
        importeMensual: t.importeMensual ?? "",
        fechaRenovacion: t.fechaRenovacion ? t.fechaRenovacion.split("T")[0] : "",
        fechaCaducidad: t.fechaCaducidad ? t.fechaCaducidad.split("T")[0] : "",
        limiteUsuarios: t.limiteUsuarios ?? 1,
        limiteFacturasMes: t.limiteFacturasMes ?? 100,
        limiteAlmacenamientoMB: t.limiteAlmacenamientoMB ?? 1024,
        notas: t.notas || "",
      },
    });
  };

  const tenantsFiltrados = tenants.filter((t) => {
    const okEstado = filtroEstado === "todos" || t.estado === filtroEstado;
    const okBusqueda = coincideBusqueda(
      busqueda,
      t.nombre,
      t.slug,
      t.nif,
      t.emailContacto,
      t.adminEmail,
      t.adminNombre,
      t.notas
    );
    return okEstado && okBusqueda;
  });

  if (!esAdmin()) {
    return (
      <div>
        <CabeceraPagina titulo="Plataforma" descripcion="Gestión de empresas" />
        <div className="panel">No tienes permisos para acceder a esta pantalla.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CabeceraPagina
        titulo="Plataforma"
        descripcion="Control de clientes que usan FILANEX"
      >
        <button className="btn-primary" onClick={() => setModal({ editando: null, inicial: VACIO })}>
          Nueva empresa
        </button>
      </CabeceraPagina>

      {mensaje && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
          {mensaje}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {(alertas.caducan?.length > 0 || alertas.inactivos?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alertas.caducan?.length > 0 && (
            <div className="panel border-l-4 border-amber-400">
              <h3 className="text-sm font-bold text-amber-300 mb-2">Licencias próximas a caducar ({alertas.caducan.length})</h3>
              <ul className="text-sm text-slate-300 space-y-1">
                {alertas.caducan.map((t) => (
                  <li key={t._id}>{t.nombre} — caduca el {formatearFecha(t.fechaCaducidad)}</li>
                ))}
              </ul>
            </div>
          )}
          {alertas.inactivos?.length > 0 && (
            <div className="panel border-l-4 border-rose-400">
              <h3 className="text-sm font-bold text-rose-300 mb-2">Clientes inactivos/suspendidos ({alertas.inactivos.length})</h3>
              <ul className="text-sm text-slate-300 space-y-1">
                {alertas.inactivos.map((t) => (
                  <li key={t._id}>{t.nombre} — {t.estado}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="panel overflow-x-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold text-white">Empresas</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="input w-full sm:w-40"
            >
              <option value="todos">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="demo">Demo</option>
              <option value="suspendido">Suspendido</option>
              <option value="inactivo">Inactivo</option>
              <option value="prueba_finalizada">Prueba finalizada</option>
            </select>
            <InputBusqueda value={busqueda} onChange={setBusqueda} />
          </div>
        </div>

        {cargando ? (
          <p className="text-slate-400 text-sm">Cargando...</p>
        ) : tenantsFiltrados.length === 0 ? (
          <p className="text-slate-400 text-sm">No hay empresas que coincidan.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Contacto</th>
                <th>Plan / Importe</th>
                <th>Usuarios</th>
                <th>Uso</th>
                <th>Caducidad</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tenantsFiltrados.map((t) => (
                <tr key={t._id} className="align-top">
                  <td>
                    <div className="font-semibold text-white">{t.nombre}</div>
                    <div className="text-xs text-slate-500">{t.slug} · {t.dbName}</div>
                    {t.nif && <div className="text-xs text-slate-500">NIF {t.nif}</div>}
                  </td>
                  <td className="text-sm">
                    <div className="text-slate-300">{t.adminNombre || t.adminEmail}</div>
                    <div className="text-xs text-slate-500">{t.adminEmail}</div>
                    {t.telefono && <div className="text-xs text-slate-500">{t.telefono}</div>}
                  </td>
                  <td className="text-sm">
                    <div className="capitalize text-slate-300">{t.plan}</div>
                    <div className="text-xs text-slate-500">{t.importeMensual > 0 ? `${Number(t.importeMensual).toFixed(2)} €/mes` : "—"}</div>
                  </td>
                  <td className="text-sm text-slate-300">
                    {t.usuarios} / {t.limiteUsuarios}
                  </td>
                  <td className="text-sm text-slate-300">
                    <div>{t.facturasMes} facturas</div>
                    <div className="text-xs text-slate-500">{t.mbUsados} MB / {t.limiteAlmacenamientoMB} MB</div>
                  </td>
                  <td className="text-sm text-slate-300 whitespace-nowrap">
                    {formatearFecha(t.fechaCaducidad)}
                    {t.diasCaducidad != null && t.diasCaducidad <= 15 && t.diasCaducidad >= 0 && (
                      <span className="block text-xs text-amber-400">Quedan {t.diasCaducidad} días</span>
                    )}
                    {t.diasCaducidad != null && t.diasCaducidad < 0 && (
                      <span className="block text-xs text-rose-400">Caducada</span>
                    )}
                  </td>
                  <td>
                    <Badge tono={ESTADO_TONO[t.estado] || "slate"}>
                      {(t.estado || "").replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <button onClick={() => abrirEditar(t)} className="text-xs text-accent hover:underline mr-3">Editar</button>
                    <button onClick={() => setReset(t)} className="text-xs text-slate-400 hover:text-white hover:underline mr-3">Clave</button>
                    <button onClick={() => confirmarBorrar(t)} className="text-xs text-rose-400 hover:text-rose-300 hover:underline">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <ModalTenant
          inicial={modal.inicial}
          editando={modal.editando}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            setMensaje(modal.editando ? "Empresa actualizada." : "Empresa creada.");
            cargar();
          }}
        />
      )}

      {reset && (
        <ModalReset
          tenant={reset}
          onCerrar={() => setReset(null)}
          onGuardado={() => {
            setReset(null);
            setMensaje("Contraseña del administrador actualizada.");
          }}
        />
      )}
    </div>
  );
}
