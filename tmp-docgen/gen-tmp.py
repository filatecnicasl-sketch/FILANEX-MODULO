# Hoja de alta de cliente FILANEX - PDF rellenable (campos de formulario)
# Mismo diseño que el .docx: navy + turquesa, Poppins, logo real.
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

NAVY = HexColor("#060B16")
NAVY2 = HexColor("#131B30")
TURQ = HexColor("#22D3EE")
GRIS = HexColor("#CBD5E1")
GRIS_CLARO = HexColor("#F1F5F9")
TEXTO = HexColor("#1E293B")
SUAVE = HexColor("#475569")
NOTA = HexColor("#64748B")

PAGE_W, PAGE_H = A4
ML = 56.7                       # margen lateral (1134 dxa)
CW = PAGE_W - 2 * ML            # ancho de contenido = 481.88
FONTS = os.path.join(os.environ["LOCALAPPDATA"], "Microsoft", "Windows", "Fonts")
LOGO = r"C:\FILANEX-MODULO\nexospro\client\public\icono-512.png"
SALIDA = r"C:\FILANEX-MODULO\tmp-docgen\rellenable-nuevo.pdf"

pdfmetrics.registerFont(TTFont("Poppins", os.path.join(FONTS, "Poppins-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Poppins-Bold", os.path.join(FONTS, "Poppins-Bold.ttf")))
POP = "Poppins"
POPB = "Poppins-Bold"
FCAMPO = "Helvetica"  # el texto que escribe el cliente: fuente universal

# ---------------------------------------------------------------- helpers
def header(c):
    """Banda navy con logo y titulo, igual que el docx."""
    h = 54
    y = PAGE_H - 42.5 - h
    c.setFillColor(NAVY)
    c.rect(ML, y, CW, h, stroke=0, fill=1)
    c.drawImage(LOGO, ML + 10, y + 11, width=32, height=32, mask="auto")
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont(POPB, 16)
    c.drawString(ML + 52, y + 26, "FILANEX")
    c.setFillColor(TURQ)
    c.setFont(POP, 9)
    c.drawString(ML + 52, y + 13, "Hoja de alta de cliente")
    return y

def footer(c, pagina):
    c.setStrokeColor(TURQ)
    c.setLineWidth(0.8)
    c.line(ML, 52, ML + CW, 52)
    c.setFillColor(NOTA)
    c.setFont(POP, 8)
    c.drawCentredString(ML + CW / 2, 40,
        f"Filatecnica S.L.  ·  info@filatecnica.com  ·  app.filanex.es      Página {pagina} de 2")

def seccion(c, y, num, titulo):
    y -= 22
    c.setFillColor(TURQ)
    c.setFont(POPB, 12.5)
    c.drawString(ML, y, num)
    c.setFillColor(NAVY)
    c.setFont(POPB, 11.5)
    c.drawString(ML + 22, y, titulo.upper())
    y -= 6
    c.setStrokeColor(TURQ)
    c.setLineWidth(1.6)
    c.line(ML, y, ML + CW, y)
    return y - 10

def fila(c, y, pares, h=20):
    """pares: [(etiqueta, wEtiqueta_pt, nombreCampo, wCampo_pt), ...]"""
    x = ML
    for etiqueta, we, nombre, wc in pares:
        # celda etiqueta (gris claro)
        c.setFillColor(GRIS_CLARO)
        c.setStrokeColor(GRIS)
        c.setLineWidth(0.5)
        c.rect(x, y - h, we, h, stroke=1, fill=1)
        c.setFillColor(NAVY2)
        c.setFont(POPB, 7.5)
        c.drawString(x + 4, y - h / 2 - 2.6, etiqueta)
        x += we
        # celda campo (blanca) con campo de formulario invisible encima
        c.setFillColor(HexColor("#FFFFFF"))
        c.rect(x, y - h, wc, h, stroke=1, fill=1)
        c.acroForm.textfield(
            name=nombre, tooltip=etiqueta, x=x + 1.5, y=y - h + 1.5,
            width=wc - 3, height=h - 3, fontName=FCAMPO, fontSize=8.5,
            borderWidth=0, fillColor=None, textColor=TEXTO, forceBorder=False,
        )
        x += wc
    return y - h

def caja(c, y, alto):
    c.setFillColor(GRIS_CLARO)
    c.setStrokeColor(GRIS)
    c.setLineWidth(0.5)
    c.rect(ML, y - alto, CW, alto, stroke=1, fill=1)
    return y - alto

def check(c, x, y, nombre, etiqueta, tooltip="", sep=16):
    c.acroForm.checkbox(
        name=nombre, tooltip=tooltip or etiqueta, x=x, y=y - 1, size=9,
        buttonStyle="check", borderColor=TURQ, borderWidth=1,
        fillColor=None, textColor=NAVY2, forceBorder=True,
    )
    c.setFillColor(TEXTO)
    c.setFont(POP, 10)
    c.drawString(x + 13, y, etiqueta)
    return x + 13 + pdfmetrics.stringWidth(etiqueta, POP, 10) + sep

def wrap(c, texto, fuente, tam, ancho):
    palabras, lineas, actual = texto.split(), [], ""
    for p in palabras:
        prueba = (actual + " " + p).strip()
        if pdfmetrics.stringWidth(prueba, fuente, tam) <= ancho:
            actual = prueba
        else:
            lineas.append(actual)
            actual = p
    if actual:
        lineas.append(actual)
    return lineas

# ---------------------------------------------------------------- documento
c = canvas.Canvas(SALIDA, pagesize=A4)
c.setTitle("FILANEX - Hoja de alta de cliente (rellenable)")
c.setAuthor("Filatecnica S.L.")

# ============================ PAGINA 1 ============================
header(c)
footer(c, 1)
y = PAGE_H - 42.5 - 54 - 14

# intro
c.setFillColor(SUAVE)
c.setFont(POP, 9.5)
c.drawString(ML, y, "Datos para dar de alta una nueva empresa en FILANEX. Rellénala en digital o a mano y devuélvela a")
y -= 13
c.setFillColor(NAVY)
c.setFont(POPB, 9.5)
c.drawString(ML, y, "info@filatecnica.com")

# 1 · EMPRESA
y = seccion(c, y, "1 ·", "Datos de la empresa")
y = fila(c, y, [("Nombre comercial", 87.5, "empresa.nombre_comercial", 147.5),
                ("Razón social", 70.0, "empresa.razon_social", 176.88)])
y = fila(c, y, [("CIF / NIF", 60.0, "empresa.cif", 95.0),
                ("Actividad / sector", 90.0, "empresa.actividad", 236.88)])
y = fila(c, y, [("Dirección", 62.5, "empresa.direccion", 419.38)])
y = fila(c, y, [("Código postal", 72.5, "empresa.cp", 62.5),
                ("Localidad", 62.5, "empresa.localidad", 284.38)])
y = fila(c, y, [("Provincia", 62.5, "empresa.provincia", 152.5),
                ("Teléfono", 60.0, "empresa.telefono", 206.88)])
y = fila(c, y, [("Email general", 70.0, "empresa.email", 152.5),
                ("Página web", 65.0, "empresa.web", 194.38)])

# 2 · CONTACTO
y = seccion(c, y, "2 ·", "Persona de contacto")
y = fila(c, y, [("Nombre y apellidos", 87.5, "contacto.nombre", 172.5),
                ("Cargo", 45.0, "contacto.cargo", 176.88)])
y = fila(c, y, [("Teléfono directo", 77.5, "contacto.telefono", 110.0),
                ("Email", 42.5, "contacto.email", 251.88)])

# 3 · MODULOS
y = seccion(c, y, "3 ·", "Módulos contratados")
y = caja(c, y, 46)
x = ML + 8
for nom, et in [("mod.facturacion", "Facturación"), ("mod.taller", "Taller"),
                ("mod.tpv", "TPV"), ("mod.asesoria", "Asesoría"),
                ("mod.telefonia", "Telefonía"), ("mod.nexo", "Agente IA Nexo")]:
    x = check(c, x, y + 28, nom, et)
c.setFillColor(NOTA)
c.setFont(POP, 8)
c.drawString(ML + 8, y + 8, "Observaciones sobre módulos:")
c.acroForm.textfield(
    name="mod.observaciones", tooltip="Observaciones sobre módulos",
    x=ML + 122, y=y + 5, width=CW - 130, height=12,
    fontName=FCAMPO, fontSize=8.5, borderWidth=0, fillColor=None,
    textColor=TEXTO, forceBorder=False,
)
y -= 4

# 4 · PLAN
y = seccion(c, y, "4 ·", "Plan y condiciones")
y = caja(c, y, 100)
c.setFillColor(NAVY2)
c.setFont(POPB, 10)
c.drawString(ML + 8, y + 82, "Plan:")
x = ML + 42
for nom, et in [("plan.basico", "Básico"), ("plan.profesional", "Profesional"), ("plan.medida", "A medida")]:
    x = check(c, x, y + 82, nom, et)
x += 16
c.setFillColor(NAVY2)
c.setFont(POPB, 10)
c.drawString(x, y + 82, "Cuota:")
c.acroForm.textfield(
    name="plan.cuota", tooltip="Cuota mensual", x=x + 40, y=y + 79,
    width=42, height=13, fontName=FCAMPO, fontSize=8.5,
    borderWidth=0.5, borderColor=GRIS, fillColor=None, textColor=TEXTO, forceBorder=True,
)
c.setFillColor(NAVY2)
c.drawString(x + 88, y + 82, "€/mes")

c.setFillColor(NAVY2)
c.setFont(POPB, 10)
c.drawString(ML + 8, y + 62, "Oferta primer año:")
c.setFillColor(TURQ)
c.setFont(POPB, 10)
c.drawString(ML + 108, y + 62, "250 €")

c.setFillColor(NAVY2)
c.setFont(POPB, 10)
c.drawString(ML + 8, y + 44, "Forma de pago:")
x = ML + 92
x = check(c, x, y + 44, "pago.domiciliacion", "Domiciliación (rellena el IBAN de abajo)")
x = check(c, x + 6, y + 44, "pago.transferencia", "Transferencia")

c.setFillColor(SUAVE)
c.setFont(POP, 8.5)
w_pre = pdfmetrics.stringWidth("Si eliges transferencia, hazla a:", POP, 8.5)
c.drawString(ML + 8, y + 26, "Si eliges transferencia, hazla a:")
c.setFillColor(NAVY)
c.setFont(POPB, 8.5)
c.drawString(ML + 14 + w_pre, y + 26, "ES21 0049 2388 1725 1480 1871")
c.setFillColor(SUAVE)
c.setFont(POP, 8.5)
c.drawString(ML + 8, y + 12, "indicando el nombre de tu empresa en el concepto.")
y -= 4

y = fila(c, y, [("IBAN (si domicilia)", 90.0, "pago.iban", 391.88)])
y = fila(c, y, [("Titular de la cuenta", 95.0, "pago.titular", 185.0),
                ("Fecha de inicio", 75.0, "pago.fecha_inicio", 126.88)])

# 5 · MIGRACION
y = seccion(c, y, "5 ·", "Programa actual y datos a migrar")
y = fila(c, y, [("Programa que usa ahora", 117.5, "migracion.programa", 364.38)])
y -= 6
y = caja(c, y, 46)
c.setFillColor(NAVY2)
c.setFont(POPB, 10)
c.drawString(ML + 8, y + 30, "Datos que quiere traer:")
x = ML + 8
for nom, et in [("migra.clientes", "Clientes"), ("migra.proveedores", "Proveedores"),
                ("migra.articulos", "Artículos"), ("migra.facturas", "Facturas"),
                ("migra.stock", "Stock"), ("migra.vehiculos", "Vehículos"),
                ("migra.ninguno", "Ninguno")]:
    x = check(c, x, y + 10, nom, et, sep=8)

c.showPage()

# ============================ PAGINA 2 ============================
header(c)
footer(c, 2)
y = PAGE_H - 42.5 - 54 - 14

# 6 · ACCESO
y = seccion(c, y, "6 ·", "Acceso al programa")
y = fila(c, y, [("Usuario administrador", 100.0, "acceso.usuario", 147.5),
                ("Email de acceso", 77.5, "acceso.email", 156.88)])
y = fila(c, y, [("Nº de usuarios", 75.0, "acceso.usuarios", 60.0),
                ("Puestos / dispositivos", 97.5, "acceso.puestos", 249.38)])
y -= 14
c.setFillColor(NOTA)
c.setFont(POP, 8)
c.drawString(ML, y, "La contraseña inicial y la dirección de acceso se envían por email al activar el alta.")

# 7 · RGPD Y FIRMA
y = seccion(c, y, "7 ·", "Protección de datos y firma")
texto_rgpd = ("Los datos facilitados se tratan por Filatecnica S.L. con la única finalidad de gestionar el alta y la "
              "prestación del servicio FILANEX, conforme al RGPD (UE) 2016/679. No se ceden a terceros. Puedes ejercer "
              "tus derechos de acceso, rectificación, supresión y portabilidad escribiendo a info@filatecnica.com.")
c.setFillColor(SUAVE)
c.setFont(POP, 8)
for linea in wrap(c, texto_rgpd, POP, 8, CW):
    c.drawString(ML, y, linea)
    y -= 11
y -= 22
c.setFillColor(TEXTO)
c.setFont(POP, 8)
c.drawString(ML, y, "En ____________ a ___ de ________ de 20___")
c.drawRightString(ML + CW, y, "Firmado:")
y -= 42
c.setStrokeColor(HexColor("#94A3B8"))
c.setLineWidth(0.6)
c.line(ML + CW - 190, y, ML + CW, y)

# USO INTERNO
y -= 34
c.setFillColor(NAVY)
c.setFont(POPB, 10)
c.drawString(ML, y, "PARA USO INTERNO DE FILANEX")
y -= 5
c.setStrokeColor(NAVY)
c.setLineWidth(1.4)
c.line(ML, y, ML + CW, y)
y -= 10
y = fila(c, y, [("Slug asignado", 72.5, "interno.slug", 130.0),
                ("Fecha de alta", 67.5, "interno.fecha_alta", 211.88)])
y = fila(c, y, [("Licencia / plan creado", 100.0, "interno.licencia", 102.5),
                ("Alta confirmada por", 92.5, "interno.confirmado_por", 186.88)])

c.save()
print("OK", SALIDA)

# verificacion: listar campos del formulario
from pypdf import PdfReader
r = PdfReader(SALIDA)
campos = r.get_fields() or {}
print(f"Campos rellenables: {len(campos)}")
for n in sorted(campos):
    print(" -", n)
