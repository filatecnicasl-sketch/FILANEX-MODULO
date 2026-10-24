import { useCallback, useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { Badge } from "../components/ui.jsx";

const AMBITOS = [
  ["agenda", "Agenda", "Eventos de la agenda general"],
  ["taller", "Taller", "Citas de vehículos"],
  ["servicio", "Servicio Técnico", "Citas e intervenciones"],
];

const ESTADO_TONO = {
  programado: "amber",
  procesando: "cyan",
  enviado: "blue",
  entregado: "green",
  leido: "green",
  respondido: "emerald",
  fallido: "red",
  cancelado: "slate",
};

function Interruptor({ valor, onCambio }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      onClick={() => onCambio(!valor)}
      className={`relative w-10 h-[22px] rounded-full transition-colors ${valor ? "bg-emerald-500" : "bg-slate-600"}`}
    >
      <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all ${valor ? "left-[21px]" : "left-[3px]"}`} />
    </button>
  );
}

function cargarSdk(appId, version) {
  return new Promise((resolve, reject) => {
    if (window.FB) return resolve();
    window.fbAsyncInit = () => {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: true, version });
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/es_ES/sdk.js";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("No se pudo cargar la conexión segura de Meta"));
    document.body.appendChild(script);
  });
}

export default function WhatsAppPage() {
  const [datos, setDatos] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [prefs, setPrefs] = useState(null);
  const [filtros, setFiltros] = useState({ q: "", estado: "", ambito: "", desde: "", hasta: "" });
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);
  const sesionMeta = useRef(null);

  const cargar = useCallback(async () => {
    const parametros = new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor));
    const [configuracion, historial] = await Promise.all([
      fetch("/api/whatsapp/configuracion").then((r) => r.json()),
      fetch(`/api/whatsapp/mensajes?${parametros}`).then((r) => r.json()),
    ]);
    setDatos(configuracion);
    setPrefs(configuracion.preferencias || {
      agenda: { activo: true, confirmacion: true, recordatorios: true, minutosAntes: 1440 },
      taller: { activo: true, confirmacion: true, recordatorios: true, minutosAntes: 1440 },
      servicio: { activo: true, confirmacion: true, recordatorios: true, minutosAntes: 1440 },
    });
    setMensajes(Array.isArray(historial) ? historial : []);
  }, [filtros]);

  useEffect(() => {
    cargar().catch(() => setError("No se pudo cargar la configuración de WhatsApp."));
  }, [cargar]);

  useEffect(() => {
    function recibir(evento) {
      if (!["https://www.facebook.com", "https://web.facebook.com"].includes(evento.origin)) return;
      let contenido = evento.data;
      try {
        if (typeof contenido === "string") contenido = JSON.parse(contenido);
      } catch {
        return;
      }
      if (contenido?.type === "WA_EMBEDDED_SIGNUP" && contenido.event === "FINISH") {
        sesionMeta.current = contenido.data;
      }
    }
    window.addEventListener("message", recibir);
    return () => window.removeEventListener("message", recibir);
  }, []);

  async function conectar() {
    setError(null);
    setAviso(null);
    try {
      if (!datos.disponible) throw new Error("Falta configurar la aplicación de Meta en el servidor.");
      await cargarSdk(datos.appId, datos.graphVersion);
      window.FB.login(async (respuesta) => {
        try {
          const code = respuesta.authResponse?.code;
          const info = sesionMeta.current;
          if (!code || !info?.waba_id || !info?.phone_number_id) {
            throw new Error("La conexión con Meta no se completó.");
          }
          const alta = await fetch("/api/whatsapp/embedded-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, wabaId: info.waba_id, phoneNumberId: info.phone_number_id }),
          });
          const resultado = await alta.json();
          if (!alta.ok) throw new Error(resultado.error || "No se pudo guardar la conexión");
          setAviso("WhatsApp Business conectado correctamente.");
          await cargar();
        } catch (e) {
          setError(e.message);
        }
      }, {
        config_id: datos.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      });
    } catch (e) {
      setError(e.message);
    }
  }

  async function guardarPreferencias() {
    const respuesta = await fetch("/api/whatsapp/preferencias", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    const resultado = await respuesta.json();
    if (!respuesta.ok) return setError(resultado.error || "No se pudieron guardar las preferencias");
    setPrefs(resultado.preferencias);
    setAviso("Automatizaciones guardadas.");
  }

  async function sincronizar() {
    const respuesta = await fetch("/api/whatsapp/sincronizar", { method: "POST" });
    const resultado = await respuesta.json();
    if (!respuesta.ok) return setError(resultado.error || "No se pudo sincronizar con Meta");
    setAviso("Cuenta y plantillas comprobadas.");
    await cargar();
  }

  async function prepararPlantillas() {
    setError(null);
    const respuesta = await fetch("/api/whatsapp/plantillas/preparar", { method: "POST" });
    const resultado = await respuesta.json();
    if (!respuesta.ok) return setError(resultado.error || "No se pudieron preparar las plantillas");
    setAviso("Plantillas enviadas a Meta para su aprobación.");
    await cargar();
  }

  async function desconectar() {
    if (!window.confirm("¿Desconectar el número de WhatsApp de esta empresa?")) return;
    await fetch("/api/whatsapp/desconectar", { method: "POST" });
    await cargar();
  }

  async function reintentar(id) {
    const respuesta = await fetch(`/api/whatsapp/mensajes/${id}/reintentar`, { method: "POST" });
    if (respuesta.ok) await cargar();
  }

  function cambiar(ambito, campo, valor) {
    setPrefs((actual) => ({
      ...actual,
      [ambito]: { ...actual[ambito], [campo]: valor },
    }));
  }

  return (
    <>
      <CabeceraPagina
        titulo="WhatsApp Business"
        descripcion="Recordatorios, confirmaciones e historial oficial de Meta, separado para cada empresa."
      />
      {aviso && <p className="text-sm text-emerald-400 mb-4">{aviso}</p>}
      {error && <p className="text-sm text-rose-400 mb-4">{error}</p>}
      {(datos?.alertas ?? []).map((alerta) => (
        <p key={alerta} className="text-sm text-amber-300 border border-amber-400/20 bg-amber-400/5 rounded-xl p-3 mb-3">
          {alerta}
        </p>
      ))}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
        {[
          ["Programados", datos?.resumen?.programado ?? 0],
          ["Enviados", datos?.resumen?.enviado ?? 0],
          ["Entregados", datos?.resumen?.entregado ?? 0],
          ["Leídos", datos?.resumen?.leido ?? 0],
          ["Respondidos", datos?.resumen?.respondido ?? 0],
          ["Fallidos", datos?.resumen?.fallido ?? 0],
        ].map(([titulo, valor]) => (
          <div key={titulo} className="panel p-4">
            <p className="text-2xl font-bold text-white num">{valor}</p>
            <p className="text-xs text-slate-500 mt-1">{titulo}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className="panel p-5 xl:col-span-1">
          <h2 className="font-semibold text-white">Conexión</h2>
          {datos?.cuenta ? (
            <div className="mt-4 space-y-3">
              <Badge tono={datos.cuenta.estado === "activa" ? "green" : "red"}>{datos.cuenta.estado}</Badge>
              <div>
                <p className="text-lg font-semibold text-white">{datos.cuenta.nombreVisible || "WhatsApp Business"}</p>
                <p className="text-sm text-slate-400">{datos.cuenta.numero}</p>
                <p className="text-xs text-slate-500 mt-1">Calidad: {datos.cuenta.calidad || "sin datos"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" onClick={sincronizar}>Comprobar</button>
                <button className="btn-ghost text-rose-400" onClick={desconectar}>Desconectar</button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-slate-400">
                Conecta el número profesional de esta empresa. FILANEX nunca muestra ni comparte sus credenciales.
              </p>
              <button className="btn-primary mt-4" onClick={conectar} disabled={!datos?.disponible}>
                Conectar con Meta
              </button>
              {!datos?.disponible && (
                <p className="text-xs text-amber-400 mt-3">El administrador de FILANEX debe terminar primero la configuración de Meta.</p>
              )}
            </div>
          )}
        </section>

        <section className="panel p-5 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Automatizaciones</h2>
              <p className="text-xs text-slate-500 mt-1">Confirmación inmediata y recordatorio 24 horas antes por defecto.</p>
            </div>
            <button className="btn-primary" onClick={guardarPreferencias}>Guardar</button>
          </div>
          <div className="mt-4 divide-y divide-line">
            {prefs && AMBITOS.map(([clave, titulo, descripcion]) => (
              <div key={clave} className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{titulo}</p>
                    <p className="text-xs text-slate-500">{descripcion}</p>
                  </div>
                  <Interruptor valor={prefs[clave]?.activo !== false} onCambio={(v) => cambiar(clave, "activo", v)} />
                </div>
                <div className="grid sm:grid-cols-3 gap-3 mt-3 text-xs text-slate-300">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={prefs[clave]?.confirmacion !== false} onChange={(e) => cambiar(clave, "confirmacion", e.target.checked)} />
                    Confirmar al crear
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={prefs[clave]?.recordatorios !== false} onChange={(e) => cambiar(clave, "recordatorios", e.target.checked)} />
                    Enviar recordatorio
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="number"
                      min="15"
                      max="10080"
                      className="input !w-24 !py-1"
                      value={prefs[clave]?.minutosAntes ?? 1440}
                      onChange={(e) => cambiar(clave, "minutosAntes", Number(e.target.value))}
                    />
                    minutos antes
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel p-5 mt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">Plantillas oficiales</h2>
            <p className="text-xs text-slate-500 mt-1">Meta debe aprobarlas antes del primer envío.</p>
          </div>
          {datos?.cuenta && <button className="btn-primary" onClick={prepararPlantillas}>Preparar plantillas</button>}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {(datos?.plantillas ?? []).length ? datos.plantillas.map((plantilla) => (
            <span key={plantilla.nombre} className="flex items-center gap-2 border border-line rounded-lg px-3 py-2 text-xs text-slate-300">
              {plantilla.nombre}
              <Badge tono={plantilla.estado === "APPROVED" ? "green" : plantilla.estado === "REJECTED" ? "red" : "amber"}>
                {plantilla.estado}
              </Badge>
            </span>
          )) : <p className="text-sm text-slate-500">Conecta la cuenta y sincroniza para consultar las plantillas.</p>}
        </div>
      </section>

      <section className="panel mt-5 overflow-hidden">
        <div className="p-5 border-b border-line">
          <h2 className="font-semibold text-white">Historial y trazabilidad</h2>
          <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
            <input className="input" placeholder="Cliente o teléfono" value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value })} />
            <select className="input" value={filtros.ambito} onChange={(e) => setFiltros({ ...filtros, ambito: e.target.value })}>
              <option value="">Todos los ámbitos</option>
              {AMBITOS.map(([clave, nombre]) => <option key={clave} value={clave}>{nombre}</option>)}
              <option value="documento">Documentos</option>
              <option value="cliente">Clientes</option>
            </select>
            <select className="input" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
              <option value="">Todos los estados</option>
              {Object.keys(ESTADO_TONO).map((estado) => <option key={estado}>{estado}</option>)}
            </select>
            <input type="date" className="input" aria-label="Desde" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} />
            <input type="date" className="input" aria-label="Hasta" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr><th>Fecha</th><th>Destinatario</th><th>Origen</th><th>Plantilla</th><th>Estado</th><th>Acción</th></tr>
            </thead>
            <tbody>
              {mensajes.map((mensaje) => (
                <tr key={mensaje._id}>
                  <td>{new Date(mensaje.createdAt).toLocaleString("es-ES")}</td>
                  <td><span className="block text-white">{mensaje.clienteNombre || "—"}</span><span className="text-xs text-slate-500">{mensaje.telefono}</span></td>
                  <td>{mensaje.origen?.ambito}</td>
                  <td className="text-xs">{mensaje.plantilla}</td>
                  <td><Badge tono={ESTADO_TONO[mensaje.estado] || "slate"}>{mensaje.estado}</Badge>{mensaje.error && <span className="block text-xs text-rose-400 mt-1 max-w-xs">{mensaje.error}</span>}</td>
                  <td>{mensaje.estado === "fallido" && <button className="text-xs text-accent hover:underline" onClick={() => reintentar(mensaje._id)}>Reintentar</button>}</td>
                </tr>
              ))}
              {!mensajes.length && <tr><td colSpan={6} className="text-center py-8 text-slate-500">Todavía no hay mensajes.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}