import { createElement, ELEMENT_NAMES } from "./editorUtils.js";
import {
  IconType, IconField, IconAlignLeft, IconCheckSquare, IconImage,
  IconMinus, IconSquare, IconTable, IconPenTool, IconLogo,
} from "./icons.jsx";

const ICONS = {
  text: <IconType />,
  field: <IconField />,
  textarea: <IconAlignLeft />,
  checkbox: <IconCheckSquare />,
  image: <IconImage />,
  logo: <IconLogo />,
  line: <IconMinus />,
  rect: <IconSquare />,
  table: <IconTable />,
  signature: <IconPenTool />,
};

const ORDER = ["text", "field", "textarea", "checkbox", "image", "logo", "line", "rect", "table", "signature"];
const LABELS = { ...ELEMENT_NAMES, logo: "Logo empresa" };

export function Palette({ onAdd, disabled }) {
  const add = (type) => {
    if (type === "logo") {
      const el = createElement("image");
      el.src = "{{empresa.logo}}";
      el.w = 45;
      el.h = 22;
      onAdd(el);
      return;
    }
    onAdd(type);
  };

  return (
    <div className="flex w-44 shrink-0 flex-col gap-1 overflow-auto border-r border-white/10 bg-navy-900 p-2">
      <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Elementos
      </div>
      {ORDER.map((t) => (
        <button
          key={t}
          type="button"
          disabled={disabled}
          onClick={() => add(t)}
          className="flex items-center gap-2 rounded-md border border-white/10 px-2 py-1.5 text-left text-sm text-slate-300 transition hover:border-accent/50 hover:bg-accent/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ICONS[t]}
          {LABELS[t]}
        </button>
      ))}
      <div className="mt-2 px-1 text-[0.6875rem] leading-snug text-slate-500">
        Pulsa para añadir a la página. Arrastra para mover y usa los tiradores para redimensionar.
      </div>
    </div>
  );
}
