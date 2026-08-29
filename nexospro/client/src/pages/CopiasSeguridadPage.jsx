import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { Badge } from "../components/ui.jsx";

const fechaLarga = (iso) =>
  iso
    ? new Date(iso).toLocaleString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const tamanoLegible = (bytes) => {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// Descarga un blob como archivo en el equipo del usuario (PC, móvil o, si el
// navegador tiene una carpeta del NAS como destino de descargas, al NAS).
async function descargar(archivo) {
  const r = await fetch(`/api/backups/${archivo}/descargar`);
  if (!r.ok) {
    const resp = await r.json().catch(() => ({}));
    throw new Error(resp.error || "No se pudo descargar la copia");
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = archivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

export default function CopiasSeguridadPage() {
  const [copias, setCopias] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [descargando, setDescargando] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);

  const cargar = () =>
    fetch("/api/backups")
      .then((r) => r.json())
      .then((datos) => setCopias(Array.isArray(datos) ? datos : []))
      .catch(() => setError("No se pudo conectar con la API."));

  useEffect(() => {
    cargar();
  }, []);

  async function generar() {
    setAviso(null);
    setError(null);
    setGenerando(true);
    try {
      const r = await fetch("/api/backups", { method: "POST" });
      const resp = await r.json();
      if (!r.ok) throw new Error(resp.error || "No se pudo crear la copia");
      setAviso(
        `Copia creada: ${resp.documentos.toLocaleString("es-ES")} documentos de ${resp.colecciones} apartados. Descárgala para guardarla en tu equipo.`
      );
      cargar();
      await descargar(resp.archivo);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerando(false);
    }
  }

  async function bajar(archivo) {
    setAviso(null);
    setError(null);
    setDescargando(archivo);
    try {
      await descargar(archivo);
    } catch (e) {
      setError(e.message);
    } finally {
      setDescargando(null);
    }
  }

  async function borrar(archivo) {
    if (!window.confirm(`¿Borrar la copia ${archivo}? Esta acción no se puede deshacer.`)) return;
    setAviso(null);
    setError(null);
    try {
      const r = await fetch(`/api/backups/${archivo}`, { method: "DELETE" });
      const resp = await r.json();
      if (!r.ok) throw new Error(resp.error || "No se pudo borrar");
      setAviso("Copia borrada.");
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const automaticas = (copias ?? []).filter((c) => c.origen === "auto");
  const manuales = (copias ?? []).filter((c) => c.origen === "manual");

  const FilaCopia = ({ copia }) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-line/60 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white truncate num">{copia.archivo}</p>
        <p className="text-xs text-slate-500">
          {fechaLarga(copia.fecha)} · {tamanoLegible(copia.tamano)}
        </p>
      </div>
      <Badge tono={copia.origen === "auto" ? "sky" : "violet"}>
        {copia.origen === "auto" ? "Automática" : "Manual"}
      </Badge>
      <button
        type="button"
        onClick={() => bajar(copia.archivo)}
        disabled={descargando === copia.archivo}
        className="btn-ghost text-xs px-3 py-1.5"
      >
        {descargando === copia.archivo ? "Descargando…" : "Descargar"}
      </button>
      <button
        type="button"
        onClick={() => borrar(copia.archivo)}
        className="btn-ghost text-xs px-3 py-1.5 text-rose-400 hover:text-rose-300"
      >
        Borrar
      </button>
    </div>
  );

  return (
    <>
      <CabeceraPagina
        titulo="Copias de seguridad"
        descripcion="Copia completa de los datos de tu empresa (clientes, facturas, taller, agenda…). Descárgala y guárdala en tu ordenador, servidor o NAS."
      />

      {aviso && <p className="text-sm text-accent mb-4">{aviso}</p>}
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="panel p-5 mb-5 max-w-3xl">
        <h2 className="text-white font-semibold mb-1">Crear copia ahora</h2>
        <p className="text-xs text-slate-500 mb-4">
          Genera un archivo ZIP con todos los datos de la empresa y se descarga en este equipo.
          Guárdalo en tu ordenador, en un disco externo o en la carpeta de tu NAS.
        </p>
        <button type="button" onClick={generar} disabled={generando} className="btn-primary">
          {generando ? "Creando copia…" : "Crear y descargar copia"}
        </button>
      </div>

      <div className="panel p-5 mb-5 max-w-3xl">
        <h2 className="text-white font-semibold mb-1">Copias automáticas</h2>
        <p className="text-xs text-slate-500 mb-3">
          Cada noche el servidor crea una copia de tu empresa y guarda las últimas 14.
          Descarga de vez en cuando la más reciente para tenerla también fuera del servidor.
        </p>
        {!copias ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : automaticas.length === 0 ? (
          <p className="text-sm text-slate-500">
            Todavía no hay copias automáticas: se crean cada noche sobre las 03:30.
          </p>
        ) : (
          automaticas.map((c) => <FilaCopia key={c.archivo} copia={c} />)
        )}
      </div>

      {manuales.length > 0 && (
        <div className="panel p-5 mb-5 max-w-3xl">
          <h2 className="text-white font-semibold mb-1">Copias manuales</h2>
          <p className="text-xs text-slate-500 mb-3">
            Las copias que creas tú no se borran solas. Elimina las que ya no necesites.
          </p>
          {manuales.map((c) => <FilaCopia key={c.archivo} copia={c} />)}
        </div>
      )}

      <div className="panel p-5 max-w-3xl">
        <h2 className="text-white font-semibold mb-1">Cómo guardarla en tu NAS o servidor</h2>
        <ol className="text-xs text-slate-400 list-decimal list-inside space-y-1.5">
          <li>Pulsa «Crear y descargar copia» o descarga la automática más reciente.</li>
          <li>El archivo ZIP se guarda en la carpeta de descargas de este equipo.</li>
          <li>Cópialo a tu NAS, disco externo o servidor: con arrastrarlo a la carpeta vale.</li>
          <li>Recomendación: conserva al menos una copia por semana fuera del servidor.</li>
        </ol>
      </div>
    </>
  );
}
