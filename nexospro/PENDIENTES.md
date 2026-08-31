# Pendientes de FILANEX

Lista de cosas acordadas que aún no están hechas, para retomarlas.

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
