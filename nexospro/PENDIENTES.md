# Pendientes de FILANEX

Lista de cosas acordadas que aún no están hechas, para retomarlas.

## Recordatorios de estilo (no olvidar)

- **Los modales y bloques de la app son de tema CLARO.** Nunca usar fondos
  oscuros (`bg-slate-800`, `bg-slate-700`) ni texto oscuro sobre ellos dentro
  de un modal: no se ve. Usar fondos claros (`bg-slate-50`, `bg-white`) y texto
  `text-slate-700/800`, y para estados el pill claro tipo
  `bg-<color>-100 text-<color>-700 border-<color>-200` (igual que en
  Taller → Valoraciones).

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

- [x] **Cortesía — contrato imprimible**: botón imprimir en Taller → Vehículos
      de cortesía genera el contrato con datos, condiciones y hueco de firma
      (taller y cliente). Desplegado (commit `f370830`).
- [ ] **Valoraciones — ver presupuestos/peritaciones aportados**: confirmar
      con la clienta qué quiere exactamente (¿ver líneas del peritaje? ¿o
      adjuntar/ver un presupuesto asociado?). Pendiente de su respuesta.
- [x] **Normalizar matrículas en todas las empresas**: el script
      `normalizar-matriculas.mjs` se ejecutó en `filanex_demomontiel` y
      `filanex_demofilanex` (con cambios); `filanex_montiel` ya estaba bien y
      `filanex_gasen` no tiene datos. Todas las matrículas están sin espacios.

## Cuanto antes (a raíz de la caída del 31/08)

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

- [ ] **Activar el envío a la AEAT.** Días antes del 1 de enero, en
      Ajustes → Certificado. Hasta entonces las facturas se registran con huella
      y QR pero nacen como "no remitidas" y no se enviarán nunca.
      Requiere tener subido el certificado y cambiar el entorno de Pruebas a
      Producción.

## Sin fecha

- [ ] **Escalabilidad**: revisar índices, caché y procesos asíncronos antes de
      crecer en número de clientes.
