import type { DesignLogoSettings } from "../types";

interface ProcessLogoParams {
  crop: DesignLogoSettings["crop"];
  transparentColor: DesignLogoSettings["transparentColor"];
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

function applyTransparencyByColor(
  imageData: ImageData,
  transparentColor: DesignLogoSettings["transparentColor"]
): void {
  if (!transparentColor) return;
  const threshold = 36;
  const softRange = 14;
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const d = Math.sqrt(
      (r - transparentColor.r) ** 2 +
        (g - transparentColor.g) ** 2 +
        (b - transparentColor.b) ** 2
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
  const { crop, transparentColor, monochrome, maxOutputWidth, maxOutputHeight } = params;
  const sw = Math.round(crop.w * bitmap.width);
  const sh = Math.round(crop.h * bitmap.height);
  const sx = crop.x * bitmap.width;
  const sy = crop.y * bitmap.height;
  const canvas = document.createElement("canvas");
  const scaleX = maxOutputWidth ? Math.min(1, maxOutputWidth / sw) : 1;
  const scaleY = maxOutputHeight ? Math.min(1, maxOutputHeight / sh) : 1;
  const scale = Math.min(scaleX, scaleY);
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to create canvas context");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyTransparencyByColor(imageData, transparentColor);
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
