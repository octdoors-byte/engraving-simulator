export async function prepareEngraveLogoBlob(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if ("close" in bitmap) {
      bitmap.close();
    }
    return blob;
  }
  ctx.drawImage(bitmap, 0, 0);
  if ("close" in bitmap) {
    bitmap.close();
  }
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const samplePoints = [
    [0, 0],
    [canvas.width - 1, 0],
    [0, canvas.height - 1],
    [canvas.width - 1, canvas.height - 1]
  ];
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;
  for (const [sx, sy] of samplePoints) {
    const idx = (sy * canvas.width + sx) * 4;
    const a = data[idx + 3];
    if (a === 0) continue;
    sumR += data[idx];
    sumG += data[idx + 1];
    sumB += data[idx + 2];
    count += 1;
  }
  const bg = count
    ? { r: Math.round(sumR / count), g: Math.round(sumG / count), b: Math.round(sumB / count) }
    : { r: 255, g: 255, b: 255 };
  const alphaThreshold = 8;
  const colorThreshold = 40;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a <= alphaThreshold) {
      data[i + 3] = 0;
      continue;
    }
    const dist = Math.sqrt((r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2);
    if (dist < colorThreshold) {
      data[i + 3] = 0;
      continue;
    }
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (converted) => {
        if (converted) {
          resolve(converted);
        } else {
          reject(new Error("engrave logo conversion failed"));
        }
      },
      "image/png",
      0.95
    );
  });
}
