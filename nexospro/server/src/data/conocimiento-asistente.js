// Conocimiento del asistente IA de FILANEX.
//
// Este texto es el "manual interno" que recibe la IA en cada conversación.
// Debe ser FIEL al programa: si una pantalla cambia, hay que actualizarlo.
// Está escrito en español, con rutas de menú reales (Menú → Sección → Pantalla)
// y flujos paso a paso, para que las respuestas digan exactamente dónde pulsar.

export const CONOCIMIENTO = `
# MANUAL INTERNO DE FILANEX (programa de gestión)

FILANEX es un programa de gestión en la nube para pymes: facturación con
VeriFactu, y módulos opcionales por licencia (Taller, TPV, Servicio Técnico,
Asesoría, Telefonía y Asistente IA). Cada empresa tiene sus propios datos y
solo ve los módulos que tiene contratados. La pantalla tiene un menú lateral
por secciones y, arriba, unas fichas con las pantallas de la sección activa.

## 1. Conceptos generales

- Usuarios y roles: en Ajustes → Usuarios. El rol "admin" lo configura todo;
  el rol "usuario" trabaja pero no entra a Ajustes ni a Sistema.
- La aplicación es una PWA: funciona sin conexión y guarda los cambios en una
  cola que se sincroniza al volver la red. Consecuencia: tras una
  actualización del programa puede seguir mostrándose la versión antigua. Se
  soluciona borrando los datos del sitio (F12 → Application/Almacenamiento →
  Storage → "Clear site data") o abriendo una ventana de incógnito.
- Todos los listados tienen buscador que filtra por cualquier campo visible.
- En muchos formularios hay "alta rápida": si el cliente/vehículo/artículo no
  existe, se crea al guardar sin salir de la pantalla.
- Las matrículas se guardan siempre sin espacios y en mayúsculas (el programa
  las normaliza solo).
- Ayuda → Novedades: registro de cambios del programa y buzón de propuestas
  (los usuarios pueden proponer mejoras con capturas de pantalla).

## 2. Facturación (núcleo, siempre activo)

Menú: Clientes, Proveedores, Artículos, Ventas, Compras, Tesorería, Informes.

### Clientes y proveedores
- Alta desde su pantalla o "alta rápida" dentro de facturas, albaranes, citas…
- En el alta de cliente se pide la provincia (con lista para autocompletar):
  en el alta rápida de citas y agenda también hay un campo Provincia, y se
  guarda en la dirección de la ficha del cliente.
- El NIF/CIF se valida solo (letra correcta). Si hay duplicados, suele ser por
  escribir el NIF con formatos distintos: bórralo y créalo una vez.
- La ficha del cliente muestra su historial (facturas, albaranes, y si hay
  módulo taller, sus vehículos con el historial de cada uno).

### Artículos
- Tienen familia, precio, IVA, referencia, código de barras, foto y STOCK.
- El stock baja con ventas (tickets TPV, albaranes y facturas) y sube con
  compras. Sirve para inventario de almacén.
- Los mismos artículos se usan en facturación, TPV y taller (módulos futuros
  también): un solo catálogo para toda la empresa.
- Se pueden crear "artículos libres" (líneas escritas a mano) en presupuestos
  y pedidos sin tocar stock.

### Albaranes de venta
- Se dan de alta en **Ventas → Albaranes**. Un albarán entrega material o
  trabajo a un cliente pero aún no es factura.
- Estado **pendiente** = sin facturar. Estado **facturado** = ya tiene
  factura asociada.
- Para facturar varios albaranes de un mismo cliente en una sola factura:
  1. Ve a **Ventas → Albaranes**.
  2. Marca la casilla de los albaranes **pendientes** del mismo cliente.
  3. Pulsa **“Facturar N seleccionado(s)”** arriba a la derecha.
  4. El programa crea una factura borrador con todas las líneas de los
     albaranes marcados.
  5. Ve a **Ventas → Facturas**, abre el borrador y pulsa **Emitir**.
- Para facturar un solo albarán, usa el botón **→ Factura** de su fila.
- Los albaranes facturados no se pueden editar ni borrar; hay que rectificar
  la factura si es necesario.

### Ciclo de venta
Presupuesto → Pedido (opcional) → Albarán (opcional) → Factura.
- Se puede convertir un documento en el siguiente con un clic (botón de
  "Pasar a…"), arrastrando líneas sin reescribir.
- **Las facturas en borrador se pueden editar**: en Ventas → Facturas, cada
  borrador tiene un botón de lápiz en su fila para modificarlo (cliente,
  líneas, vencimiento, método de pago…), y también desde su detalle con
  "Modificar borrador". Se puede cambiar todo mientras siga en borrador.
- Una vez validada/emitida, la factura ya no se puede editar ni borrar
  (VeriFactu): hay que hacer una rectificativa.
- La factura se emite con serie y número atómicos (nunca se repiten ni hay
  huecos por dos usuarios a la vez).
- Rectificativas: desde la factura, opción "Rectificar". Nunca se borra una
  factura emitida; se rectifica (así lo exige VeriFactu).
- Impresión y email: cada documento se imprime con su FORMATO (ver sección
  Formatos) y se puede enviar por correo con plantilla configurable.
- Series y numeración: Ajustes → Series. Cada tipo de documento puede tener
  varias series (ej. A, B, F2 para tickets). La F2 se usa para las facturas
  simplificadas (tickets).

### Compras y gastos
- Facturas de compra y albaranes de compra se pueden dar de alta a mano o con
  OCR: se sube el PDF/foto y la IA lee proveedor, líneas e importes (incluida
  la divisa si la factura no es en euros).
- "Del correo" (Compras → Facturas): se conecta el buzón de correo de la
  empresa (Gmail con contraseña de aplicación, u otro proveedor por IMAP) y
  el programa trae las facturas que llegan por email para darlas de alta con
  OCR sin descargarlas a mano.
- El programa avisa si una factura de compra ya existe (mismo proveedor y
  número) para evitar altas duplicadas al importar.
- Gastos: tickets y recibos con foto, también leídos por IA.

### Tesorería
- Cobros y pagos de cada factura, vencimientos, remesas SEPA para cobrar por
  domiciliación y facturas recurrentes (cuotas que se generan solas).
- Extractos bancarios (Tesorería → Extractos): se sube el extracto del banco
  (Excel/CSV) y el programa intenta conciliar cada movimiento con sus
  facturas automáticamente, cruzando importe y el nombre del tercero que
  aparece en el concepto del banco. Un movimiento puede quedar enlazado a
  varias facturas a la vez (por ejemplo, un cargo agrupado con dos facturas
  del mismo proveedor).
- Lo que no concilia solo se revisa a mano abriendo el apunte: el modal
  ofrece las facturas más probables de ese proveedor/cliente para elegir.
- Informes → Tesorería: informe de conciliaciones, con filtros para ver solo
  lo pendiente y por qué no ha conciliado.

## 3. VeriFactu (obligación fiscal)

- Qué es: cada factura (y ticket) genera un registro de facturación que se
  envía a la AEAT con huella encadenada (cada registro enlaza con el anterior;
  no se puede alterar el historial).
- Configuración: Ajustes → VeriFactu. Se sube el certificado electrónico
  (.pfx) y se elige entorno de pruebas o producción.
- El envío NO bloquea: la factura se crea al instante y el registro se envía
  en segundo plano. Si la AEAT falla, un proceso reintenta solo.
- Estado de los envíos: Ajustes → VeriFactu y en la propia factura (marca de
  enviado/pendiente/error).
- Tickets del TPV: cada cobro crea su factura simplificada (serie F2) con su
  registro VeriFactu, igual que una factura normal.

## 4. Módulo Taller

Menú Taller: Panel, Citas, Vehículos, Órdenes, Planning, Valoraciones,
Aseguradoras, Cortesía, Operarios, Ayuda taller.

### Flujo típico de un siniestro (de principio a fin)
1. Llega la valoración de la compañía: Taller → Valoraciones → "Alta desde
   PDF" y se sube el PDF de la aseguradora. La IA la da de alta sola
   (matrícula, marca, modelo, bastidor, km, compañía, nº de siniestro, fecha,
   partidas y total). Si la compañía no existe, se crea su ficha de
   aseguradora automáticamente.
2. Se cita al cliente: Taller → Citas → "Nueva cita" (o pestaña "Citas
   peritaje" si solo deja el coche para el perito). Si el vehículo no existe,
   alta rápida con la matrícula.
3. El día que viene: en la cita, botón "Recepcionar". Se crea la Orden de
   Trabajo heredando la valoración (líneas y total cuadran al céntimo, IVA
   desglosado), la aseguradora y el siniestro.
4. La OT se trabaja: líneas de mano de obra y materiales, operarios, estados
   (pendiente, en curso, terminada, facturada…), fotos del vehículo.
5. Al terminar: desde la OT se genera la factura (al cliente o a la
   aseguradora, según "facturar a").

### Citas
- Dos tipos: "Cita normal" (recepción/entrega) y "Peritaje" (el cliente deja
  el coche y viene el perito de la compañía: compañía obligatoria y nº de
  siniestro). Las de peritaje tienen su propia pestaña en Taller → Citas,
  con vista de agenda o de listado (muestra marca/modelo del vehículo, para
  ver de un vistazo todos los coches citados a peritar).
- La cita guarda cliente (alta rápida con teléfono obligatorio), vehículo
  (alta rápida con matrícula), motivo, cortesía, compañía y notas. La cita
  se guarda siempre, aunque falte completar algún dato o se cierre sin
  querer tras imprimir el justificante: nunca se pierde por imprimir sin
  guardar antes.
- "Viene de presupuesto": casilla siempre marcada por defecto; si la cita
  tiene valoración/presupuesto vinculado, se muestra dentro de la cita.
- Desde la cita se imprime el justificante de cita para el cliente y la hoja
  de entrada.
- **Listado del día** (botón "Imprimir día" en Taller → Citas): al lado del
  botón se elige la fecha (hoy por defecto, o el día que sea, p. ej. el
  lunes siguiente) y saca en A4 todas las citas de ese día —recepciones y
  entregadas por una parte y peritajes por otra— con hora, matrícula,
  vehículo, cliente, teléfono y motivo.
- Si una matrícula cambia de dueño (coche vendido), al dar la cita con otro
  cliente el programa avisa y permite reasignar el vehículo conservando el
  historial.

### Vehículos
- Ficha con matrícula, marca, modelo, bastidor (VIN), km, cliente y fotos.
- El historial del vehículo muestra todas sus órdenes, valoraciones y citas,
  entren quien entre (aunque cambie de propietario).
- El teléfono que se ve es el del cliente propietario actual.

### Valoraciones (peritajes)
- Manuales o desde PDF (botón "Alta desde PDF", leído por IA).
- Campos: matrícula (al salir del campo se autorrellenan marca/modelo/
  bastidor si el vehículo ya existe), compañía de seguros (se da de alta sola
  si es nueva), nº y fecha de siniestro, casilla "compromiso de reparación" y
  partidas.
- Las partidas llevan tipo (chapa, pintura, mecánica, material, otro) y, si
  son de mano de obra, horas: el importe se calcula solo con los precios por
  hora configurados.
- Precios por hora: Ajustes → Configuración → panel "Taller — precios por
  hora" (chapa, pintura y mecánica).
- Estados: pendiente, valorado, aprobado, rechazado. Al recepcionar, la OT
  queda enlazada (se ve su número en la lista).

### Órdenes de trabajo (OT)
- Líneas con tipo, horas, precio e IVA; materiales con artículo del catálogo.
- "Facturar a": cliente o aseguradora (con sus condiciones: franquicia, IVA,
  suplidos…).
- Impresión: menú imprimir de la OT → "Orden de trabajo" (con formato).
  La hoja de entrada se imprime desde la cita/recepción, no desde la OT.
- Planning: vista de carga de trabajo por día/operario.
- **Horas de finalizado y entrega**: cada una queda con la hora del momento
  en que se picó. Al pasar la orden a finalizado se guarda la hora de la
  finalización, y al pasarla a entregado, la de la entrega (no se copia la
  anterior). En el tablero se ven las dos; desde la campanita se pueden
  corregir a posteriori.

### Aseguradoras
- Ficha con condiciones por compañía (franquicia, % IVA que asume, suplidos,
  precios pactados). Se crean solas desde valoraciones/citas si no existen.

### Vehículos de cortesía
- Parque de coches propios: se reservan desde la cita (casilla "Reservar
  cortesía") y quedan ocupados hasta la devolución.
- Contrato de cesión: se imprime desde la ficha del vehículo de cortesía con
  el formato "parte de cesión" (editable en el editor de formatos, con las
  fotos del coche si se suben).

### Operarios
- Ficha de cada mecánico/chapista con su coste/hora para márgenes.

## 5. Módulo Energía (gestoría/canal de comercializadoras de luz y gas)

Menú Energía: Panel, Suministros, Comercializadoras, Canales, Trámites,
Comisiones, Estudios, Campañas, Autofacturas, Agenda, Ayuda energía.
Es el módulo de las agencias/canales que venden contratos de luz y gas por
cuenta de comercializadoras y cobran comisión por ello. Todo gira alrededor
del **punto de suministro** (su código CUPS): es a este módulo lo que el
vehículo es al taller.

### Flujo típico
Estudio de ahorro → Trámite (alta/cambio) → Contrato activo (Suministro) →
Comisión cobrada. El estudio arranca pidiendo al cliente su última factura
(se puede leer con IA); si acepta, se abre el trámite; al activarse, el
suministro queda actualizado solo y empieza a generar comisión cada mes.

### Comercializadoras (Energía → Comercializadoras)
- Las compañías de luz/gas con las que trabaja la agencia. Su ficha guarda
  las condiciones de comisión (distintas para luz y gas): pago único por
  alta, €/mes por contrato activo y €/año recurrente. Lo que se deja a cero
  no genera comisión. No se puede borrar si tiene suministros vinculados.

### Canales de distribución (Energía → Canales)
- Un **canal** es un distribuidor o intermediario por el que se dan de alta
  los suministros (p. ej. una asesoría energética que revende contratos de
  varias comercializadoras). Un canal puede trabajar con varias
  comercializadoras a la vez; se da de alta con nombre, NIF, contacto y las
  comercializadoras con las que opera. Sirve para distinguir de qué canal
  viene cada cliente cuando una misma comercializadora se vende por varias
  vías.

### Suministros (Energía → Suministros)
- Ficha por CUPS (22 caracteres, se normaliza solo): cliente, comercializadora
  actual, luz o gas, dirección del suministro (puede ser distinta a la
  fiscal), tarifa (2.0TD, 3.0TD…), potencia y consumo anual en kWh.
- **Potencias**: en tarifa 2.0TD se apuntan punta y valle; en 3.0TD y 6.XTD
  (alta tensión) el formulario pide las 6 potencias P1–P6, que pueden ser
  distintas entre sí.
- **Estados del suministro**: Activo (ya está con la comercializadora, con su
  fecha de alta), En trámite (el alta o cambio está en marcha) y Baja. Al
  abrir un trámite de alta/cambio el suministro pasa solo a En trámite, y al
  activar el trámite vuelve a Activo con la fecha de alta rellenada; si el
  trámite se rechaza o cancela, el suministro vuelve a Activo con la
  comercializadora que ya tenía. También se puede cambiar a mano en la ficha.
- Columna **€/kWh (12 m.)**: lo facturado entre lo consumido en los últimos
  12 meses; en ámbar (≥0,25 €/kWh) son los contratos caros, mejores
  candidatos a estudio de ahorro.
- Se puede apuntar un **presupuesto anual (€)** por suministro para comparar
  contra lo facturado real.
- Consumos: botón de la gráfica de cada fila, histórico mensual de kWh e
  importe, con media, total del año y gráfica de evolución.
- Grupos de empresas: en la ficha del cliente hay un campo "Grupo"; poniendo
  el mismo nombre en varias sociedades, el filtro "Grupo" de Suministros las
  junta todas.

### Trámites (Energía → Trámites)
- Se abren al aceptar un estudio o directamente desde un suministro. Cinco
  tipos: alta, cambio de comercializadora, cambio de titular, renovación
  (misma compañía) y baja.
- Circuito de estados: Documentación → Enviado → En trámite → Activado (o
  rechazado/cancelado), con nota en cada cambio.
- Al **Activar**, el trámite actualiza el suministro solo (cambia
  comercializadora, titular o lo da de baja); un trámite activado ya no se
  edita ni se borra.
- **Renovación**: para contratos que se renuevan con la misma compañía. Al
  activarla, la fecha de alta pasa a ser la de la activación (así el aviso de
  renovación vuelve a saltar al año siguiente) y se aplican los datos que
  se hayan cambiado: teléfono y correo (van a la ficha del cliente),
  dirección, tarifa, consumo anual y nuevo fin de contrato (al suministro).
  Lo que se deja en blanco no se toca.

### Comisiones (Energía → Comisiones)
- La caja del canal: lo que debe cada comercializadora. Botón **Generar
  mes** calcula, suministro a suministro: la mensual de cada contrato
  activo, el pago único de las altas de ese mes y el recurrente anual en el
  mes del aniversario. Generar dos veces el mismo mes no duplica nada.
  Se marcan como cobradas con la flecha verde. "Nueva manual" para bonos o
  pactos especiales.

### Estudios de ahorro (Energía → Estudios)
- Se puede leer la factura del cliente con IA ("Leer factura (IA)"): sube el
  PDF/foto y rellena solo comercializadora actual, tarifa, consumo, potencias
  y coste anual (anualiza el importe según los días que cubre la factura).
- A la izquierda la situación actual, a la derecha la propuesta con una
  comercializadora propia; calcula el ahorro en €/año y en % al momento. Un
  selector permite rellenar la propuesta con una campaña de precios
  publicada.
- Circuito: borrador → enviado → aceptado/rechazado. Al aceptar, abre solo el
  trámite de cambio de comercializadora sobre ese CUPS.

### Campañas de precios (Energía → Campañas)
- Cuando una comercializadora manda el PDF con sus tarifas, se sube con
  "Leer campaña (IA)": lee comercializadora, tarifa, precios (único o por
  tramos punta/llano/valle), potencia, mantenimiento, descuentos y vigencia.
- Nace siempre "pendiente de revisión": hay que publicarla (botón del ojo)
  para que aparezca en los estudios de ahorro.
- **Recogida automática por correo**: se configura el buzón donde llegan las
  campañas (botón "Correo") y el programa lo revisa cada 15 minutos solo,
  leyendo los PDF adjuntos con IA. Con Gmail hace falta verificación en dos
  pasos y una contraseña de aplicación (no la contraseña normal); con correo
  profesional se usa IMAP a mano (host/puerto, normalmente 993). El campo
  "Carpeta" permite vigilar solo una etiqueta/carpeta concreta.

### Autofacturas (Energía → Autofacturas)
- La liquidación mensual que manda cada comercializadora: se registra número,
  mes y base imponible (IVA y total se calculan solos). Al lado se ve lo que
  el programa calculó en Comisiones para ese mes y la diferencia, para
  comprobar que no han liquidado de menos.

### Agenda (Energía → Agenda)
- Agenda automática del canal, sin apuntar nada a mano: suministros a punto
  de cumplir un año (ventana de 7 a 10 meses desde el alta, antes de que
  caduque la permanencia), contratos con fecha de fin próxima (60 días),
  estudios enviados hace más de una semana sin respuesta, y consumos
  anómalos (suben 25 % o más sobre su media: posible fuga o avería). También
  muestra la huella de CO2 estimada de toda la cartera.

### Panel e informe de cartera (Energía → Panel)
- Resumen de suministros activos, trámites/estudios en curso con el ahorro
  potencial, comisiones pendientes de cobrar, energía gestionada y
  distribución por comercializadora, más las alertas de la agenda.
- Botón "Imprimir / PDF": informe completo de cartera (energía gestionada,
  CO2, ahorro conseguido, comisiones, contratos más caros).

## 6. Módulo TPV (punto de venta)

- Apertura de caja obligatoria antes de vender (importe inicial).
- Terminal táctil: columna de categorías (familias, con color e imagen), rejilla
  de productos (foto, precio; si ya está en el ticket se ve la cantidad),
  ticket a la derecha con teclado numérico y botón COBRAR.
- Los artículos de una familia heredan el color de la familia; las imágenes se
  suben en la ficha del artículo y de la familia.
- Cobro: efectivo (con cambio), tarjeta u otros; crea la factura simplificada
  F2 con VeriFactu y descuenta el stock.
- Barra inferior: movimientos de caja (entradas/salidas), informe del usuario,
  proforma, ticket regalo (sin precios), copia y email del último ticket, y
  abrir cajón.
- Tickets en espera (aparcar y recuperar) y devoluciones con ticket negativo.
- Arqueo/cierre de caja: cuenta el efectivo esperado contra el real.
- Sin pantalla táctil funciona igual con el ratón: misma pantalla.
- Configuración: TPV → Ajustes (periféricos: impresora, cajón portamonedas,
  visor; formato del ticket en el editor de formatos; y preferencias de
  visión, como artículos redondos o cuadrados).

## 7. Módulo Servicio Técnico (SAT)

- Aparatos (ficha por aparato con marca/modelo/nº serie), órdenes de
  reparación con estados y recepción, y agenda de citas a domicilio/tienda.

## 8. Módulo Asesoría

- Cartera de clientes del despacho (empresas vinculadas: la asesoría ve los
  datos fiscales de sus clientes).
- Documentos: los clientes suben facturas/tickets; el OCR los lee y caen en
  la bandeja de revisión para contabilizar.
- Libros de IVA (registro de facturas emitidas/recibidas), previsión de
  tesorería, calendario de fiscalidad (modelos y fechas), solicitudes de
  documentación y cierres de periodo.

## 9. Módulo Telefonía

- Centralita IP (handSIP): historial de llamadas, identificación del cliente
  que llama (salta su ficha) y click-to-call desde la ficha.

## 10. Agenda general

- Citas de cualquier tipo (no solo taller), con recordatorios por WhatsApp:
  el cliente autoriza en la cita y el programa envía confirmación y
  recordatorio según Ajustes → WhatsApp.
- Dictado por voz: se habla y la IA rellena la cita.

## 11. Ajustes (configuración completa)

- Empresa: datos fiscales, logo (sale en los documentos).
- Series: numeración de cada documento.
- Usuarios: altas, roles y accesos.
- Correo: SMTP para enviar facturas y plantillas de email.
- WhatsApp: proveedor y plantillas de recordatorios de citas.
- VeriFactu: certificado y entorno (pruebas/producción).
- Taller: precios por hora de chapa, pintura y mecánica.
- TPV: periféricos, visión y ticket.
- Formatos: EDITOR DE FORMATOS de impresión (ver sección siguiente).
- Copias de seguridad: copia de la base de datos descargable.

## 12. Editor de formatos de impresión (muy importante)

Los documentos impresos (facturas, albaranes, presupuestos, órdenes de
trabajo, partes de taller, contrato de cortesía, tickets…) se diseñan con el
editor en Ajustes → Formatos. Cada formato es una plantilla visual:
- Se trabaja con bloques: textos fijos, datos del documento (número, fecha,
  cliente, líneas, totales…), imágenes (logo) y tablas.
- Cada documento tiene un formato asignado; se puede duplicar un formato para
  hacer variantes (ej. "factura con sello", "albarán sin precios").
- Los cambios se guardan y afectan a partir de la siguiente impresión.
- Si un documento "sale en blanco" o con un diseño viejo, casi siempre es el
  formato asignado: revisar Ajustes → Formatos.
- Consejo: para el contrato de cortesía y documentos especiales se crea un
  formato propio tipo "parte" y se maqueta ahí (no en Word).

## 13. Ayudas y soporte dentro del programa

- Cada módulo tiene su propia ayuda (Ayuda taller, Ayuda TPV, Ayuda
  energía, Ayuda asesoría…) y hay una Ayuda general con primeros pasos y
  configuración.
- Ayuda → Novedades: qué se ha ido añadiendo y buzón de propuestas con
  capturas de pantalla.
- Nexo, el asistente con IA (módulo Asistente IA), responde preguntas de uso
  y conoce la configuración actual de la empresa.

## 14. Problemas frecuentes y solución rápida

- "No veo el cambio nuevo": caché de la PWA → borrar datos del sitio o
  incógnito.
- "El documento imprime raro": formato asignado en Ajustes → Formatos.
- "No salen los precios por hora en la valoración": configurarlos en Ajustes
  → Configuración → Taller — precios por hora.
- "La compañía no sale al importar el PDF": se crea sola; revisar Taller →
  Aseguradoras.
- "VeriFactu da error": Ajustes → VeriFactu, revisar certificado y reintentos
  (el registro se reenvía solo).
- "Cliente duplicado": fusionar borrando el sobrante y usando el NIF único.
- "Una factura de compra en moneda extranjera (dólares, etc.)": se da de alta
  con el importe ya convertido a euros (el campo de la factura es siempre en
  €); conviene anotar en las notas el importe y la divisa original y guardar
  el PDF de la factura real.
- "El extracto del banco no encuentra la factura al conciliar": el programa
  cruza importe (±3 %, mínimo 2 €) y nombre del tercero en el concepto del
  banco; si el concepto no nombra al proveedor/cliente reconocible, hay que
  conciliar a mano eligiendo la factura correcta en el buscador del modal.
- "¿Cómo sé qué está conciliado y qué no?": Informes → Tesorería (informe de
  conciliaciones) lista cada movimiento del extracto, si está conciliado, con
  qué factura(s) y permite filtrar los pendientes.
- "¿Cómo veo quién me debe o a quién le debo con su NIF/CIF?": Informes →
  Ventas e Informes → Compras, pestaña Documentos, muestran el NIF/CIF del
  cliente/proveedor en cada línea.
`;

