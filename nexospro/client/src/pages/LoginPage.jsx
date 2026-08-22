import { useEffect, useState } from "react";
import { guardarToken } from "../lib/sesion.js";
import { LogoFX } from "../components/icons.jsx";

// Pantalla de acceso. Si la instalación aún no tiene usuarios (primera
// ejecución), ofrece crear la cuenta de administrador.
export default function LoginPage() {
  const [estado, setEstado] = useState(null); // {usuarios, empresa}
  const [modo, setModo] = useState("login"); // login | bootstrap
  const [form, setForm] = useState({ nombre: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    fetch("/api/auth/estado")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((e) => {
        setEstado(e);
        if (e.usuarios === 0) setModo("bootstrap");
      })
      .catch(() => setEstado({ usuarios: null }));
  }, []);

  const poner = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function entrar(e) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const esBootstrap = modo === "bootstrap";
      const r = await fetch(`/api/auth/${esBootstrap ? "bootstrap" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo iniciar sesión");
      guardarToken(datos.token);
      location.reload(); // recarga limpia con la sesión ya activa
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  }

  const esBootstrap = modo === "bootstrap";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border border-white/10 bg-white/[0.04] text-white mb-3">
            <LogoFX size={42} />
          </div>
          <h1 className="text-2xl font-bold text-accent tracking-[0.16em]">FILANEX</h1>
          <p className="text-sm text-slate-400 mt-1">
            {estado?.empresa ?? "Facturación VeriFactu"}
          </p>
        </div>

        <form onSubmit={entrar} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
          {esBootstrap ? (
            <>
              <p className="text-sm text-slate-300">
                <b className="text-white">Primera ejecución.</b> Crea la cuenta de
                administrador de esta instalación.
              </p>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Tu nombre</label>
                <input value={form.nombre} onChange={poner("nombre")} className="input" autoFocus required />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-300">
              Inicia sesión para entrar a la aplicación.
            </p>
          )}
          <div>
            <label className="text-sm text-slate-400 block mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={poner("email")}
              className="input"
              autoComplete="username"
              autoFocus={!esBootstrap}
              required
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Contraseña</label>
            <input
              type="password"
              value={form.password}
              onChange={poner("password")}
              className="input"
              autoComplete={esBootstrap ? "new-password" : "current-password"}
              placeholder={esBootstrap ? "Mínimo 6 caracteres" : ""}
              required
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button type="submit" disabled={cargando} className="btn-primary w-full justify-center">
            {cargando ? "Entrando…" : esBootstrap ? "Crear administrador y entrar" : "Entrar"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-6">
          Los datos de esta instalación se guardan en este equipo.
        </p>
      </div>
    </div>
  );
}
