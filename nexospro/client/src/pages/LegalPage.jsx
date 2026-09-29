// Página pública de textos legales (LSSI, RGPD, cookies). Accesible sin
// sesión desde /legal, enlazada desde la pantalla de acceso y desde el menú.
const SECCIONES = [
  {
    titulo: "1 · Titular del sitio web",
    parrafos: [
      "En cumplimiento de la Ley 34/2002 de Servicios de la Sociedad de la Información (LSSI-CE), se informa de que este sitio web y la aplicación FILANEX son titularidad de FILATECNICA S.L. Contacto: info@filatecnica.com.",
    ],
  },
  {
    titulo: "2 · Condiciones de uso",
    parrafos: [
      "El acceso y uso de este sitio web atribuye la condición de usuario e implica la aceptación de estas condiciones. El usuario se compromete a hacer un uso lícito del sitio y de la aplicación. FILATECNICA S.L. se reserva el derecho a modificar los contenidos y estas condiciones en cualquier momento.",
      "La aplicación FILANEX es un servicio de software de gestión (facturación, taller, TPV y otros módulos) prestado por suscripción. Las condiciones económicas y de servicio se pactan individualmente con cada cliente en su contrato de alta.",
    ],
  },
  {
    titulo: "3 · Propiedad intelectual",
    parrafos: [
      "Los contenidos del sitio (marca FILANEX, logotipos, diseños, textos y el propio software) son titularidad de FILATECNICA S.L. Queda prohibida su reproducción, distribución o explotación sin autorización expresa.",
    ],
  },
  {
    titulo: "4 · Política de privacidad — datos de visitantes y clientes",
    parrafos: [
      "Responsable del tratamiento: FILATECNICA S.L. (info@filatecnica.com).",
      "Finalidades: (a) gestionar la relación comercial y la prestación del servicio contratado (alta de empresa, usuarios, facturación y soporte); (b) atender consultas recibidas por email o formulario; (c) cumplir obligaciones legales (fiscales y contables). Base jurídica: ejecución del contrato, interés legítimo y cumplimiento de obligaciones legales.",
      "Conservación: mientras dure la relación contractual y, después, durante los plazos legales de prescripción (6 años mercantil, 4-5 años fiscal).",
      "Destinatarios: no se ceden datos a terceros salvo obligación legal. Los datos se alojan en servidores de UpCloud Spain S.L. (Madrid, Unión Europea) como encargado de tratamiento. No se realizan transferencias internacionales.",
      "Derechos: puede ejercer acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a info@filatecnica.com, indicando el derecho que ejerce y adjuntando documento identificativo. También puede reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).",
    ],
  },
  {
    titulo: "5 · Privacidad dentro de la aplicación (datos de nuestros clientes)",
    parrafos: [
      "Los datos que cada empresa usuaria introduce en FILANEX (sus clientes, facturas, vehículos, empleados, etc.) son responsabilidad de dicha empresa, que actúa como responsable del tratamiento. FILATECNICA S.L. los trata únicamente como encargado, conforme al contrato de encargado de tratamiento (art. 28 RGPD) que se firma con cada cliente. FILATECNICA S.L. no utiliza esos datos con fines propios ni comerciales.",
    ],
  },
  {
    titulo: "6 · Cookies y almacenamiento local",
    parrafos: [
      "Este sitio y la aplicación no utilizan cookies de seguimiento, publicidad ni analítica de terceros.",
      "La aplicación utiliza únicamente almacenamiento local del navegador (localStorage/sessionStorage y caché del service worker) con fines estrictamente técnicos: mantener la sesión iniciada, recordar preferencias de pantalla y permitir el funcionamiento sin conexión (modo PWA). Estos elementos son necesarios para el servicio y no requieren consentimiento según el art. 22.2 LSSI.",
      "El usuario puede eliminarlos en cualquier momento borrando los datos de navegación del sitio desde su navegador, si bien la aplicación dejará de recordar su sesión.",
    ],
  },
  {
    titulo: "7 · Legislación aplicable",
    parrafos: [
      "Estas condiciones se rigen por la legislación española. Para cualquier controversia serán competentes los juzgados del domicilio del usuario consumidor o, en otro caso, los de la provincia de Cádiz.",
    ],
  },
];

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <a href="/" className="text-accent text-sm hover:underline">← Volver a FILANEX</a>
          <h1 className="text-2xl font-bold text-white mt-4">Aviso legal, privacidad y cookies</h1>
          <p className="text-sm text-slate-400 mt-1">Filatecnica S.L. · app.filanex.es · Última actualización: septiembre de 2026</p>
        </div>

        <div className="space-y-6">
          {SECCIONES.map((s) => (
            <section key={s.titulo} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-accent mb-3">{s.titulo}</h2>
              <div className="space-y-2">
                {s.parrafos.map((p, i) => (
                  <p key={i} className="text-sm text-slate-300 leading-relaxed text-justify">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="text-center text-xs text-slate-500 mt-8">
          Filatecnica S.L. · info@filatecnica.com · app.filanex.es
        </p>
      </div>
    </div>
  );
}
