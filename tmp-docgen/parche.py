import re
src = open("gen-fillable-pdf.py", encoding="utf-8").read()
src = src.replace(
    'SALIDA = r"D:\\FILANEX\\hoja-alta-cliente-filanex-rellenable.pdf"',
    'SALIDA = r"C:\\FILANEX-MODULO\\tmp-docgen\\rellenable-nuevo.pdf"',
)
open("gen-tmp.py", "w", encoding="utf-8").write(src)
print("patched:", "rellenable-nuevo" in src)
