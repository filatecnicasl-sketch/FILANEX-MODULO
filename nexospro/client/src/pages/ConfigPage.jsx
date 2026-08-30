import { useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import VinculoAsesoria from "../components/VinculoAsesoria.jsx";

const campo = "w-full input";
const etiqueta = "block text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400 mb-1.5";

export default function ConfigPage() {
  const [empresa, setEmpresa] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);
  const inputLogo = useRef(null);

  useEffect(() => {
    fetch("/api/empresa")
      .then((r) => r.json())
      .then(setEmpresa)
      .catch(() => setError("No se pudo conectar con la API."));
  }, []);

  function actualizar(campoNombre, valor) {
    setEmpresa((e) => ({ ...e, [campoNombre]: valor }));
  }

  function actualizarDireccion(campoNombre, valor) {
    setEmpresa((e) => ({ ...e, direccion: { ...(e.direccion ?? {}), [campoNombre]: valor } }));
  }

  function actualizarSepa(campoNombre, valor) {
    setEmpresa((e) => ({ ...e, sepa: { ...(e.sepa ?? {}), [campoNombre]: valor } }));
  }

  async function subirLogo(archivo) {
    if (!archivo) return;
    setError(null);
    setAviso(null);
    const datos = new FormData();
    datos.append("archivo", archivo);
    const r = await fetch("/api/empresa/logo", { method: "POST", body: datos });
    const json = await r.json();
    if (r.ok) {
      setEmpresa((e) => ({ ...e, logoUrl: `${json.logoUrl}?t=${Date.now()}` }));
      setAviso("Logo actualizado.");
    } else setError(json.error || "No se pudo subir el logo");
  }

  async function quitarLogo() {
    setError(null);
    const r = await fetch("/api/empresa/logo", { method: "DELETE" });
    if (r.ok) setEmpresa((e) => ({ ...e, logoUrl: undefined }));
  }

  async function guardar() {
    setAviso(null);
    setError(null);
    const r = await fetch("/api/empresa", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: empresa.nombre,
        nif: empresa.nif,
        telefono: empresa.telefono,
        email: empresa.email,
        direccion: empresa.direccion,
        sepa: empresa.sepa,
      }),
    });
    const datos = await r.json();
    if (r.ok) {
      setEmpresa(datos);
      setAviso("Configuración guardada.");
    } else setError(datos.error || "Error al guardar");
  }

  if (!empresa) {
    return (
      <>
        <CabeceraPagina titulo="Configuración" descripcion="Datos fiscales de la empresa y remesas SEPA." />
        {error && <p className="text-sm text-red-400">{error}</p>}
      </>
    );
  }

  return (
    <>
      <CabeceraPagina
        titulo="Configuración"
        descripcion="Datos fiscales de la empresa y cuenta SEPA para las remesas de cobro."
      >
        <button onClick={guardar} className="btn-primary">
          Guardar
        </button>
      </CabeceraPagina>

      {aviso && <p className="text-sm text-emerald-600 mb-4">{aviso}</p>}
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="panel p-6 mb-6">
        <h2 className="text-white font-semibold">Datos de empresa</h2>
        <p className="text-xs text-slate-500 mt-0.5 mb-5">
          Aparecerán en tus documentos y facturas.
        </p>

        {/* Logo */}
        <div className="flex items-center gap-4 mb-6">
          <span className="w-[72px] h-[72px] rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
            {empresa.logoUrl ? (
              <img src={empresa.logoUrl} alt="Logo de la empresa" className="max-w-full max-h-full object-contain" />
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="9" cy="9" r="1.8" />
                <path d="m21 15-4.5-4.5L6 21" />
              </svg>
            )}
          </span>
          <div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => inputLogo.current?.click()} className="btn-ghost">
                Cambiar logo
              </button>
              {empresa.logoUrl && (
                <button
                  type="button"
                  onClick={quitarLogo}
                  className="text-sm font-medium text-rose-500 hover:text-rose-600"
                >
                  Quitar
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              PNG, JPG o WEBP · máx. 600 KB. Aparecerá en tus documentos.
            </p>
            <input
              ref={inputLogo}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => subirLogo(e.target.files?.[0])}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
          <div className="md:col-span-2">
            <label className={etiqueta}>Nombre / Razón social</label>
            <input className={campo} value={empresa.nombre ?? ""}
              onChange={(e) => actualizar("nombre", e.target.value)} />
          </div>
          <div>
            <label className={etiqueta}>NIF / CIF</label>
            <input className={campo} value={empresa.nif ?? ""}
              onChange={(e) => actualizar("nif", e.target.value)} />
          </div>
          <div>
            <label className={etiqueta}>Teléfono</label>
            <input className={campo} value={empresa.telefono ?? ""}
              onChange={(e) => actualizar("telefono", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={etiqueta}>Dirección</label>
            <input className={campo} value={empresa.direccion?.calle ?? ""}
              onChange={(e) => actualizarDireccion("calle", e.target.value)} />
          </div>
          <div>
            <label className={etiqueta}>Código postal</label>
            <input className={campo} value={empresa.direccion?.cp ?? ""}
              onChange={(e) => actualizarDireccion("cp", e.target.value)} />
          </div>
          <div>
            <label className={etiqueta}>Ciudad</label>
            <input className={campo} value={empresa.direccion?.ciudad ?? ""}
              onChange={(e) => actualizarDireccion("ciudad", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={etiqueta}>Email</label>
            <input type="email" className={campo} value={empresa.email ?? ""}
              onChange={(e) => actualizar("email", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={etiqueta}>IBAN</label>
            <input className={campo} value={empresa.sepa?.iban ?? ""}
              onChange={(e) => actualizarSepa("iban", e.target.value)} />
          </div>
        </div>
      </div>

      <VinculoAsesoria />

      <div className="panel p-6 space-y-3">
        <h2 className="text-white font-semibold">Remesas SEPA</h2>
        <p className="text-xs text-slate-500">
          Necesarios para generar los archivos de remesa (pain.008) que se suben al banco.
          El identificador de acreedor tiene el formato ES + sufijo + NIF (lo asigna tu banco).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={etiqueta}>Identificador de acreedor (ES…)</label>
            <input className={campo} value={empresa.sepa?.idAcreedor ?? ""}
              onChange={(e) => actualizarSepa("idAcreedor", e.target.value)} />
          </div>
        </div>
      </div>
    </>
  );
}
