# NEXOSPRO

Programa de facturación conectado a VeriFactu con registro automático de compras mediante OCR (Gemini).

- Alcance del MVP: `docs/mvp-alcance.md`
- Stack: Node.js + Express + MongoDB (Mongoose) · React + Vite + Tailwind CSS · Gemini API

## Estructura

```
nexospro/
  docs/     Documentación de producto
  server/   API REST (Express + Mongoose)
  client/   Aplicación web (React + Vite + Tailwind)
```

## Requisito fiscal (no olvidar)

Para **remitir registros a la AEAT** hace falta el **certificado electrónico del representante de FILA TÉCNICA S.L.** exportado como `.pfx` (con clave privada). Configurar en `server/.env`:

```
AEAT_CERT_PFX=C:/ruta/al/certificado.pfx
AEAT_CERT_PASS=contraseña-del-pfx
AEAT_ENTORNO=pruebas   # produccion cuando toque
```

Sin certificado el sistema funciona igual, pero los registros quedan en estado `pendiente` de envío. El certificado **nunca se sube al repositorio** (guardarlo fuera de la carpeta del proyecto).

## Puesta en marcha (desarrollo)

```bash
# API
cd server
copy .env.example .env   # editar MONGODB_URI y GEMINI_API_KEY
npm install
npm run dev              # http://localhost:4700/api/health

# Web
cd client
npm install
npm run dev              # http://localhost:4701
```

## Operativa diaria

- **Ventas**: crear factura (borrador) → emitir (sellado VeriFactu + PDF con QR) → anular si procede.
- **Presupuestos**: crear → enviar/aceptar → **Facturar** convierte el presupuesto aceptado en factura borrador.
- **Albaranes**: crear albaranes → seleccionar varios del mismo cliente → **Facturar seleccionados** los agrupa en una sola factura.
- **Compras OCR**: subir PDF/foto de factura de proveedor → Gemini extrae líneas → revisar y validar (crea proveedor/artículos si no existen).
- **Tesorería**: pendientes de cobro → registrar cobros (totales o parciales) → seleccionar facturas con IBAN → **Generar remesa** (XML SEPA pain.008.001.02 descargable para el banco). Requiere IBAN en la ficha del cliente y datos SEPA de la empresa en Configuración.
- **Recurrencias**: cuotas periódicas (mensual/trimestral/anual) → **Generar vencidas** crea las facturas borrador del periodo.

## Producción (un solo puerto)

```bash
cd client
npm run build            # genera client/dist
cd ..\server
npm start                # http://localhost:4700 sirve API + web
```

## Copias de seguridad

```bash
server\scripts\backup-mongo.cmd
```

Genera un volcado con `mongodump` en `server\backups\AAAAMMDD-HHMMSS`. Programar en el Programador de tareas de Windows para ejecución diaria. **Guardar también el `.env` y el certificado fuera del equipo.**
