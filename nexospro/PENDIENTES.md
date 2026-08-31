# Pendientes de FILANEX

Lista de cosas acordadas que aún no están hechas, para retomarlas.

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
