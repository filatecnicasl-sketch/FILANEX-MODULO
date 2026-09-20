import { useState, useEffect } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import {
  cargarConfigHardware,
  guardarConfigHardware,
  soportaEscPos,
  conectarImpresora,
  reconectarImpresora,
  imprimirEscPos,
  construirTicketPrueba,
  abrirCajon,
} from "../../lib/tpvHardware.js";

export default function TpvConfigPage() {
  const [cfg, setCfg] = useState(cargarConfigHardware);
  const [impresoraConectada, setImpresoraConectada] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [pruebaEscaner, setPruebaEscaner] = useState("");
  const [ultimoEscaneo, setUltimoEscaneo] = useState(null);
  // Modelo de ticket: configuración de la empresa (se guarda en el servidor).
  const [ticket, setTicket] = useState(null);
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    reconectarImpresora().then(setImpresoraConectada).catch(() => {});
    fetch("/api/tpv/config-ticket")
      .then((r) => r.json())
      .then((d) => {
        setTicket(d.config);
        setLogoUrl(d.logoUrl ?? "");
      })
      .catch(() => {});
  }, []);

  function actualizar(seccion, cambios) {
    const nueva = { ...cfg, [seccion]: { ...cfg[seccion], ...cambios } };
    setCfg(nueva);
    guardarConfigHardware(nueva);
  }

  async function guardarTicket(cambios) {
    const nuevo = { ...ticket, ...cambios };
    setTicket(nuevo);
    try {
      const r = await fetch("/api/tpv/config-ticket", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      if (!r.ok) throw new Error((await r.json()).error || "No se pudo guardar");
    } catch (e) {
      setError(e.message);
    }
  }

  async function conectar() {
    setError(null);
    setMensaje(null);
    try {
      await conectarImpresora();
      setImpresoraConectada(true);
      setMensaje("Impresora conectada. Ya puedes imprimir directo y abrir el cajón.");
    } catch (e) {
      setError(e.message);
    }
  }

  async function probarImpresion() {
    setError(null);
    setMensaje(null);
    try {
      if (cfg.impresion.modo === "escpos") {
        await imprimirEscPos(construirTicketPrueba({ ancho: cfg.impresion.ancho }));
        setMensaje("Ticket de prueba enviado a la impresora.");
      } else {
        window.open("/api/tpv/tickets", "_blank");
        setMensaje("Modo navegador: los tickets se imprimen desde su ventana (botón Imprimir).");
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function probarCajon() {
    setError(null);
    setMensaje(null);
    try {
      await abrirCajon();
      setMensaje("Orden de apertura enviada al cajón.");
    } catch (e) {
      setError(e.message);
    }
  }

  function onTeclaEscaner(e) {
    if (e.key === "Enter" && pruebaEscaner.trim()) {
      setUltimoEscaneo({ codigo: pruebaEscaner.trim(), hora: new Date().toLocaleTimeString("es-ES") });
      setPruebaEscaner("");
    }
  }

  const Opcion = ({ activo, children, onClick }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
        activo ? "seg-activo" : "bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );

  const Interruptor = ({ valor, onCambio, etiqueta, ayuda }) => (
    <label className="flex items-start gap-3 py-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={valor}
        onChange={(e) => onCambio(e.target.checked)}
        className="mt-1 w-5 h-5 accent-cyan-500"
      />
      <span>
        <span className="block font-semibold text-slate-200">{etiqueta}</span>
        {ayuda && <span className="block text-sm text-slate-500">{ayuda}</span>}
      </span>
    </label>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <CabeceraPagina
        titulo="Ajustes del TPV"
        subtitulo="Apariencia del terminal, impresora de tickets, cajón y escáner — se guardan en este equipo"
      />

      {mensaje && <p className="text-sm text-emerald-300 mb-4">{mensaje}</p>}
      {error && <p className="text-sm text-rose-400 mb-4">{error}</p>}

      <div className="space-y-6">
        {/* Apariencia */}
        <div className="panel p-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Apariencia del terminal</h2>
          <p className="text-sm text-slate-500 mb-2">Forma de los artículos en la rejilla de venta</p>
          <div className="flex flex-wrap gap-2 mb-4">
            <Opcion
              activo={cfg.vista?.formaArticulos !== "cuadrado"}
              onClick={() => actualizar("vista", { formaArticulos: "redondo" })}
            >
              Redondos
            </Opcion>
            <Opcion
              activo={cfg.vista?.formaArticulos === "cuadrado"}
              onClick={() => actualizar("vista", { formaArticulos: "cuadrado" })}
            >
              Cuadrados
            </Opcion>
          </div>
          <p className="text-sm text-slate-500">
            Se aplica solo en este equipo: cada terminal puede tener su propia apariencia.
          </p>
        </div>

        {/* Impresora */}
        <div className="panel p-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Impresora de tickets</h2>

          <p className="text-sm text-slate-500 mb-2">Modo de impresión</p>
          <div className="flex flex-wrap gap-2 mb-4">
            <Opcion
              activo={cfg.impresion.modo === "navegador"}
              onClick={() => actualizar("impresion", { modo: "navegador" })}
            >
              Navegador (cualquier impresora)
            </Opcion>
            <Opcion
              activo={cfg.impresion.modo === "escpos"}
              onClick={() => actualizar("impresion", { modo: "escpos" })}
            >
              Directa ESC/POS (sin diálogo)
            </Opcion>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            {cfg.impresion.modo === "navegador"
              ? "Se abre el ticket en una ventana y se imprime con el diálogo del sistema. Funciona con cualquier impresora instalada o compartida en red."
              : "Impresión térmica directa por USB/serie, sin diálogo y con apertura de cajón. Necesita Chrome o Edge en el PC y pulsar «Conectar impresora» una vez en cada terminal."}
          </p>

          {cfg.impresion.modo === "escpos" && !soportaEscPos && (
            <p className="text-sm text-amber-300 mb-4">
              Este navegador no soporta impresión directa (Web Serial). Usa Chrome o Edge en el PC del TPV,
              o deja el modo navegador.
            </p>
          )}

          {cfg.impresion.modo === "escpos" && (
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <button onClick={conectar} className="btn-primary">
                {impresoraConectada ? "Impresora conectada — volver a elegir" : "Conectar impresora"}
              </button>
              <span className={`text-sm font-semibold ${impresoraConectada ? "text-emerald-300" : "text-slate-500"}`}>
                {impresoraConectada ? "Conectada" : "Sin conectar"}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-slate-500 mb-2">Ancho de papel</p>
              <div className="flex gap-2">
                <Opcion activo={cfg.impresion.ancho === 80} onClick={() => actualizar("impresion", { ancho: 80 })}>
                  80 mm
                </Opcion>
                <Opcion activo={cfg.impresion.ancho === 58} onClick={() => actualizar("impresion", { ancho: 58 })}>
                  58 mm
                </Opcion>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-2">Copias por ticket</p>
              <div className="flex gap-2">
                {[1, 2].map((n) => (
                  <Opcion key={n} activo={cfg.impresion.copias === n} onClick={() => actualizar("impresion", { copias: n })}>
                    {n}
                  </Opcion>
                ))}
              </div>
            </div>
          </div>

          <Interruptor
            valor={cfg.impresion.autoImprimir}
            onCambio={(v) => actualizar("impresion", { autoImprimir: v })}
            etiqueta="Imprimir automáticamente al cobrar"
            ayuda="Si lo quitas, el ticket solo se imprime desde Tickets → Reimprimir."
          />

          <button onClick={probarImpresion} className="btn-ghost mt-3">
            Imprimir ticket de prueba
          </button>
        </div>

        {/* Modelo de ticket */}
        {ticket && (
          <div className="panel p-6">
            <h2 className="text-lg font-bold text-slate-200 mb-4">Modelo de ticket</h2>
            <p className="text-sm text-slate-500 mb-4">
              Qué se imprime en el ticket de venta. Es de la empresa: vale para todos los terminales
              y se aplica tanto en impresión de navegador como en impresora térmica directa.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <Interruptor
                valor={ticket.mostrarLogo}
                onCambio={(v) => guardarTicket({ mostrarLogo: v })}
                etiqueta="Logo de la empresa"
                ayuda={logoUrl ? "Se imprime en la cabecera (modo navegador)." : "La empresa no tiene logo: súbelo en Ajustes → Empresa."}
              />
              <Interruptor
                valor={ticket.mostrarNif}
                onCambio={(v) => guardarTicket({ mostrarNif: v })}
                etiqueta="NIF bajo el nombre"
              />
              <Interruptor
                valor={ticket.mostrarDireccion}
                onCambio={(v) => guardarTicket({ mostrarDireccion: v })}
                etiqueta="Dirección"
              />
              <Interruptor
                valor={ticket.mostrarTelefono}
                onCambio={(v) => guardarTicket({ mostrarTelefono: v })}
                etiqueta="Teléfono"
              />
              <Interruptor
                valor={ticket.mostrarQr}
                onCambio={(v) => guardarTicket({ mostrarQr: v })}
                etiqueta="QR Veri*factu"
                ayuda="Código QR de verificación de la AEAT (modo navegador)."
              />
              <Interruptor
                valor={ticket.mostrarDesgloseIva}
                onCambio={(v) => guardarTicket({ mostrarDesgloseIva: v })}
                etiqueta="Desglose base + IVA"
              />
              <Interruptor
                valor={ticket.mostrarMetodoPago}
                onCambio={(v) => guardarTicket({ mostrarMetodoPago: v })}
                etiqueta="Método de pago"
              />
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-1">Línea extra de cabecera (opcional)</p>
                <input
                  type="text"
                  value={ticket.cabeceraLibre}
                  onChange={(e) => setTicket({ ...ticket, cabeceraLibre: e.target.value })}
                  onBlur={(e) => guardarTicket({ cabeceraLibre: e.target.value })}
                  placeholder="Ej.: Panadería artesana · Horario de 7:00 a 20:00"
                  className="input"
                />
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Texto de despedida (pie del ticket)</p>
                <input
                  type="text"
                  value={ticket.pieLibre}
                  onChange={(e) => setTicket({ ...ticket, pieLibre: e.target.value })}
                  onBlur={(e) => guardarTicket({ pieLibre: e.target.value })}
                  placeholder="Gracias por su compra"
                  className="input"
                />
              </div>
            </div>

            <button
              onClick={() =>
                window.open(`/api/tpv/tickets/ultimo/imprimir?ancho=${cfg.impresion.ancho}`, "_blank", "width=400,height=600")
              }
              className="btn-ghost mt-4"
            >
              Vista previa con el último ticket
            </button>
            <p className="text-sm text-slate-500 mt-2">
              La vista previa usa el último ticket emitido y el ancho de papel elegido arriba.
            </p>
          </div>
        )}

        {/* Cajón */}
        <div className="panel p-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Cajón portamonedas</h2>
          <p className="text-sm text-slate-500 mb-3">
            El cajón se conecta al conector RJ11 de la impresora de tickets y se abre solo
            (requiere impresión directa ESC/POS).
          </p>
          <Interruptor
            valor={cfg.cajon.abrirEfectivo}
            onCambio={(v) => actualizar("cajon", { abrirEfectivo: v })}
            etiqueta="Abrir al cobrar en efectivo"
            ayuda="Lo habitual: el cajón se abre cuando hay que dar cambio."
          />
          <Interruptor
            valor={cfg.cajon.abrirSiempre}
            onCambio={(v) => actualizar("cajon", { abrirSiempre: v })}
            etiqueta="Abrir con cualquier método de pago"
            ayuda="También con tarjeta u otros (p. ej. si guardas los resguardos en el cajón)."
          />
          <button onClick={probarCajon} className="btn-ghost mt-3">
            Abrir cajón ahora (prueba)
          </button>
        </div>

        {/* Escáner */}
        <div className="panel p-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Escáner de códigos</h2>
          <p className="text-sm text-slate-500 mb-3">
            Los escáneres de mano funcionan como un teclado: no necesitan instalación. Escanea un
            código en el buscador del terminal y pulsa Enter (la mayoría lo envían solos) para
            añadir el artículo al ticket.
          </p>
          <Interruptor
            valor={cfg.escaner.sonido}
            onCambio={(v) => actualizar("escaner", { sonido: v })}
            etiqueta="Pitido al añadir artículos"
            ayuda="Confirmación sonora en el terminal al escanear o tocar un artículo."
          />
          <div className="mt-4">
            <p className="text-sm text-slate-500 mb-2">Probar escáner (escanea aquí y pulsa Enter)</p>
            <input
              type="text"
              value={pruebaEscaner}
              onChange={(e) => setPruebaEscaner(e.target.value)}
              onKeyDown={onTeclaEscaner}
              placeholder="Escanea un código de barras…"
              className="input"
            />
            {ultimoEscaneo && (
              <p className="mt-2 text-sm">
                <span className="text-emerald-300 font-semibold">Leído correctamente:</span>{" "}
                <span className="num text-slate-200">{ultimoEscaneo.codigo}</span>{" "}
                <span className="text-slate-500">a las {ultimoEscaneo.hora}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
