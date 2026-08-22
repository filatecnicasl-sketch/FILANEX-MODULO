"""
pdf_a_imagen.py
===============
Convierte PDFs a imágenes de forma masiva respetando el nombre del archivo.

Uso:
    python pdf_a_imagen.py                        # procesa ./pdfs/ → ./imagenes/
    python pdf_a_imagen.py --entrada mis_pdfs     # carpeta personalizada
    python pdf_a_imagen.py --formato jpg --dpi 150
    python pdf_a_imagen.py --pagina-unica         # PDFs de 1 página → sin sufijo _pag1

Estructura de salida:
    Si el PDF tiene 1 página  → nombre_archivo.png
    Si el PDF tiene N páginas → nombre_archivo_pag1.png, nombre_archivo_pag2.png, ...
"""

import argparse
import sys
from pathlib import Path

try:
    import fitz  # pymupdf
except ImportError:
    sys.exit("❌  Instala pymupdf:  pip install pymupdf")


# ──────────────────────────────────────────────
#  Convertir un único PDF
# ──────────────────────────────────────────────
def convertir_pdf(pdf_path: Path, salida_dir: Path, dpi: int, fmt: str, pagina_unica: bool):
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"  ⚠️  Error al abrir {pdf_path.name}: {e}")
        return 0

    total = len(doc)
    nombre_base = pdf_path.stem          # nombre sin extensión
    ext = fmt.lower()
    convertidas = 0

    for i, page in enumerate(doc):
        mat = fitz.Matrix(dpi / 72, dpi / 72)   # factor de escala respecto a 72 dpi base
        pix = page.get_pixmap(matrix=mat, alpha=False)

        # Nombre del archivo de salida
        if total == 1 and pagina_unica:
            nombre_img = f"{nombre_base}.{ext}"
        else:
            nombre_img = f"{nombre_base}_pag{i + 1}.{ext}"

        dest = salida_dir / nombre_img
        pix.save(str(dest))
        convertidas += 1

    doc.close()
    return convertidas


# ──────────────────────────────────────────────
#  Proceso masivo
# ──────────────────────────────────────────────
def procesar_carpeta(entrada: Path, salida: Path, dpi: int, fmt: str, pagina_unica: bool):
    pdfs = sorted(entrada.glob("*.pdf"))

    if not pdfs:
        print(f"⚠️  No se encontraron archivos PDF en: {entrada}")
        return

    salida.mkdir(parents=True, exist_ok=True)
    print(f"\n📂  Entrada : {entrada.resolve()}")
    print(f"🖼️   Salida  : {salida.resolve()}")
    print(f"⚙️   DPI={dpi}  Formato={fmt.upper()}  Archivos={len(pdfs)}\n")

    total_imgs = 0
    for pdf in pdfs:
        print(f"  ▶  {pdf.name}", end=" ... ", flush=True)
        n = convertir_pdf(pdf, salida, dpi, fmt, pagina_unica)
        print(f"{n} imagen{'es' if n != 1 else ''} generada{'s' if n != 1 else ''}")
        total_imgs += n

    print(f"\n✅  Proceso completado: {len(pdfs)} PDF(s) → {total_imgs} imagen(es)")


# ──────────────────────────────────────────────
#  CLI
# ──────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Convierte PDFs a imágenes de forma masiva respetando el nombre del archivo."
    )
    parser.add_argument("--entrada",      default="pdfs",       help="Carpeta con los PDFs (default: ./pdfs)")
    parser.add_argument("--salida",       default="imagenes",   help="Carpeta de salida (default: ./imagenes)")
    parser.add_argument("--dpi",          type=int, default=300, help="Resolución en DPI (default: 300)")
    parser.add_argument("--formato",      default="png",        choices=["png", "jpg", "jpeg", "webp"],
                        help="Formato de imagen (default: png)")
    parser.add_argument("--pagina-unica", action="store_true",
                        help="PDFs de 1 página se guardan sin sufijo _pag1")

    args = parser.parse_args()

    entrada = Path(args.entrada)
    salida  = Path(args.salida)

    if not entrada.exists():
        sys.exit(f"❌  La carpeta de entrada no existe: {entrada.resolve()}")

    procesar_carpeta(entrada, salida, args.dpi, args.formato, args.pagina_unica)


if __name__ == "__main__":
    main()
