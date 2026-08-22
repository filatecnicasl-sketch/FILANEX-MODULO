import { useEffect, useRef, useState } from "react";
import { IconImprimir } from "./icons.jsx";
import { imprimirFormato } from "../utils/imprimir-formato.jsx";
import { descargarPdf, imprimirDocumentoRapido } from "../utils/pdf.js";

const fechaEs = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "");
const dirTexto = (d) => [d?.calle, d?.cp, d?.ciudad, d?.provincia].filter(Boolean).join(", ");

async function cargarPlantillaEntrada() {
  try {
    const r = await fetch("/api/formatos/default/entrada-sat");
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function imprimirHojaEntradaServicio(o) {
  const plantilla = await cargarPlantillaEntrada();
  if (!plantilla) return;
  const emp = await fetch("/api/empresa").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));

  const formData = {
    "taller.nombre": emp.nombre,
    "taller.cif": emp.nif,
    "taller.direccion": dirTexto(emp.direccion),
    "taller.mail": emp.email,
    "taller.telefono": emp.telefono,
    "resguardo.numero": o.numero,
    "cliente.titular": o.cliente?.nombre ?? o.clienteNombre,
    "cliente.cifTitular": o.cliente?.nif,
    "cliente.direccion": dirTexto(o.cliente?.direccion),
    "cliente.telefono": o.cliente?.telefono ?? o.telefono,
    "cliente.mail": o.cliente?.email,
    "aparato.fecha": fechaEs(o.fechaEntrada),
    "aparato.tipo": o.aparato?.tipo ?? o.aparatoDescripcion,
    "aparato.marca": o.aparato?.marca,
    "aparato.modelo": o.aparato?.modelo,
    "aparato.serie": o.aparato?.numeroSerie,
    "aparato.accesorios": o.accesorios,
    "aparato.estadoFisico": o.estadoFisico,
    "aparato.averia": o.averia,
    "aparato.garantiaSi": o.garantia === "en_garantia",
    "aparato.garantiaNo": o.garantia !== "en_garantia",
    "entrega.fechaPrevista": fechaEs(o.fechaEntregaPrevista),
  };

  const tabla = plantilla.elements.find((e) => e.type === "table");
  if (tabla) {
    (o.lineas ?? []).slice(0, tabla.rows).forEach((l, r) => {
      formData[`tbl_${tabla.id}_${r}_0`] = l.descripcion ?? "";
      if (l.tipo === "mano_obra") formData[`tbl_${tabla.id}_${r}_1`] = "X";
      if (l.tipo === "material") formData[`tbl_${tabla.id}_${r}_2`] = "X";
    });
  }

  const signatures = {};
  if (o.recepcionDigital?.firma?.imagen) signatures.cliente = o.recepcionDigital.firma.imagen;

  const conTitulo = (texto) => ({
    ...plantilla,
    elements: plantilla.elements.map((el) =>
      el.type === "text" && /EJEMPLAR PARA/i.test(el.text ?? "") ? { ...el, text: texto } : el
    ),
  });
  const paginas = [
    conTitulo("EJEMPLAR PARA EL PRESTADOR DEL SERVICIO"),
    conTitulo("EJEMPLAR PARA EL CLIENTE"),
  ];

  imprimirFormato(paginas, formData, signatures);
}

export default function MenuImprimirOrdenServicio({ orden, pequeno = false }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e) => {
      if (!ref.current?.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);

  function elegir(variante) {
    setAbierto(false);
    if (variante === "entrada") imprimirHojaEntradaServicio(orden);
    else if (variante === "parte-pdf") descargarPdf("parte-sat", orden._id, orden.numero);
    else imprimirDocumentoRapido("parte-sat", orden._id);
  }

  return (
    <span ref={ref} className="relative inline-block align-middle">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        title="Imprimir orden SAT"
        className={
          pequeno
            ? "inline-flex items-center gap-0.5 text-[0.6875rem] text-slate-400 hover:text-accent transition-colors"
            : "inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors"
        }
      >
        <IconImprimir />
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {abierto && (
        <span className="absolute right-0 top-full z-40 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-xl py-1 text-left">
          <button type="button" onClick={() => elegir("entrada")} className="block w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-accent/10 hover:text-accent">
            Hoja de entrada
          </button>
          <button type="button" onClick={() => elegir("parte")} className="block w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-accent/10 hover:text-accent">
            Parte de trabajo
          </button>
          <button type="button" onClick={() => elegir("parte-pdf")} className="block w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-accent/10 hover:text-accent">
            Parte de trabajo PDF
          </button>
        </span>
      )}
    </span>
  );
}
