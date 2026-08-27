import { PX_PER_MM } from "./editorUtils.js";
import { resolveImageSrc, BUILTIN_IMAGES } from "./assets.js";
import { SignatureField } from "./SignatureField.jsx";

const PT_TO_PX = 96 / 72;

export function ElementContent(props) {
  const { el, variant, zoom } = props;
  const print = variant === "print";
  const scale = PX_PER_MM * zoom;

  /** tamaño de fuente: pt en impresión, px escalados en pantalla */
  const fs = (pt) => (print ? `${pt}pt` : `${pt * PT_TO_PX * zoom}px`);
  const mm = (v) => (print ? `${v}mm` : `${v * scale}px`);

  const sub = {
    variant,
    zoom,
    formData: props.formData,
    signatures: props.signatures,
    onFormValue: props.onFormValue,
    onSignature: props.onSignature,
    fs,
    mm,
    scale,
  };

  switch (el.type) {
    case "text":
      return <TextView el={el} fs={fs} />;
    case "field":
      return <FieldView el={el} {...sub} />;
    case "textarea":
      return <TextareaView el={el} {...sub} />;
    case "checkbox":
      return <CheckboxView el={el} {...sub} />;
    case "image":
      return <ImageView el={el} />;
    case "line":
      return <LineView el={el} mm={mm} />;
    case "rect":
      return <RectView el={el} />;
    case "table":
      return <TableView el={el} {...sub} />;
    case "signature":
      return <SignatureView el={el} {...sub} />;
    default:
      return null;
  }
}

// ---------- Texto ----------
function TextView({ el, fs }) {
  return (
    <div
      className="h-full w-full overflow-hidden"
      style={{
        fontSize: fs(el.fontSize),
        fontWeight: el.bold ? 700 : 400,
        textAlign: el.align,
        color: el.color,
        lineHeight: 1.25,
        whiteSpace: "pre-wrap",
      }}
    >
      {el.text}
    </div>
  );
}

