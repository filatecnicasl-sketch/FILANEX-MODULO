import { useEffect, useState } from "react";
import { LogoFX } from "../components/icons.jsx";

// Asistente de primera configuración: aparece cuando la instalación aún no
// tiene empresa configurada (alta de un cliente nuevo). Guía paso a paso:
// datos fiscales → series → módulos → certificado VeriFactu → importación.
const PASOS = [
  { clave: "fiscal", titulo: "Datos de la empresa" },
  { clave: "series", titulo: "Series de facturación" },
  { clave: "modulos", titulo: "Módulos" },
  { clave: "certificado", titulo: "Certificado VeriFactu" },
  { clave: "importar", titulo: "Datos iniciales" },
];

export default function SetupWizard() {
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Paso 1: datos fiscales
  const [fiscal, setFiscal] = useState({
    nombre: "", nif: "", telefono: "", email: "",
    direccion: { calle: "", cp: "", ciudad: "", provincia: "" },
  });
  const [logo, setLogo] = useState(null);

  // Paso 2: series (se cargan tras crear la empresa: vienen con los valores
  // por defecto del programa)
  const [seriesVenta, setSeriesVenta] = useState([]);
  const [seriesCompra, setSeriesCompra] = useState([]);

  // Paso 3: módulos
  const [catalogo, setCatalogo] = useState([]);
  const [activos, setActivos] = useState([]);

  // Paso 4: certificado
  const [cert, setCert] = useState({ archivo: null, pass: "" });
  const [certOk, setCertOk] = useState(null);

  useEffect(() => {
    fetch("/api/empresa/modulos").then((r) => r.json()).then(setCatalogo).catch(() => {});
  }, []);

  const ponerF = (k) => (e) => setFiscal((f) => ({ ...f, [k]: e.target.value }));
  const ponerD = (k) => (e) =>
    setFiscal((f) => ({ ...f, direccion: { ...f.direccion, [k]: e.target.value } }));

  async function llamar(url, opciones) {
    const r = await fetch(url, opciones);
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(datos.error || "No se pudo guardar");
    return datos;
  }

  // Paso 1 → guarda datos fiscales (crea la empresa si es la primera vez) y logo.
  async function guardarFiscal() {
    if (!fiscal.nombre.trim() || !fiscal.nif.trim()) {
      setError("El nombre y el NIF/CIF son obligatorios");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await llamar("/api/empresa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fiscal),
      });
      if (logo) {
        const fd = new FormData();
        fd.append("archivo", logo);
        await llamar("/api/empresa/logo", { method: "POST", body: fd });
      }
      // Carga las series por defecto para el siguiente paso.
      const emp = await llamar("/api/empresa");
      setSeriesVenta(emp.seriesVenta ?? []);
      setSeriesCompra(emp.seriesCompra ?? []);
      setPaso(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  // Paso 2 → guarda series.
  async function guardarSeries() {
    setGuardando(true);
    setError(null);
    try {
      await llamar("/api/empresa/series", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesVenta, seriesCompra }),
      });
      setPaso(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  // Paso 3 → guarda módulos activos.
  async function guardarModulos() {
    setGuardando(true);
    setError(null);
    try {
      await llamar("/api/empresa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulos: activos }),
      });
      setPaso(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  // Paso 4 → sube el certificado (opcional).
  async function subirCertificado() {
    if (!cert.archivo) {
      setError("Elige el archivo .pfx o .p12 (u omite este paso)");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("certificado", cert.archivo);
      fd.append("pass", cert.pass);
      await llamar("/api/certificado", { method: "POST", body: fd });
      setCertOk(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  function editarSerie(lista, setLista, i, campo, valor) {
    setLista(lista.map((s, idx) => (idx === i ? { ...s, [campo]: valor } : s)));
  }

  function bloqueSeries(titulo, lista, setLista, campos) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">{titulo}</h3>
        <div className="space-y-2">
          {lista.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <span className="w-28 text-sm font-mono text-white">{s.nombre}</span>
              {campos.map(([campo, etiqueta]) => (
                <label key={campo} className="text-xs text-slate-400 flex items-center gap-1">
                  {etiqueta}
                  <input
                    type="number"
                    min="1"
                    value={s[campo]}
                    onChange={(e) => editarSerie(lista, setLista, i, campo, e.target.value)}
                    className="input w-20 text-center"
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border border-white/10 bg-white/[0.04] text-white mb-3">
            <LogoFX size={42} />
          </div>
          <h1 className="text-2xl font-bold text-accent tracking-[0.16em]">FILANEX</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configuración inicial: prepara la instalación en un minuto. Luego podrás cambiarlo
            todo en Sistema.
          </p>
        </div>

        {/* Pasos */}
        <div className="flex justify-center gap-1.5 mb-6 flex-wrap">
          {PASOS.map((p, i) => (
            <span
              key={p.clave}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                i === paso
                  ? "bg-accent text-white"
                  : i < paso
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-slate-800 text-slate-500"
              }`}
            >
              {i + 1}. {p.titulo}
            </span>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
          {error && <p className="text-sm text-rose-400">{error}</p>}

          {/* ---------- Paso 1: datos fiscales ---------- */}
          {paso === 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm text-slate-400 sm:col-span-2">
                  Nombre o razón social *
                  <input value={fiscal.nombre} onChange={ponerF("nombre")} className="input mt-1" autoFocus />
                </label>
                <label className="text-sm text-slate-400">
                  NIF/CIF *
                  <input value={fiscal.nif} onChange={ponerF("nif")} className="input mt-1" />
                </label>
                <label className="text-sm text-slate-400">
                  Teléfono
                  <input value={fiscal.telefono} onChange={ponerF("telefono")} className="input mt-1" />
                </label>
                <label className="text-sm text-slate-400 sm:col-span-2">
                  Email
                  <input type="email" value={fiscal.email} onChange={ponerF("email")} className="input mt-1" />
                </label>
                <label className="text-sm text-slate-400 sm:col-span-2">
                  Dirección
                  <input value={fiscal.direccion.calle} onChange={ponerD("calle")} className="input mt-1" />
                </label>
                <label className="text-sm text-slate-400">
                  Código postal
                  <input value={fiscal.direccion.cp} onChange={ponerD("cp")} className="input mt-1" />
                </label>
                <label className="text-sm text-slate-400">
                  Ciudad
                  <input value={fiscal.direccion.ciudad} onChange={ponerD("ciudad")} className="input mt-1" />
                </label>
                <label className="text-sm text-slate-400">
                  Provincia
                  <input value={fiscal.direccion.provincia} onChange={ponerD("provincia")} className="input mt-1" />
                </label>
                <label className="text-sm text-slate-400">
                  Logo (opcional)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
                    className="input mt-1 text-xs"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button onClick={guardarFiscal} disabled={guardando} className="btn-primary">
                  {guardando ? "Guardando…" : "Guardar y continuar"}
                </button>
              </div>
            </>
          )}

          {/* ---------- Paso 2: series ---------- */}
          {paso === 1 && (
            <>
              <p className="text-sm text-slate-300">
                El programa crea la serie <b className="text-white">A</b> empezando por 1. Si el
                negocio viene de otro programa, ajusta aquí los próximos números para continuar la
                numeración.
              </p>
              {bloqueSeries("Series de venta", seriesVenta, setSeriesVenta, [
                ["proxPresupuesto", "Pto."],
                ["proxAlbaran", "Alb."],
                ["proxFactura", "Fact."],
              ])}
              {bloqueSeries("Series de compra", seriesCompra, setSeriesCompra, [
                ["proxPresupuesto", "Pto."],
                ["proxPedido", "Ped."],
                ["proxAlbaran", "Alb."],
              ])}
              <div className="flex justify-end gap-2">
                <button onClick={() => setPaso(2)} className="btn-ghost">Dejar como están</button>
                <button onClick={guardarSeries} disabled={guardando} className="btn-primary">
                  {guardando ? "Guardando…" : "Guardar y continuar"}
                </button>
              </div>
            </>
          )}

          {/* ---------- Paso 3: módulos ---------- */}
          {paso === 2 && (
            <>
              <p className="text-sm text-slate-300">
                Activa solo lo que este negocio va a usar. Se puede cambiar después en
                Sistema → Módulos.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {catalogo.filter((m) => m.disponible).map((m) => (
                  <label
                    key={m.clave}
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                      activos.includes(m.clave)
                        ? "border-accent/60 bg-accent/10"
                        : "border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={activos.includes(m.clave)}
                      onChange={(e) =>
                        setActivos((a) =>
                          e.target.checked ? [...a, m.clave] : a.filter((x) => x !== m.clave)
                        )
                      }
                      className="mt-1 accent-cyan-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-white">{m.nombre}</span>
                      <span className="block text-xs text-slate-400">{m.descripcion}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <button onClick={guardarModulos} disabled={guardando} className="btn-primary">
                  {guardando ? "Guardando…" : "Guardar y continuar"}
                </button>
              </div>
            </>
          )}

          {/* ---------- Paso 4: certificado ---------- */}
          {paso === 3 && (
            <>
              <p className="text-sm text-slate-300">
                Para enviar las facturas a la AEAT (VeriFactu) hace falta el{" "}
                <b className="text-white">certificado digital</b> de la empresa (.pfx o .p12).
                Si no lo tienes a mano, puedes subirlo después en Sistema → Certificado: las
                facturas se emiten igualmente y se envían cuando el certificado esté.
              </p>
              {certOk ? (
                <p className="text-sm text-emerald-400 font-medium">
                  Certificado guardado y validado correctamente.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-sm text-slate-400">
                    Archivo .pfx / .p12
                    <input
                      type="file"
                      accept=".pfx,.p12"
                      onChange={(e) => setCert((c) => ({ ...c, archivo: e.target.files?.[0] ?? null }))}
                      className="input mt-1 text-xs"
                    />
                  </label>
                  <label className="text-sm text-slate-400">
                    Contraseña del certificado
                    <input
                      type="password"
                      value={cert.pass}
                      onChange={(e) => setCert((c) => ({ ...c, pass: e.target.value }))}
                      className="input mt-1"
                    />
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setPaso(4)} className="btn-ghost">Lo configuro después</button>
                {!certOk && (
                  <button onClick={subirCertificado} disabled={guardando} className="btn-primary">
                    {guardando ? "Validando…" : "Subir certificado"}
                  </button>
                )}
                {certOk && (
                  <button onClick={() => setPaso(4)} className="btn-primary">Continuar</button>
                )}
              </div>
            </>
          )}

          {/* ---------- Paso 5: importar datos ---------- */}
          {paso === 4 && (
            <>
              <p className="text-sm text-slate-300">
                <b className="text-white">Último paso.</b> Si el negocio viene de otro programa,
                importa sus datos desde Excel (cada pantalla tiene su botón «Importar»):
              </p>
              <ul className="text-sm text-slate-400 list-disc pl-5 space-y-1">
                <li><b className="text-slate-200">Clientes</b> — desde la pantalla Clientes.</li>
                <li><b className="text-slate-200">Proveedores</b> — desde Compras → Proveedores.</li>
                <li><b className="text-slate-200">Artículos</b> — desde la pantalla Artículos.</li>
              </ul>
              <p className="text-xs text-slate-500">
                Consejo: importa primero clientes y proveedores, y después artículos y facturas.
              </p>
              <div className="flex justify-end">
                <button onClick={() => location.reload()} className="btn-primary">
                  Terminar y empezar a trabajar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
