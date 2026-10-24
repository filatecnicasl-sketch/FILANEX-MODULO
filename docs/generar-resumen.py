from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib import colors
from datetime import datetime
import os

output_dir = r"C:\Users\Francis\.verdent\verdent-projects\calculadora-de-iprem\nexospro\docs"
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, "resumen-filanex.pdf")

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    topMargin=2*cm, bottomMargin=2*cm,
    leftMargin=2.5*cm, rightMargin=2.5*cm
)

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Justify", parent=styles["BodyText"], alignment=4, spaceAfter=6))

story = []

story.append(Paragraph("FILANEX - Resumen de avance", styles["Title"]))
story.append(Paragraph(f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles["Normal"]))
story.append(Spacer(1, 1*cm))

story.append(Paragraph("1. Arquitectura SaaS nube + PWA offline", styles["Heading2"]))
story.append(Paragraph(
    "Se aprobo un plan para desplegar FILANEX como SaaS multi-tenant accesible desde app.filanex.es, "
    "manteniendo la posibilidad de instalacion local. El backend se desplegara en Render/Railway/Fly.io, "
    "el frontend estatico en Netlify/Vercel, y el almacenamiento de archivos en Cloudflare R2 o AWS S3. "
    "La aplicacion funcionara como PWA con service worker, cacheo de recursos y sincronizacion offline de escrituras.",
    styles["Justify"]
))
story.append(Spacer(1, 0.5*cm))

story.append(Paragraph("2. Optimizacion de rendimiento", styles["Heading2"]))
story.append(Paragraph(
    "Se anadieron indices en las colecciones FacturaVenta, FacturaCompra, Cliente y OrdenTrabajo. "
    "El envio a VeriFactu se hizo asincrono, liberando la peticion HTTP del usuario y delegando el envio "
    "a un job de reintento automatico. Esto elimina bloqueos por latencia de la AEAT.",
    styles["Justify"]
))
story.append(Spacer(1, 0.5*cm))

story.append(Paragraph("3. Numeracion atomica", styles["Heading2"]))
story.append(Paragraph(
    "Se implemento una coleccion Contador (server/src/models/Contador.js) con findOneAndUpdate y $inc. "
    "Se reemplazo la numeracion de facturas de venta y ordenes de taller por funciones atomicas en "
    "server/src/services/numeracion.js. Esto evita duplicados bajo alta concurrencia y reduce la contencion "
    "sobre el documento Empresa. Se corrigio la inicializacion del contador para que parta del maximo existente + 1.",
    styles["Justify"]
))
story.append(Spacer(1, 0.5*cm))

story.append(Paragraph("4. Resultados de stress-test (100 conexiones concurrentes)", styles["Heading2"]))
story.append(Paragraph(
    "Prueba realizada en localhost sobre facturacion y taller. No se produjeron errores, timeouts ni respuestas 5xx.",
    styles["Justify"]
))
story.append(Spacer(1, 0.3*cm))

data = [
    ["Endpoint", "Peticiones", "Resultado"],
    ["GET /api/facturas-venta", "100 concurrentes", "0 errores, mejora del 34%"],
    ["POST /api/facturas-venta", "100 concurrentes", "0 errores, mejora del 68%"],
    ["GET /api/taller/ordenes", "100 concurrentes", "0 errores, mejora del 63%"],
    ["POST /api/taller/ordenes", "100 concurrentes", "0 errores, mejora del 63%"],
]

table = Table(data, colWidths=[6*cm, 4*cm, 5*cm])
table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4472C4")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#D9E2F3")]),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
]))
story.append(table)
story.append(Spacer(1, 0.5*cm))

story.append(Paragraph("Verificacion de duplicados", styles["Heading3"]))
story.append(Paragraph(
    "Tras las pruebas se verifico que no existian numeros de orden de trabajo ni facturas de venta duplicados "
    "en las colecciones. Se crearon scripts auxiliares (check-duplicados.mjs, check-duplicados-fv.mjs, "
    "post-fv-concurrente.mjs) para futuras validaciones.",
    styles["Justify"]
))
story.append(Spacer(1, 0.5*cm))

story.append(Paragraph("5. Pendientes y proximos pasos", styles["Heading2"]))
items = [
    "Completar el manifest PWA y la sincronizacion offline de escrituras.",
    "Implementar el panel de administracion de tenants (/admin/tenants).",
    "Configurar Cloudflare R2/S3 para almacenamiento de archivos y certificados VeriFactu.",
    "Desplegar frontend en Netlify/Vercel y backend en Render/Railway/Fly.io.",
    "Depurar formatos de impresion: quitar recuadros en HTML/PDF de facturas, albaranes y presupuestos.",
    "Anadir modulo de tickets de gasto en compras.",
    "Seguir ajustando el modulo de taller segun lo indicado.",
]
for item in items:
    story.append(Paragraph(f"- {item}", styles["BodyText"]))

story.append(Spacer(1, 1*cm))
story.append(Paragraph(
    "Nota: este resumen refleja el estado tecnico al cierre de la ultima sesion de trabajo.",
    styles["Normal"]
))

doc.build(story)
print(f"PDF generado en: {output_path}")
