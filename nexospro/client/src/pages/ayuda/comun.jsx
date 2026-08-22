// Bloques comunes de las páginas de ayuda (manuales de usuario).
// Un manual es una lista de <Seccion> con pasos <Paso> y notas <Nota>.

export function Seccion({ titulo, children }) {
  return (
    <section className="panel p-5 sm:p-6">
      <h2 className="text-base font-bold text-slate-900 mb-3 pb-2.5 border-b border-slate-200">{titulo}</h2>
      <div className="space-y-2.5 text-sm text-slate-600 leading-relaxed">{children}</div>
    </section>
  );
}

export function Sub({ children }) {
  return <h3 className="text-sm font-bold text-slate-800 pt-2">{children}</h3>;
}

// Paso numerado de un procedimiento.
export function Paso({ n, children }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-lg bg-accent/10 border border-accent/25 text-accent text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <p className="flex-1">{children}</p>
    </div>
  );
}

// Aviso o truco destacado.
export function Nota({ titulo = "Ojo", children }) {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
      <p className="text-sm font-semibold text-sky-800">{titulo}</p>
      <div className="text-sm text-sky-700 mt-0.5">{children}</div>
    </div>
  );
}

// Tecla o botón tal cual aparece en pantalla.
export function K({ children }) {
  return (
    <span className="inline-block rounded-md border border-slate-300 bg-slate-100 px-1.5 py-px text-[0.8125rem] font-semibold text-slate-700 whitespace-nowrap">
      {children}
    </span>
  );
}
