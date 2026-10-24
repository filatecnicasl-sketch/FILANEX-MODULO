# NEXOSPRO — Alcance del MVP (v1)

> Producto mínimo viable del programa de facturación NEXOSPRO.
> Objetivo: que una empresa real pueda **facturar legalmente con VeriFactu**
> y **registrar sus compras por OCR (Gemini)** a diario. Nada más.

## 1. Dentro del MVP

| Bloque | Alcance |
|---|---|
| Configuración | Datos fiscales de la empresa, series de facturación, logo |
| Clientes | Alta, listado, edición básica |
| Facturación de ventas | Crear factura (líneas, IVA), numeración por serie, PDF, rectificativas |
| Núcleo VeriFactu | Registro de facturación (alta/anulación), hash SHA-256 encadenado, QR en factura, remisión a AEAT, estados de envío |
| OCR de compras (Gemini) | Subir PDF/foto → propuesta estructurada → confirmar con un clic |
| Altas automáticas | Creación de proveedor si no existe (matching difuso + validación NIF) y de artículo (unidades) o servicio (teléfono, luz…) |
| Cola de revisión | Estados `pendiente_revision / validada / rechazada`, umbral de confianza |
| Albaranes de compra | Registro y cruce albarán ↔ factura (`pendiente_facturar / facturado`) |

## 2. Fuera del MVP (roadmap posterior)

- **NEXOSPRO-AUTO** y resto de verticales (con taller piloto real)
- Conciliación bancaria, remesas SEPA, cobros
- Albaranes/pedidos de venta, stock avanzado
- Asistente IA (RAG sobre los datos), informes avanzados
- Multiusuario con roles, app móvil
- Migraciones desde otros programas (Excel/Access)
- Multiempresa real (el modelo ya lo prevé, la UI no)

## 3. Pantallas

1. **Login**
2. **Panel** — facturación del mes, pendientes de revisión OCR, estado de envíos AEAT
3. **Ventas** — lista de facturas (con estado AEAT), nueva factura, detalle/PDF
4. **Compras OCR** — bandeja de subida + cola de revisión (documento y propuesta lado a lado) + validar
5. **Clientes / Proveedores / Artículos** — listas y formularios
6. **Configuración** — empresa, series, certificado AEAT

## 4. Flujos críticos

### Emitir factura (VeriFactu)
1. Crear factura → 2. Generar registro de facturación con huella SHA-256 encadenada a la anterior → 3. Componer QR (URL de verificación AEAT) → 4. Remitir registro a la AEAT → 5. Persistir estado (`pendiente / aceptado / aceptado_con_errores / rechazado`)

### Compra por OCR
1. Subir PDF/foto → 2. Gemini extrae JSON estructurado → 3. Validaciones (dígito de control del NIF, aritmética: líneas → base, base + IVA = total) → 4. Matching de proveedor (difuso) y artículos → 5. Borrador `pendiente_revision` → 6. Usuario revisa y valida → 7. Altas automáticas si proceden

> Regla de oro: **el OCR propone, el usuario dispone.** Nada se contabiliza sin confirmación.

## 5. Modelo de datos (resumen)

- `Empresa` — NIF, datos fiscales, series (prefijo + siguiente número), config VeriFactu
- `Usuario` — email, hash, rol, empresa
- `Cliente` / `Proveedor` (con `alias[]` para matching OCR)
- `Articulo` — `tipo: articulo | servicio`, IVA, referencia de proveedor
- `FacturaVenta` — serie+número, líneas, totales, subdoc `verifactu` (huella, huellaAnterior, QR, estado envío)
- `FacturaCompra` — proveedor, líneas, totales, `estado` revisión, `origen: ocr | manual`, subdoc `ocr` (confianza, JSON, fichero)
- `AlbaranCompra` — estado de cruce con factura
- `RegistroFacturacion` — log inmutable de registros AEAT (alta/anulación, huellas, XML, respuesta)

## 6. Criterios de aceptación del MVP

- [ ] Emitir una factura y verla **aceptada por la AEAT** (entorno de pruebas)
- [ ] El QR de la factura resuelve en la sede electrónica
- [ ] Subir una factura de teléfono → propuesta de servicio sin artículo → validar en 1 clic
- [ ] Subir un albarán con artículos → alta de proveedor nuevo + artículos → validar
- [ ] NIF inválido o sumas que no cuadran → la propuesta queda marcada, nunca se valida sola

## 7. Mejoras previstas tras el MVP (backlog compartido)

Se ampliará iterando con experiencia real de uso. Candidatas ya identificadas:
- Aprendizaje por proveedor (memorizar layout/campos de cada emisor)
- Cruce automático albarán ↔ factura al validar
- Duplicados: detección por NIF + número + fecha antes de crear
- Exportación para asesoría (modelos 303/347)
- Modo VERI*FACTU / NO VERI*FACTU conmutable por empresa
