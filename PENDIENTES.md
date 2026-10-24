# Pendientes de FILANEX

Lista de cosas acordadas que aún no están hechas, para retomarlas.

## Sábado 24/10 (ventana de mantenimiento 8:00–15:00)

- [x] **Aplanar el repo: eliminar el directorio `nexospro/`** — HECHO 24/10.
      Rama `refactor/aplanar-repo` fusionada a main (515 renombres, historial
      intacto). Servidor migrado: backup previo en
      `/root/backup-pre-aplanado-2026-10-24.tar.gz`, datos en vivo movidos
      (.env, uploads, node_modules, client/dist), pm2 recreado con cwd
      `/opt/filanex/server`, cron actualizado, `/opt/filanex/nexospro`
      eliminado. Identificadores internos intactos (package.json, health,
      localStorage `nexospro-formatos-v1`, nombres de BD). Verificado: health
      ok, index 200, logo Montiel 401 (no 404).
- [ ] **Desplegar el agente Nexo (AGENE IA) en este mismo servidor**
      (194.62.96.102): resuelto el acceso — yo entro como root por SSH con
      la clave `filanex_prod`; no existe usuario `ubuntu` (la máquina se
      administra como root, por eso no aparecía ese login). El agente aún no
      está subido. Recursos libres: ~2,5 GB RAM, 20 GB disco. Habría que
      crearle su carpeta (p. ej. `/opt/agene`), su proceso pm2 aparte y un
      puerto que no choque con el 4700 de FILANEX.
- [ ] **Dar de alta las facturas 1T y 2T de Filatecnica** (carpeta
      `D:\Users\Francis\Desktop\ENVIO 2026`). Comprobado 22/10: las 20 ventas
      de las series 3/xxxx YA están en el programa (coinciden con los
      informes de FacturaSOL); NO tocar el 3T (ya completo). Falta:
      (a) compras 1T: ~42 PDFs en `1º TRIMESTRE\compra` (FilaSur, Hispamicro,
      Ionos, Enea, ASTRD LLC, etc.); (b) compras 2T: ~39 PDFs en
      `2º TRIMESTRE\RECIBIDAS` (incluidas Emergent/Verdent abril-junio);
      (c) 6 ingresos por comisiones de altas: 1T `FS-26-1-01` 484,00 €,
      `FS-26-2-01` 254,10 €, `FS-26-3-01` 1.081,16 € (AT Enterprise, en
      `1º TRIMESTRE\venta`) y 2T `5569-26-00001` 145,20 € (GANA, facturación
      por el destinatario), `ACI/0001` 268,62 € (Ahorreluz) y
      `autofactura informa.pdf` (imagen sin texto, OCR pendiente). Adjuntar
      siempre el PDF, dedupe por proveedor+número y conciliar contra extracto.

## URGENTE / Revisar con detenimiento

- [ ] **Importación de facturas del buzón filatecnicasl@gmail.com — PDFs
      descargados y OCR COMPLETO, falta alta + conciliación**: CAUSA RAÍZ
      encontrada y corregida (15/10, cursor por UID, commit `69f0355`). Los
      38 PDFs están en `/tmp/facturas-faltantes/` del servidor y su
      `estado.json` ya tiene el OCR de todos (15/10): 8 de Emergent
      (I2AMTLUM-0001, PJQ0IGLM-0001..0008), ~13 de Link/Verdent (LINKT-****,
      ojo: LINKT-3199 viene dos veces, es la misma factura reenviada) y ~13
      de Moonshot (TMPKWC3S-****, proveedor aún sin crear; en varias el OCR
      confunde el proveedor con "FILATECNICA S.L." — es el destinatario).
      Pendiente: dar de alta en Compras con su PDF (dedupe por
      proveedor+número, LINKT-32550075 ya existe) y conciliar con el extracto.
      Copia de seguridad de los PDFs en `/opt/filanex/facturas-pendientes/`.

- [ ] **Dos cargos de Emergent de 20 $ sin factura**: -18,22 € (06/07) y
      -18,08 € (04/08). Son facturas que el usuario no ha pasado todavía
      (las 6 de la carpeta —0009 a 0014— ya están dadas de alta, validadas
      y conciliadas al céntimo, 14/10).
