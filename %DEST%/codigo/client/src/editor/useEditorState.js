import { useCallback, useMemo, useState } from "react";
import { loadTemplates, saveTemplates } from "./storage.js";
import { genId } from "./editorUtils.js";

export function useEditorState() {
  const [templates, setTemplates] = useState(() => loadTemplates());
  const [currentId, setCurrentId] = useState(() => templates[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState("design"); // 'design' | 'fill'
  const [formData, setFormData] = useState({});
  const [signatures, setSignatures] = useState({});

  const template = useMemo(
    () => templates.find((t) => t.id === currentId) ?? templates[0],
    [templates, currentId]
  );

  const persist = useCallback((next) => {
    setTemplates(next);
    saveTemplates(next);
  }, []);

  const updateTemplate = useCallback(
    (updater) => {
      persist(templates.map((t) => (t.id === template.id ? updater(t) : t)));
    },
    [persist, templates, template.id]
  );

  const updateElement = useCallback(
    (id, patch) => {
      updateTemplate((t) => ({
        ...t,
        elements: t.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
      }));
    },
    [updateTemplate]
  );

  const addElement = useCallback(
    (el) => {
      updateTemplate((t) => ({ ...t, elements: [...t.elements, el] }));
      setSelectedId(el.id);
    },
    [updateTemplate]
  );

  const removeElement = useCallback(
    (id) => {
      updateTemplate((t) => ({ ...t, elements: t.elements.filter((el) => el.id !== id) }));
      setSelectedId((s) => (s === id ? null : s));
    },
    [updateTemplate]
  );

  const duplicateElement = useCallback(
    (id) => {
      const el = template.elements.find((e) => e.id === id);
      if (!el) return;
      const copy = { ...el, id: genId(), x: el.x + 5, y: el.y + 5 };
      addElement(copy);
    },
    [template.elements, addElement]
  );

  const reorderElement = useCallback(
    (id, dir) => {
      updateTemplate((t) => {
        const idx = t.elements.findIndex((e) => e.id === id);
        const to = idx + dir;
        if (idx < 0 || to < 0 || to >= t.elements.length) return t;
        const arr = [...t.elements];
        const [item] = arr.splice(idx, 1);
        arr.splice(to, 0, item);
        return { ...t, elements: arr };
      });
    },
    [updateTemplate]
  );

  // ---- Gestión de plantillas ----
  const selectTemplate = useCallback((id) => {
    setCurrentId(id);
    setSelectedId(null);
    setFormData({});
    setSignatures({});
  }, []);

  const createTemplate = useCallback(
    (name) => {
      const t = {
        id: genId(), name, page: { size: "A4", orientation: "portrait" }, elements: [],
      };
      persist([...templates, t]);
      selectTemplate(t.id);
    },
    [persist, templates, selectTemplate]
  );

  const duplicateTemplate = useCallback(() => {
    const copy = {
      ...template,
      id: genId(),
      name: `${template.name} (copia)`,
      elements: template.elements.map((el) => ({ ...el, id: genId() })),
    };
    persist([...templates, copy]);
    selectTemplate(copy.id);
  }, [persist, templates, template, selectTemplate]);

  const renameTemplate = useCallback(
    (name) => updateTemplate((t) => ({ ...t, name })),
    [updateTemplate]
  );

  const deleteTemplate = useCallback(() => {
    if (templates.length <= 1) return;
    const next = templates.filter((t) => t.id !== template.id);
    persist(next);
    selectTemplate(next[0].id);
  }, [persist, templates, template.id, selectTemplate]);

  const importTemplate = useCallback(
    (t) => {
      const withNewId = { ...t, id: genId() };
      persist([...templates, withNewId]);
      selectTemplate(withNewId.id);
    },
    [persist, templates, selectTemplate]
  );

  const setFormValue = useCallback((key, value) => {
    setFormData((d) => ({ ...d, [key]: value }));
  }, []);

  const setSignature = useCallback((elementId, dataUrl) => {
    setSignatures((s) => ({ ...s, [elementId]: dataUrl }));
  }, []);

  const clearForm = useCallback(() => {
    setFormData({});
    setSignatures({});
  }, []);

  return {
    templates, template, selectedId, setSelectedId,
    mode, setMode, formData, setFormValue, signatures, setSignature, clearForm,
    updateTemplate, updateElement, addElement, removeElement, duplicateElement, reorderElement,
    selectTemplate, createTemplate, duplicateTemplate, renameTemplate, deleteTemplate, importTemplate,
  };
}
