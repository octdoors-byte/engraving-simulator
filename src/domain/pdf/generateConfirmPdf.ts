import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { PDFPage } from "pdf-lib";
import type { Template, DesignPlacement } from "../types";
import { rotateImage90 } from "@/domain/image/rotateImage90";

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

async function rotateLogoByDegrees(blob: Blob, rotation: number): Promise<Blob> {
  const steps = rotation === 90 ? 1 : rotation === 180 ? 2 : rotation === 270 ? 3 : 0;
  let next = blob;
  for (let i = 0; i < steps; i += 1) {
    next = await rotateImage90(next);
  }
  return next;
}

function drawCornerMarks(
  page: PDFPage,
  rect: { x: number; y: number; width: number; height: number },
  style: { color: ReturnType<typeof rgb>; thickness: number; cornerLength: number }
) {
  // 線は中心が座標に乗るため、内側に寄せると「刻印範囲が狭く見える」。
  // ここでは刻印範囲が狭くならないよう、コーナー線は外側に張り出す（内側のエッジは rect に一致）。
  const { color, thickness, cornerLength } = style;
  const x0 = rect.x;
  const y0 = rect.y;
  const x1 = rect.x + rect.width;
  const y1 = rect.y + rect.height;
  const len = Math.max(1, Math.min(cornerLength, rect.width / 2, rect.height / 2));
  const half = Math.max(0, thickness / 2);

  // Bottom-left
  page.drawLine({ start: { x: x0, y: y0 - half }, end: { x: x0 + len, y: y0 - half }, color, thickness });
  page.drawLine({ start: { x: x0 - half, y: y0 }, end: { x: x0 - half, y: y0 + len }, color, thickness });

  // Bottom-right
  page.drawLine({ start: { x: x1, y: y0 - half }, end: { x: x1 - len, y: y0 - half }, color, thickness });
  page.drawLine({ start: { x: x1 + half, y: y0 }, end: { x: x1 + half, y: y0 + len }, color, thickness });

  // Top-left
  page.drawLine({ start: { x: x0, y: y1 + half }, end: { x: x0 + len, y: y1 + half }, color, thickness });
  page.drawLine({ start: { x: x0 - half, y: y1 }, end: { x: x0 - half, y: y1 - len }, color, thickness });

  // Top-right
  page.drawLine({
    start: { x: x1, y: y1 + half },
    end: { x: x1 - len, y: y1 + half },
    color,
    thickness
  });
  page.drawLine({
    start: { x: x1 + half, y: y1 },
    end: { x: x1 + half, y: y1 - len },
    color,
    thickness
  });
}

export async function generateConfirmPdf(
  template: Template,
  bgBlob: Blob | null,
  logoBlob: Blob | null,
  placement: DesignPlacement,
  designId: string
): Promise<Blob> {
  try {
    const mmPerPx = 25.4 / template.pdf.dpi;
    const formatMm = (value: number) => `${Math.round(value * 10) / 10}mm`;
    const placementMm = {
      x: placement.x * mmPerPx,
      y: placement.y * mmPerPx,
      w: placement.w * mmPerPx,
      h: placement.h * mmPerPx
    };
    const pdfDoc = await PDFDocument.create();
    const { width, height } = getPageDimensions(template);
    const page = pdfDoc.addPage([width, height]);
    const canvasWidth = template.background.canvasWidthPx;
    const canvasHeight = template.background.canvasHeightPx;
    const scale = Math.min(width / canvasWidth, height / canvasHeight);
    const drawWidth = canvasWidth * scale;
    const drawHeight = canvasHeight * scale;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;

    const background = await embedImage(pdfDoc, bgBlob);
    if (background) {
      const bgScale = Math.min(canvasWidth / background.width, canvasHeight / background.height);
      const bgDrawWidth = background.width * bgScale;
      const bgDrawHeight = background.height * bgScale;
      const bgOffsetX = (canvasWidth - bgDrawWidth) / 2;
      const bgOffsetY = (canvasHeight - bgDrawHeight) / 2;
      page.drawImage(background, {
        x: offsetX + bgOffsetX * scale,
        y: offsetY + (canvasHeight - (bgOffsetY + bgDrawHeight)) * scale,
        width: bgDrawWidth * scale,
        height: bgDrawHeight * scale
      });
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
    const engravingRect = {
      x: offsetX + engravingArea.x * scale,
      y: offsetY + (canvasHeight - (engravingArea.y + engravingArea.h)) * scale,
      width: engravingArea.w * scale,
      height: engravingArea.h * scale
    };

    if (logoBlob) {
      const rotation = placement.rotationDeg ?? 0;
      const sourceBlob = rotation ? await rotateLogoByDegrees(logoBlob, rotation) : logoBlob;
      const logoImage = await embedImage(pdfDoc, sourceBlob);
      if (logoImage) {
        page.drawImage(logoImage, {
          x: offsetX + placement.x * scale,
          y: offsetY + (canvasHeight - (placement.y + placement.h)) * scale,
          width: placement.w * scale,
          height: placement.h * scale
        });
      }
    }

    // 画像が線の上に“乗って見える”のを防ぐため、コーナーマークは最後に描画して常に最前面にします。
    drawCornerMarks(page, engravingRect, {
      color: rgb(0.1, 0.4, 0.9),
      thickness: 1,
      cornerLength: Math.min(14, Math.min(engravingRect.width, engravingRect.height) * 0.25)
    });

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const margin = 24;
    page.drawText(
      `Pos(mm): x=${formatMm(placementMm.x)} y=${formatMm(placementMm.y)} / Size(mm): w=${formatMm(
        placementMm.w
      )} h=${formatMm(placementMm.h)}`,
      {
        x: margin,
        y: margin + 12,
        size: 8,
        font,
        color: rgb(0.1, 0.1, 0.1)
      }
    );
    page.drawText(designId, {
      x: margin,
      y: margin,
      size: 8,
      font,
      color: rgb(0.1, 0.1, 0.1)
    });

    const bytes = await pdfDoc.save();
    return new Blob([bytes as BlobPart], { type: "application/pdf" });
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error("generateConfirmPdf failed", message, error);
    throw error;
  }
}
