import { useEffect, useState } from "react";
import EditorLineas, { lineaVacia, totalesDeLineas } from "./EditorLineas.jsx";
import { enterComoTab } from "../utils/enter-tab.js";
import SelectorContacto from "./SelectorContacto.jsx";
import { euros } from "./ui.jsx";

// Formulario genérico de documento de COMPRA: proveedor + fecha + líneas.
// Espejo de FormDocumento (ventas) pero con proveedores.
// Retención de IRPF: para facturas de profesionales y arrendamientos, la
// retención se resta del total a pagar al proveedor (base + IVA − retención).
const PORCENTAJES_IRPF = [0, 1, 2, 7, 15, 19];
export default function FormDocumentoCompra({
  titulo,
  url,
  metodo = "POST",
  inicial = null, // { proveedor, fecha, numeroAlbaran, notas, lineas, total }
  conNumeroProveedor = false,
  etiquetaNumero = "Nº albarán del proveedor",
  campoNumero = "numeroAlbaran",
  conTotalReal = false, // solo facturas: permite cuadrar el total del papel
  onGuardado,
  onCerrar,
}) {
  const [proveedores, setProveedores] = useState([]);
  const [divisa, setDivisa] = useState(inicial?.divisa ?? "EUR");
  const [tipoCambio, setTipoCambio] = useState(
    inicial?.tipoCambio != null ? String(inicial.tipoCambio) : "1"
  );
  const [proveedorId, setProveedorId] = useState(inicial?.proveedor ?? "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? new Date().toISOString().slice(0, 10));
  const [numeroProveedor, setNumeroProveedor] = useState(inicial?.[campoNumero] ?? "");
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const [lineas, setLineas] = useState(
    inicial?.lineas?.length > 0 ? inicial.lineas.map((l) => ({ ...l })) : [lineaVacia()]
  );
  // Total que pone en la factura del proveedor (el papel manda): si difiere
  // unos céntimos del calculado, se guarda como ajuste por redondeo.
  const [totalReal, setTotalReal] = useState(inicial?.total != null ? String(inicial.total) : "");
  // Si se desmarca, al validar no se crean artículos nuevos en el catálogo.
  const [crearArticulos, setCrearArticulos] = useState(inicial?.crearArticulos !== false);
  // Retención de IRPF (solo si la factura la lleva): porcentaje y modelo.
  const [retPorc, setRetPorc] = useState(inicial?.retencionIrpf?.porcentaje ?? 0);
  const [retModelo, setRetModelo] = useState(inicial?.retencionIrpf?.modelo ?? "111");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const tcNum = parseFloat(String(tipoCambio).replace(",", ".")) || 1;
  const calculado = totalesDeLineas(lineas, divisa, tcNum);
  const totalRealNum = parseFloat(String(totalReal).replace(",", "."));
  const ajuste =
    conTotalReal && Number.isFinite(totalRealNum)
      ? Math.round((totalRealNum - calculado.totalEur) * 100) / 100
      : 0;
  // La retención se calcula sobre la base imponible y se resta del total a
  // pagar. Si el usuario pone el total del papel, la retención ya forma
  // parte de ese ajuste: solo se muestra informativa.
  const retImporte =
    Number(retPorc) > 0 ? Math.round((calculado.baseEur * Number(retPorc)) / 100 * 100) / 100 : 0;
  const totalAPagar = Math.round((calculado.totalEur - retImporte) * 100) / 100;

  useEffect(() => {
    fetch("/api/proveedores")
      .then((r) => r.json())
      .then(setProveedores)
      .catch(() => setProveedores([]));
  }, []);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = {
        proveedor: proveedorId,
        fecha,
        notas: notas || undefined,
        divisa,
        tipoCambio: tcNum,
        lineas: lineas
          .filter((l) => l.descripcion)
          .map((l) => ({
            ...l,
            cantidad: Number(l.cantidad) || 0,
            precioUnitario: Number(l.precioUnitario) || 0,
            precioUnitarioDivisa: Number(l.precioUnitarioDivisa) || 0,
            descuento: Number(l.descuento) || 0,
            iva: Number(l.iva) || 0,
          })),
      };
      if (conNumeroProveedor) cuerpo[campoNumero] = numeroProveedor || undefined;
      if (conTotalReal && Number.isFinite(totalRealNum)) {
        cuerpo.totalReal = divisa === "USD" ? Math.round(totalRealNum * tcNum * 100) / 100 : totalRealNum;
      }
      if (conTotalReal) cuerpo.crearArticulos = crearArticulos;
      // Retención de IRPF: solo se envía si hay porcentaje.
      if (conTotalReal && Number(retPorc) > 0) {
        cuerpo.retencionIrpf = { porcentaje: Number(retPorc), modelo: retModelo };
      }
      const r = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al guardar");
      onGuardado();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        className="modal-panel w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-4">{titulo}</h2>
        <form onSubmit={guardar} onKeyDown={enterComoTab} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="text-sm text-slate-400 block mb-1">Proveedor *</label>
              <SelectorContacto
                tipo="proveedor"
                contactos={proveedores}
                valor={proveedorId}
                onChange={setProveedorId}
                onCreado={(p) => setProveedores((ps) => [...ps, p])}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="input w-full"
              />
            </div>
            {conNumeroProveedor && (
              <div>
                <label className="text-sm text-slate-400 block mb-1">{etiquetaNumero}</label>
                <input
                  value={numeroProveedor}
                  onChange={(e) => setNumeroProveedor(e.target.value)}
                  className="input w-full"
                />
              </div>
            )}
            <div>
              <label className="text-sm text-slate-400 block mb-1">Divisa</label>
              <select
                value={divisa}
                onChange={(e) => setDivisa(e.target.value)}
                className="input w-full"
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            {divisa === "USD" && (
              <div>
                <label className="text-sm text-slate-400 block mb-1">Tipo de cambio (EUR/USD)</label>
                <input
                  value={tipoCambio}
                  onChange={(e) => setTipoCambio(e.target.value)}
                  placeholder="0,93"
                  inputMode="decimal"
                  className="input w-full text-right"
                />
              </div>
            )}
          </div>

          <EditorLineas
            lineas={lineas}
            setLineas={setLineas}
            precio="compra"
            conDescuento
            divisa={divisa}
            tipoCambio={tcNum}
          />

          {conTotalReal && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-600/40 px-4 py-3">
              <span className="text-sm text-slate-400">
                Total calculado:{" "}
                <strong className="text-slate-200">
                  {divisa === "USD" ? `$${calculado.total.toFixed(2)} ≈ ${euros(calculado.totalEur)}` : euros(calculado.total)}
                </strong>
              </span>
              {/* Retención de IRPF (profesionales y arrendamientos) */}
              <label className="text-sm text-slate-400 flex items-center gap-2">
                Retención IRPF:
                <select
                  value={retPorc}
                  onChange={(e) => setRetPorc(Number(e.target.value))}
                  className="input w-auto py-1"
                >
                  {PORCENTAJES_IRPF.map((p) => (
                    <option key={p} value={p}>
                      {p === 0 ? "Sin retención" : `${p} %`}
                    </option>
                  ))}
                </select>
              </label>
              {Number(retPorc) > 0 && (
                <>
                  <span className="text-sm text-amber-300">
                    −{euros(retImporte)} · a pagar: <strong>{euros(totalAPagar)}</strong>
                  </span>
                  <label className="text-sm text-slate-400 flex items-center gap-2">
                    Modelo:
                    <select
                      value={retModelo}
                      onChange={(e) => setRetModelo(e.target.value)}
                      className="input w-auto py-1"
                    >
                      <option value="111">111 · Profesional</option>
                      <option value="115">115 · Arrendamiento</option>
                    </select>
                  </label>
                </>
              )}
              <label className="text-sm text-slate-400 flex items-center gap-2">
                Total en la factura del proveedor:
                <input
                  value={totalReal}
                  onChange={(e) => setTotalReal(e.target.value)}
                  placeholder={divisa === "USD" ? calculado.total.toFixed(2) : calculado.total.toFixed(2)}
                  className="input w-28 text-right"
                  inputMode="decimal"
                />
                <span className="text-slate-500">{divisa === "USD" ? "$" : "€"}</span>
              </label>
              {Math.abs(ajuste) >= 0.005 && (
                <span className="text-xs text-amber-300">
                  Se guardará un ajuste por redondeo de {ajuste > 0 ? "+" : ""}
                  {euros(ajuste)}
                </span>
              )}
              <label className="text-sm text-slate-400 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={crearArticulos}
                  onChange={(e) => setCrearArticulos(e.target.checked)}
                  className="accent-sky-500"
                />
                Dar de alta los artículos en el catálogo
              </label>
            </div>
          )}

          <div>
            <label className="text-sm text-slate-400 block mb-1">Notas</label>
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="input w-full"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCerrar} className="btn-ghost">
              Cancelar
            </button>
            <button type="submit" disabled={guardando || !proveedorId} className="btn-primary">
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