- [ ] **Kimi/Novascent JPDA3HSY-0004 (octubre) a la espera del extracto 4T**:
      dada de alta y validada con cambio BCE (34,86 €), pero sin conciliar —
      cuando llegue el extracto del 4T, ajustar el tipoCambio al real de la
      tarjeta (cargo € / 39 $) y conciliar. El resto de Moonshot/Novascent
      (0001-0003 + top-up IX1C52EV) ya está todo conciliado (14/10).
- [ ] **Tres cargos de use.ai sin factura**: -29,99 € (09/07), -29,99 € (06/08)
      y -29,99 € (03/09). Suscripción YA CANCELADA por el usuario el 09/09
      (no habrá más cargos). No tienen portal de facturas: hay que pedirlas
      por correo a bill@use.ai (borrador del correo entregado al usuario el
      14/10, con datos fiscales de FILA TECNICA S.L. / B75418350). Los tres
      cargos quedan SIN conciliar a la espera de las facturas; si use.ai no
      factura, decidir entre gasto sin factura (no deducible) o nada.
- [ ] **Cargo IONOS de -149,44 € del 06/07** sin conciliar: son casi seguro
      facturas de junio (2T) no dadas de alta. El usuario aún no ha decidido
      entre subirlas o marcar "Sin factura".

## Modelo comercial / precios (acordado 29/09/2026)

- **Base facturación: 30 €/mes** (1 usuario, sin oferta). Oferta de captación:
  250 € el primer año solo sobre la base, nunca sobre módulos.
- **Usuario adicional: +5 €/mes.** Los operarios de taller que solo consultan
  su orden o registran tiempo NO cuentan como usuarios.
- **Módulos:** Taller +39 €/mes (chapa/pintura incluido) · TPV +19 €/mes ·
  Asesoría +29 €/mes · Nexo (IA) +9 €/mes.
- **Servicios pago único:** importación de datos 250 € · formación 120 €.
- **Descuento por pago anual:** 10 cuotas por 12 meses (2 meses gratis).
- **Descuento a asesorías partner (acordado):** −1 €/mes por cada cliente
  activo y al corriente de pago vinculado a la asesoría. Reglas: se aplica
  SOLO sobre la cuota del módulo Asesoría y con tope en su precio (el módulo
  puede quedar a 0 €, nunca negativo); si el cliente se da de baja o deja de
  pagar, ese euro se pierde ese mes.
- [ ] **Automatizar el descuento partner**: en la ficha/cuota de la asesoría
      mostrar "X clientes vinculados = −X €/mes" y aplicarlo al generar su
      facturación periódica (futura facturación a partners).

## Recordatorios de estilo (no olvidar)

- **Grabado a fuego (23/09/2026, día de la demo ganada).** Estas cuatro
  reglas aplican a TODOS los ámbitos del programa (taller, TPV, facturación,
  tesorería, agenda, asesoría...), no solo a la IA:
  1. Cuando el usuario afirma algo ("esto funcionaba", "esto está mal"),
     parte de que es VERDAD: busca el fallo en otra parte, nunca en su
     palabra. Él es quien más interés tiene en que el programa funcione.
  2. Verificar antes de entregar, siempre: primero lo compruebo yo
     (imagen, PDF, dato, despliegue), luego se lo enseño. Nunca al revés.
  3. Cuidado con los efectos colaterales de las herramientas: un
     `git stash -u` borró la llave de la IA dos veces. Antes de ejecutar
     comandos de despliegue o limpieza, pensar qué más tocan.
  4. Lo más vendible debe ser lo más vigilado: la IA de lectura ahora tiene
     vigilante propio; cualquier función estrella nueva, igual.

- **La marca es intocable: usar SIEMPRE los recursos corporativos reales.**
  Logo oficial: `nexospro/client/public/icono-512.png` (Fx blanca sobre
  cuadrado negro redondeado con punto turquesa). Colores: navy `#060B16` /
  `#131B30` y turquesa `#22D3EE`. Fuente: Poppins.
  Las imágenes generadas por IA INVENTAN logos parecidos pero falsos: en
  cualquier imagen o documento donde aparezca la marca, el logo hay que
  componerlo pegando el archivo real encima (nunca el dibujado por la IA) y
  VERIFICARLO visualmente antes de entregarlo al usuario. Esto ya falló una
  vez (fondo de Meet, 23/09/2026) y no puede repetirse: verificar primero,
  entregar después.

