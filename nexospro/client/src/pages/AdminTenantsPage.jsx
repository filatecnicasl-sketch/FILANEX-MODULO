import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { esAdmin } from "../lib/sesion.js";

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    slug: "",
    nombre: "",
    email: "",
    password: "",
    adminNombre: "",
    plan: "basico",
    limiteUsuarios: 5,
    notas: "",
  });
  const [mensaje, setMensaje] = useState("");

  const cargar = async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/admin/tenants");
      if (!r.ok) throw new Error("No se pudieron cargar las empresas");
      setTenants(await r.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  if (!esAdmin()) {
    return (
      <div>
        <CabeceraPagina titulo="Plataforma" descripcion="Gestión de empresas" />
        <div className="panel">No tienes permisos para acceder a esta pantalla.</div>
      </div>
    );
  }

  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const crear = async (e) => {
    e.preventDefault();
    setMensaje("");
    setError("");
    try {
      const r = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          limiteUsuarios: Number(form.limiteUsuarios) || 1,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Error al crear la empresa");
      setMensaje(`Empresa "${data.nombre}" creada. Slug: ${data.slug}`);
      setForm({
        slug: "",
        nombre: "",
        email: "",
        password: "",
        adminNombre: "",
        plan: "basico",
        limiteUsuarios: 5,
        notas: "",
      });
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleActiva = async (tenant) => {
    try {
      const r = await fetch(`/api/admin/tenants/${tenant._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa: !tenant.activa }),
      });
      if (!r.ok) throw new Error("Error al actualizar");
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <CabeceraPagina
        titulo="Plataforma"
        descripcion="Alta y gestión de empresas (SaaS)"
      />

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

      <div className="panel">
        <h2 className="text-lg font-bold text-white mb-4">Nueva empresa</h2>
        <form onSubmit={crear} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-slate-400">Slug *</label>
            <input
              value={form.slug}
              onChange={(e) => cambiar("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="taller-perez"
              required
              className="input"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-400">Nombre *</label>
            <input
              value={form.nombre}
              onChange={(e) => cambiar("nombre", e.target.value)}
              placeholder="Taller Pérez S.L."
              required
              className="input"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-400">Email admin *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => cambiar("email", e.target.value)}
              placeholder="admin@tallerperez.es"
              required
              className="input"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-400">Contraseña admin *</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => cambiar("password", e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              className="input"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-400">Nombre del admin (opcional)</label>
            <input
              value={form.adminNombre}
              onChange={(e) => cambiar("adminNombre", e.target.value)}
              placeholder="Administrador"
              className="input"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-400">Plan</label>
            <select
              value={form.plan}
              onChange={(e) => cambiar("plan", e.target.value)}
              className="input"
            >
              <option value="basico">Básico</option>
              <option value="profesional">Profesional</option>
              <option value="empresarial">Empresarial</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-400">Límite usuarios</label>
            <input
              type="number"
              min={1}
              value={form.limiteUsuarios}
              onChange={(e) => cambiar("limiteUsuarios", e.target.value)}
              className="input"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm text-slate-400">Notas</label>
            <input
              value={form.notas}
              onChange={(e) => cambiar("notas", e.target.value)}
              className="input"
            />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary">Crear empresa</button>
          </div>
        </form>
      </div>

      <div className="panel overflow-x-auto">
        <h2 className="text-lg font-bold text-white mb-4">Empresas</h2>
        {cargando ? (
          <p className="text-slate-400 text-sm">Cargando...</p>
        ) : tenants.length === 0 ? (
          <p className="text-slate-400 text-sm">No hay empresas dadas de alta.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Slug</th>
                <th>BD</th>
                <th>Plan</th>
                <th>Usuarios</th>
                <th>Estado</th>
                <th className="text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t._id}>
                  <td className="font-semibold text-white">{t.nombre}</td>
                  <td className="text-slate-400">{t.slug}</td>
                  <td className="text-slate-400">{t.dbName}</td>
                  <td className="capitalize">{t.plan}</td>
                  <td>{t.usuarios}</td>
                  <td>
                    {t.activa ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-rose-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Inactiva
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => toggleActiva(t)}
                      className={`text-xs font-medium underline underline-offset-4 ${
                        t.activa ? "text-rose-300 hover:text-rose-200" : "text-emerald-300 hover:text-emerald-200"
                      }`}
                    >
                      {t.activa ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
