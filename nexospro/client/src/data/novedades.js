// Registro de cambios y mejoras del programa + propuestas para estudiar.
// REGLA DE TRABAJO: cada vez que se hace un cambio en la aplicación, se añade
// aquí una entrada (la más reciente PRIMERO) y se sube junto con el commit.
// tipos: "nuevo" | "mejora" | "correccion" | "seguridad"

export const CAMBIOS = [
  {
    fecha: "2026-10-01",
    tipo: "nuevo",
    titulo: "Energía: análisis de cartera (a la altura de los software de gestión energética)",
    detalle:
      "Tras analizar los principales software del sector (EnergyCAP, MACH Energy, JadeTrack, Snapmeter, Dexma, Smarkia…), el módulo de Energía estrena las utilidades que se repiten en todos ellos: 1) Columna €/kWh (12 meses) en Suministros — el coste medio real de cada contrato, con los más caros marcados en ámbar: tus mejores oportunidades de estudio de ahorro. 2) Presupuesto anual por suministro con la desviación respecto a lo facturado, en la ficha, en el listado y en el modal de consumos. 3) Detección de consumos anómalos: el último mes sube 25 % o más sobre su media y aparece en la Agenda y en el panel. 4) Huella de CO2 estimada de la cartera (luz 0,19 y gas 0,202 kg CO2e/kWh) en la Agenda y en la tarjeta de energía gestionada. 5) Informe de cartera imprimible o en PDF desde el panel, con resumen, distribución por comercializadora, oportunidades y pendientes de la agenda.",
  },
  {
    fecha: "2026-10-01",
    tipo: "nuevo",
    titulo: "Energía: agenda automática del canal",
    detalle:
      "Nueva Agenda en el módulo de Energía (Energía → Agenda): en un vistazo, los suministros que cumplen de 7 a 10 meses desde su fecha de alta — la ventana para llamar al cliente y renovar el contrato antes del aniversario —, con los meses que lleva, los que faltan y el teléfono; junto a los contratos con fecha de fin próxima y los estudios sin respuesta de más de una semana. Se llena sola a partir de las fechas de alta y de fin de cada suministro, y el panel la resume en su sección de alertas.",
  },
  {
    fecha: "2026-10-01",
    tipo: "nuevo",
    titulo: "Energía: estudios de ahorro, consumos, autofacturas y alertas",
    detalle:
      "El módulo de Energía se completa con cuatro piezas nuevas. 1) Estudios de ahorro: situación actual del cliente frente a tu propuesta, con cálculo en vivo del coste anual y del ahorro (€ y %); al aceptarlo, el trámite de cambio de comercializadora se abre solo. 2) Consumos: cada CUPS lleva su histórico mensual de kWh e importe, con media, total anual y gráfica. 3) Autofacturas: se registran las liquidaciones que mandan las comercializadoras y se concilian automáticamente contra las comisiones calculadas, con la diferencia a la vista. 4) Alertas del canal: contratos que terminan en 60 días (nuevo campo «Fin del contrato» en suministros) y estudios enviados hace más de una semana sin respuesta, con el teléfono del cliente, directamente en el panel, que además estrena tarjetas de estudios en curso, energía gestionada en kWh y alertas.",
  },
  {
    fecha: "2026-10-01",
    tipo: "nuevo",
    titulo: "Energía: comisiones del canal",
    detalle:
      "Nuevo apartado Comisiones en el módulo de Energía. Con el botón «Generar mes» el programa calcula solo lo que devenga tu cartera ese mes: la mensualidad de cada contrato activo, el pago único de las altas y portabilidades conseguidas, y el recurrente anual en el mes del aniversario. Generar el mismo mes dos veces no duplica nada. Cada comisión se marca como cobrada cuando la comercializadora paga, se pueden dar de alta comisiones manuales (bonos, pactos especiales) y el panel muestra siempre lo pendiente de cobrar. Además, el contenido de todas las páginas vuelve a ir pegado al menú lateral, sin el hueco que había quedado en pantallas anchas.",
  },
  {
    fecha: "2026-10-01",
    tipo: "mejora",
    titulo: "Energía: panel renovado y listas bien alineadas",
    detalle:
      "El panel de Energía pasa a tarjetas de colores con icono, dato grande y detalle (suministros activos, trámites en curso, luz, gas, comercializadoras e inactivos), como el resto de paneles del programa, y cada tarjeta lleva a su apartado. Además, las listas de Suministros, Trámites y Comercializadoras se han rehecho: los filtros van en una sola fila con los botones de acción a la derecha, y las tablas ya no se cortan ni se montan sobre el menú lateral — era un fallo de la cabecera de página que afectaba a todo el programa y también queda corregido.",
  },
  {
    fecha: "2026-10-01",
    tipo: "nuevo",
    titulo: "Energía: trámites de alta, cambio, titular y baja",
    detalle:
      "Nuevo apartado Trámites en el módulo de Energía. Cuando un cliente acepta el estudio se abre un trámite sobre su CUPS: alta de suministro, cambio de comercializadora, cambio de titular o baja. Cada trámite lleva su circuito (documentación → enviado → en trámite) con notas e historial, y al activarlo el programa actualiza el suministro solo: le cambia la comercializadora, el titular o lo marca de baja. El panel muestra cuántos trámites hay en curso y desde Suministros se abre el trámite de un CUPS con un clic.",
  },
  {
    fecha: "2026-10-01",
    tipo: "nuevo",
    titulo: "Energía: alta de suministros leyendo la factura con IA",
    detalle:
      "En Energía → Suministros hay un botón «Importar factura (IA)». Subes la factura de luz o gas del cliente (PDF o foto) y la IA extrae CUPS, titular, comercializadora, dirección del punto, tarifa, potencias y consumo anual. Antes de guardar, todo se revisa y se corrige en pantalla: si el cliente no existe se crea en ese momento, y si la comercializadora es nueva también se puede dar de alta al vuelo. Si el CUPS ya estaba dado de alta, avisa y no deja duplicarlo. Con esto, dar de alta un suministro nuevo cuesta lo mismo que tarda el cliente en enviar su factura.",
  },
  {
    fecha: "2026-09-30",
    tipo: "nuevo",
    titulo: "Nuevo módulo: Energía",
    detalle:
      "Módulo para agencias de energía (canal directo de comercializadoras). Panel con la cartera de suministros, ficha de cada punto de suministro (CUPS) de luz o gas con cliente, comercializadora, tarifa, potencia y consumo anual, y ficha de comercializadoras con sus condiciones de comisión distintas para luz y gas (pago único por alta, €/mes por contrato activo y €/año recurrente). Además, los clientes pueden agruparse por grupo de empresas (varias sociedades del mismo dueño) y filtrar los suministros por grupo. Es un módulo de pago: se contrata desde FILANEX y se activa en Ajustes → Módulos. En camino: lectura de facturas de luz y gas con IA, estudios de ahorro, trámites y cálculo de comisiones.",
  },
  {
    fecha: "2026-09-30",
    tipo: "nuevo",
    titulo: "Presupuestos: se pueden borrar y las descripciones de varias líneas se editan bien",
    detalle:
      "Dos mejoras. 1) En Ventas → Presupuestos hay botón «Borrar» para eliminar los que ya no sirven (los ya convertidos en factura o albarán quedan protegidos por trazabilidad). 2) El campo de descripción de las líneas de cualquier documento (presupuesto, factura, albarán…) admite ahora varias líneas de texto visibles al escribir y al editar: con Enter se baja de línea y el cuadro crece solo, así los textos largos como «durante los primeros meses tendréis la ayuda…» se ven y se corrigen enteros.",
  },
  {
    fecha: "2026-09-30",
    tipo: "nuevo",
    titulo: "Ventas: los presupuestos ya se pueden editar",
    detalle:
      "Cada presupuesto tiene ahora un botón «Editar» para cambiar cliente, fecha, líneas, precios y dirección de entrega. Como los presupuestos no son documentos fiscales, se pueden modificar libremente; solo quedan bloqueados cuando ya se convirtieron en factura o albarán (entonces el botón desaparece).",
  },
  {
    fecha: "2026-09-30",
    tipo: "correccion",
    titulo: "Tesorería: los abonos de proveedor ya no salen como pago pendiente",
    detalle:
      "Las facturas de compra con total cero o en negativo (abonos del proveedor, como los de IONOS) aparecían en Pagos pendientes con 0,00 € o importe negativo y no había forma de quitarlas. Ahora se consideran saldadas y desaparecen de la lista: un abono no es algo que haya que pagar. Es el mismo criterio que ya se aplicó a las facturas rectificativas de venta.",
  },
  {
    fecha: "2026-09-30",
    tipo: "nuevo",
    titulo: "Ventas: se puede quitar un cobro registrado por error",
    detalle:
      "Abriendo la factura en Ventas → Facturas, en el apartado Cobros cada apunte tiene ahora un botón «Quitar». Sirve para cuando un cobro se registró mal (importe, fecha o método equivocado): al quitarlo, la factura vuelve a salir como pendiente en Tesorería. No afecta a VeriFactu, porque los cobros son un dato interno de tesorería, no del registro fiscal.",
  },
  {
    fecha: "2026-09-30",
    tipo: "mejora",
    titulo: "Compras: buscador completo y lista ordenada por fecha",
    detalle:
      "La lista de facturas de compra se ordena ahora por la fecha de la factura (no por cuándo se metió en el programa) y tiene un buscador en condiciones: texto libre (nº, proveedor, NIF, total…), estado (pendientes de revisión, validadas, rechazadas), pago (pendientes, parcial, pagadas), origen (IA o manual) y rango de fechas, con botón para limpiar todo y contador de resultados.",
  },
  {
    fecha: "2026-09-30",
    tipo: "nuevo",
    titulo: "Compras: se puede elegir no dar de alta los artículos",
    detalle:
      "Al registrar una factura de compra (revisión de la IA, alta manual o edición) hay una casilla «Dar de alta los artículos en el catálogo». Si se desmarca, la factura queda solo como gasto y no crea artículos nuevos: ideal para material que no se revende y así no ensucia el catálogo. Si alguna línea coincide con un artículo que ya existía, se enlaza igualmente para que el stock siga bien.",
  },
  {
    fecha: "2026-09-30",
    tipo: "correccion",
    titulo: "Compras: el total ya cuadra con el papel del proveedor",
    detalle:
      "Dos arreglos en facturas de compra. 1) El total que se veía mientras se editaban las líneas podía salir un céntimo por encima del guardado (se sumaba sin redondear antes): ahora la pantalla y el dato guardado coinciden siempre. 2) Si la factura del proveedor trae un total distinto por SU redondeo (p. ej. base 273,39 + IVA 57,41 = 330,80), en la revisión de la IA y en el alta/edición manual hay un campo «Total en la factura del proveedor» para escribir el del papel: la diferencia de céntimos se guarda como ajuste por redondeo y los libros de IVA siguen cuadrando.",
  },
  {
    fecha: "2026-09-29",
    tipo: "correccion",
    titulo: "Tesorería: las facturas rectificativas ya no salen como cobro pendiente",
    detalle:
      "Una factura rectificativa (total negativo, en negativo a favor del cliente) aparecía como «pendiente de cobro» y restaba en el neto previsto del panel de Tesorería, dando números confusos. Ahora se considera saldada: no es algo que haya que cobrar, sino una devolución que se gestiona aparte.",
  },
  {
    fecha: "2026-09-29",
    tipo: "mejora",
    titulo: "Borrar órdenes también desde el tablero",
    detalle:
      "Las tarjetas del tablero de órdenes (taller y servicio técnico) llevan ahora el botón «Borrar», con el mismo aviso del listado: si la orden tiene factura, queda claro que la factura no se borra.",
  },
  {
    fecha: "2026-09-29",
    tipo: "mejora",
    titulo: "Cualquier orden se puede borrar, también las facturadas",
    detalle:
      "El borrado de órdenes (taller y servicio técnico) ya no tiene restricciones. Si la orden tiene factura, el aviso lo deja claro antes de confirmar: la factura NO se borra (es un documento legal) y se reimprime igual, porque desde ahora guarda su propia copia de los datos de la reparación (vehículo, nº de orden, compañía, siniestro). Se borra solo la orden, con sus fotos, el historial del vehículo y los tiempos de operarios.",
  },
  {
    fecha: "2026-09-29",
    tipo: "correccion",
    titulo: "El logo de la empresa ya sale al imprimir documentos",
    detalle:
      "El elemento «Logo empresa» del editor de formatos imprimía una caja gris de muestra en vez del logo real. Ahora se sustituye por el logo subido en Ajustes → Configuración al imprimir cualquier documento (hoja de entrada, orden, cortesía…). Si la empresa no tiene logo, el hueco sale vacío.",
  },
  {
    fecha: "2026-09-29",
    tipo: "correccion",
    titulo: "Editor de formatos: imágenes que no llegan a guardarse y aviso de errores",
    detalle:
      "Las imágenes subidas al editor se reducen automáticamente antes de guardarse (una foto de móvil tal cual podía superar el límite del servidor y perderse sin avisar). Y si el formato no llega a guardarse en el servidor, ahora salta un aviso en pantalla en vez de fallar en silencio.",
  },
  {
    fecha: "2026-09-29",
    tipo: "nuevo",
    titulo: "Hoja de entrada desde la cita, con descripción y tabla de reparaciones rellenas",
    detalle:
      "La hoja de entrada se imprime desde la cita (también al crearla, sin guardar antes). Al pulsar «Imprimir hoja de entrada» se abre un cuadro con dos apartados: la descripción de la avería (sale en el bloque grande de la hoja) y las reparaciones a realizar, que rellenan la tabla del impreso con descripción, mano de obra y materiales. Si la cita tiene valoración enlazada, las reparaciones vienen ya escritas de sus partidas. Todo queda guardado en la cita. Además, el antiguo campo «Motivo» de la cita es ahora un cuadro amplio de «Descripción de la avería».",
  },
  {
    fecha: "2026-09-29",
    tipo: "correccion",
    titulo: "El alta de cliente nuevo daba error y no abría la ficha",
    detalle:
      "Al pulsar «Nuevo cliente» la pantalla se rompía con el mensaje «Cannot read properties of null (reading '_id')». Era una consulta de vehículos que se preparaba antes de saber si había cliente seleccionado. Ya se puede dar de alta sin problema.",
  },
  {
    fecha: "2026-09-29",
    tipo: "nuevo",
    titulo: "Factura Taller: códigos de conceptos, bloques y franquicia en totales",
    detalle:
      "Nueva plantilla «Factura Taller» (Ajustes → Formatos). En las líneas se puede teclear el código del concepto (1 Reparar, 2 Resanar, 3 Pintar, 4 Ajustar…) y el texto se escribe solo — los códigos son editables por empresa en Taller → Conceptos. El PDF agrupa las líneas en tres bloques (Piezas sustituidas, Mano de obra chapa y Mano de obra pintura/material) con su subtotal, y en los totales aparecen Total reparación, Franquicia y Descuento solo cuando aplican. Arriba salen los datos del trabajo: matrícula, vehículo, nº de orden, compañía y siniestro.",
  },
  {
    fecha: "2026-09-29",
    tipo: "mejora",
    titulo: "Hoja de entrada con sitio de verdad para describir la avería",
    detalle:
      "La hoja de entrada del taller estrena un bloque grande «Descripción de la avería / trabajos solicitados por el cliente»: sale impreso lo anotado en la recepción o la cita y, si está vacío, queda el espacio para escribir a mano. El seguro y la franquicia pasan a su propio cuadro («Seguro / franquicia»), ya no se mezclan con la descripción.",
  },
  {
    fecha: "2026-09-29",
    tipo: "mejora",
    titulo: "Tablero de órdenes: cambio de estado sin arrastrar",
    detalle:
      "Cada tarjeta del tablero (taller y servicio técnico) lleva ahora un selector de estado con colores: se cambia de columna con un clic, sin arrastrar — imprescindible cuando la tarjeta está abajo del todo. Y al arrastrar, la columna se desplaza sola al acercarse al borde.",
  },
  {
    fecha: "2026-09-29",
    tipo: "nuevo",
    titulo: "Aviso legal, privacidad y cookies publicado",
    detalle:
      "Los textos legales (LSSI, política de privacidad y cookies) están disponibles en Ayuda → Aviso legal y también sin iniciar sesión en app.filanex.es/legal, enlazado desde la pantalla de acceso.",
  },
  {
    fecha: "2026-09-29",
    tipo: "mejora",
    titulo: "Recepción de taller afinada: valoración localizable, orden sin precios",
    detalle:
      "Al crear la cita se puede localizar y enlazar la valoración/presupuesto del vehículo. La orden de trabajo impresa va sin precios (solo trabajos y cantidades) y la hoja de entrada ya no inventa la fecha de entrega. El buscador de órdenes encuentra por compañía, siniestro y teléfono, y en Vehículos se ve el teléfono del cliente aunque la ficha aún no esté enlazada.",
  },
  {
    fecha: "2026-09-29",
    tipo: "nuevo",
    titulo: "Compras: editar y borrar facturas, y margen de venta automático",
    detalle:
      "Las facturas de compra se pueden editar y borrar en cualquier estado (el stock se ajusta solo). Al validar una factura o albarán, los artículos nuevos nacen con precio de venta calculado con el margen configurado — margen general y también por familias de artículos. Los tickets de gasto (restaurante, gasolinera…) ya no crean artículos al validar, y las facturas sin validar llevan marca de agua «BORRADOR» para evitar confusiones.",
  },
  {
    fecha: "2026-09-28",
    tipo: "nuevo",
    titulo: "Matrícula en las facturas de venta",
    detalle:
      "Las facturas tienen campo matrícula: al facturar una orden de taller se rellena sola con la del vehículo y sale en el PDF de la factura. También se puede escribir a mano en cualquier factura.",
  },
  {
    fecha: "2026-09-28",
    tipo: "nuevo",
    titulo: "Franquicia del seguro de punta a punta",
    detalle:
      "La franquicia se anota en la cita, viaja a la orden y, al facturar a la aseguradora, se descuenta sola del total (línea negativa) — la compañía paga su parte y el cliente ve la suya. También aparece en la hoja de entrada que firma el cliente.",
  },
  {
    fecha: "2026-09-28",
    tipo: "mejora",
    titulo: "Borrado de órdenes de trabajo, con protección",
    detalle:
      "Las órdenes se pueden borrar (se llevan por delante sus fotos y el historial asociado), pero no si ya están facturadas: esas quedan protegidas para no romper la facturación.",
  },
  {
    fecha: "2026-09-28",
    tipo: "correccion",
    titulo: "Descargar PDF o XML en ventas pedía sesión de nuevo",
    detalle:
      "Los botones de imprimir PDF y descargar XML de las facturas de venta daban error 401 al abrirse como enlace directo. Ahora se descargan con la sesión iniciada y funcionan a la primera.",
  },
  {
    fecha: "2026-09-25",
    tipo: "nuevo",
    titulo: "Aviso MODO DEMO bien visible",
    detalle:
      "Cuando la empresa es de demostración, la aplicación muestra un aviso claro en pantalla. Así, al enseñar el programa, es imposible liarla metiendo datos de prueba en una empresa real.",
  },
  {
    fecha: "2026-09-25",
    tipo: "mejora",
    titulo: "Filtro por serie en las facturas de venta",
    detalle:
      "El listado de facturas se filtra ahora por serie (las que tenga dadas de alta la empresa), en sustitución del antiguo filtro por estados que no aportaba.",
  },
  {
    fecha: "2026-09-24",
    tipo: "seguridad",
    titulo: "Vigilante de la IA de escaneo de facturas",
    detalle:
      "La integración con la IA que lee facturas, albaranes y tickets se vigila sola: comprobación al arrancar el servidor, autotest diario, aviso al administrador si falla y estado visible en /api/health. Se acabó el enterarnos de que no escanea en mitad de una demostración.",
  },
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
