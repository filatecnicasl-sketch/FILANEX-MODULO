import pdfplumber
import json

pdf_path = r"D:\Users\Francis\Desktop\ENVIO 2026\3º TRIMESTRE\RECIBIDAS\FILASUR\261F0001970-02714F_firmado.pdf"

with pdfplumber.open(pdf_path) as pdf:
    print(f"Total páginas: {len(pdf.pages)}")
    for i, page in enumerate(pdf.pages):
        print(f"\n=== PÁGINA {i+1} ===")
        text = page.extract_text()
        if text:
            print(text)
        else:
            print("(sin texto extraíble)")

        # Buscar retención / IRPF en tablas también
        tables = page.extract_tables()
        if tables:
            print(f"\n--- {len(tables)} tabla(s) encontrada(s) ---")
            for t_idx, table in enumerate(tables):
                print(f"Tabla {t_idx+1}:")
                for row in table:
                    print(" | ".join(str(cell) if cell else "" for cell in row))
