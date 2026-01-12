import type { Design, DesignLogoSettings, DesignPlacement, Template } from "@/domain/types";
import { processLogo } from "@/domain/image/processLogo";
import { generateConfirmPdf } from "@/domain/pdf/generateConfirmPdf";
import { generateEngravePdf } from "@/domain/pdf/generateEngravePdf";
import {
  getTemplate,
  loadCommonSettings,
  listDesigns,
  listTemplates,
  saveCommonSettings,
  saveDesign,
  saveTemplate
} from "@/storage/local";
import { getAssetById, saveAsset } from "@/storage/idb";
import { saveTemplateBgFallback } from "@/storage/local";

const SEED_KEY = "ksim:seeded";
const STORAGE_PREFIX = "ksim:";
const DB_NAME = "ksim_db";

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

async function resetSeedStorage(): Promise<void> {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(STORAGE_PREFIX))
    .forEach((key) => localStorage.removeItem(key));
  await deleteDatabase(DB_NAME);
}

function createTemplateSet(): Template[] {
  return [
    {
      templateKey: "certificate_cover_a4_v1",
      name: "証書カバー A4 右下刻印",
      status: "published",
      updatedAt: "2026-01-09T10:00:00.000+09:00",
      background: {
        fileName: "certificate-cover-a4.png",
        canvasWidthPx: 1200,
        canvasHeightPx: 1600
      },
      engravingArea: {
        label: "右下刻印枠",
        x: 820,
        y: 1220,
        w: 280,
        h: 180
      },
      placementRules: {
        allowRotate: false,
        keepInsideEngravingArea: true,
        minScale: 0.1,
        maxScale: 6.0
      },
      logoSettings: {
        monochrome: false
      },
      pdf: {
        pageSize: "A4",
        orientation: "portrait",
        dpi: 300
      }
    },
    {
      templateKey: "certificate_cover_a4_left_v1",
      name: "証書カバー A4 左下刻印",
      status: "tested",
      updatedAt: "2026-01-09T10:30:00.000+09:00",
      background: {
        fileName: "certificate-cover-a4.png",
        canvasWidthPx: 1200,
        canvasHeightPx: 1600
      },
      engravingArea: {
        label: "左下刻印枠",
        x: 100,
        y: 1220,
        w: 280,
        h: 180
      },
      placementRules: {
        allowRotate: false,
        keepInsideEngravingArea: true,
        minScale: 0.1,
        maxScale: 6.0
      },
      logoSettings: {
        monochrome: true
      },
      pdf: {
        pageSize: "A4",
        orientation: "portrait",
        dpi: 300
      }
    }
  ];
}

function calculatePlacement(template: Template, logoSize: { width: number; height: number }): DesignPlacement {
  const area = template.engravingArea;
  const scale = Math.min((area.w * 0.9) / logoSize.width, (area.h * 0.9) / logoSize.height);
  const w = logoSize.width * scale;
  const h = logoSize.height * scale;
  return {
    x: area.x + (area.w - w) / 2,
    y: area.y + (area.h - h) / 2,
    w,
    h
  };
}

function createLogoCanvas(text: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 300;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111827";
  ctx.font = "bold 64px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  return canvas;
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to generate seed logo"));
      }
    }, "image/png");
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Invalid data URL"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

