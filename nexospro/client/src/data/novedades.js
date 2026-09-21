// Registro de cambios y mejoras del programa + propuestas para estudiar.
// REGLA DE TRABAJO: cada vez que se hace un cambio en la aplicación, se añade
// aquí una entrada (la más reciente PRIMERO) y se sube junto con el commit.
// tipos: "nuevo" | "mejora" | "correccion" | "seguridad"

export const CAMBIOS = [
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