// ---------- Campo con etiqueta ----------
function FieldView({ el, variant, formData, onFormValue, fs, mm }) {
  const labelH = el.label ? 3 : 0;
  const value = String(formData[el.fieldKey] ?? "");
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {el.label && (
        <div style={{ fontSize: fs(5.5), fontWeight: 700, height: mm(labelH), lineHeight: 1.1 }} className="shrink-0 uppercase">
          {el.label}
        </div>
      )}
      <div
        className="relative min-h-0 flex-1"
        style={el.boxed ? { border: "1px solid #333" } : { borderBottom: "1px solid #333" }}
      >
        {variant === "fill" ? (
          <input
            value={value}
            onChange={(e) => onFormValue(el.fieldKey, e.target.value)}
            className="h-full w-full bg-transparent px-1 outline-none"
            style={{ fontSize: fs(el.fontSize) }}
          />
        ) : (
          <div className="h-full w-full truncate px-1" style={{ fontSize: fs(el.fontSize), lineHeight: 1.3 }}>
            {value}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Área de texto ----------
function TextareaView({ el, variant, formData, onFormValue, fs, mm }) {
  const value = String(formData[el.fieldKey] ?? "");
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {el.label && (
        <div style={{ fontSize: fs(5.5), fontWeight: 700, height: mm(3), lineHeight: 1.1 }} className="shrink-0 uppercase">
          {el.label}
        </div>
      )}
      <div className="relative min-h-0 flex-1" style={el.boxed ? { border: "1px solid #333" } : undefined}>
        {variant === "fill" ? (
          <textarea
            value={value}
            onChange={(e) => onFormValue(el.fieldKey, e.target.value)}
            className="h-full w-full resize-none bg-transparent px-1 outline-none"
            style={{ fontSize: fs(el.fontSize), lineHeight: 1.3 }}
          />
        ) : (
          <div className="h-full w-full overflow-hidden px-1" style={{ fontSize: fs(el.fontSize), lineHeight: 1.3, whiteSpace: "pre-wrap" }}>
            {value}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Casilla de verificación ----------
function CheckboxView({ el, variant, formData, onFormValue, fs, mm, scale }) {
  const checked = formData[el.fieldKey] === true;
  const boxMm = Math.min(3.5, el.h - 0.5);
  const inner = (
    <>
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          width: mm(boxMm),
          height: mm(boxMm),
          border: `${variant === "print" ? 1 : Math.max(1, scale * 0.3)}px solid #000`,
          fontSize: fs(el.fontSize + 2),
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {checked ? "✕" : ""}
      </div>
      {el.label && (
        <div style={{ fontSize: fs(el.fontSize), fontWeight: el.bold ? 700 : 400, lineHeight: 1.2, marginLeft: mm(1.5) }}>
          {el.label}
        </div>
      )}
    </>
  );
  if (variant === "fill") {
    return (
      <button
        type="button"
        onClick={() => onFormValue(el.fieldKey, !checked)}
        className="flex h-full w-full cursor-pointer items-start overflow-hidden text-left"
      >
        {inner}
      </button>
    );
  }
  return <div className="flex h-full w-full items-start overflow-hidden">{inner}</div>;
}

// ---------- Imagen ----------
function ImageView({ el }) {
  if (el.src === "{{empresa.logo}}") {
    return (
      <div className="flex h-full w-full items-center justify-center border border-dashed border-slate-400 bg-slate-100 text-[0.625rem] text-slate-500">
        LOGO EMPRESA
      </div>
    );
  }
  if (!el.src) return null;
  // Las siluetas integradas rellenan el hueco; el logo o las fotos mantienen
  // su proporción para no deformarse.
  const esBuiltin = Boolean(BUILTIN_IMAGES[el.src]);
  return (
    <img
      src={resolveImageSrc(el.src)}
      alt=""
      draggable={false}
      className="h-full w-full select-none"
      style={{ objectFit: esBuiltin ? "fill" : "contain", objectPosition: "left center" }}
    />
  );
}

// ---------- Línea ----------
function LineView({ el, mm }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        style={
          el.orientation === "h"
            ? { width: "100%", borderTop: `${el.thickness}px solid ${el.color}` }
            : { height: "100%", borderLeft: `${el.thickness}px solid ${el.color}`, width: mm(0.5) }
        }
      />
    </div>
  );
}

// ---------- Rectángulo ----------
function RectView({ el }) {
  return (
    <div
      className="h-full w-full"
      style={{ border: `${el.borderWidth}px solid ${el.borderColor}`, background: el.background || "transparent" }}
    />
  );
}

// ---------- Tabla ----------
// Columnas numéricas: se alinean a la derecha, como en el PDF.
const COL_DERECHA = ["CANT.", "CANT", "UDS", "PRECIO", "IMPORTE", "IVA", "DTO", "TOTAL"];

function TableView({ el, variant, formData, onFormValue, fs, mm }) {
  const numCol = el.showRowNumbers ? 5 : 0; // mm
  const totalFrac = el.columns.reduce((a, c) => a + c.width, 0) || 1;
  const availW = el.w - numCol;
  const groupH = el.groupTitle ? 5 : 0;
  const headH = 5;
  const rowH = Math.max(2, (el.h - groupH - headH) / el.rows);
  // "limpia": sin rejilla, igual que los documentos comerciales en PDF.
  const limpia = el.estilo === "limpia";
  const border = limpia ? "none" : "1px solid #000";

  const cellKey = (r, c) => `tbl_${el.id}_${r}_${c}`;
  const alinea = (c) =>
    limpia && COL_DERECHA.includes(String(el.columns[c]?.title ?? "").toUpperCase()) ? "right" : "left";
  const filaConDatos = (r) => el.columns.some((_, c) => String(formData[cellKey(r, c)] ?? "") !== "");

  return (
    <table className="h-full w-full" style={{ borderCollapse: "collapse", tableLayout: "fixed", border }}>
      <colgroup>
        {el.showRowNumbers && <col style={{ width: mm(numCol) }} />}
        {el.columns.map((c, i) => (
          <col key={i} style={{ width: mm((c.width / totalFrac) * availW) }} />
        ))}
      </colgroup>
      <tbody>
        {el.groupTitle && (
          <tr style={{ height: mm(groupH) }}>
            <td
              colSpan={el.columns.length + (el.showRowNumbers ? 1 : 0)}
              style={{
                border,
                textAlign: limpia ? "left" : "center",
                fontWeight: 700,
                fontSize: fs(el.headerFontSize + (limpia ? 0 : 1)),
                color: limpia ? "#6b7280" : undefined,
                padding: 0,
              }}
            >
              {el.groupTitle}
            </td>
          </tr>
        )}
        <tr style={{ height: mm(headH) }}>
          {el.showRowNumbers && <td style={{ border, padding: 0 }} />}
          {el.columns.map((c, i) => (
            <td
              key={i}
              style={{
                border,
                borderBottom: limpia ? "1.5px solid #333" : border,
                textAlign: limpia ? alinea(i) : "center",
                fontWeight: 700,
                fontSize: fs(el.headerFontSize),
                padding: 0,
              }}
            >
              {c.title}
            </td>
          ))}
        </tr>
        {Array.from({ length: el.rows }, (_, r) => (
          // min-height en vez de height fija: la fila crece si la línea lleva
          // texto detalle multilínea, para que no se corte al imprimir.
          <tr key={r} style={{ minHeight: mm(rowH) }}>
            {el.showRowNumbers && (
              <td style={{ border, textAlign: "center", fontSize: fs(el.headerFontSize), padding: 0 }}>{r + 1}</td>
            )}
            {el.columns.map((_, c) => (
              <td
                key={c}
                style={{
                  border,
                  borderBottom: limpia ? (filaConDatos(r) ? "0.5px solid #ddd" : "none") : border,
                  verticalAlign: "top",
                  padding: 0,
                }}
              >
                {variant === "fill" ? (
                  <input
                    value={String(formData[cellKey(r, c)] ?? "")}
                    onChange={(e) => onFormValue(cellKey(r, c), e.target.value)}
                    className="h-full w-full bg-transparent px-0.5 outline-none"
                    style={{ fontSize: fs(el.headerFontSize), textAlign: alinea(c) }}
                  />
                ) : (
                  <div
                    className="px-0.5"
                    style={{
                      fontSize: fs(el.headerFontSize),
                      textAlign: alinea(c),
                      // Respeta los saltos de línea del detalle bajo la línea
                      // y envuelve el texto largo, igual que en el PDF.
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                      lineHeight: 1.25,
                    }}
                  >
                    {String(formData[cellKey(r, c)] ?? "")}
                  </div>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- Firma ----------
function SignatureView({ el, variant, signatures, onSignature, fs, mm, zoom }) {
  const dataUrl = signatures[el.id];
  const lineH = 3;
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {el.label && (
        <div style={{ fontSize: fs(5.5), fontWeight: 700, height: mm(lineH), lineHeight: 1.1 }} className="shrink-0 uppercase">
          {el.label}
        </div>
      )}
      <div className="relative min-h-0 flex-1" style={{ borderBottom: "1px solid #000" }}>
        {variant === "fill" ? (
          <SignatureField
            value={dataUrl}
            onChange={(d) => onSignature(el.id, d)}
            widthPx={el.w * PX_PER_MM * zoom}
            heightPx={Math.max(20, el.h * PX_PER_MM * zoom - lineH * PX_PER_MM * zoom)}
          />
        ) : dataUrl ? (
          <img src={dataUrl} alt="firma" className="h-full w-full" style={{ objectFit: "contain" }} />
        ) : null}
      </div>
      {el.sublabel && (
        <div style={{ fontSize: fs(5), height: mm(2.5), lineHeight: 1.1 }} className="shrink-0">
          {el.sublabel}
        </div>
      )}
    </div>
  );
}