export async function seedIfEmpty(mode: "ifEmpty" | "always" = "ifEmpty"): Promise<void> {
  if (mode === "always") {
    await resetSeedStorage();
  } else if (localStorage.getItem(SEED_KEY)) {
    return;
  }
  const hasTemplates = listTemplates().length > 0;
  const hasDesigns = listDesigns().length > 0;
  const hasSettings = Boolean(loadCommonSettings());
  const hasUserData = hasTemplates || hasDesigns;

  try {
    if (mode === "ifEmpty" && hasUserData) {
      if (!hasSettings) {
        saveCommonSettings({
          headerText: "",
          footerText: "",
          landingTitle: "デザインシミュレーター",
          logoAlign: "left",
          headerTextAlign: "left",
          footerTextAlign: "center",
          logoSize: "md",
          headerTextSize: "md",
          footerTextSize: "md"
        });
      }
      localStorage.setItem(SEED_KEY, "1.1.0");
      return;
    }

    if (!hasTemplates) {
      const templates = createTemplateSet();
      const response = await fetch(`/assets/${templates[0].background.fileName}`);
      const bgBlob = response.ok ? await response.blob() : null;
      for (const template of templates) {
        saveTemplate(template);
        if (bgBlob) {
          try {
            await saveAsset({
              id: `asset:templateBg:${template.templateKey}`,
              type: "templateBg",
              blob: bgBlob,
              createdAt: new Date().toISOString()
            });
          } catch (error) {
            console.error(error);
            const dataUrl = await blobToDataUrl(bgBlob);
            saveTemplateBgFallback(template.templateKey, dataUrl);
          }
        }
      }
    }

    if (!hasSettings) {
      saveCommonSettings({
        headerText: "",
        footerText: "",
        landingTitle: "デザインシミュレーター",
        logoAlign: "left",
        headerTextAlign: "left",
        footerTextAlign: "center",
        logoSize: "md",
        headerTextSize: "md",
        footerTextSize: "md"
      });
    }

    if (!hasDesigns) {
      const templates = listTemplates();
      if (templates.length > 0) {
        const logoCanvas = createLogoCanvas("SAMPLE");
        const originalBlob = await canvasToBlob(logoCanvas);
        const bitmap = await createImageBitmap(originalBlob);
        const designSeeds: Array<{
          templateKey: string;
          designId: string;
          createdAt: string;
          transparentColor: DesignLogoSettings["transparentColor"];
        }> = [
          {
            templateKey: templates[0].templateKey,
            designId: "260109_TESTDATA",
            createdAt: "2026-01-09T11:12:34.000+09:00",
            transparentColor: null
          },
          ...(templates[1]
            ? [
                {
                  templateKey: templates[1].templateKey,
                  designId: "260109_EXAMDATA",
                  createdAt: "2026-01-09T12:04:10.000+09:00",
                  transparentColor: null
                }
              ]
            : [])
        ];

        for (const seed of designSeeds) {
          const fullTemplate = getTemplate(seed.templateKey);
          if (!fullTemplate) continue;
          const processedBlob = await processLogo(bitmap, {
            crop: { x: 0, y: 0, w: 1, h: 1 },
            transparentColor: seed.transparentColor,
            monochrome: fullTemplate.logoSettings?.monochrome ?? false,
            maxOutputWidth: 600,
            maxOutputHeight: 300
          });
          const logoBitmap = await createImageBitmap(processedBlob);
          const placement = calculatePlacement(fullTemplate, {
            width: logoBitmap.width,
            height: logoBitmap.height
          });
          const bgAsset = await getAssetById(`asset:templateBg:${fullTemplate.templateKey}`);
          const confirmPdf = await generateConfirmPdf(
            fullTemplate,
            bgAsset?.blob ?? null,
            processedBlob,
            placement,
            seed.designId
          );
          const engravePdf = await generateEngravePdf(fullTemplate, processedBlob, placement, {
            designId: seed.designId,
            createdAt: seed.createdAt
          });

          const assets = [
            { id: `asset:logoOriginal:${seed.designId}`, type: "logoOriginal" as const, blob: originalBlob },
            { id: `asset:logoEdited:${seed.designId}`, type: "logoEdited" as const, blob: processedBlob },
            { id: `asset:pdfConfirm:${seed.designId}`, type: "pdfConfirm" as const, blob: confirmPdf },
            { id: `asset:pdfEngrave:${seed.designId}`, type: "pdfEngrave" as const, blob: engravePdf }
          ];

          await Promise.all(
            assets.map((asset) =>
              saveAsset({
                id: asset.id,
                type: asset.type,
                blob: asset.blob,
                createdAt: seed.createdAt
              })
            )
          );

          const design: Design = {
            designId: seed.designId,
            templateKey: fullTemplate.templateKey,
            createdAt: seed.createdAt,
            logo: {
              fileName: "sample-logo.png",
              mimeType: "image/png",
              sizeBytes: originalBlob.size,
              crop: { x: 0, y: 0, w: 1, h: 1 },
              transparentColor: seed.transparentColor,
              monochrome: fullTemplate.logoSettings?.monochrome ?? false
            },
            placement,
            pdf: {
              confirmAssetId: `asset:pdfConfirm:${seed.designId}`,
              engraveAssetId: `asset:pdfEngrave:${seed.designId}`
            }
          };
          saveDesign(design);
        }
      }
    }

    localStorage.setItem(SEED_KEY, "1.1.0");
  } catch (error) {
    console.error("seed failed", error);
  }
}