// Reglas de comportamiento de la IA (qué debe y qué no debe hacer).
export const REGLAS_ASISTENTE = `
Eres Nexo, el asistente de FILANEX, integrado en el programa. Te presentas
como Nexo y ayudas a usarlo.

REGLAS:
1. Responde SIEMPRE en español, claro y directo, como un compañero experto.
2. Indica las rutas reales de menú con flechas (ej.: Ajustes → Configuración →
   Taller — precios por hora). Nunca inventes pantallas ni opciones: si algo
   no está en el manual, dilo con honestidad y sugiere el buzón de propuestas
   (Ayuda → Novedades → Propuestas).
3. Da pasos numerados cuando expliques un procedimiento. Sé conciso: mejor 5
   líneas útiles que 20 de relleno. Usa negritas (**) solo para lo importante.
4. Ten en cuenta la sección "ESTADO ACTUAL DE ESTA EMPRESA": solo habla de los
   módulos que tiene activos salvo que pregunte por contratar otros; cita sus
   propios valores (precios, series…) cuando sea relevante.
5. No ejecutas acciones ni ves los datos de negocio (facturas concretas,
   clientes…): explicas cómo hacerlo. Si te piden un dato concreto, di dónde
   consultarlo. Si te piden que lo hagas tú, no te disculpes: da enseguida los
   pasos para que lo haga el usuario.
6. ENLACES DIRECTOS (obligatorio): cuando expliques algo que se hace en una
   pantalla concreta, termina la respuesta con un enlace clicable a esa
   pantalla en este formato EXACTO, cada uno en su propia línea:
   [→Ir a Configuración](/configuracion)
   Usa SOLO rutas de esta lista (nunca inventes otras):
   /ventas (facturas) · /presupuestos · /albaranes · /clientes · /proveedores
   /articulos · /compras/facturas · /compras/albaranes · /compras/gastos
   /compras/ocr · /tesoreria · /tesoreria/cobros · /tesoreria/pagos
   /tesoreria/extractos
   /informes/ventas · /informes/compras · /informes/iva · /informes/tesoreria
   /recurrencias
   /agenda · /configuracion · /series · /certificado · /correo · /whatsapp
   /usuarios · /formatos · /copias · /novedades
   /taller · /taller/agenda · /taller/vehiculos · /taller/ordenes
   /taller/valoraciones · /taller/aseguradoras · /taller/cortesia
   /taller/operarios · /taller/planning
   /energia · /energia/suministros · /energia/comercializadoras
   /energia/canales · /energia/tramites · /energia/comisiones
   /energia/estudios · /energia/campanas · /energia/autofacturas
   /energia/agenda
   /tpv · /tpv/tickets · /tpv/caja · /tpv/ajustes
   /servicio · /servicio/agenda · /servicio/aparatos · /servicio/ordenes
   /asesoria · /asesoria/cartera · /asesoria/documentos · /asesoria/libros
   /asesoria/fiscalidad · /asesoria/prevision · /asesoria/solicitudes
   /telefonia/llamadas · /ayuda/general · /ayuda/taller · /ayuda/tpv
   /ayuda/asesoria · /ayuda/facturacion · /ayuda/servicio · /ayuda/telefonia
   /ayuda/energia
   Máximo 3 enlaces por respuesta, y solo los realmente útiles.
7. Si la pregunta no es del programa (temas personales, otros programas…),
   responde brevemente que solo ayudas con FILANEX.
`;
