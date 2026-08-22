import { useRef } from "react";
import { exportTemplate, parseImportedTemplate } from "./storage.js";
import {
  IconPrinter, IconPencil, IconFilePlus, IconCopy, IconTrash, IconDownload,
  IconUpload, IconZoomIn, IconZoomOut, IconMaximize, IconEraser, IconPenLine,
} from "./icons.jsx";

const iconBtn =
  "rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent";

export function TopBar({
  templates, currentId, mode, zoom, onZoom, onFit, onSetMode,
  onSelectTemplate, onCreateTemplate, onDuplicateTemplate, onDeleteTemplate,
  onImportTemplate, onClearForm,
}) {
  const fileRef = useRef(null);
  const current = templates.find((t) => t.id === currentId);
  const design = mode === "design";

  const onImportFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const t = parseImportedTemplate(String(reader.result));
      if (t) onImportTemplate(t);
      else alert("El archivo no es una plantilla válida.");
    };
    reader.readAsText(f);
    e.target.value = "";
  };

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-navy-900 px-3">
      <div className="flex items-center gap-2 pr-2">
        <IconPrinter className="h-5 w-5 text-accent" />
        <span className="hidden text-sm font-bold text-white lg:inline">Editor de Formatos</span>
      </div>

      <select
        className="input max-w-52 !px-2 !py-1.5 text-sm"
        value={currentId}
        onChange={(e) => onSelectTemplate(e.target.value)}
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      <button className={iconBtn} title="Nueva plantilla" onClick={onCreateTemplate} disabled={!design}>
        <IconFilePlus />
      </button>
      <button className={iconBtn} title="Duplicar plantilla" onClick={onDuplicateTemplate} disabled={!design}>
        <IconCopy />
      </button>
      <button
        className={iconBtn}
        title="Eliminar plantilla"
        onClick={onDeleteTemplate}
        disabled={!design || templates.length <= 1}
      >
        <IconTrash className="h-4 w-4 text-rose-400" />
      </button>
      <button
        className={iconBtn}
        title="Exportar plantilla (JSON)"
        disabled={!current}
        onClick={() => current && exportTemplate(current)}
      >
        <IconDownload />
      </button>
      <button className={iconBtn} title="Importar plantilla (JSON)" onClick={() => fileRef.current?.click()} disabled={!design}>
        <IconUpload />
      </button>
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImportFile} />

      <div className="mx-1 h-6 w-px bg-white/10" />

      {/* Modo */}
      <div className="flex rounded-md border border-white/10 p-0.5">
        <button
          className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium ${
            design ? "bg-accent text-navy-950" : "text-slate-400 hover:bg-white/10 hover:text-white"
          }`}
          onClick={() => onSetMode("design")}
        >
          <IconPencil className="h-3.5 w-3.5" /> Diseñar
        </button>
        <button
          className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium ${
            !design ? "bg-emerald-400 text-navy-950" : "text-slate-400 hover:bg-white/10 hover:text-white"
          }`}
          onClick={() => onSetMode("fill")}
        >
          <IconPenLine className="h-3.5 w-3.5" /> Rellenar
        </button>
      </div>

      <div className="mx-1 h-6 w-px bg-white/10" />

      {/* Zoom */}
      <button className={iconBtn} title="Alejar" onClick={() => onZoom(Math.max(0.3, zoom - 0.15))}>
        <IconZoomOut />
      </button>
      <span className="w-12 text-center text-xs text-slate-400">{Math.round(zoom * 100)}%</span>
      <button className={iconBtn} title="Acercar" onClick={() => onZoom(Math.min(2.5, zoom + 0.15))}>
        <IconZoomIn />
      </button>
      <button className={iconBtn} title="Ajustar a ventana" onClick={onFit}>
        <IconMaximize />
      </button>

      <div className="flex-1" />

      {!design && (
        <button
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-300 transition hover:bg-white/10"
          onClick={onClearForm}
          title="Vaciar los datos rellenados"
        >
          <IconEraser /> Limpiar
        </button>
      )}
      <button className="btn-primary !px-3 !py-1.5 text-sm" onClick={() => window.print()}>
        <IconPrinter /> Imprimir / PDF
      </button>
    </div>
  );
}
