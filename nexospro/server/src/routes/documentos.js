import { Router } from "express";
import QRCode from "qrcode";
import Formato from "../models/Formato.js";
import { datosParaPdf } from "../services/documentoPdfData.js";
import { formatoToHtml, expandirLineasEnCeldas, resolverPlantillaParaImpresion, pageDimensions } from "../services/formatoToHtml.js";
import { renderPdf } from "../services/pdfRenderer.js";
import { generarPdfFactura } from "../services/factura-pdf.js";
import FacturaVenta from "../models/FacturaVenta.js";
import Cliente from "../models/Cliente.js";
import Empresa from "../models/Empresa.js";

const router = Router();

const NOMBRE_FICHERO = {
  "factura-venta": "factura",
  "presupuesto-venta": "presupuesto",
  "albaran-venta": "albaran",
  "pedido-cliente": "pedido",
  "parte-taller": "parte-taller",
  "parte-sat": "parte-sat",
};

async function plantillaPorTipo(tipo) {
  return (
    (await Formato.findOne({ tipoDocumento: tipo, porDefecto: true }).lean()) ??
    (await Formato.findOne({ tipoDocumento: tipo }).sort({ createdAt: 1 }).lean())
  );
}

// Bloque de QR tributario VeriFactu. Se añade al HTML de la plantilla para
// que la factura entregada al cliente lleve siempre el QR obligatorio,
// aunque el usuario haya personalizado el diseño.
async function bloqueQrVerifactu(qrContenido) {
  const dataUri = await QRCode.toDataURL(qrContenido, { errorCorrectionLevel: "M", width: 300, margin: 0 });
  return `<div style="position:absolute;left:20mm;bottom:14mm;display:flex;align-items:center;gap:3mm;">
    <img src="${dataUri}" style="width:24mm;height:24mm;" alt="QR VeriFactu" />
    <div style="font-size:6.5pt;color:#444;max-width:80mm;line-height:1.3;">
      <strong>VERI*FACTU</strong><br>
      Factura verificable en la sede electrónica de la AEAT
    </div>
  </div>`;
}

// Genera PDF de un documento comercial usando la plantilla editable.
// Para facturas VeriFactu emitidas se añade el QR tributario obligatorio.
router.get("/:tipo/:id/pdf", async (req, res, next) => {
  try {
    const { tipo, id } = req.params;
    const plantilla = await plantillaPorTipo(tipo);

    // Sin plantilla editable, la factura cae al PDF clásico de PDFKit.
    if (!plantilla && tipo === "factura-venta") {
      const factura = await FacturaVenta.findById(id).populate("cliente").lean();
      if (!factura) return res.status(404).json({ error: "Factura no encontrada" });
      const empresa = await Empresa.findOne().lean();
      const buffer = await generarPdfFactura({ empresa, factura, cliente: factura.cliente });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="factura-${factura.serieNumero}.pdf"`);
      return res.send(buffer);
    }
    if (!plantilla) return res.status(404).json({ error: "No hay plantilla de impresión para este documento" });

    const { formData, logoUrl, firma, qrContenido } = await datosParaPdf(tipo, id);
    const signatures = firma?.imagen ? { cliente: firma.imagen } : {};

    let { html, css, pageSize, pageOrientation } = formatoToHtml(plantilla, formData, signatures, {
      logoUrl,
    });

    if (tipo === "factura-venta" && qrContenido) {
      html = html.replace(/<\/div>$/, `${await bloqueQrVerifactu(qrContenido)}</div>`);
    }

    const pdf = await renderPdf({ html, css, pageSize, pageOrientation });
    const numero = formData["documento.numero"] || id;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${NOMBRE_FICHERO[tipo]}-${numero}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

// Devuelve la plantilla y los datos del documento para la impresión rápida
// desde el navegador (sin generar PDF): es instantánea y no consume servidor.
router.get("/:tipo/:id/formato", async (req, res, next) => {
  try {
    const { tipo, id } = req.params;
    const plantilla = await plantillaPorTipo(tipo);
    if (!plantilla) return res.status(404).json({ error: "No hay plantilla de impresión para este documento" });

    const { formData, logoUrl, firma, qrContenido } = await datosParaPdf(tipo, id);
    const datos = expandirLineasEnCeldas(plantilla, formData);
    delete datos.lineas;

    const qr = qrContenido
      ? await QRCode.toDataURL(qrContenido, { errorCorrectionLevel: "M", width: 300, margin: 0 })
      : null;

    const resuelta = resolverPlantillaParaImpresion(plantilla, formData, logoUrl);
    if (qr) {
      // El QR tributario debe salir también en la impresión rápida.
      const { h } = pageDimensions(resuelta.page);
      resuelta.elements = [
        ...resuelta.elements,
        { id: "qr-verifactu", type: "image", x: 20, y: h - 38, w: 24, h: 24, src: qr },
        {
          id: "qr-verifactu-txt",
          type: "text",
          x: 46,
          y: h - 32,
          w: 80,
          h: 10,
          text: "VERI*FACTU\nFactura verificable en la sede electrónica de la AEAT",
          fontSize: 6.5,
          align: "left",
          color: "#444444",
        },
      ];
    }

    res.json({
      plantilla: resuelta,
      formData: datos,
      signatures: firma?.imagen ? { cliente: firma.imagen } : {},
    });
  } catch (err) {
    next(err);
  }
});

export default router;
