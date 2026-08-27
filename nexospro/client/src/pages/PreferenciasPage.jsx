import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { guardarInicioDispositivo, obtenerInicioDispositivo } from "../lib/preferenciaInicio.js";

const tarjeta = (seleccionada) =>
  `text-left rounded-xl border p-4 transition ${
    seleccionada
      ? "border-accent/50 bg-accent/[0.06] shadow-sm"
      : "border-slate-200 hover:border-accent/40 bg-white"
  }`;

export default function PreferenciasPage() {
  const [empresa, setEmpresa] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [inicio, setInicio] = useState("panel");
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/empresa").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/empresa/modulos").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([datosEmpresa, datosCatalogo]) => {
        setEmpresa(datosEmpresa);
        setCatalogo(datosCatalogo);
        setInicio(obtenerInicioDispositivo(datosEmpresa?.moduloInicio ?? "panel"));
      })
      .catch(() => setError("No se pudieron cargar las preferencias."));
  }, []);

  const activos = empresa?.modulos ?? [];
  const opciones = [
    { clave: "panel", nombre: "Panel principal", descripcion: "Tesorería y situación general de la empresa" },
    { clave: "agenda", nombre: "Agenda", descripcion: "Calendario, citas y recordatorios" },
    ...catalogo
      .filter((modulo) => modulo.disponible && activos.includes(modulo.clave))
      .map((modulo) => ({
        clave: modulo.clave,
        nombre: modulo.nombre,
        descripcion: `Panel principal de ${modulo.nombre.toLowerCase()}`,
      })),
  ];

  function elegir(clave) {
    setInicio(clave);
    guardarInicioDispositivo(clave);
    setAviso("Preferencia guardada para este usuario en este dispositivo.");
  }

  return (
    <>
      <CabeceraPagina
        titulo="Mis preferencias"
        descripcion="Personaliza cómo se abre FILANEX en este dispositivo."
      />

      {aviso && <p className="text-sm text-emerald-600 mb-4">{aviso}</p>}
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="panel p-6">
        <h2 className="text-white font-semibold">Pantalla de inicio</h2>
        <p className="text-xs text-slate-500 mt-0.5 mb-5">
          Esta elección solo afecta a tu usuario en este móvil, tableta u ordenador.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {opciones.map((opcion) => (
            <button
              key={opcion.clave}
              type="button"
              onClick={() => elegir(opcion.clave)}
              className={tarjeta(inicio === opcion.clave)}
            >
              <span className="font-semibold text-white text-sm">{opcion.nombre}</span>
              <p className="text-xs text-slate-500 mt-1.5">{opcion.descripcion}</p>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}