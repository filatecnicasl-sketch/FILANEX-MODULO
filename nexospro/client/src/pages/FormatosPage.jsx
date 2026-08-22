import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorState } from "../editor/useEditorState.js";
import { pageDimensions } from "../editor/types.js";
import { PX_PER_MM, createElement } from "../editor/editorUtils.js";
import { TopBar } from "../editor/TopBar.jsx";
import { Palette } from "../editor/Palette.jsx";
import { PropertiesPanel } from "../editor/PropertiesPanel.jsx";
import { EditorCanvas } from "../editor/EditorCanvas.jsx";
import { PrintSheet } from "../editor/PrintSheet.jsx";

export default function FormatosPage() {
  const ed = useEditorState();
  const [zoom, setZoom] = useState(1);
  const wrapRef = useRef(null);
  const design = ed.mode === "design";

  const fitZoom = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return 1;
    const { w, h } = pageDimensions(ed.template.page);
    const zx = (wrap.clientWidth - 60) / (w * PX_PER_MM);
    const zy = (wrap.clientHeight - 60) / (h * PX_PER_MM);
    return Math.min(2.5, Math.max(0.2, Math.min(zx, zy)));
  }, [ed.template.page]);

  const onFit = useCallback(() => setZoom(fitZoom()), [fitZoom]);

  // Ajuste inicial y al cambiar de plantilla/tamaño de página
  useEffect(() => {
    setZoom(fitZoom());
  }, [fitZoom, ed.template.id]);

  const addElement = (typeOrEl) => {
    const { w, h } = pageDimensions(ed.template.page);
    const el = typeof typeOrEl === "string" ? createElement(typeOrEl) : typeOrEl;
    el.x = Math.max(5, w / 2 - el.w / 2);
    el.y = Math.max(5, h / 2 - el.h / 2);
    ed.addElement(el);
  };

  const selected = ed.template.elements.find((e) => e.id === ed.selectedId) ?? null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="no-print flex min-h-0 flex-1 flex-col">
        <TopBar
          templates={ed.templates}
          currentId={ed.template.id}
          currentType={ed.template.tipoDocumento}
          isDefault={ed.template.porDefecto}
          mode={ed.mode}
          zoom={zoom}
          onZoom={setZoom}
          onFit={onFit}
          onSetMode={ed.setMode}
          onSelectTemplate={ed.selectTemplate}
          onCreateTemplate={ed.createTemplate}
          onDuplicateTemplate={ed.duplicateTemplate}
          onDeleteTemplate={ed.deleteTemplate}
          onImportTemplate={ed.importTemplate}
          onClearForm={ed.clearForm}
          onRename={ed.renameTemplate}
          onSetType={ed.setTemplateType}
          onSetDefault={ed.setAsDefault}
        />
        <div className="flex min-h-0 flex-1">
          {design && <Palette onAdd={addElement} disabled={!design} />}
          <div ref={wrapRef} className="min-w-0 flex-1">
            <EditorCanvas
              template={ed.template}
              zoom={zoom}
              mode={ed.mode}
              selectedId={ed.selectedId}
              onSelect={ed.setSelectedId}
              onUpdateElement={ed.updateElement}
              onRemoveElement={ed.removeElement}
              onDuplicateElement={ed.duplicateElement}
              formData={ed.formData}
              signatures={ed.signatures}
              onFormValue={ed.setFormValue}
              onSignature={ed.setSignature}
            />
          </div>
          {design && (
            <PropertiesPanel
              template={ed.template}
              element={selected}
              onUpdateElement={ed.updateElement}
              onUpdateTemplate={(p) => ed.updateTemplate((t) => ({ ...t, ...p }))}
              onRemoveElement={ed.removeElement}
              onDuplicateElement={ed.duplicateElement}
              onReorderElement={ed.reorderElement}
            />
          )}
        </div>
      </div>
      <PrintSheet template={ed.template} formData={ed.formData} signatures={ed.signatures} />
    </div>
  );
}
