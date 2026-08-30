import { useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { Badge } from "../components/ui.jsx";

function IconoEscudo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-4z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

const fechaCorta = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "—";

export default function CertificadoPage() {
  const [estado, setEstado] = useState(null);
  const [envio, setEnvio] = useState(null);
  const [guardandoEnvio, setGuardandoEnvio] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [pass, setPass] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [probando, setProbando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);
  const inputArchivo = useRef(null);

  const cargar = () =>
    fetch("/api/certificado").then((r) => r.json()).then(setEstado).catch(() => setError("No se pudo conectar con la API."));

  const cargarEnvio = () =>
    fetch("/api/verifactu/estado")
      .then((r) => r.json())
      .then((v) =>
        setEnvio({
          activo: Boolean(v.envioActivo),
          desde: v.enviarDesde ? String(v.enviarDesde).slice(0, 10) : "",
          pendientes: v.registrosPendientesEnvio ?? 0,
        })
      )
      .catch(() => {});

  useEffect(() => {
    cargar();
    cargarEnvio();
  }, []);

  async function guardarEnvio(activo, desde) {
    setAviso(null);
    setError(null);
    if (activo && !window.confirm(
      "Vas a ACTIVAR el envío a la AEAT.\n\nA partir de ahora las facturas emitidas se remitirán automáticamente y el envío no se puede deshacer. ¿Continuar?"
    )) return;
    setGuardandoEnvio(true);
    try {
      const r = await fetch("/api/verifactu/envio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envioActivo: activo, enviarDesde: desde || null }),
      });
      const resp = await r.json();
      if (!r.ok) throw new Error(resp.error || "No se pudo guardar");
      setEnvio((e) => ({ ...e, activo, desde }));
      setAviso(activo ? "Envío a la AEAT ACTIVADO." : "Envío a la AEAT desactivado: las facturas se registran pero no se remiten.");
    } catch (e2) {
      setError(e2.message);
    } finally {
      setGuardandoEnvio(false);
    }
  }

  async function subir(e) {
    e.preventDefault();
    setAviso(null);
    setError(null);
    if (!archivo) return setError("Selecciona el archivo .pfx o .p12 del certificado.");
    if (!pass) return setError("Indica la contraseña del certificado.");
    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.append("certificado", archivo);
      datos.append("pass", pass);
      const r = await fetch("/api/certificado", { method: "POST", body: datos });
      const resp = await r.json();
      if (!r.ok) throw new Error(resp.error || "No se pudo subir");
      setEstado(resp);
      setArchivo(null);
      setPass("");
      if (inputArchivo.current) inputArchivo.current.value = "";
      setAviso("Certificado cargado y validado. Ya firma las remisiones a la AEAT.");
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function cambiarEntorno(entorno) {
    setAviso(null);
    setError(null);
    try {
      const r = await fetch("/api/certificado/entorno", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entorno }),
      });
      const resp = await r.json();
      if (!r.ok) throw new Error(resp.error || "No se pudo cambiar");
      setEstado(resp);
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function probar() {
    setAviso(null);
    setError(null);
    setProbando(true);
    try {
      const r = await fetch("/api/certificado/probar");
      const resp = await r.json();
      if (!r.ok) throw new Error(resp.error || "Fallo de validación");
      setAviso("Certificado válido: el archivo y la contraseña guardados son correctos.");
    } catch (e2) {
      setError(e2.message);
    } finally {
      setProbando(false);
    }
  }

  async function eliminar() {
    if (!window.confirm("¿Eliminar el certificado? Las remisiones VeriFactu se detendrán hasta cargar otro.")) return;
    setAviso(null);
    setError(null);
    try {
      const r = await fetch("/api/certificado", { method: "DELETE" });
      const resp = await r.json();
      if (!r.ok) throw new Error(resp.error || "No se pudo eliminar");
      setEstado(resp);
      setAviso("Certificado eliminado.");
    } catch (e2) {
      setError(e2.message);
    }
  }

  return (
    <>
      <CabeceraPagina
        titulo="Certificado / FACe"
        descripcion="Certificado electrónico del representante. Firma las remisiones VeriFactu a la AEAT y sirve también para FACe (facturas a administraciones públicas)."
      />

      {aviso && <p className="text-sm text-accent mb-4">{aviso}</p>}
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {!estado ? null : (
        <>
          {envio && (
            <div className={`panel p-5 mb-5 max-w-3xl border-l-4 ${envio.activo ? "border-l-emerald-500" : "border-l-amber-500"}`}>
              <div className="flex items-center gap-3 mb-3">
                <div>
                  <h2 className="text-white font-semibold leading-tight">Envío a la AEAT</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Las facturas se registran siempre con su huella y su QR. Esto controla si además se remiten a Hacienda.
                  </p>
                </div>
                <span className="ml-auto">
                  {envio.activo ? <Badge tono="green">Activado</Badge> : <Badge tono="amber">Desactivado</Badge>}
                </span>
              </div>

              {!envio.activo && (
                <p className="text-xs text-amber-500 mb-3">
                  Ahora mismo NO se envía nada a la AEAT, ni aunque haya certificado.
                  {envio.pendientes > 0 && ` Hay ${envio.pendientes} factura(s) registradas en espera.`}
                </p>
              )}

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Enviar solo facturas a partir de</label>
                  <input
                    type="date"
                    value={envio.desde}
                    onChange={(e) => setEnvio((v) => ({ ...v, desde: e.target.value }))}
                    className="input"
                  />
                  <p className="text-[0.6875rem] text-slate-500 mt-1">
                    Las anteriores a esta fecha nunca se remiten automáticamente.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={guardandoEnvio}
                  onClick={() => guardarEnvio(!envio.activo, envio.desde)}
                  className={envio.activo ? "btn-ghost text-rose-400 hover:text-rose-300" : "btn-primary"}
                >
                  {guardandoEnvio ? "Guardando…" : envio.activo ? "Desactivar envío" : "Activar envío a la AEAT"}
                </button>
                {envio.activo && (
                  <button type="button" disabled={guardandoEnvio} onClick={() => guardarEnvio(true, envio.desde)} className="btn-ghost">
                    Guardar fecha
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="panel p-5 mb-5 max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-100 text-teal-600 shrink-0">
                <IconoEscudo />
              </span>
              <div>
                <h2 className="text-white font-semibold leading-tight">Certificado cargado</h2>
                <p className="text-xs text-slate-500 mt-0.5">El certificado del representante de la empresa</p>
              </div>
              <span className="ml-auto">
                {estado.configurado ? <Badge tono="green">Configurado</Badge> : <Badge tono="amber">Sin certificado</Badge>}
              </span>
            </div>

            {estado.configurado && (
              <dl className="grid grid-cols-3 gap-4 mb-4 text-sm">
                <div>
                  <dt className="text-[0.65625rem] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-0.5">Archivo</dt>
                  <dd className="text-white num">{estado.archivo}</dd>
                </div>
                <div>
                  <dt className="text-[0.65625rem] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-0.5">Cargado</dt>
                  <dd className="text-white">{fechaCorta(estado.fecha)}</dd>
                </div>
                <div>
                  <dt className="text-[0.65625rem] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-0.5">Contraseña</dt>
                  <dd className="text-white">{estado.conPass ? "Guardada" : "No guardada"}</dd>
                </div>
              </dl>
            )}

            <div className="mb-4">
              <span className="text-[0.65625rem] font-semibold uppercase tracking-[0.1em] text-slate-500 block mb-1.5">
                Entorno VeriFactu
              </span>
              <div className="flex gap-2">
                {["pruebas", "produccion"].map((ent) => (
                  <button
                    key={ent}
                    type="button"
                    onClick={() => cambiarEntorno(ent)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      estado.entorno === ent
                        ? "bg-accent text-white border-accent"
                        : "border-line text-slate-400 hover:border-accent/50"
                    }`}
                  >
                    {ent === "pruebas" ? "Pruebas" : "Producción"}
                  </button>
                ))}
              </div>
              {estado.entorno === "pruebas" && (
                <p className="text-xs text-amber-600 mt-2">
                  En pruebas los envíos van a los servidores de test de la AEAT. Cambia a Producción solo cuando el certificado sea el definitivo.
                </p>
              )}
            </div>

            {estado.configurado && (
              <div className="flex gap-2">
                <button type="button" onClick={probar} disabled={probando} className="btn-ghost">
                  {probando ? "Comprobando…" : "Probar certificado"}
                </button>
                <button type="button" onClick={eliminar} className="btn-ghost text-rose-400 hover:text-rose-300">
                  Eliminar
                </button>
              </div>
            )}
          </div>

          <form onSubmit={subir} className="panel p-5 max-w-3xl">
            <h2 className="text-white font-semibold mb-1">
              {estado.configurado ? "Sustituir certificado" : "Subir certificado"}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Archivo .pfx o .p12 del certificado electrónico de representante (FNMT / Camerfirma…). Se valida antes de guardarlo.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Archivo del certificado</label>
                <input
                  ref={inputArchivo}
                  type="file"
                  accept=".pfx,.p12"
                  onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                  className="input file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-accent/10 file:text-accent file:text-xs file:font-semibold"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Contraseña del certificado</label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className="input"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <button type="submit" disabled={subiendo} className="btn-primary">
                {subiendo ? "Validando…" : "Subir y validar"}
              </button>
            </div>
          </form>
        </>
      )}
    </>
  );
}
