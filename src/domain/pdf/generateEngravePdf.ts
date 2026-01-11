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

export async function generateEngravePdf(
  template: Template,
  logoBlob: Blob | null,
  placement: DesignPlacement,
  meta: { designId: string; createdAt: string }
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const { width, height } = getPageDimensions(template);
  const page = pdfDoc.addPage([width, height]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(1, 1, 1)
  });

  const canvasWidth = template.background.canvasWidthPx;
  const canvasHeight = template.background.canvasHeightPx;
  const scale = Math.min(width / canvasWidth, height / canvasHeight);
  const drawWidth = canvasWidth * scale;
  const drawHeight = canvasHeight * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  const engravingArea = template.engravingArea;
  page.drawRectangle({
    x: offsetX + engravingArea.x * scale,
    y: offsetY + (canvasHeight - (engravingArea.y + engravingArea.h)) * scale,
    width: engravingArea.w * scale,
    height: engravingArea.h * scale,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1
  });

  if (logoBlob) {
    const logoImage = await embedImage(pdfDoc, logoBlob);
    if (logoImage) {
      page.drawImage(logoImage, {
        x: offsetX + placement.x * scale,
        y: offsetY + (canvasHeight - (placement.y + placement.h)) * scale,
        width: placement.w * scale,
        height: placement.h * scale
      });
    }
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const margin = 24;
  page.drawText(`Design ID: ${meta.designId}`, {
    x: margin,
    y: margin,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2)
  });
  page.drawText(`Template: ${template.templateKey}`, {
    x: margin,
    y: margin + 12,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2)
  });
  page.drawText(`Created at: ${meta.createdAt}`, {
    x: margin,
    y: margin + 24,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2)
  });

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
