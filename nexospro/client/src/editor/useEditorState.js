import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadTemplates,
  saveTemplate,
  deleteTemplateRemote,
  duplicateTemplateRemote,
  setDefaultTemplateRemote,
  importTemplateRemote,
} from "./storage.js";
import { genId } from "./editorUtils.js";

const emptyTemplate = () => ({
  id: "",
  tipoDocumento: "generico",
  name: "Nuevo formato",
  porDefecto: false,
  page: { size: "A4", orientation: "portrait" },
  elements: [],
});

export function useEditorState() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentId, setCurrentId] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState("design");
  const [formData, setFormData] = useState({});
  const [signatures, setSignatures] = useState({});

  // Carga inicial desde el servidor.
  useEffect(() => {
    let vivo = true;
    setLoading(true);
    loadTemplates()
      .then((docs) => {
        if (!vivo) return;
        setTemplates(docs);
        setCurrentId(docs[0]?.id ?? "");
        setLoading(false);
      })
      .catch((err) => {
        if (!vivo) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const template = useMemo(
    () => templates.find((t) => t.id === currentId) ?? templates[0] ?? emptyTemplate(),
    [templates, currentId]
  );

  const persistOne = useCallback(async (nextTemplate) => {
    const saved = await saveTemplate(nextTemplate);
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === nextTemplate.id || t.id === saved.id);
      if (idx >= 0) {
        const arr = [...prev];
        arr[idx] = saved;
        return arr;
      }
      return [...prev, saved];
    });
    if (!currentId && saved.id) setCurrentId(saved.id);
    return saved;
  }, [currentId]);

  const updateTemplate = useCallback(
    (updater) => {
      const next = updater(template);
      setTemplates((prev) => prev.map((t) => (t.id === next.id ? next : t)));
      persistOne(next);
    },
    [template, persistOne]
  );

  const updateElement = useCallback(
    (idEl, patch) => {
      updateTemplate((t) => ({
        ...t,
        elements: t.elements.map((el) => (el.id === idEl ? { ...el, ...patch } : el)),
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
    (idEl) => {
      updateTemplate((t) => ({ ...t, elements: t.elements.filter((el) => el.id !== idEl) }));
      setSelectedId((s) => (s === idEl ? null : s));
    },
    [updateTemplate]
  );

  const duplicateElement = useCallback(
    (idEl) => {
      const el = template.elements.find((e) => e.id === idEl);
      if (!el) return;
      const copy = { ...el, id: genId(), x: el.x + 5, y: el.y + 5 };
      addElement(copy);
    },
    [template.elements, addElement]
  );

  const reorderElement = useCallback(
    (idEl, dir) => {
      updateTemplate((t) => {
        const idx = t.elements.findIndex((e) => e.id === idEl);
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

  const selectTemplate = useCallback((id) => {
    setCurrentId(id);
    setSelectedId(null);
    setFormData({});
    setSignatures({});
  }, []);

  const createTemplate = useCallback(
    async (name, tipoDocumento = "generico") => {
      const t = {
        id: "",
        tipoDocumento,
        name,
        porDefecto: false,
        page: { size: "A4", orientation: "portrait" },
        elements: [],
      };
      const saved = await persistOne(t);
      selectTemplate(saved.id);
    },
    [persistOne, selectTemplate]
  );

  const duplicateTemplate = useCallback(async () => {
    if (!template.id) return;
    const copy = await duplicateTemplateRemote(template.id);
    setTemplates((prev) => [...prev, copy]);
    selectTemplate(copy.id);
  }, [template, selectTemplate]);

  const renameTemplate = useCallback(
    (name) => updateTemplate((t) => ({ ...t, name })),
    [updateTemplate]
  );

  const setTemplateType = useCallback(
    (tipoDocumento) => updateTemplate((t) => ({ ...t, tipoDocumento })),
    [updateTemplate]
  );

  const deleteTemplate = useCallback(async () => {
    if (!template.id) return;
    if (templates.length <= 1) return;
    await deleteTemplateRemote(template.id);
    const next = templates.filter((t) => t.id !== template.id);
    setTemplates(next);
    selectTemplate(next[0]?.id ?? "");
  }, [template, templates, selectTemplate]);

  const setAsDefault = useCallback(async () => {
    if (!template.id) return;
    await setDefaultTemplateRemote(template.id);
    // Refrescar para que solo esta tenga porDefecto=true.
    const refreshed = await loadTemplates();
    setTemplates(refreshed);
  }, [template]);

  const importTemplate = useCallback(
    async (obj) => {
      const imported = await importTemplateRemote(obj);
      setTemplates((prev) => [...prev, imported]);
      selectTemplate(imported.id);
    },
    [selectTemplate]
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
    templates,
    template,
    loading,
    error,
    selectedId,
    setSelectedId,
    mode,
    setMode,
    formData,
    setFormValue,
    signatures,
    setSignature,
    clearForm,
    updateTemplate,
    updateElement,
    addElement,
    removeElement,
    duplicateElement,
    reorderElement,
    selectTemplate,
    createTemplate,
    duplicateTemplate,
    renameTemplate,
    setTemplateType,
    deleteTemplate,
    setAsDefault,
    importTemplate,
  };
}
