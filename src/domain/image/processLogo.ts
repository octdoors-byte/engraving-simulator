import type { DesignLogoSettings } from "../types";

interface ProcessLogoParams {
  crop: DesignLogoSettings["crop"];
  transparentLevel: DesignLogoSettings["transparentLevel"];
  monochrome: boolean;
  maxOutputWidth?: number;
  maxOutputHeight?: number;
}

function applyMonochrome(imageData: ImageData): void {
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const value = gray >= 160 ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = value;
  }
}

function sampleBackgroundColor(imageData: ImageData): [number, number, number] {
  const { width, height, data } = imageData;
  const points: [number, number][] = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1]
  ];
  const accum = points.reduce(
    (acc, [x, y]) => {
      const offset = (y * width + x) * 4;
      acc[0] += data[offset];
      acc[1] += data[offset + 1];
      acc[2] += data[offset + 2];
      return acc;
    },
    [0, 0, 0]
  );
  return [accum[0] / points.length, accum[1] / points.length, accum[2] / points.length];
}

function applyTransparency(imageData: ImageData, level: DesignLogoSettings["transparentLevel"]): void {
  const thresholds = {
    weak: 24,
    medium: 40,
    strong: 64
  };
  const threshold = thresholds[level];
  const softRange = 12;
  const bgColor = sampleBackgroundColor(imageData);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const d = Math.sqrt(
      (r - bgColor[0]) ** 2 + (g - bgColor[1]) ** 2 + (b - bgColor[2]) ** 2
    );
    if (d < threshold) {
      data[i + 3] = 0;
    } else if (d < threshold + softRange) {
      const ratio = (d - threshold) / softRange;
      data[i + 3] = Math.round(data[i + 3] * ratio);
    }
  }
}

export async function processLogo(bitmap: ImageBitmap, params: ProcessLogoParams): Promise<Blob> {
  const { crop, transparentLevel, monochrome, maxOutputWidth, maxOutputHeight } = params;
  const sw = Math.round(crop.w * bitmap.width);
  const sh = Math.round(crop.h * bitmap.height);
  const sx = crop.x * bitmap.width;
  const sy = crop.y * bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = maxOutputWidth && sw > maxOutputWidth ? maxOutputWidth : sw;
  canvas.height = maxOutputHeight && sh > maxOutputHeight ? maxOutputHeight : sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to create canvas context");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (transparentLevel) {
    applyTransparency(imageData, transparentLevel);
  }
  if (monochrome) {
    applyMonochrome(imageData);
  }
  ctx.putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to export logo"));
        }
      },
      "image/png",
      0.95
    );
  });
}
