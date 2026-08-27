import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";

const tarjetaModulo = (activo, disponible) =>
  `text-left rounded-xl border p-4 transition ${
    !disponible
      ? "border-slate-200 opacity-50 cursor-not-allowed"
      : activo
        ? "border-accent/50 bg-accent/[0.06] shadow-sm"
        : "border-slate-200 hover:border-accent/40 bg-white"
  }`;

export default function ModulosPage() {
  const [empresa, setEmpresa] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/empresa")
      .then((r) => r.json())
      .then(setEmpresa)
      .catch(() => setError("No se pudo conectar con la API."));
    fetch("/api/empresa/modulos")
      .then((r) => r.json())
      .then(setCatalogo)
      .catch(() => {});
  }, []);

  function alternarModulo(clave) {
    const actuales = empresa.modulos ?? [];
    const modulos = actuales.includes(clave)
      ? actuales.filter((modulo) => modulo !== clave)
      : [...actuales, clave];
    setEmpresa((datos) => ({ ...datos, modulos }));
  }

  async function guardar() {
    setAviso(null);
    setError(null);
    const r = await fetch("/api/empresa", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modulos: empresa.modulos ?? [],
      }),
    });
    const datos = await r.json();
    if (r.ok) {
      setEmpresa(datos);
      setAviso("Módulos guardados. Se aplican al cambiar de página.");
    } else setError(datos.error || "Error al guardar");
  }

  if (!empresa) {
    return (
      <>
        <CabeceraPagina titulo="Módulos" descripcion="Módulos activos de la instalación y pantalla de inicio." />
        {error && <p className="text-sm text-red-400">{error}</p>}
      </>
    );
  }

  const activos = empresa.modulos ?? [];
  return (
    <>
      <CabeceraPagina
        titulo="Módulos"
        descripcion="Activa los módulos contratados para esta empresa."
      >
        <button onClick={guardar} className="btn-primary">
          Guardar
        </button>
      </CabeceraPagina>

      {aviso && <p className="text-sm text-emerald-600 mb-4">{aviso}</p>}
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="panel p-6">
        <h2 className="text-white font-semibold">Módulos de la instalación</h2>
        <p className="text-xs text-slate-500 mt-0.5 mb-5">
          FILANEX es el núcleo de facturación. Cada módulo se activa según la licencia contratada
          por el cliente; solo aparecen en el menú los módulos activos.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {catalogo.map((m) => {
            const activo = activos.includes(m.clave);
            return (
              <button
                key={m.clave}
                type="button"
                disabled={!m.disponible}
                onClick={() => alternarModulo(m.clave)}
                className={tarjetaModulo(activo, m.disponible)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-sm">
                    FILANEX {m.nombre.toUpperCase()}
                  </span>
                  {m.disponible ? (
                    <span
                      className={`text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full ${
                        activo ? "bg-accent/15 text-accent" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {activo ? "Activo" : "Desactivado"}
                    </span>
                  ) : (
                    <span className="text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      Próximamente
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">{m.descripcion}</p>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