- **Los modales y bloques de la app son de tema CLARO.** Nunca usar fondos
  oscuros (`bg-slate-800`, `bg-slate-700`) ni texto oscuro sobre ellos dentro
  de un modal: no se ve. Usar fondos claros (`bg-slate-50`, `bg-white`) y texto
  `text-slate-700/800`, y para estados el pill claro tipo
  `bg-<color>-100 text-<color>-700 border-<color>-200` (igual que en
  Taller → Valoraciones).

## Ideas en estudio (propuestas internas)

- **Calendly (calendly.com) — valorar si nos conviene** (pedido 14/10/2026):
  agenda online donde el cliente reserva hora él mismo con un enlace
  (disponibilidad, recordatorios, integración con Google Calendar). Plan
  gratuito muy limitado; de pago por asiento. Dos caminos a estudiar:
  (a) integrarlo por su API/webhook para que las reservas caigan solas en
  las citas de FILANEX, o (b) construir la "reserva online" nativa (enlace
  público por taller que vuelca en la agenda, sin cuota externa ni datos
  del cliente en terceros). Decidir con el usuario.
- **Nexo — fase 2 (agente que ejecuta acciones)**: APLAZADO por el usuario
  (21/09/2026, "de momento Nexo se queda así"). Diseño acordado: Nexo crearía
  citas/clientes y consultaría agenda y facturación, con confirmación en el
  chat antes de acciones delicadas (facturar, cobrar, borrar) y registro de
  cada acción. Empezar por consultas + citas + altas de cliente.
- **Capturas de pantalla en las ayudas**: ilustrar cada apartado del manual
  con pantallazos reales y leyendas (los hace el usuario, yo los inserto).
- **Avisos de stock mínimo**: avisar al vender o en el panel cuando un
  artículo baja de su stock mínimo.
- **Histórico de movimientos de stock**: registro de cada entrada/salida con
  el documento que la originó, para trazar descuadres.
- **Informe de ventas por artículo y familia**: ranking con importes y
  márgenes, filtrable por periodo.
- **Etiquetas con código de barras**: impresión de etiquetas de precio desde
  la ficha del artículo.
- **Valoraciones con presupuestos/peritaciones** (taller): pendiente de que
  la clienta confirme qué quiere ver exactamente.
- Las propuestas que escriben los usuarios se recogen en
  **Ayuda → Novedades → Propuestas** (colección `propuestas` del tenant).

## Recordatorios de arquitectura / trabajo

- **Apuntar cada cambio en Novedades.** Cada vez que se hace un cambio en la
  aplicación, se añade una entrada en `client/src/data/novedades.js` (la más
  reciente primero) y se sube en el mismo commit. Las ideas a estudiar van en
  el array `PROPUESTAS` del mismo archivo. La página está en Ayuda → Novedades.

- **Usar el editor de formatos** (`Ajustes → Formatos`) para todos los
  documentos imprimibles (facturas, presupuestos, albaranes, partes,
  contratos, etc.). Antes de crear un documento nuevo o modificar uno
  existente "a mano" en código, valorar si puede hacerse como plantilla del
  editor para que cada cliente la personalice a su gusto.

## Estado del equipo y del repo (10/09/2026)

- El ordenador anterior se estropeó. El proyecto vive ahora en
  **`C:\FILANEX-MODULO`** del equipo nuevo (copia completa del disco D:,
  que queda solo como respaldo). Abrir siempre esta carpeta en Verdent.
- Repo GitHub: `filatecnicasl-sketch/FILANEX-MODULO`. Git ya está instalado
  en este equipo y la identidad del repo configurada; commit y push funcionan.
- **Ojo:** hay una copia ANTIGUA del proyecto en
  `C:\Users\fbmagp\.verdent\verdent-projects\calculadora-de-iprem\nexospro`
  (anterior al sistema de licencias por tenant). No trabajar ahí.
- Último commit subido: `2e7a282` (10/09) con dos correcciones:
  1. `PUT /api/empresa` ahora aplica `modulos` antes de validar
     `moduloInicio` (antes fallaba al activar un sistema y ponerlo de
     inicio en la misma petición).
  2. `telefonia.js`: las rutas privadas (stream, llamadas, simular) ya
     exigen `requiereModulo("telefonia")`; el webhook `/evento` sigue público.
