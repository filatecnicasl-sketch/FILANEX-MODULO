// Registro de cambios y mejoras del programa + propuestas para estudiar.
// REGLA DE TRABAJO: cada vez que se hace un cambio en la aplicación, se añade
// aquí una entrada (la más reciente PRIMERO) y se sube junto con el commit.
// tipos: "nuevo" | "mejora" | "correccion" | "seguridad"

export const CAMBIOS = [
  {
    fecha: "2026-09-23",
    tipo: "correccion",
    titulo: "Finalizado y entregado: cada uno con su fecha",
    detalle:
      "Al pasar la orden a «Finalizado» la ventana pide la fecha y hora de finalización (trabajo terminado), y al pasar a «Entregado» pide la fecha y hora de entrega al cliente — antes pedía «fecha de entrega» en los dos casos. La chapa de la orden también lo distingue: «Finalizado: fecha» o «Entregado: fecha».",
  },
  {
    fecha: "2026-09-23",
    tipo: "mejora",
    titulo: "Aviso al cliente y fecha de entrega, editables en las finalizadas",
    detalle:
      "Las órdenes en «Finalizado» (y «Entregado») tienen ahora una campanita en la tarjeta y en la lista: abre la ventana de entrega para marcar el cliente como avisado (teléfono, WhatsApp, SMS, email o en persona), corregir la fecha y hora de entrega y subir fotos, también después de haber finalizado la orden. La campanita sale en ámbar si falta avisar y en verde cuando el cliente ya está avisado.",
  },
  {
    fecha: "2026-09-22",
    tipo: "nuevo",
    titulo: "Sello PAGADA en el PDF de las facturas cobradas",
    detalle:
      "Cuando una factura está totalmente cobrada, su PDF (descargar o imprimir) sale con un sello verde «PAGADA» estampado en el hueco bajo las líneas, con la fecha y el medio del último cobro (ej.: «Cobrada el 22/09/2026 por transferencia»). Sirve como justificante de pago para subvenciones y trámites. El formato de la factura no cambia en nada más: si no está cobrada, no sale ningún sello.",
  },
  {
    fecha: "2026-09-22",
    tipo: "nuevo",
    titulo: "Al finalizar la orden: entrega, fotos y aviso al cliente",
    detalle:
      "Al pasar una orden de trabajo a «Finalizado» se abre una ventana para anotar la fecha y hora de entrega, subir fotos del vehículo terminado y marcar si el cliente ya está avisado para la recogida (y por qué medio: teléfono, WhatsApp…). En el tablero y la lista se ve la hora de entrega y la chapa «Avisado» o «Sin avisar».",
  },
  {
    fecha: "2026-09-22",
    tipo: "mejora",
    titulo: "El PDF del albarán importado, visible en Compras",
    detalle:
      "En Compras → Albaranes, los albaranes importados por IA muestran ahora el enlace «Ver PDF original» para abrir el documento que mandó el proveedor. Así se puede cotejar lo escaneado con el albarán real en el control diario de recepciones.",
  },
  {
    fecha: "2026-09-22",
    tipo: "mejora",
    titulo: "El trabajo a realizar del parte, con letra grande",
    detalle:
      "En el parte de trabajo impreso (taller), el texto del «Trabajo solicitado» pasa de letra 9 a letra 14 en negrita, para que los operarios lo lean bien de un vistazo. Solo cambia ese texto; el resto del parte sigue igual. Como es una plantilla del editor de formatos, cada empresa puede ajustarlo más en Ajustes → Formatos.",
  },
  {
    fecha: "2026-09-22",
    tipo: "nuevo",
    titulo: "Peritación adjunta en las citas de peritaje",
    detalle:
      "En la cita de peritaje se puede adjuntar la peritación que manda la compañía (PDF o fotos, hasta 4 documentos). Se sube desde el propio modal —si la cita es nueva, se adjunta sola al guardar— y queda guardada con la cita. En Taller → Citas peritaje hay una columna «Peritación» para abrir el documento directamente.",
  },
  {
    fecha: "2026-09-22",
    tipo: "nuevo",
    titulo: "Actualización del programa sin cerrar la aplicación",
    detalle:
      "Nuevo botón «Actualizar» en la barra superior, junto a Salir: comprueba si hay una versión nueva y la aplica al momento, sin cerrar sesión ni salir y entrar. Además, la aplicación revisa sola cada 10 minutos si hay versión nueva y muestra el aviso abajo a la derecha. Pensado para pantallas que se quedan abiertas todo el día (TPV, recepción…).",
  },
  {
    fecha: "2026-09-22",
    tipo: "nuevo",
    titulo: "Archivo de propuestas: pendientes, realizadas y descartadas",
    detalle:
      "En Novedades → Propuestas, el administrador de la plataforma puede archivar cada propuesta como «Realizada» o «Descartada» (y reabrirla si hace falta). La pestaña muestra cuántas quedan pendientes y hay un filtro para ver cada grupo. Los usuarios ven la marca de estado en sus propuestas.",
  },
  {
    fecha: "2026-09-22",
    tipo: "mejora",
    titulo: "La orden nueva hereda la valoración sola",
    detalle:
      "Al dar de alta una orden de trabajo (desde Órdenes → Nueva orden), si la matrícula tiene una valoración pendiente —por ejemplo la importada del PDF de la compañía— la orden se rellena sola: líneas y total, compañía, nº de siniestro, «facturar a» y motivo. Ya no hay que escribir nada coche por coche, y la valoración queda enlazada con su número de orden.",
  },
  {
    fecha: "2026-09-22",
    tipo: "mejora",
    titulo: "La orden de trabajo impresa muestra la compañía",
    detalle:
      "En la impresión de la orden de trabajo, el bloque del vehículo ahora lleva una línea con la compañía de seguros y el nº de siniestro cuando la reparación va por aseguradora (si es particular, pone «Particular»). Ya estaba el dato; ahora también sale en el papel.",
  },
  {
    fecha: "2026-09-21",
    tipo: "mejora",
    titulo: "El TPV ya se usa bien desde el móvil",
    detalle:
      "En pantallas pequeñas el terminal cambia de aspecto: las familias pasan a una fila deslizable arriba, los productos ocupan toda la pantalla y el ticket se abre a pantalla completa desde la barra flotante con el total y el botón Cobrar. La barra de acciones de abajo se desliza con el dedo. En ordenador y tablet grande sigue igual.",
  },
  {
    fecha: "2026-09-21",
    tipo: "mejora",
    titulo: "El asistente ya tiene nombre: Nexo",
    detalle:
      "El asistente con IA se llama ahora Nexo: botón, cabecera del chat y saludo renovados, con su avatar. Además sus respuestas incluyen botones «Ir a…» que abren directamente la pantalla de la que habla.",
  },
  {
    fecha: "2026-09-21",
    tipo: "mejora",
    titulo: "El administrador del sistema ve todas las propuestas",
    detalle:
      "En Ayuda → Novedades → Propuestas, el superadministrador de la plataforma ve juntas las propuestas de TODAS las empresas, cada una con la chapa de la empresa que la envió. Ya no hace falta entrar empresa por empresa para leerlas.",
  },
  {
    fecha: "2026-09-21",
    tipo: "nuevo",
    titulo: "Asistente IA: pregunta cómo hacer cualquier cosa",
    detalle:
      "Módulo nuevo contratable por empresa: un botón «Asistente» flotante abre un chat que conoce todo el programa (facturación, taller, TPV, ajustes, formatos de impresión…) y la configuración real de tu empresa, y te guía paso a paso con las rutas de menú exactas. Se activa por licencia: quien no lo tenga contratado no lo ve.",
  },
  {
    fecha: "2026-09-21",
    tipo: "nuevo",
    titulo: "Citas de peritaje: el coche espera al perito",
    detalle:
      "En Taller → Citas hay una pestaña nueva «Citas peritaje» para cuando el cliente deja el vehículo y viene el perito de la compañía: la cita guarda compañía (obligatoria, se da de alta sola si no existe) y nº de siniestro, y salen en una lista ordenada con recepción directa. En cualquier cita se puede cambiar el tipo entre «Cita normal» y «Peritaje».",
  },
  {
    fecha: "2026-09-21",
    tipo: "mejora",
    titulo: "La compañía de seguros se da de alta sola",
    detalle:
      "Al escribir el nombre de una compañía que no existe (en la valoración, en la cita o al importar el PDF de la peritación), la ficha de aseguradora se crea automáticamente al guardar. Además las valoraciones se simplifican: ya no piden nombre ni teléfono del cliente, trabajan con el vehículo y la compañía.",
  },
  {
    fecha: "2026-09-21",
    tipo: "mejora",
    titulo: "Capturas de pantalla en las propuestas",
    detalle:
      "En Ayuda → Novedades → Propuestas ahora se pueden adjuntar hasta 4 capturas de pantalla a cada idea, con vista previa antes de enviar y miniaturas que se abren en grande al pulsarlas.",
  },
  {
    fecha: "2026-09-21",
    tipo: "mejora",
    titulo: "Valoraciones completas: vehículo, bastidor, compromiso y precios por hora",
    detalle:
      "La valoración ahora guarda marca, modelo y nº de bastidor (y los pasa a la ficha del vehículo), casilla de compromiso de reparación, y las partidas llevan tipo (chapa/pintura/mecánica/material) y horas: el importe se calcula solo con el precio por hora que se configura en Ajustes → Configuración → Taller. Todo sale también en la impresión.",
  },
  {
    fecha: "2026-09-21",
    tipo: "nuevo",
    titulo: "Alta de valoraciones desde el PDF de la compañía",
    detalle:
      "En Taller → Valoraciones, el botón «Alta desde PDF» lee el documento de la aseguradora (peritación) y crea la valoración completa: matrícula, vehículo (marca, modelo, km), aseguradora, nº de siniestro, fecha, póliza y las partidas con importes. Solo queda poner los datos del cliente.",
  },
  {
    fecha: "2026-09-21",
    tipo: "mejora",
    titulo: "La orden de trabajo sale rellena al imprimir",
    detalle:
      "Al crear la orden (recepción rápida o «Crear OT») las líneas de la valoración pasan a la orden, así la impresión lleva los trabajos e importes. En Órdenes el menú de impresión se queda solo con «Orden de trabajo» y «Orden de trabajo PDF».",
  },
  {
    fecha: "2026-09-21",
    tipo: "mejora",
    titulo: "Teléfono del cliente en la lista de presupuestos",
    detalle:
      "La pantalla principal de Presupuestos muestra el teléfono del cliente bajo su nombre, y el buscador también encuentra por teléfono.",
  },
  {
    fecha: "2026-09-21",
    tipo: "mejora",
    titulo: "La valoración da de alta cliente y vehículo",
    detalle:
      "Al guardar una valoración, si el cliente o la matrícula no existen se crean solos (el cliente con el NIF pendiente de completar), para que la cita y la recepción puedan relacionarlos.",
  },
  {
    fecha: "2026-09-21",
    tipo: "mejora",
    titulo: "Citas: valoración siempre visible y traspaso a la orden",
    detalle:
      "En la cita de taller la casilla «Viene de presupuesto» sale siempre marcada, y al recepcionar con recepción rápida las valoraciones del vehículo se enlazan con la orden creada (la orden hereda aseguradora y número de siniestro).",
  },
  {
    fecha: "2026-09-21",
    tipo: "mejora",
    titulo: "Propuestas escritas por los usuarios",
    detalle:
      "La pestaña «Propuestas» de Novedades es ahora un buzón: cualquier usuario escribe su idea (nombre, texto y fecha) y queda registrada para estudiarla.",
  },
  {
    fecha: "2026-09-21",
    tipo: "nuevo",
    titulo: "Novedades: registro de cambios y propuestas",
    detalle:
      "Nueva página Ayuda → Novedades con el registro de mejoras y cambios del programa y las propuestas pendientes de estudio. Cada cambio futuro se apuntará aquí automáticamente.",
  },
  {
    fecha: "2026-09-21",
    tipo: "mejora",
    titulo: "Alta de documentos más intuitiva",
    detalle:
      "El formulario de presupuesto/albarán muestra en una fila Cliente, NIF/CIF (se rellena solo) y Fecha; la dirección de entrega es una casilla compacta; totales siempre visibles abajo con el Total en grande y botones «Añadir línea» y «Buscar artículo».",
  },
  {
    fecha: "2026-09-21",
    tipo: "nuevo",
    titulo: "Ayuda general del programa",
    detalle:
      "Nuevo manual general accesible desde el menú Ayuda (sin necesidad de tener módulos activos): organización, primeros pasos, facturación, artículos, agenda, informes, ajustes y VeriFactu. Además se creó la ayuda del módulo Asesoría y se reescribió la del TPV.",
  },
  {
    fecha: "2026-09-21",
    tipo: "correccion",
    titulo: "Impresión de tickets desde la lista",
    detalle:
      "Reimprimir, ticket regalo y cierres de caja ya no dan «Sesión no válida»: las ventanas de impresión abren con el token de sesión.",
  },
  {
    fecha: "2026-09-21",
    tipo: "correccion",
    titulo: "Stock en conversiones de documentos",
    detalle:
      "Presupuesto → albarán y pedido → albarán ya mueven el stock (antes se quedaba sin actualizar). El TPV ya no descuenta stock de los servicios. El borrado de albaranes de compra ajusta el stock y se bloquea si está facturado.",
  },
  {
    fecha: "2026-09-20",
    tipo: "nuevo",
    titulo: "Modelo de ticket configurable",
    detalle:
      "En TPV → Ajustes → Modelo de ticket se decide qué se imprime: logo, NIF, dirección, teléfono, línea de cabecera libre, texto de despedida, QR Veri*factu, desglose de IVA y método de pago. Con vista previa sobre el último ticket y ancho de papel 58/80 mm aplicado a todas las impresiones.",
  },
  {
    fecha: "2026-09-20",
    tipo: "nuevo",
    titulo: "Inventario de almacén",
    detalle:
      "Artículos gana el botón «Inventario»: edición del stock en línea, filtro de bajo stock, valoración del almacén e impresión. Las compras suman stock (albarán y validación de factura) y las ventas lo descuentan, sin duplicar cuando se factura desde albaranes.",
  },
  {
    fecha: "2026-09-20",
    tipo: "nuevo",
    titulo: "Rediseño completo del TPV",
    detalle:
      "Terminal de venta estilo retail: categorías a la izquierda con foto y color, rejilla de artículos con imagen y precio, ticket a la derecha con teclado numérico, y barra inferior con movimientos de caja, informe de usuario, proforma, ticket regalo, copia y envío del último ticket y apertura de cajón. Funciona igual con pantalla táctil o ratón.",
  },
  {
    fecha: "2026-09-20",
    tipo: "nuevo",
    titulo: "Ajustes del TPV",
    detalle:
      "Nuevo apartado TPV → Ajustes: impresora (navegador o térmica ESC/POS), ancho de papel, copias, impresión automática, cajón portamonedas, escáner y apariencia de los artículos (redondos o cuadrados) por terminal.",
  },
  {
    fecha: "2026-09-19",
    tipo: "mejora",
    titulo: "Taller: cortesía y datos del cliente a la vista",
    detalle:
      "En la agenda y el calendario se ve la matrícula seguida de «V. cortesía» cuando el cliente tiene coche de cortesía; también en las vistas semana y mes. El listado de vehículos y los préstamos muestran el teléfono del cliente, y se pueden ver los vehículos de cortesía libres.",
  },
  {
    fecha: "2026-09-19",
    tipo: "nuevo",
    titulo: "Ficha de cliente con sus vehículos",
    detalle:
      "Los clientes del taller tienen un apartado «Vehículos» en su ficha; pulsando cada uno se abre el historial completo del vehículo.",
  },
  {
    fecha: "2026-09-19",
    tipo: "mejora",
    titulo: "Reasignación de vehículos al cambiar de dueño",
    detalle:
      "Si das de alta un vehículo que ya pertenece a otro cliente (p. ej. se vendió el coche), el programa avisa y permite reasignarlo. Las citas ya no se guardan vacías sin cliente, teléfono ni matrícula.",
  },
  {
    fecha: "2026-09-18",
    tipo: "seguridad",
    titulo: "Correcciones de la auditoría de código",
    detalle:
      "Aplicados los hallazgos críticos de la auditoría: actualización de dependencias con vulnerabilidades y endurecimiento del webhook de telefonía.",
  },
  {
    fecha: "2026-09-18",
    tipo: "nuevo",
    titulo: "Justificante de cita imprimible",
    detalle:
      "Al crear una cita de taller se puede imprimir el justificante para el cliente, con la fecha y hora de la cita.",
  },
];
