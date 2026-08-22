import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { fechaDDMMYYYY } from "./verifactu.js";

// PDF de factura de venta. Si la factura está emitida incluye el QR
// tributario VeriFactu (obligatorio en la factura impresa/entregada).
export async function generarPdfFactura({ empresa, factura, cliente }) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const terminado = new Promise((resolve) => doc.on("end", resolve));

  const esBorrador = factura.estado === "borrador";

  // Cabecera: emisor
  doc.fontSize(18).font("Helvetica-Bold").text(empresa.nombre ?? "");
  doc.fontSize(9).font("Helvetica").text(`NIF: ${empresa.nif ?? ""}`);
  const dir = empresa.direccion ?? {};
  if (dir.calle) doc.text(`${dir.calle} · ${dir.cp ?? ""} ${dir.ciudad ?? ""}`.trim());

  // Datos de la factura (derecha)
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .text(esBorrador ? "FACTURA (BORRADOR)" : `FACTURA Nº ${factura.serieNumero}`, 350, 50, { width: 195, align: "right" });
  doc
    .fontSize(9)
    .font("Helvetica")
    .text(`Fecha: ${fechaDDMMYYYY(factura.fechaExpedicion)}`, 350, 72, { width: 195, align: "right" });

  // Cliente
  doc.moveDown(2);
  doc.fontSize(10).font("Helvetica-Bold").text("Facturar a:", 50, 130);
  doc.font("Helvetica").fontSize(10);
  doc.text(cliente?.nombre ?? "");
  if (cliente?.nif) doc.text(`NIF: ${cliente.nif}`);

  // Tabla de líneas
  const top = 200;
  doc.font("Helvetica-Bold").fontSize(9);
  doc.text("Descripción", 50, top);
  doc.text("Uds.", 330, top, { width: 45, align: "right" });
  doc.text("Precio", 380, top, { width: 60, align: "right" });
  doc.text("IVA", 445, top, { width: 40, align: "right" });
  doc.text("Importe", 490, top, { width: 55, align: "right" });
  doc.moveTo(50, top + 14).lineTo(545, top + 14).strokeColor("#cccccc").stroke();

  let y = top + 22;
  doc.font("Helvetica").fontSize(9);
  for (const l of factura.lineas ?? []) {
    const importe = (l.cantidad ?? 0) * (l.precioUnitario ?? 0);
    doc.text(l.descripcion, 50, y, { width: 275 });
    doc.text(String(l.cantidad), 330, y, { width: 45, align: "right" });
    doc.text((l.precioUnitario ?? 0).toFixed(2), 380, y, { width: 60, align: "right" });
    doc.text(`${l.iva ?? 0}%`, 445, y, { width: 40, align: "right" });
    doc.text(importe.toFixed(2), 490, y, { width: 55, align: "right" });
    y += 16;
  }

  // Totales
  y += 10;
  doc.moveTo(350, y).lineTo(545, y).strokeColor("#cccccc").stroke();
  y += 8;
  doc.font("Helvetica").text("Base imponible", 380, y, { width: 105, align: "right" });
  doc.text(`${(factura.baseImponible ?? 0).toFixed(2)} EUR`, 460, y, { width: 85, align: "right" });
  y += 14;
  doc.text("IVA", 380, y, { width: 105, align: "right" });
  doc.text(`${(factura.cuotaIva ?? 0).toFixed(2)} EUR`, 460, y, { width: 85, align: "right" });
  y += 16;
  doc.font("Helvetica-Bold").fontSize(11).text("TOTAL", 380, y, { width: 105, align: "right" });
  doc.text(`${(factura.total ?? 0).toFixed(2)} EUR`, 460, y, { width: 85, align: "right" });

  // QR tributario (solo facturas emitidas con registro VeriFactu)
  if (!esBorrador && factura.verifactu?.qrContenido) {
    const qrPng = await QRCode.toBuffer(factura.verifactu.qrContenido, {
      errorCorrectionLevel: "M",
      width: 200,
    });
    doc.image(qrPng, 50, 660, { width: 80 });
    doc
      .fontSize(7)
      .font("Helvetica")
      .text("QR tributario — Factura verificable en la sede electrónica de la AEAT", 140, 700, {
        width: 300,
      });
  }
  if (factura.estado === "anulada") {
    doc.fontSize(24).font("Helvetica-Bold").fillColor("red").text("ANULADA", 350, 400, { align: "right", width: 195 });
    doc.fillColor("black");
  }

  doc.end();
  await terminado;
  return Buffer.concat(chunks);
}