- [x] **Verificar que app.filanex.es ha aplicado el commit `2e7a282`** —
      HECHO (10/09 ~03:20). No se había desplegado solo: el servidor seguía
      en `436a52e`. Se ha hecho `git pull` + `npm install` + `pm2 restart`
      en `/opt/filanex` (UpCloud ES-MAD1, IP 194.62.96.102) y la API responde OK.

## Acceso al servidor (nuevo, 10/09)

- Servidor: UpCloud `ubuntu-2cpu-4gb-es-mad1` (Madrid), IP `194.62.96.102`.
- Proyecto en `/opt/filanex`; servicio `filanex-api` gestionado con PM2 (root).
- SSH desde este equipo: la llave recuperada del disco viejo está en
  `C:\Users\fbmagp\.ssh\id_ed25519_fil` y la nueva en
  `C:\Users\fbmagp\.ssh\filanex_prod`; ambas autorizadas en el servidor.
- Conexión: `ssh -i C:\Users\fbmagp\.ssh\id_ed25519_fil root@194.62.96.102`.
- Para actualizar producción: push a GitHub, luego en el servidor
  `cd /opt/filanex && git pull && cd nexospro/server && npm install --omit=dev && pm2 restart filanex-api`
  (si toca frontend, además build del cliente).
- [ ] **Guarda de rutas en el frontend** (acordado, sin hacer): redirigir a
      `/` si se entra por URL a un sistema no activado (hoy el menú los
      oculta pero la ruta existe y la página falla al cargar datos).

## Peticiones de la clienta sobre Citas (10/09)

Impresión de citas y adjuntar presupuestos YA ESTABAN. Lo que faltaba, HECHO
y desplegado (commit `1759ab0`, 10/09 ~04:10):

- [x] **Valoraciones en la cita**: si el vehículo tiene valoraciones, salen
      listadas en el modal de la cita (número, compañía, estado, total).
- [x] **Alta de vehículo desde la cita**: casilla "Vehículo nuevo" con marca
      y modelo; se da de alta al guardar la cita.
- [x] **Vehículo de cortesía**: checkbox "Reservar cortesía" en la cita con
      asignación de coche libre, enlace "Registrar préstamo" (queda ligado a
      la cita), y aviso de cortesía activa. En Taller → Vehículos se ve el
      badge "Prestado" (coches de cortesía) y "Cortesía MATRÍCULA" (coches de
      cliente cuyo dueño tiene una).
- [x] **Pantalla principal de citas — más información**: badges de compañía
      (nombre de la aseguradora) o "Particular", y de cortesía, tanto en la
      vista Agenda del calendario como en la lista de búsqueda.
- [x] **Selector de aseguradora al crear cita**: campo "Por compañía de
      seguros" con buscador (vacío = particular).

## Nuevas peticiones de la clienta (nota manuscrita, 10/09)

- [x] **Cortesía — contrato imprimible**: creado como plantilla del editor de
      formatos (`Ajustes → Formatos → Contrato de cortesía`), configurable por
      cada cliente, con siluetas reales del coche (lateral, superior, frontal,
      trasera). Desplegado (commit `11f445e`).
- [ ] **Valoraciones — ver presupuestos/peritaciones aportados**: confirmar
      con la clienta qué quiere exactamente (¿ver líneas del peritaje? ¿o
      adjuntar/ver un presupuesto asociado?). Pendiente de su respuesta.
- [x] **Normalizar matrículas en todas las empresas**: el script
      `normalizar-matriculas.mjs` se ejecutó en `filanex_demomontiel` y
      `filanex_demofilanex` (con cambios); `filanex_montiel` ya estaba bien y
      `filanex_gasen` no tiene datos. Todas las matrículas están sin espacios.

## Cuanto antes (a raíz de la caída del 31/08)

