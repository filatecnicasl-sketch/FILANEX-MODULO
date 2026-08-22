export const euros = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n ?? 0);

const TONOS = {
  slate: ["bg-white/5 text-slate-300 border-white/10", "bg-slate-400"],
  cyan: ["bg-accent/10 text-accent border-accent/25", "bg-accent"],
  amber: ["bg-amber-400/10 text-amber-300 border-amber-400/25", "bg-amber-400"],
  green: ["bg-emerald-400/10 text-emerald-300 border-emerald-400/25", "bg-emerald-400"],
  red: ["bg-red-400/10 text-red-300 border-red-400/25", "bg-red-400"],
};

export function Badge({ children, tono = "slate" }) {
  const [clases, punto] = TONOS[tono] ?? TONOS.slate;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border ${clases}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${punto}`} />
      {children}
    </span>
  );
}

const TONOS_AVATAR = [
  "bg-indigo-100 text-indigo-600",
  "bg-emerald-100 text-emerald-600",
  "bg-amber-100 text-amber-600",
  "bg-rose-100 text-rose-600",
  "bg-sky-100 text-sky-600",
  "bg-violet-100 text-violet-600",
  "bg-teal-100 text-teal-600",
  "bg-orange-100 text-orange-600",
];

// Avatar con iniciales y color pastel estable según el nombre (referencia).
export function Avatar({ nombre, className = "" }) {
  const ini = (nombre ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";
  let h = 0;
  for (const c of nombre ?? "") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const tono = TONOS_AVATAR[h % TONOS_AVATAR.length];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center w-7 h-7 rounded-lg text-[10px] font-bold ${tono} ${className}`}
    >
      {ini}
    </span>
  );
}

export function Iniciales({ nombre }) {
  const ini = (nombre ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span className="inline-flex shrink-0 items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-b from-accent/25 to-accent/5 border border-accent/25 text-accent text-[10px] font-extrabold tracking-wide">
      {ini}
    </span>
  );
}

export function EstadoVacio({ titulo, descripcion }) {
  return (
    <div className="panel px-6 py-14 text-center">
      <div className="w-12 h-12 mx-auto rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          className="text-accent"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <p className="text-white font-semibold">{titulo}</p>
      {descripcion && <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">{descripcion}</p>}
    </div>
  );
}
