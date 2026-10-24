import { useState } from "react";
import BuscadorEntidad from "./BuscadorEntidad.jsx";
import { invalidarClientesLigeros } from "../lib/clientesLigeros.js";

// Selector de cliente/proveedor con buscador unificado (BuscadorEntidad) y
// alta rápida completa sin salir del documento (nombre, NIF, contacto,
// dirección y datos bancarios — igual que en la ficha).
// tipo="cliente" (NIF obligatorio) | tipo="proveedor".
// onPendiente(true|false): avisa al formulario padre de que hay un alta
// a medias con datos escritos, para que no se guarden y cierren sin más
// (pasó en Rolusur: guardaron el suministro sin pulsar «Crear y
// seleccionar» y se perdieron los datos del cliente).
const VACIO = {
  nombre: "", nif: "", telefono: "", email: "",
  calle: "", ciudad: "", cp: "",
  iban: "", banco: "", bic: "", notas: "",
};

export default function SelectorContacto({ tipo = "cliente", contactos, valor, onChange, onCreado, onPendiente }) {
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [docsPend, setDocsPend] = useState([]);
  const [error, setError] = useState(null);

  const esCliente = tipo === "cliente";
  const url = esCliente ? "/api/clientes" : "/api/proveedores";
  const etiqueta = esCliente ? "cliente" : "proveedor";

  const poner = (campo, v) => {
    setNuevo((n) => ({ ...n, [campo]: v }));
    // Los campos solo se ven con el panel de alta abierto: escribir en
    // cualquiera significa que hay datos que pueden perderse.
    onPendiente?.(true);
  };

  function abrirCreacion() {
    setCreando(true);
    onPendiente?.(false);
  }

  function cerrarCreacion() {
    setCreando(false);
    setError(null);
    setDocsPend([]);
    onPendiente?.(false);
  }

  // Adjuntar documentación al alta del cliente (DNI, factura…): los archivos
  // se eligen ahora y se suben justo después de crearlo (propuesta Rolusur —
  // antes había que volver a la ficha del cliente para adjuntarlos).
  function elegirDocs(e) {
    const archivos = [...(e.target.files ?? [])].filter(
      (f) => f.type === "application/pdf" || f.type.startsWith("image/")
    );
    e.target.value = "";
    if (archivos.length) setDocsPend((d) => [...d, ...archivos]);
  }

  async function subirDocsCliente(idCliente) {
    const cuerpo = new FormData();
    docsPend.forEach((f) => cuerpo.append("archivos", f));
    const r = await fetch(`/api/clientes/${idCliente}/documentos`, { method: "POST", body: cuerpo });
    if (!r.ok) throw new Error("No se pudo subir la documentación");
  }

  async function crear() {
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nuevo.nombre.trim(),
          nif: nuevo.nif.trim() || undefined,
          telefono: nuevo.telefono.trim() || undefined,
          email: nuevo.email.trim() || undefined,
          direccion: {
            calle: nuevo.calle.trim() || undefined,
            ciudad: nuevo.ciudad.trim() || undefined,
            cp: nuevo.cp.trim() || undefined,
          },
          iban: nuevo.iban.trim() || undefined,
          banco: nuevo.banco.trim() || undefined,
          bic: nuevo.bic.trim() || undefined,
          notas: nuevo.notas.trim() || undefined,
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al crear");
      // El cliente ya existe: subir la documentación elegida. Si falla, el
      // cliente no se pierde — solo avisamos para adjuntarla luego.
      if (esCliente && docsPend.length) {
        try {
          await subirDocsCliente(datos._id);
        } catch {
          window.alert(
            "El cliente se ha creado correctamente, pero su documentación no se ha podido subir.\n\n" +
              "Puedes adjuntarla después abriendo su ficha (pestaña Documentos)."
          );
        }
      }
      if (esCliente) invalidarClientesLigeros();
      onCreado?.(datos);
      onChange(datos._id);
      onPendiente?.(false);
      setCreando(false);
      setNuevo(VACIO);
      setDocsPend([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (creando) {
    return (
      <div className="mt-1 rounded-lg border border-accent/40 bg-accent/5 p-3.5 space-y-2.5">
        <p className="text-xs font-semibold text-accent uppercase tracking-wider">
          Nuevo {etiqueta}
        </p>
        <input
          autoFocus
          placeholder="Nombre / Razón social *"
          value={nuevo.nombre}
          onChange={(e) => poner("nombre", e.target.value)}
          className="input w-full"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder={esCliente ? "NIF / CIF *" : "NIF / CIF"}
            value={nuevo.nif}
            onChange={(e) => poner("nif", e.target.value)}
            className="input"
          />
          <input
            placeholder="Teléfono"
            value={nuevo.telefono}
            onChange={(e) => poner("telefono", e.target.value)}
            className="input"
          />
        </div>
        <input
          placeholder="Email"
          type="email"
          value={nuevo.email}
          onChange={(e) => poner("email", e.target.value)}
          className="input w-full"
        />
        <input
          placeholder="Dirección"
          value={nuevo.calle}
          onChange={(e) => poner("calle", e.target.value)}
          className="input w-full"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Ciudad"
            value={nuevo.ciudad}
            onChange={(e) => poner("ciudad", e.target.value)}
            className="input"
          />
          <input
            placeholder="Código postal"
            value={nuevo.cp}
            onChange={(e) => poner("cp", e.target.value)}
            className="input"
          />
        </div>
        <p className="text-[0.65625rem] font-semibold uppercase tracking-wider text-slate-500 pt-1">
          Datos bancarios
        </p>
        <input
          placeholder="IBAN"
          value={nuevo.iban}
          onChange={(e) => poner("iban", e.target.value)}
          className="input w-full num"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Banco"
            value={nuevo.banco}
            onChange={(e) => poner("banco", e.target.value)}
            className="input"
          />
          <input
            placeholder="BIC / SWIFT"
            value={nuevo.bic}
            onChange={(e) => poner("bic", e.target.value)}
            className="input"
          />
        </div>
        <textarea
          placeholder="Notas"
          rows={2}
          value={nuevo.notas}
          onChange={(e) => poner("notas", e.target.value)}
          className="input w-full resize-none"
        />
        {esCliente && (
          <div className="pt-1">
            <p className="text-[0.65625rem] font-semibold uppercase tracking-wider text-slate-500">
              Documentación (DNI, factura…)
            </p>
            {docsPend.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {docsPend.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="truncate" title={f.name}>{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setDocsPend((d) => d.filter((_, j) => j !== i))}
                      className="ms-auto p-0.5 text-slate-400 hover:text-rose-400"
                      title="Quitar documento"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="btn-ghost inline-flex items-center gap-1.5 cursor-pointer !py-1 !px-2.5 text-xs mt-1.5">
              + Adjuntar documentos
              <input
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={elegirDocs}
                className="hidden"
              />
            </label>
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={crear}
            disabled={guardando || !nuevo.nombre.trim() || (esCliente && !nuevo.nif.trim())}
            className="btn-primary !py-1.5 !px-3.5 text-xs"
          >
            {guardando ? "Guardando…" : "Crear y seleccionar"}
          </button>
          <button
            type="button"
            onClick={cerrarCreacion}
            className="text-xs text-slate-500 hover:text-white"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 flex gap-2">
      <BuscadorEntidad
        opciones={contactos}
        valorId={valor}
        onElegir={(op) => onChange(op?._id ?? "")}
        placeholder={`Buscar ${etiqueta} por nombre o NIF…`}
      />
      <button
        type="button"
        onClick={abrirCreacion}
        title={`Crear ${etiqueta} nuevo sin salir del documento`}
        className="shrink-0 rounded-lg border border-accent/50 text-accent text-xs font-semibold px-3 hover:bg-accent/10 transition-colors"
      >
        + Nuevo
      </button>
    </div>
  );
}