- [x] **IA de lectura de facturas: robustecida (23/09/2026).** Causa real del
      fallo encontrada: los despliegues con `git stash -u` retiraban la carpeta
      `/opt/filanex/secrets` (no estaba en el repo); ya está en `.gitignore`.
      Hecho: (1) vigilante al arrancar que comprueba que la llave existe y hace
      una prueba en vivo (`services/ia-salud.js`); (2) autotest diario a las
      08:15; (3) mensaje claro al usuario cuando es problema de configuración
      ("avisa al administrador"); (4) `/api/health` incluye `"ia":"ok|error"`
      para el vigilante externo; (5) copias de la llave en D:\FILANEX y en
      C:\FILANEX-MODULO\secrets (gitignored).
      FALTA: configurar SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS y
      AVISO_ADMIN_EMAIL en el .env del servidor para que el aviso llegue
      también por correo (de momento queda registrado en el log del servidor).

Esa noche el servidor estuvo caído desde ~22:00 hasta las 00:51 y nos enteramos
porque se vio en una demo delante de un cliente. Causa: se acabó la prueba
gratuita de UpCloud y apagaron la máquina. La cuenta ya está en modo de pago,
así que por ese motivo no se repite; falta enterarse antes y recuperar rápido.

- [ ] **Vigilante externo (gratis).** UptimeRobot o Better Stack apuntando a
      `https://app.filanex.es/api/health`, con aviso al móvil y al correo.
      Detecta la caída en 1-2 minutos.
- [ ] **Copias automáticas del servidor** en el panel de UpCloud (1-2 €/mes):
      instantánea diaria del disco entero, aparte de las copias de la base de
      datos que ya se hacen.
- [ ] **Registros del sistema persistentes** en el servidor (`/var/log/journal`),
      para que un cuelgue futuro deje rastro y se pueda saber la causa. Requiere
      reiniciar el servicio de registro: pendiente de hacerlo con permiso.
- [ ] **No compilar en producción**: hoy se hace `npm run build` en el propio
      servidor; mejor compilar fuera y subir solo el resultado.
- [ ] **Configurar `TELEFONIA_TOKEN` en producción** (mínimo 32 caracteres
      aleatorios) antes de activar el sistema de telefonía. Actualizar la
      centralita para usar `?token=...`; idealmente mover la autenticación del
      webhook a una cabecera o a una firma HMAC para no dejar el token en logs.

## Antes de enero (importante)

- [ ] **Fecha de operación en facturas.** Hoy solo existe la fecha de expedición.
      Hace falta para poder facturar en enero trabajos de diciembre y que el IVA
      entre en el 4T del año anterior, sin poner fechas retroactivas (VeriFactu
      estampa la fecha y hora real de generación del registro, así que retrasar
      la fecha de expedición ya no es viable).
      Afecta a: modelo `FacturaVenta`, formulario de factura, plantillas de
      impresión, campo `FechaOperacion` del XML de VeriFactu y agrupación de los
      informes de IVA por fecha de operación cuando exista.
      Plazo legal de referencia: la factura a empresas se puede expedir hasta el
      día 16 del mes siguiente al devengo.

## 1 de octubre de 2028 (VeriFactu)

- [ ] **Activar el envío a la AEAT.** Según última información, VeriFactu entra
      a funcionar el **1 de octubre de 2028**. Días antes de esa fecha, en
      Ajustes → Certificado habrá que cambiar el entorno de Pruebas a
      Producción. Hasta entonces las facturas se registran con huella y QR pero
      nacen como "no remitidas" y no se enviarán. Requiere tener subido el
      certificado.

## Calendario de auditorías (acordado 13/10/2026)

Cadencia acordada tras la auditoría completa de octubre 2026:

- [ ] **Revisión ligera — enero de 2027.** Solo del código añadido o tocado
      desde octubre 2026 (conciliación bancaria con datos reales del cliente,
      módulo de energía). 2-3 horas, no una auditoría completa.
- [ ] **Auditoría completa — octubre de 2027.** Como la de octubre 2026
      (seguridad, integridad, tesorería, rendimiento), con revisores
      independientes. Además deja el terreno preparado para VeriFactu 2028.
- [ ] **Revisión específica VeriFactu — primavera de 2028** (3-6 meses antes
      del 1 de octubre de 2028): flujo de firma, huella encadenada,
      reintentos y entorno de producción.
- **Sin calendario fijo, revisión inmediata si:** módulo nuevo, integración
      con un tercero (banco, AEAT, IMAP), vía nueva de mover dinero, o
      crecimiento notable del número de empresas (tenants).

## Sin fecha

- [ ] **Escalabilidad**: revisar índices, caché y procesos asíncronos antes de
      crecer en número de clientes.
