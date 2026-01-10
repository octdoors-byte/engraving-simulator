import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { Template, DesignPlacement } from "../types";

function getPageDimensions(template: Template) {
  const { pageSize, orientation } = template.pdf;
  const base = pageSize === "A4" ? [595.28, 841.89] : [595.28, 841.89];
  if (orientation === "portrait") {
    return { width: base[0], height: base[1] };
  }
  return { width: base[1], height: base[0] };
}

async function embedImage(pdfDoc: PDFDocument, blob: Blob | null) {
  if (!blob) return null;
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  try {
    return await pdfDoc.embedPng(buffer);
  } catch {
    return await pdfDoc.embedJpg(buffer);
  }
}

export async function generateConfirmPdf(
  template: Template,
  bgBlob: Blob | null,
  logoBlob: Blob | null,
  placement: DesignPlacement,
  designId: string
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const { width, height } = getPageDimensions(template);
  const page = pdfDoc.addPage([width, height]);
  const viewScaleX = width / template.background.canvasWidthPx;
  const viewScaleY = height / template.background.canvasHeightPx;

  const background = await embedImage(pdfDoc, bgBlob);
  if (background) {
    page.drawImage(background, { x: 0, y: 0, width, height });
  } else {
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1)
    });
  }

  const engravingArea = template.engravingArea;
  page.drawRectangle({
    x: engravingArea.x * viewScaleX,
    y: height - (engravingArea.y + engravingArea.h) * viewScaleY,
    width: engravingArea.w * viewScaleX,
    height: engravingArea.h * viewScaleY,
    borderColor: rgb(0.1, 0.4, 0.9),
    borderWidth: 1,
    opacity: 0.4
  });

  if (logoBlob) {
    const logoImage = await embedImage(pdfDoc, logoBlob);
    if (logoImage) {
      page.drawImage(logoImage, {
        x: placement.x * viewScaleX,
        y: height - (placement.y + placement.h) * viewScaleY,
        width: placement.w * viewScaleX,
        height: placement.h * viewScaleY
      });
    }
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText(designId, {
    x: width - 200,
    y: 24,
    size: 8,
    font,
    color: rgb(0.1, 0.1, 0.1)
  });

  page.drawText(`Template: ${template.templateKey}`, {
    x: 24,
    y: 24,
    size: 8,
    font,
    color: rgb(0.1, 0.1, 0.1)
  });

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
