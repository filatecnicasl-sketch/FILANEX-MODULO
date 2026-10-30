// Registro de cambios y mejoras del programa + propuestas para estudiar.
// REGLA DE TRABAJO: cada vez que se hace un cambio en la aplicación, se añade
// aquí una entrada (la más reciente PRIMERO) y se sube junto con el commit.
// tipos: "nuevo" | "mejora" | "correccion" | "seguridad"

export const CAMBIOS = [
  {
    fecha: "2026-10-30",
    tipo: "correccion",
    titulo: "Editar una cita ya guarda el vehículo nuevo",
    detalle:
      "Al reabrir una cita guardada sin vehículo y marcar «Vehículo nuevo» con su marca y modelo, ahora el coche se da de alta al guardar, igual que al crear la cita. Antes la marca y el modelo parecía que se guardaban pero el vehículo no llegaba a crearse.",
  },
  {
    fecha: "2026-10-30",
    tipo: "mejora",
    titulo: "Buscar clientes por matrícula y fichas de operarios completas",
    detalle:
      "En Clientes, el buscador encuentra ahora también al cliente por la matrícula de cualquiera de sus vehículos (se puede escribir con espacios o guiones). Y en Taller → Operarios, la ficha de cada operario incorpora teléfono, email, situación laboral (alta, periodo de prueba o baja), fecha de alta y de baja, notas importantes y el curriculum en PDF o foto (el impreso que traen en mano), que se sube y se consulta desde la propia ficha.",
  },
  {
    fecha: "2026-10-30",
    tipo: "mejora",
    titulo: "Citas: la dirección del cliente y las cortesías, a la vista",
    detalle:
      "Al crear una cita con cliente nuevo, se puede escribir su dirección junto al teléfono y queda guardada en la ficha del cliente (sin salir de la cita). Y en el calendario, las citas con coche de cortesía se señalan ahora en azul intenso —también en la vista MES— para localizarlas de un vistazo, igual que las insignias de compañía y «V. cortesía» de la lista.",
  },
  {
    fecha: "2026-10-29",
    tipo: "correccion",
    titulo: "Documentación de clientes y suministros: adiós al bloqueo por peso",
    detalle:
      "Al subir la documentación de un cliente o de un suministro, las fotos y escaneos muy pesados se comprimen ahora solos en el navegador antes de enviarse (se reducen a un tamaño legible que pesa alrededor de 1-2 MB), y el máximo por archivo sube de 15 a 30 MB. Si aun así un PDF escaneado se pasa del límite, el aviso explica cómo resolverlo. Ya se puede adjuntar la documentación de cualquier ficha sin que el programa la rechace.",
  },
  {
    fecha: "2026-10-29",
    tipo: "mejora",
    titulo: "Importar factura con IA: renovar un suministro ya existente",
    detalle:
      "Al importar una factura de luz o gas con la IA, si el CUPS ya estaba dado de alta el programa bloqueaba la continuación. Ahora ofrece la elección: «Renovar o cambiar de compañía» —actualiza el suministro existente con la comercializadora, tarifa, potencias y consumo leídos en la factura, y permite anotar la fecha de alta en la comercializadora para los avisos de renovación— o «Es otro suministro», que crea uno nuevo tras corregir el CUPS leído. Nunca se crean duplicados del mismo CUPS.",
  },
  {
    fecha: "2026-10-28",
    tipo: "nuevo",
    titulo: "Notas internas con avisos en el historial del vehículo",
    detalle:
      "En Taller → Vehículos, al abrir la ficha hay una nueva pestaña «Notas internas»: anotaciones del coche o del cliente que no salen en ningún impreso. Cualquier nota se puede marcar como aviso: entonces salta una ventana al abrir el historial del vehículo y se muestra en rojo también al crear una cita con esa matrícula, para que nadie se lo pierda (impagos, incidencias, piezas pendientes…).",
  },
  {
    fecha: "2026-10-28",
    tipo: "mejora",
    titulo: "El historial del vehículo muestra los documentos completos",
    detalle:
      "Al pulsar una orden, presupuesto, albarán, factura, cita, valoración o cortesía del historial, antes salía un resumen. Ahora se abre el documento completo: todos sus datos, el detalle de líneas con cantidades, precios, descuentos e importes, los totales, las horas invertidas por operario, las tareas pendientes de entrega, los cobros de las facturas y las fotos y firmas de recepción y entrega (pulsando una foto o firma se amplía).",
  },
  {
    fecha: "2026-10-28",
    tipo: "correccion",
    titulo: "El logotipo de la empresa ya sale siempre al imprimir",
    detalle:
      "Al imprimir cualquier formato (contrato de cortesía, facturas, albaranes…), el programa esperaba a las fuentes del texto pero no a que la imagen del logo terminara de descargarse: según la conexión, el diálogo de impresión se abría antes y el logo salía en blanco. Ahora se espera a que el logo (y cualquier imagen del formato) esté cargado antes de abrir la impresión. Además, el contrato de cortesía incorpora el hueco del logotipo arriba a la izquierda, sin tocar el resto del documento.",
  },
  {
    fecha: "2026-10-27",
    tipo: "correccion",
    titulo: "Vencimiento por defecto: al contado, nunca a 30 días",
    detalle:
      "Las facturas nacen ahora con el vencimiento el mismo día de su expedición (al contado), en vez de los 30 días que se ponía antes. Bajo la fecha hay botones rápidos: Al contado, 7, 15, 30 y 60 días; o se escribe la fecha a mano. Vale igual al facturar una orden de taller. La factura 3-2026-39, creada con el defecto antiguo, se ha corregido a contado.",
  },
  {
    fecha: "2026-10-27",
    tipo: "mejora",
    titulo: "Formularios más rápidos: cliente vacío y Enter para avanzar",
    detalle:
      "En albaranes, facturas, presupuestos y demás documentos, el buscador de cliente empieza ahora vacío: se escribe el nombre o NIF y se busca directamente, sin limpiar el campo antes. Y en las líneas del documento, la tecla Enter pasa al siguiente campo (cantidad, precio…), como en la entrada de datos clásica; para meter un salto de línea dentro de la descripción, Shift+Enter.",
  },
  {
    fecha: "2026-10-26",
    tipo: "nuevo",
    titulo: "Autofacturas: alta por OCR desde el PDF",
    detalle:
      "En Ventas → Autofacturas, el botón «Subir autofactura (OCR)» lee el PDF que manda la comercializadora y crea un borrador con la contraparte, el número, la fecha y los importes ya rellenados. El documento queda marcado «por revisar»: en el borrador se pueden corregir todos los datos (incluso cambiar la contraparte) y, al dar a «Validar», recibe su número de la serie interna AUTO y pasa a contar en informes, IVA y tesorería. Si el mismo documento se sube dos veces, el programa avisa de que ya existe y no crea duplicados.",
  },
  {
    fecha: "2026-10-25",
    tipo: "mejora",
    titulo: "Autofacturas: una sola sección, en Ventas",
    detalle:
      "Se elimina la sección Autofacturas del módulo de Energía para evitar duplicidad: las autofacturas (comisiones de energía, móvil y demás facturación por el destinatario) se registran únicamente en Ventas → Autofacturas, con serie interna AUTO-<año>. El panel de Energía mantiene una ficha que enlaza a la nueva sección y la URL antigua /energia/autofacturas redirige automáticamente.",
  },
  {
    fecha: "2026-10-25",
    tipo: "nuevo",
    titulo: "Ventas: sección propia de Autofacturas con serie interna AUTO",
    detalle:
      "La mayoría de las comisiones de energía y de las compañías de móvil se liquidan por facturación por el destinatario. Esas autofacturas tienen ahora su propia sección en Ventas → Autofacturas, separada del listado general de facturas. Se siguen contabilizando como ventas en informes e IVA, se numeran con la serie interna AUTO-<año> conservando el número del documento original, y desde su ficha se puede ver el PDF original y registrar o quitar cobros. El listado general de Facturas ya no las mezcla; la Tesorería sigue mostrándolas como cobros pendientes.",
  },
  {
    fecha: "2026-10-24",
    tipo: "mejora",
    titulo: "Ventas: importar facturas históricas conservando el PDF original",
    detalle:
      "Las facturas ya emitidas en otro sistema (por ejemplo, autofacturas por destinatario) pueden incorporarse a Ventas con su número, fecha e importes originales y conservar el PDF fuente. Se identifican como históricas: no se vuelven a emitir, no generan otro registro VeriFactu ni permiten crear una rectificativa desde FILANEX. El cobro queda pendiente hasta cotejar el extracto.",
  },
  {
    fecha: "2026-10-23",
    tipo: "mejora",
    titulo: "Flota de cortesía: datos de gestión de cada vehículo",
    detalle:
      "Al añadir o editar (lápiz) un coche de la flota se registran ahora su fecha de llegada, fecha de entrega (fin de renting o préstamo; se marca en rojo si ya pasó), empresa de renting (vacío = propiedad), kilómetros, año y combustible. Todo se ve en la tabla de la pestaña «Flota».",
  },
  {
    fecha: "2026-10-23",
    tipo: "correccion",
    titulo: "El teléfono y el modelo vuelven al tablón de peritajes",
    detalle:
      "En la vista Agenda de las citas de peritaje (Próximos, Día, Semana y Mes) cada cita vuelve a mostrar el teléfono del cliente y añade el modelo del vehículo debajo del nombre, para llamar sin abrir la cita. En Semana y Mes también aparecen al dejar el ratón sobre la cita.",
  },
  {
    fecha: "2026-10-22",
    tipo: "nuevo",
    titulo: "Informe del modelo 347",
    detalle:
      "En Informes → Modelo 347 se lista, año por año, la relación de clientes y proveedores con los que has hecho operaciones por más de 3.005,06 € (base imponible sin IVA), con desglose trimestral, exportación a CSV e impresión. Una casilla permite ver también los que no llegan al umbral, por si alguno se queda cerca y quieres revisarlo.",
  },
  {
    fecha: "2026-10-22",
    tipo: "nuevo",
    titulo: "Gestión de la flota de cortesía en la propia página de Cortesía",
    detalle:
      "La página de Cortesía tiene dos pestañas: «Préstamos» (la de siempre) y «Flota», donde se ven todos los coches de sustitución, quién tiene cada uno prestado y hasta cuándo, y desde donde se añaden o se quitan coches sin ir a Vehículos. Un coche con préstamos o con órdenes de trabajo registradas no se puede borrar, para no perder el historial.",
  },
  {
    fecha: "2026-10-22",
    tipo: "mejora",
    titulo: "Historial del vehículo: también se ven las cortesías que recibió el cliente",
    detalle:
      "Antes, la pestaña «Cortesías» del historial solo mostraba los préstamos en la ficha del coche de cortesía. Ahora, en la ficha del vehículo del cliente también aparece qué coche de sustitución le prestaron y entre qué fechas, con el coche en taller y los KM si se anotaron.",
  },
  {
    fecha: "2026-10-22",
    tipo: "nuevo",
    titulo: "Adjuntar documentación en el momento del alta",
    detalle:
      "Al dar de alta un suministro nuevo, su sección Documentación permite elegir contrato, factura de la comercializadora o cualquier PDF/imagen desde el primer momento: los archivos se suben solos al guardar. Lo mismo al crear un cliente nuevo: la pestaña Documentos está disponible durante el alta (también en el botón + Nuevo del selector de cliente dentro de cualquier documento), así ya no hace falta volver después a la ficha para adjuntar el DNI o la factura.",
  },
  {
    fecha: "2026-10-22",
    tipo: "correccion",
    titulo: "Ya no se pierde un cliente nuevo escrito dentro de un documento",
    detalle:
      "Al dar de alta un cliente o proveedor nuevo desde un suministro, presupuesto, albarán o factura de compra, si se pulsaba «Guardar» del documento sin haber pulsado antes «Crear y seleccionar», la ventana se cerraba y los datos escritos se perdían. Ahora el programa avisa antes: ofrece volver atrás para terminar de crear el cliente (o proveedor) o guardar sin él a sabiendas.",
  },
  {
    fecha: "2026-10-22",
    tipo: "mejora",
    titulo: "Energía: aviso al guardar fechas sospechosas en un suministro",
    detalle:
      "Al dar de alta o renovar un suministro, si la fecha de alta en la comercializadora es anterior a hoy, o la fecha de fin es anterior a la de alta, el programa avisa antes de guardar para confirmar que no es un error de tecleo. Así un contrato con la fecha mal puesta no pasa desapercibido y sigue apareciendo en los avisos de renovación de la agenda. Si es un contrato que ya estaba en vigor, basta con aceptar el aviso.",
  },
  {
    fecha: "2026-10-22",
    tipo: "nuevo",
    titulo: "Energía: los avisos de renovación llevan al suministro",
    detalle:
      "En la agenda del módulo de Energía (y en el panel de alertas de la portada), ahora se puede pulsar cualquier suministro de los avisos — llamar para renovar, contratos por renovar y consumos anómalos — y se abre directamente su ficha en Suministros para gestionarlo: cambiar la fecha de fin, apuntar consumos o revisar sus documentos, sin buscarlo en la lista.",
  },
  {
    fecha: "2026-10-21",
    tipo: "nuevo",
    titulo: "Calendario: días festivos marcados en rojo",
    detalle:
      "En el calendario de citas (y en la agenda) los días festivos se distinguen en rojo del resto de días. Los festivos nacionales (Año Nuevo, Reyes, Jueves y Viernes Santo, 1 de mayo, Asunción, Todos los Santos, Constitución, Inmaculada y Navidad) se calculan solos cada año; los festivos de cada zona (día de la comunidad, ferias locales) se añaden en Ajustes → Configuración → Taller — días festivos, con su fecha y nombre.",
  },
  {
    fecha: "2026-10-21",
    tipo: "mejora",
    titulo: "Historial del vehículo: las notas de las citas ya se ven",
    detalle:
      "Las notas que se escriben en una cita (por ejemplo, «no se ha quedado en taller») no aparecían en el historial del vehículo. Ahora salen en el recuadro azul «Nota» de cada documento del historial, tanto en la lista como al abrir la ficha, y también en la línea de la cita en la agenda.",
  },
  {
    fecha: "2026-10-20",
    tipo: "mejora",
    titulo: "Taller Montiel: contrato de cortesía más claro y citas por día",
    detalle:
      "El contrato de cortesía ya no deja un marco vacío de logo; los campos salen identificados y ordenados para que no se monten unos sobre otros, y el nivel de combustible se muestra con barras de 0/8 a 8/8. En Citas, Hoy abre directamente las citas de hoy, las flechas avanzan día a día y al pulsar una fecha en Semana o Mes se ven sus citas; Próximos destaca primero las fechas cercanas.",
  },
  {
    fecha: "2026-10-20",
    tipo: "nuevo",
    titulo: "Taller Montiel: dos impresiones para el parte de trabajo",
    detalle:
      "Al imprimir una orden de trabajo, Raquel puede elegir entre el parte completo (con los datos de la aseguradora y la tabla de trabajos/materiales) y el documento 'Trabajos a realizar' (lista grande en vertical, con los datos del vehículo y de la aseguradora como referencia, sin tabla ni importes). En ambos, cada trabajo sale en su propio renglón, el texto no se corta y las líneas 'POR CUENTA DEL CLIENTE' quedan subrayadas.",
  },
  {
    fecha: "2026-10-20",
    tipo: "mejora",
    titulo: "Energía: botones de suministros siempre a la vista (columna fija)",
    detalle:
      "En Energía → Suministros, la tabla tiene muchas columnas y para llegar a los botones de editar había que arrastrar la barra horizontal hasta el final. La columna de Acciones ahora queda fija a la derecha: se queda pegada al borde mientras te desplazas por la tabla, con lo que editar, borrar, ver consumos o iniciar un trámite está siempre a un clic, sin scroll.",
  },
  {
    fecha: "2026-10-19",
    tipo: "correccion",
    titulo: "Escribir en cualquier campo de texto ya no se queda corto: los cuadros crecen solos",
    detalle:
      "Los cuadros de texto de varias líneas (descripción del trabajo en la orden, motivo de la recepción, avería y diagnóstico en servicio, detalle de las líneas de factura…) ya no tienen altura fija: crecen solos a medida que escribes, así una descripción de daños de 4, 5 o 10 renglones se ve entera mientras la escribes y no parece que el programa «no deje» escribir más. Antes solo se veían 2 líneas y el resto quedaba escondido.",
  },
  {
    fecha: "2026-10-19",
    tipo: "correccion",
    titulo: "Seleccionar texto (marcar en azul) ya no cierra la ventana ni pierde lo escrito",
    detalle:
      "El gesto de arrastrar con el ratón para marcar una palabra o frase y soltarlo fuera del cuadro de texto cerraba la ventana entera y se perdía todo lo escrito. Ya no puede pasar: la ventana solo se cierra si el clic empieza Y termina en el fondo oscuro, nunca si el arrastre empezó dentro de un campo. Está arreglado en todas las ventanas del programa (taller, servicio, ventas, compras, clientes, artículos, tesorería…).",
  },
  {
    fecha: "2026-10-19",
    tipo: "nuevo",
    titulo: "La orden de trabajo se guarda sola como borrador mientras escribes",
    detalle:
      "Al rellenar una orden de trabajo, todo lo que escribes se guarda automáticamente como borrador en el propio equipo. Si la ventana se cierra sin querer —o se va la luz— al volver a abrir la orden aparece un aviso y el borrador se recupera tal cual estaba. Al guardar la orden de verdad, el borrador se borra. Así no se vuelve a perder una recepción a medio hacer.",
  },
  {
    fecha: "2026-10-19",
    tipo: "correccion",
    titulo: "Contrato de cortesía: sale por duplicado (cliente y taller) y con el nº de orden",
    detalle:
      "El contrato del vehículo de cortesía se imprime ahora dos veces seguidas en el mismo diálogo —una copia para el cliente y otra para el taller—. Además, el número de la orden de trabajo asociada ya no sale vacío al editar el préstamo: se recupera y se rellena al elegir la orden.",
  },
  {
    fecha: "2026-10-19",
    tipo: "correccion",
    titulo: "Las descripciones largas salen completas en los impresos, aunque no quepan",
    detalle:
      "Los cuadros de texto de las plantillas impresas (trabajos solicitados, descripción de daños, observaciones…) primero reducen la letra para encajar, y si aun así el texto es más largo, el cuadro crece hacia abajo en vez de cortar lo que no cabe. Lo que se escribe en la orden es lo que sale en el papel, entero.",
  },
  {
    fecha: "2026-10-19",
    tipo: "mejora",
    titulo: "Todas las ventanas del programa piden confirmación antes de perder datos",
    detalle:
      "La protección de cierre (aviso «Hay datos sin guardar» antes de cerrar con Escape o clic fuera) se ha extendido a todas las fichas con datos: orden de trabajo y recepción rápida del taller, orden de servicio y recepción del SAT, facturas de compra, clientes, proveedores y artículos. Si no has tocado nada, la ventana se cierra igual que antes, sin molestar.",
  },
  {
    fecha: "2026-10-16",
    tipo: "correccion",
    titulo: "Taller: horas reales de finalizado y entrega, y listado del día con fecha a elegir",
    detalle:
      "Al pasar una orden a entregado ya no se arrastra la hora de la finalización: cada hito queda con la hora del momento en que se picó (finalización por un lado, entrega por otro, y las dos se ven en el tablero; se siguen poder corregir a posteriori desde la campanita). Y el listado de citas del día («Imprimir día» en Taller → Citas) ahora permite elegir la fecha junto al botón: hoy por defecto, o el lunes que viene o el día que haga falta, con todas las citas de ese día en A4.",
  },
  {
    fecha: "2026-10-16",
    tipo: "mejora",
    titulo: "Energía: 6 potencias P1–P6 en tarifas 3.0TD y trámite de renovación",
    detalle:
      "En Suministros, al poner una tarifa de alta tensión (3.0TD, 6.XTD) el formulario pide las 6 potencias P1–P6, que pueden ser distintas; en 2.0TD siguen siendo punta y valle. Y en Trámites hay un nuevo tipo «Renovación (misma compañía)»: al activarla, la fecha de alta pasa a ser la de la activación —el aviso de renovación vuelve a saltar al año siguiente— y se aplican los datos que hayan cambiado (teléfono y correo del cliente, dirección, tarifa, consumo anual y nuevo fin de contrato). Lo que se deja en blanco no se toca.",
  },
  {
    fecha: "2026-10-15",
    tipo: "mejora",
    titulo: "Energía: nuevos estados del suministro (activo, en trámite, baja)",
    detalle:
      "Los suministros ya no tienen el estado «inactivo»: ahora son Activo, En trámite o Baja. El «En trámite» (ámbar) es para los altas y cambios de comercializadora que están en marcha: al abrir el trámite el suministro pasa solo a En trámite, y al activarlo vuelve a Activo con la fecha de alta rellenada; si el trámite se rechaza o cancela, el suministro vuelve a Activo con la comercializadora que ya tenía. También se puede cambiar a mano en la ficha, y el filtro de la lista tiene su propia opción «En trámite».",
  },
  {
    fecha: "2026-10-15",
    tipo: "mejora",
    titulo: "Facturas en borrador: edición directa desde el listado",
    detalle:
      "En Ventas → Facturas, cada factura en borrador tiene ahora un botón de lápiz en su fila para editarla al momento: cliente, líneas, vencimiento y método de pago se pueden cambiar mientras la factura siga en borrador, sin pasar por el detalle. Una vez validada, la factura ya no se puede tocar (lo exige VeriFactu) y hay que rectificarla, igual que antes.",
  },
  {
    fecha: "2026-10-15",
    tipo: "mejora",
    titulo: "Alta de cliente: la provincia se pide también en el alta rápida",
    detalle:
      "El alta rápida de cliente (la de las citas y la agenda) tiene un campo Provincia con las 52 provincias para autocompletar. Lo que se escribe queda guardado en la dirección de la ficha del cliente, igual que en el alta completa de Clientes, y no hace falta completarlo después a mano.",
  },
  {
    fecha: "2026-10-15",
    tipo: "mejora",
    titulo: "Taller: el tablero se limpia solo y el historial del vehículo, completo",
    detalle:
      "Las órdenes entregadas desaparecen del tablero a los 7 días de la entrega (quedan en el historial del vehículo y se pueden ver marcando «Ver archivadas»), para que el día a día no se llene de coches ya entregados. El historial del vehículo muestra ahora las fotos de la recepción y de la entrega, los kilómetros, la compañía, el siniestro y los daños de cada orden. Y al finalizar una orden hay un campo de notas para apuntar lo que queda pendiente (recambios que no llegaron, llamar al cliente…), visible en la orden y en el historial aunque el coche ya esté entregado.",
  },
  {
    fecha: "2026-10-15",
    tipo: "nuevo",
    titulo: "Facturas de compra: vencimiento real del pago, visible en todas partes",
    detalle:
      "Las facturas de compra ahora guardan la fecha de vencimiento que imprime el proveedor. Al importar un PDF, la IA la lee del documento; en el alta manual y en la revisión hay un campo «Vencimiento» para ponerla o corregirla. En Compras → Facturas hay una columna «Vence» (en rojo si está vencida sin pagar, en ámbar si vence esta semana, con ~ si es estimada) y en Tesorería → Pagos se usa la fecha real en vez de la estimación de 30 días: las que no la traen se marcan con ~ para distinguirlas, y la lista se ordena por lo que antes vence. Así no vuelve a pillarte por sorpresa un cobro domiciliado que aún no ha llegado su fecha.",
  },
  {
    fecha: "2026-10-15",
    tipo: "nuevo",
    titulo: "Buzón de correo entrante: consulta el correo de la empresa y importa facturas desde él",
    detalle:
      "En Ajustes → Correo hay una sección nueva, Buzón entrante, donde se conecta la cuenta de correo de la empresa (Gmail con contraseña de aplicación u otro correo IMAP), cifrada igual que el resto de contraseñas. Desde Compras → Facturas, el botón «Del correo» abre un listado de los mensajes recientes con adjuntos PDF o imagen: al elegir uno, el adjunto baja del correo y se procesa con la misma IA de OCR que el botón «Importar PDF», abriéndose después la ventana de revisión. Así las facturas que llegan al correo se dan de alta sin descargarlas a mano.",
  },
  {
    fecha: "2026-10-14",
    tipo: "mejora",
    titulo: "Clientes: documentación adjunta (NIF, CIF, escrituras…) y suministros ordenados",
    detalle:
      "En la ficha de cada cliente hay una pestaña nueva, Documentos, donde se pueden adjuntar su NIF/CIF, escrituras, poderes o contratos (PDF o imágenes, hasta 6 archivos por subida). Al borrar un cliente, sus documentos se borran también del almacenamiento. Y en Energía → Suministros, la lista sale ordenada de lo más actual a lo más antiguo por fecha de alta.",
  },
  {
    fecha: "2026-10-14",
    tipo: "mejora",
    titulo: "Facturas de compra: no se pueden dar de alta dos veces, y el OCR lee la divisa",
    detalle:
      "Al dar de alta una factura (a mano o importando el PDF) se comprueba que no exista ya otra del mismo proveedor con el mismo número: si existe, el programa lo avisa y no la crea. La comparación también caza las confusiones típicas de teclear una O donde va un cero (o una I donde va un 1), para que un número escrito a mano no esquive el control. Además, al importar un PDF, el número de factura se contrasta con el texto interno del documento y se copia tal cual lo emitió el proveedor. Y el OCR detecta la moneda: las facturas en dólares se guardan con sus importes en $ y el tipo de cambio del Banco Central Europeo del día de la factura, editable en la revisión.",
  },
  {
    fecha: "2026-10-14",
    tipo: "mejora",
    titulo: "La lectura OCR aguanta los límites de cuota de Google",
    detalle:
      "Esta mañana Google denegó temporalmente las llamadas de IA por cuota agotada (error 429) y la lectura de facturas falló durante unos minutos. Ahora, si eso ocurre, se espera más tiempo entre reintentos (la ventana de cuota es de un minuto) y se prueba automáticamente la vía de reserva de IA Studio antes de dar el aviso de «OCR no disponible», con cuotas independientes de las de Vertex.",
  },
  {
    fecha: "2026-10-14",
    tipo: "mejora",
    titulo: "Extractos: un cargo puede conciliar varias facturas a la vez",
    detalle:
      "Algunos proveedores (IONOS, por ejemplo) agrupan varias facturas en un solo cargo del banco. Ahora, al conciliar un movimiento, las facturas de compra admiten selección múltiple: se marcan las que paga ese cargo, se comprueba que la suma cuadre y el registro de conciliaciones anota todas juntas. Al buscar coincidencias también aparecen las facturas pendientes del mismo proveedor aunque no cuadren solas, y las devoluciones del banco se pueden casar con sus abonos.",
  },
  {
    fecha: "2026-10-14",
    tipo: "mejora",
    titulo: "Ya no se pierde una factura o una cita por un Escape o un clic fuera",
    detalle:
      "Los editores de facturas, albaranes, presupuestos y citas ya no se cierran de golpe: si estás escribiendo en un campo, la tecla Esc solo saca el foco del campo; y si hay datos sin guardar, Esc o un clic fuera de la ventana piden confirmación antes de cerrar. Sin datos escritos, se cierran igual que antes, sin molestar.",
  },
  {
    fecha: "2026-10-14",
    tipo: "nuevo",
    titulo: "Taller: listado de las citas del día para imprimir",
    detalle:
      "En Taller → Citas, el botón «Imprimir día» saca en A4 todas las citas de hoy: hora, matrícula, vehículo, cliente, teléfono, motivo y estado, con las citas de peritaje en su propia sección. Ideal para llevar a primera hora la hoja del día (sugerencia de Talleres Montiel).",
  },
  {
    fecha: "2026-10-14",
    tipo: "mejora",
    titulo: "Ya no se corta el texto largo en los impresos",
    detalle:
      "Los cuadros de texto de las plantillas (descripción de la avería, trabajos solicitados, observaciones…) reducen automáticamente el tamaño de letra cuando el texto no cabe, en lugar de cortar lo que sobresalía. Las averías largas salen completas en la orden de trabajo.",
  },
  {
    fecha: "2026-10-13",
    tipo: "correccion",
    titulo: "Vuelven a verse logos, firmas, fotos y peritaciones",
    detalle:
      "El endurecimiento de seguridad de ayer exigía sesión para abrir cualquier archivo subido, pero varias pantallas enlazaban las imágenes sin ella: el logo de la empresa (Ajustes y documentos impresos), las firmas de recepción y de albaranes, las fotos de vehículos y entregas, las peritaciones de las citas, los adjuntos de propuestas y los documentos de asesoría. Todas vuelven a mostrarse, ahora con la sesión incluida en el enlace.",
  },
  {
    fecha: "2026-10-13",
    tipo: "nuevo",
    titulo: "Energía: documentación de cada suministro",
    detalle:
      "Cada punto de suministro (Energía → Suministros) admite ahora su documentación adjunta: contrato con la comercializadora, facturas, burofaxes de la distribuidora… Se sube desde el propio suministro (botón «Añadir documentos», PDF o imágenes, hasta 6 archivos por vez), los archivos quedan guardados en la carpeta de tu empresa y en el listado se ve un contador de documentos por CUPS. Al borrar un suministro, su documentación se elimina también.",
  },
  {
    fecha: "2026-10-12",
    tipo: "seguridad",
    titulo: "Auditoría fases 2-5: aislamiento total entre empresas y numeración infalible",
    detalle:
      "Segunda tanda de la auditoría interna: (1) un usuario ya no puede leer los archivos subidos de OTRA empresa aunque adivine la dirección; (2) las búsquedas de clientes, artículos y proveedores ya no se pueden romper escribiendo caracteres especiales; (3) las peticiones a la IA (OCR, asistente Nexo) tienen un cupo propio para que nadie pueda disparar el coste; (4) al emitir una factura, un doble clic o un reintento ya no puede duplicarla: se reserva antes de numerar y firmar; (5) la numeración de presupuestos, albaranes y pedidos de compra pasa a ser atómica, imposible que dos documentos compartan número; (6) la conciliación bancaria solo casa facturas con algo pendiente, admite remesas con pequeña diferencia (comisión del banco), detecta el número de factura en la referencia bancaria y registra en la auditoría también los movimientos que no encontró pareja; (7) las tareas automáticas del servidor (reintento VeriFactu, copias de seguridad, correos de campañas de energía) ya no pueden solaparse consigo mismas.",
  },
  {
    fecha: "2026-10-12",
    tipo: "seguridad",
    titulo: "Endurecimiento de seguridad y fiabilidad (auditoría, fase 1)",
    detalle:
      "Primera tanda de correcciones de la auditoría interna: los archivos subidos (firmas, extractos, fotos de artículos) ya no son públicos, exigen sesión iniciada; los cobros, pagos y conciliaciones ahora se escriben en la base de datos de forma atómica, por lo que dos usuarios trabajando a la vez no pueden pisarse; el servidor valida las líneas de las facturas (cantidad, precio, descuento e IVA) antes de firmarlas en VeriFactu; la protección anti-duplicados de la cola sin conexión reserva la operación antes de ejecutarla; y las operaciones críticas (certificado AEAT, entorno y envío VeriFactu, datos fiscales y series de la empresa) quedan reservadas a administradores.",
  },
  {
    fecha: "2026-10-12",
    tipo: "nuevo",
    titulo: "Tesorería: liquidación de remesa, reintegros e ingresos en efectivo",
    detalle:
      "La conciliación automática ahora detecta los movimientos de tesorería sin factura: la liquidación o comisión de una remesa SEPA del banco (se registra como gasto deducible de 'Comisiones bancarias'), los reintegros de cajero (dinero que se saca en efectivo) y los ingresos en efectivo. Se etiquetan como 'Tesorería', sin necesidad de anotarlos como 'Sin factura', y en el modal de conciliar aparece la opción 'Tesorería' para estos casos.",
  },
  {
    fecha: "2026-10-12",
    tipo: "mejora",
    titulo: "Tesorería: cobros con fecha real y referencia",
    detalle:
      "Al marcar una factura como cobrada (Tesorería → Cobros) ahora se puede indicar la fecha real del cobro (por ejemplo, la del extracto bancario, no la de hoy) y una referencia opcional (nº de operación, remesa SEPA…). El método de cobro (transferencia, efectivo, tarjeta, remesa SEPA u otro) se elige con etiquetas claras, y en el detalle de la factura de venta se ve cada cobro con su fecha, método y referencia.",
  },
  {
    fecha: "2026-10-12",
    tipo: "mejora",
    titulo: "Tesorería: conciliación de remesas con varias facturas",
    detalle:
      "Cuando el banco agrupa en un solo ingreso varias facturas del mismo cliente (emisión de remesa SEPA), la conciliación automática ahora encuentra el grupo de facturas cuya suma exacta iguale el importe del ingreso y las vincula todas, sin duplicar cobros ya registrados.",
  },
  {
    fecha: "2026-10-12",
    tipo: "correccion",
    titulo: "Tesorería: conciliación automática de ingresos",
    detalle:
      "La conciliación automática ya vincula también los ingresos bancarios directamente con su factura de venta cuando el banco informa una remesa pero esa remesa no se generó dentro de FILANEX. Comprueba importe exacto y fecha cercana, no duplica un cobro que ya exista y deja el movimiento registrado en el historial de conciliaciones.",
  },
  {
    fecha: "2026-10-08",
    tipo: "nuevo",
    titulo: "Conciliación bancaria por extracto",
    detalle:
      "Nueva pantalla en Tesorería → Extractos: sube el CSV o Excel de tu banco, el programa lee los movimientos y busca automáticamente facturas de compra pendientes de pago que cuadren por importe. Un clic concilia el cargo con la factura y registra el pago. También puedes desconciliar o borrar movimientos si te equivocas.",
  },
  {
    fecha: "2026-10-08",
    tipo: "nuevo",
    titulo: "Facturas de compra en dólares (USD)",
    detalle:
      "Al dar de alta una factura de compra manual puedes elegir USD como divisa, indicar el tipo de cambio y escribir los precios en dólares. El programa guarda los importes originales en USD y los convierte a EUR para la contabilidad, el stock y los informes. En el listado se ve el total en EUR y, al pasar el ratón, el total original y el tipo de cambio. El IVA 0 % sigue disponible para facturas exentas.",
  },
  {
    fecha: "2026-10-06",
    tipo: "mejora",
    titulo: "Citas: alta de cliente completo y aviso de duplicados",
    detalle:
      "El modal de citas ya permite dar de alta un cliente nuevo con nombre, teléfono, email y NIF/CIF directamente, sin salir de la cita. Si al escribir detecta un cliente existente por NIF, teléfono o nombre muy parecido, muestra una alerta para usar ese y evitar duplicados. Se ha eliminado el check confuso de «Cliente nuevo (dar de alta ahora)» y su botón separado: ahora el alta es automática al guardar si hay teléfono.",
  },
  {
    fecha: "2026-10-05",
    tipo: "correccion",
    titulo: "Citas: los datos del cliente ya no se pierden al guardar",
    detalle:
      "Al crear una cita, si se rellenaba el recuadro «Cliente nuevo» pero no se pulsaba «Dar de alta», el nombre y el teléfono se perdían y la cita quedaba solo con la matrícula. Ahora esos datos se dan de alta automáticamente al guardar la cita (o viajan con ella si el alta no es posible). Además, pulsar Enter en un buscador sin coincidencias ya no envía el formulario a medias.",
  },
  {
    fecha: "2026-10-03",
    tipo: "mejora",
    titulo: "Clientes: búsqueda por teléfono y carga instantánea en los selectores",
    detalle:
      "Los buscadores de clientes ahora encuentran también por teléfono (escribiéndolo con o sin espacios) además de por nombre, NIF, email y código. Y la cartera se carga una sola vez y se reutiliza en todas las pantallas: al pasar de Presupuestos a Ventas o al abrir una cita, los clientes aparecen al instante en vez de volver a esperar la descarga.",
  },
  {
    fecha: "2026-10-03",
    tipo: "mejora",
    titulo: "Órdenes: modelo del vehículo, orden por último cambio y PDF de valoración",
    detalle:
      "El tablón de órdenes muestra ahora el modelo junto a la matrícula y coloca arriba la orden cuyo estado ha cambiado más recientemente. Además, cada orden permite adjuntar y abrir el PDF original de la valoración o peritación de la compañía.",
  },
  {
    fecha: "2026-10-03",
    tipo: "mejora",
    titulo: "Propuestas: respuesta del equipo FILANEX en tu buzón",
    detalle:
      "Cuando resolvemos una de tus propuestas, al entrar en el programa te salta una ventana con la respuesta del equipo FILANEX (qué se ha hecho y cómo usarlo); la cierras con «Entendido» y queda guardada para releerla en Ayuda → Novedades → Propuestas. Si tu empresa tiene el correo configurado, también recibes la respuesta por email.",
  },
  {
    fecha: "2026-10-03",
    tipo: "correccion",
    titulo: "Arreglado: los buscadores no encontraban clientes con carteras grandes",
    detalle:
      "Al crear un presupuesto, albarán, venta o cita, el buscador de clientes solo cargaba los primeros 1000 por orden alfabético: si tu cartera tiene miles de fichas, los nombres a partir de la «E» o la «F» no aparecían y parecía que el cliente «no estaba dado de alta». Ahora la lista se carga completa (hasta 15.000) y el buscador localiza a cualquiera por nombre, NIF, teléfono o email. Lo mismo se ha aplicado a los proveedores. La ficha de Clientes/Proveedores sigue mostrando el detalle completo como siempre.",
  },
  {
    fecha: "2026-10-02",
    tipo: "nuevo",
    titulo: "Soporte FILANEX con acceso identificado",
    detalle:
      "El equipo de FILANEX puede entrar en tu empresa para ayudarte con configuraciones (plantillas, formatos, revisiones) sin crear usuarios ni compartir contraseñas: el acceso se hace desde el panel de plataforma con la identidad del técnico, queda registrado en la auditoría y mientras dura ves un aviso violeta «MODO SOPORTE» arriba con el botón para volver. Si prefieres que no entremos, dínoslo y no se usa.",
  },
  {
    fecha: "2026-10-01",
    tipo: "nuevo",
    titulo: "Compras: retenciones de IRPF en facturas de proveedor",
    detalle:
      "Las facturas de compra ya admiten retención de IRPF: el OCR la detecta solo en el PDF (línea «Retención IRPF −15 %» y similares) y en el formulario eliges el porcentaje (0, 1, 2, 7, 15 o 19 %) y el modelo —111 para profesionales, 115 para alquileres—; el programa calcula la retención y el total a pagar al proveedor, que es lo que luego sale en tesorería y en el PDF. Además, Informes → Compras estrena la pestaña «Retenciones IRPF»: acumulado del periodo por modelo (111/115) y por proveedor, imprimible y exportable a CSV, listo para preparar la liquidación trimestral.",
  },
  {
    fecha: "2026-10-01",
    tipo: "nuevo",
    titulo: "Energía: las campañas de precios se recogen solas del correo",
    detalle:
      "En Energía → Campañas, botón «Correo»: configura el buzón donde las comercializadoras mandan sus campañas (Gmail con contraseña de aplicación o cualquier IMAP) y el programa lo revisa cada 15 minutos. Los PDF adjuntos se leen con IA y quedan como campañas «pendientes de revisión», igual que si las subieras a mano; lo que no parece una campaña (facturas, recibos…) se ignora y los correos ya tratados no se duplican. La contraseña se guarda cifrada y nunca vuelve al navegador. Hay «Probar conexión» y «Revisar ahora» para comprobarlo en el momento, y las campañas recogidas muestran el remitente y el asunto del correo.",
  },
  {
    fecha: "2026-10-01",
    tipo: "nuevo",
    titulo: "Energía: campañas de precios con lectura por IA",
    detalle:
      "Nuevo apartado Energía → Campañas: la campaña de precios que te manda una comercializadora (el PDF con los términos de la tarifa) se sube, la IA la lee y rellena comercializadora, tarifa, precios de energía (único o por tramos punta/llano/valle), potencia, mantenimiento, descuentos y vigencia. Si la potencia viene en €/kW·día se convierte sola a €/kW·año. La campaña queda «pendiente de revisión» hasta que la compruebas y publicas; las publicadas aparecen en los estudios de ahorro con un selector que rellena la propuesta (comercializadora, tarifa y precios) en un clic. También se pueden dar de alta a mano, con la unidad de potencia que traiga el documento.",
  },
  {
    fecha: "2026-10-01",
    tipo: "mejora",
    titulo: "Informes: búsqueda por trimestre (1T-4T) y año completo",
    detalle:
      "El filtro de fechas de los informes (Ventas, Compras y Resumen de IVA) estrena un selector de año con botones 1T, 2T, 3T, 4T y «Año completo»: elige el año, pincha el trimestre y el informe se calcula de ese periodo exacto — ideal para el modelo 303 trimestral y para comparar trimestres de distintos años. Los atajos de siempre (este mes, mes pasado, este trimestre, este año) siguen igual.",
  },
  {
    fecha: "2026-10-01",
    tipo: "correccion",
    titulo: "Facturas: la fecha de expedición es el día en que se valida el borrador",
    detalle:
      "Hasta ahora, un borrador validado días después conservaba la fecha del día en que se creó. Ahora, al validar, la factura toma como fecha de expedición el día de la validación (que es cuando nace legalmente), y la serie usa el año de esa fecha. Un borrador creado y validado el mismo día no cambia.",
  },
  {
    fecha: "2026-10-01",
    tipo: "mejora",
    titulo: "Cabeceras más limpias: sin subtítulo bajo el título",
    detalle:
      "Se retira la pequeña descripción que aparecía debajo del título de cada página, en todos los módulos. Ahora la barra superior muestra solo la empresa y el título de la pantalla: más limpio y más espacio para las pestañas.",
  },
  {
    fecha: "2026-10-01",
    tipo: "mejora",
    titulo: "Energía: los estudios leen la factura con IA",
    detalle:
      "En Energía → Estudios, el botón «Nuevo estudio» estrena «Leer factura (IA)»: subes el PDF o la foto de la factura del cliente y el programa rellena solo la situación actual —comercializadora, tarifa, consumo anual, potencias y el coste anual (anualizando el importe con los días que cubre)—. Si el CUPS ya está en la cartera, enlaza el estudio con el suministro y su cliente. Después solo falta elegir la propuesta y guardar: el ahorro se calcula al momento.",
  },
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
