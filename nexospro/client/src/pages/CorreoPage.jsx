import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";

const campo = "w-full input";
const etiqueta = "block text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400 mb-1.5";

const VACIO = {
  activo: false,
  tipo: "smtp",
  nombreRemitente: "",
  usuario: "",
  host: "",
  puerto: 587,
  seguridad: "starttls",
  responderA: "",
  copiaOculta: "",
  password: "",
};

function cambiarTipo(valor, form, setForm) {
  if (valor === "gmail") {
    setForm({
      ...form,
      tipo: valor,
      host: "smtp.gmail.com",
      puerto: 465,
      seguridad: "ssl",
    });
  } else {
    setForm({
      ...form,
      tipo: valor,
      host: form.host === "smtp.gmail.com" ? "" : form.host,
      puerto: form.puerto === 465 ? 587 : form.puerto,
      seguridad: form.puerto === 465 ? "starttls" : form.seguridad,
    });
  }
}

export default function CorreoPage() {
  const [form, setForm] = useState(null);
  const [guardada, setGuardada] = useState(false);
  const [prueba, setPrueba] = useState({ para: "", asunto: "Prueba de correo de FILANEX", mensaje: "La configuración de correo electrónico funciona correctamente." });
  const [estado, setEstado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/correo/configuracion")
      .then((r) => r.json())
      .then((datos) => {
        setForm({ ...VACIO, ...datos, password: "" });
        setGuardada(Boolean(datos.passwordGuardada));
      })
      .catch(() => setEstado({ error: "No se pudo cargar la configuración de correo." }));
  }, []);

  function poner(campoNombre, valor) {
    setForm((actual) => ({ ...actual, [campoNombre]: valor }));
  }

  async function guardar() {
    setGuardando(true);
    setEstado(null);
    try {
      const respuesta = await fetch("/api/correo/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || "No se pudo guardar");
      setForm({ ...VACIO, ...datos, password: "" });
      setGuardada(Boolean(datos.passwordGuardada));
      setEstado({ ok: "Configuración guardada." });
    } catch (error) {
      setEstado({ error: error.message });
    } finally {
      setGuardando(false);
    }
  }

  async function verificar() {
    setVerificando(true);
    setEstado(null);
    try {
      const respuesta = await fetch("/api/correo/verificar", { method: "POST" });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || "No se pudo verificar");
      setForm((actual) => ({ ...actual, ...datos, password: "" }));
      setEstado({ ok: "Conexión con el servidor de correo correcta." });
    } catch (error) {
      setEstado({ error: error.message });
    } finally {
      setVerificando(false);
    }
  }

  async function enviarPrueba() {
    setEnviando(true);
    setEstado(null);
    try {
      const respuesta = await fetch("/api/correo/prueba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prueba),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || "No se pudo enviar la prueba");
      setEstado({ ok: `Prueba enviada a ${prueba.para}.` });
    } catch (error) {
      setEstado({ error: error.message });
    } finally {
      setEnviando(false);
    }
  }

  if (!form) {
    return (
      <>
        <CabeceraPagina titulo="Correo electrónico" descripcion="Configura la cuenta de envío de esta empresa." />
        {estado?.error && <p className="text-sm text-red-400">{estado.error}</p>}
      </>
    );
  }

  return (
    <>
      <CabeceraPagina
        titulo="Correo electrónico"
        descripcion="Cuenta usada para enviar presupuestos, albaranes, facturas y avisos."
      >
        <button className="btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </CabeceraPagina>

      {estado?.ok && <p className="text-sm text-emerald-600 mb-4">{estado.ok}</p>}
      {estado?.error && <p className="text-sm text-red-400 mb-4">{estado.error}</p>}

      <div className="panel p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-white font-semibold">Cuenta de envío</h2>
            <p className="text-xs text-slate-500 mt-1">Admite correo profesional SMTP y Gmail con contraseña de aplicación.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 pt-2">
            <input type="checkbox" checked={form.activo} onChange={(e) => poner("activo", e.target.checked)} />
            Activar envío desde FILANEX
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <label className={etiqueta}>Tipo de correo</label>
            <select className={campo} value={form.tipo} onChange={(e) => cambiarTipo(e.target.value, form, setForm)}>
              <option value="smtp">Correo profesional / SMTP</option>
              <option value="gmail">Gmail</option>
            </select>
          </div>
          <div>
            <label className={etiqueta}>Nombre visible del remitente</label>
            <input className={campo} value={form.nombreRemitente} onChange={(e) => poner("nombreRemitente", e.target.value)} placeholder="Ej. FILA TÉCNICA S.L." />
          </div>
          <div>
            <label className={etiqueta}>Correo remitente</label>
            <input type="email" className={campo} value={form.usuario} onChange={(e) => poner("usuario", e.target.value)} placeholder="info@empresa.com" />
          </div>
          <div>
            <label className={etiqueta}>Contraseña</label>
            <input type="password" className={campo} value={form.password} onChange={(e) => poner("password", e.target.value)} placeholder={guardada ? "Guardada — escribe solo para cambiarla" : "Contraseña o contraseña de aplicación"} autoComplete="new-password" />
          </div>
          <div>
            <label className={etiqueta}>Servidor SMTP</label>
            <input className={campo} value={form.host} onChange={(e) => poner("host", e.target.value)} placeholder="smtp.tudominio.com" disabled={form.tipo === "gmail"} />
          </div>
          <div>
            <label className={etiqueta}>Puerto</label>
            <input type="number" min="1" max="65535" className={campo} value={form.puerto} onChange={(e) => poner("puerto", e.target.value)} />
          </div>
          <div>
            <label className={etiqueta}>Seguridad</label>
            <select className={campo} value={form.seguridad} onChange={(e) => poner("seguridad", e.target.value)}>
              <option value="ssl">SSL / TLS (465)</option>
              <option value="starttls">STARTTLS (587)</option>
              <option value="ninguna">Sin seguridad (no recomendado)</option>
            </select>
          </div>
          <div>
            <label className={etiqueta}>Responder a</label>
            <input type="email" className={campo} value={form.responderA} onChange={(e) => poner("responderA", e.target.value)} placeholder="opcional" />
          </div>
          <div className="md:col-span-2">
            <label className={etiqueta}>Copia oculta en todos los envíos</label>
            <input type="email" className={campo} value={form.copiaOculta} onChange={(e) => poner("copiaOculta", e.target.value)} placeholder="opcional" />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={verificar} disabled={verificando || !guardada}>
            {verificando ? "Comprobando…" : "Comprobar conexión"}
          </button>
          <p className="text-xs text-slate-500 self-center">
            {form.comprobadaAt ? `Última comprobación correcta: ${new Date(form.comprobadaAt).toLocaleString("es-ES")}` : guardada ? "Guarda primero y después comprueba la conexión." : "Falta guardar la contraseña."}
          </p>
        </div>
        {form.ultimoError && <p className="text-xs text-amber-400 mt-3">Último aviso del servidor: {form.ultimoError}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="panel p-6">
          <h2 className="text-white font-semibold">Gmail</h2>
          <div className="text-sm text-slate-400 mt-3 space-y-2">
            <p>1. Activa la verificación en dos pasos en la cuenta de Google.</p>
            <p>2. Entra en Seguridad → Contraseñas de aplicación.</p>
            <p>3. Crea una contraseña para «Correo de FILANEX».</p>
            <p>4. Usa esa contraseña generada aquí, nunca la contraseña normal.</p>
          </div>
        </div>
        <div className="panel p-6">
          <h2 className="text-white font-semibold">Enviar prueba</h2>
          <div className="grid grid-cols-1 gap-4 mt-4">
            <div>
              <label className={etiqueta}>Para</label>
              <input type="email" className={campo} value={prueba.para} onChange={(e) => setPrueba({ ...prueba, para: e.target.value })} />
            </div>
            <div>
              <label className={etiqueta}>Asunto</label>
              <input className={campo} value={prueba.asunto} onChange={(e) => setPrueba({ ...prueba, asunto: e.target.value })} />
            </div>
            <div>
              <label className={etiqueta}>Mensaje</label>
              <textarea className={`${campo} min-h-28`} value={prueba.mensaje} onChange={(e) => setPrueba({ ...prueba, mensaje: e.target.value })} />
            </div>
          </div>
          <button className="btn-primary mt-4" onClick={enviarPrueba} disabled={enviando || !form.activo || !prueba.para}>
            {enviando ? "Enviando…" : "Enviar email de prueba"}
          </button>
        </div>
      </div>
    </>
  );
}
