import { useEffect, useState } from "react";

const campo = "w-full input";
const etiqueta = "block text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400 mb-1.5";

const NOMBRES_TIPO = { ventas: "Facturas de venta", compras: "Facturas de compra", tickets: "Tickets y gastos" };

function fechaCorta(f) {
  if (!f) return "—";
  return new Date(f).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Imprime la autorización firmada con formato de documento A4 (el navegador
// permite guardarla como PDF).
function imprimirAutorizacion({ texto, datos }) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const compartido = Object.entries(datos.compartir ?? {})
    .filter(([, v]) => v)
    .map(([k]) => NOMBRES_TIPO[k] ?? k)
    .join(", ");
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Autorización asesoría - ${datos.empresa.nombre}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; max-width: 720px; margin: 40px auto; padding: 0 24px; font-size: 13px; line-height: 1.65; }
  h1 { font-size: 17px; text-align: center; margin-bottom: 4px; }
  .marca { text-align: center; color: #666; font-size: 11px; letter-spacing: 2px; margin-bottom: 28px; }
  .partes { border-top: 2px solid #111; border-bottom: 1px solid #999; padding: 12px 0; margin-bottom: 20px; }
  .partes p { margin: 2px 0; }
  .cuerpo { white-space: pre-wrap; }
  .firma { margin-top: 32px; border-top: 1px solid #999; padding-top: 12px; font-size: 12px; }
  .firma p { margin: 2px 0; }
  @media print { body { margin: 0; } }
</style></head><body>
<div class="marca">FILANEX · FILATECNICA S.L.</div>
<div class="partes">
  <p><strong>Empresa (autoriza):</strong> ${datos.empresa.nombre} · NIF ${datos.empresa.nif}</p>
  <p><strong>Asesoría (destinataria):</strong> ${datos.asesoria.nombre}${datos.asesoria.nif ? ` · NIF ${datos.asesoria.nif}` : ""}</p>
  <p><strong>Documentación autorizada:</strong> ${compartido || "—"}</p>
</div>
<div class="cuerpo">${texto}</div>
<div class="firma">
  <p><strong>Firmado digitalmente por:</strong> ${datos.firmadoPor}</p>
  <p><strong>Fecha y hora:</strong> ${fechaCorta(datos.fechaFirma)} · <strong>Versión del texto:</strong> ${datos.version}</p>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`);
  w.document.close();
}

// Sección "Asesoría" de Ajustes → Configuración: vínculo de la empresa con
// su asesoría, firma de la autorización RGPD y revocación.
export default function VinculoAsesoria() {
  const [estado, setEstado] = useState("cargando"); // cargando | sin-vinculo | previa | activo
  const [vinculo, setVinculo] = useState(null);
  const [codigo, setCodigo] = useState("");
  const [previa, setPrevia] = useState(null); // { asesoria, texto, versionTexto }
  const [compartir, setCompartir] = useState({ ventas: true, compras: true, tickets: true });
  const [acepto, setAcepto] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function cargar() {
    try {
      const r = await fetch("/api/mi-asesoria");
      const json = await r.json();
      if (json.vinculo?.estado === "activo") {
        setVinculo(json.vinculo);
        setEstado("activo");
      } else {
        setEstado("sin-vinculo");
      }
    } catch {
      setError("No se pudo consultar el estado del vínculo.");
      setEstado("sin-vinculo");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function buscar() {
    setError(null);
    setAviso(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/mi-asesoria/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const json = await r.json();
      if (!r.ok) return setError(json.error || "Código no válido");
      setPrevia(json);
      setAcepto(false);
      setEstado("previa");
    } catch {
      setError("No se pudo conectar con la API.");
    } finally {
      setOcupado(false);
    }
  }

  async function firmar() {
    setError(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/mi-asesoria/vincular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, acepto, compartir }),
      });
      const json = await r.json();
      if (!r.ok) return setError(json.error || "No se pudo firmar la autorización");
      setVinculo(json.vinculo);
      setEstado("activo");
      setPrevia(null);
      setCodigo("");
      setAviso("Autorización firmada. Tu asesoría ya puede ver tus documentos.");
    } catch {
      setError("No se pudo conectar con la API.");
    } finally {
      setOcupado(false);
    }
  }

  async function revocar() {
    if (!window.confirm("¿Revocar la autorización? Tu asesoría dejará de ver tus documentos al momento.")) return;
    setError(null);
    setAviso(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/mi-asesoria/revocar", { method: "POST" });
      const json = await r.json();
      if (!r.ok) return setError(json.error || "No se pudo revocar");
      setVinculo(null);
      setEstado("sin-vinculo");
      setAviso("Autorización revocada. La asesoría ya no tiene acceso a tus documentos.");
    } catch {
      setError("No se pudo conectar con la API.");
    } finally {
      setOcupado(false);
    }
  }

  async function descargar() {
    setError(null);
    try {
      const r = await fetch("/api/mi-asesoria/autorizacion");
      const json = await r.json();
      if (!r.ok) return setError(json.error || "No se pudo obtener la autorización");
      imprimirAutorizacion(json);
    } catch {
      setError("No se pudo conectar con la API.");
    }
  }

  if (estado === "cargando") return null;

  return (
    <div className="panel p-6 mb-6">
      <h2 className="text-white font-semibold">Asesoría</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-5">
        Si tu asesoría usa FILANEX, introdúcela aquí y podrá descargar tus facturas y tickets sin que tengas que enviárselos.
      </p>

      {aviso && <p className="text-sm text-emerald-600 mb-4">{aviso}</p>}
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {estado === "sin-vinculo" && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className={etiqueta}>Código de tu asesoría (te lo da ella, empieza por ASC-)</label>
            <input
              className={campo}
              placeholder="ASC-XXXXXX"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            />
          </div>
          <button onClick={buscar} disabled={!codigo.trim() || ocupado} className="btn-primary">
            Buscar asesoría
          </button>
        </div>
      )}

      {estado === "previa" && previa && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">{previa.asesoria.nombre}</span>
              {previa.asesoria.nif && <span className="text-slate-500"> · NIF {previa.asesoria.nif}</span>}
              {previa.asesoria.ciudad && <span className="text-slate-500"> · {previa.asesoria.ciudad}</span>}
            </p>
          </div>

          <div>
            <p className={etiqueta}>Qué documentos podrá ver</p>
            <div className="flex flex-wrap gap-4">
              {Object.entries(NOMBRES_TIPO).map(([clave, nombre]) => (
                <label key={clave} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={compartir[clave]}
                    onChange={(e) => setCompartir((c) => ({ ...c, [clave]: e.target.checked }))}
                  />
                  {nombre}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 max-h-56 overflow-y-auto p-4 bg-white">
            <p className="text-xs text-slate-600 whitespace-pre-wrap">{previa.texto}</p>
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
            He leído la autorización y la acepto en nombre de la empresa.
          </label>

          <div className="flex gap-3">
            <button onClick={firmar} disabled={!acepto || ocupado} className="btn-primary">
              Firmar autorización
            </button>
            <button onClick={() => { setEstado("sin-vinculo"); setPrevia(null); }} className="btn-ghost">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {estado === "activo" && vinculo && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-800">
              <span className="font-semibold">{vinculo.asesoria?.nombre}</span>
              {vinculo.asesoria?.nif && <span> · NIF {vinculo.asesoria.nif}</span>}
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              Autorización firmada el {fechaCorta(vinculo.autorizacion?.fechaAceptacion)} por {vinculo.autorizacion?.usuarioEmail}
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Compartiendo: {Object.entries(vinculo.compartir ?? {}).filter(([, v]) => v).map(([k]) => NOMBRES_TIPO[k]).join(", ") || "nada"}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={descargar} className="btn-ghost">
              Descargar autorización (PDF)
            </button>
            <button onClick={revocar} disabled={ocupado} className="text-sm font-medium text-rose-500 hover:text-rose-600">
              Revocar autorización
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
