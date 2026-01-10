import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dropzone } from "@/components/sim/Dropzone";
import { sampleTemplate } from "@/data/sampleTemplate";
import { generateDesignId } from "@/domain/id/designId";
import { processLogo } from "@/domain/image/processLogo";
import { generateConfirmPdf } from "@/domain/pdf/generateConfirmPdf";
import { generateEngravePdf } from "@/domain/pdf/generateEngravePdf";
import type { DesignPlacement, DesignLogoSettings } from "@/domain/types";
import { saveDesign, listDesigns, saveTemplate } from "@/storage/local";
import { AssetType, saveAsset } from "@/storage/idb";

type SimPhase =
  | "EMPTY"
  | "UPLOADED"
  | "EDITING"
  | "PLACEMENT"
  | "READY_TO_ISSUE"
  | "ISSUING"
  | "ISSUED"
  | "ERROR";

const basePlacement = (() => {
  const area = sampleTemplate.engravingArea;
  const width = area.w * 0.9;
  const height = area.h * 0.9;
  return {
    x: area.x + (area.w - width) / 2,
    y: area.y + (area.h - height) / 2,
    w: width,
    h: height
  };
})();

function downloadBlob(blob: Blob, fileName: string) {
  const id = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = id;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(id);
}

type StagePreviewProps = {
  template: typeof sampleTemplate;
  crop: DesignLogoSettings["crop"];
  placement: DesignPlacement;
  bitmap: ImageBitmap | null;
};

function StagePreview({ template, crop, placement, bitmap }: StagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = Math.min(
      360 / template.background.canvasWidthPx,
      420 / template.background.canvasHeightPx
    );
    const viewWidth = template.background.canvasWidthPx * scale;
    const viewHeight = template.background.canvasHeightPx * scale;
    canvas.width = viewWidth;
    canvas.height = viewHeight;

    const drawCanvas = (background: HTMLImageElement) => {
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      ctx.drawImage(background, 0, 0, viewWidth, viewHeight);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#f97316";
      ctx.strokeRect(
        crop.x * viewWidth,
        crop.y * viewHeight,
        crop.w * viewWidth,
        crop.h * viewHeight
      );
      ctx.strokeStyle = "#0ea5e9";
      ctx.strokeRect(
        placement.x * scale,
        placement.y * scale,
        placement.w * scale,
        placement.h * scale
      );
      if (bitmap) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.drawImage(
          bitmap,
          crop.x * bitmap.width,
          crop.y * bitmap.height,
          crop.w * bitmap.width,
          crop.h * bitmap.height,
          placement.x * scale,
          placement.y * scale,
          placement.w * scale,
          placement.h * scale
        );
        ctx.restore();
      }
    };

    const bg = new Image();
    bg.onload = () => drawCanvas(bg);
    bg.onerror = () => {
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(0, 0, viewWidth, viewHeight);
      ctx.fillStyle = "#64748b";
      ctx.fillText("背景画像を読み込めません", 20, 30);
    };
    bg.src = `/assets/${template.background.fileName}`;
  }, [template, crop, placement, bitmap]);

  return <canvas ref={canvasRef} className="w-full rounded-2xl border border-slate-200 shadow-sm" />;
}

export function SimPage() {
  const [phase, setPhase] = useState<SimPhase>("EMPTY");
  const [toast, setToast] = useState<string | null>(null);
  const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<DesignLogoSettings["crop"]>({ x: 0, y: 0, w: 1, h: 1 });
  const [placement, setPlacement] = useState<DesignPlacement>(basePlacement);
  const [transparentLevel, setTransparentLevel] = useState<DesignLogoSettings["transparentLevel"]>("medium");
  const [monochrome, setMonochrome] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issuedDesignId, setIssuedDesignId] = useState<string | null>(null);

  useEffect(() => {
    saveTemplate(sampleTemplate);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (imageBitmap && !isIssuing && phase !== "ISSUED") {
      setPhase("READY_TO_ISSUE");
    }
  }, [imageBitmap, isIssuing, phase]);

  const handleReject = useCallback((message: string) => {
    setToast(message);
  }, []);

  const handleCropChange = useCallback(
    (key: keyof DesignLogoSettings["crop"], value: number) => {
      setCrop((prev) => {
        const next = { ...prev, [key]: value };
        if (key === "w" && next.x + value > 1) {
          next.x = Math.max(0, 1 - value);
        }
        if (key === "h" && next.y + value > 1) {
          next.y = Math.max(0, 1 - value);
        }
        if (key === "x") {
          next.x = Math.min(value, 1 - next.w);
        }
        if (key === "y") {
          next.y = Math.min(value, 1 - next.h);
        }
        return next;
      });
    },
    []
  );

  const handleFileAccepted = useCallback(
    async (file: File) => {
      try {
        setPhase("UPLOADED");
        const bitmap = await createImageBitmap(file);
        setImageBitmap(bitmap);
        setUploadedFile(file);
        setCrop({ x: 0, y: 0, w: 1, h: 1 });
        setPlacement(basePlacement);
        setPhase("EDITING");
        setTimeout(() => setPhase("PLACEMENT"), 1200);
      } catch (error) {
        console.error(error);
        setToast("画像の読み込みに失敗しました");
        setPhase("ERROR");
      }
    },
    []
  );

  const handleIssue = useCallback(async () => {
    if (!imageBitmap || !uploadedFile) {
      setToast("先に画像をアップロードしてください");
      return;
    }
    setIsIssuing(true);
    setPhase("ISSUING");
    try {
      const existingIds = new Set(listDesigns().map((entry) => entry.designId));
      const designId = generateDesignId(existingIds);
      const createdAt = new Date().toISOString();
      const processedBlob = await processLogo(imageBitmap, {
        crop,
        transparentLevel,
        monochrome,
        maxOutputWidth: Math.round(placement.w),
        maxOutputHeight: Math.round(placement.h)
      });
      const backgroundResponse = await fetch(`/assets/${sampleTemplate.background.fileName}`);
      const backgroundBlob = backgroundResponse.ok ? await backgroundResponse.blob() : null;
      const confirmPdf = await generateConfirmPdf(
        sampleTemplate,
        backgroundBlob,
        processedBlob,
        placement,
        designId
      );
      const engravePdf = await generateEngravePdf(sampleTemplate, processedBlob, placement, {
        designId,
        createdAt
      });
      const assetsWithDate = [
        { id: `asset:logoOriginal:${designId}`, type: "logoOriginal" as AssetType, blob: uploadedFile, createdAt },
        { id: `asset:logoEdited:${designId}`, type: "logoEdited" as AssetType, blob: processedBlob, createdAt },
        { id: `asset:pdfConfirm:${designId}`, type: "pdfConfirm" as AssetType, blob: confirmPdf, createdAt },
        { id: `asset:pdfEngrave:${designId}`, type: "pdfEngrave" as AssetType, blob: engravePdf, createdAt }
      ];
      await Promise.all(assetsWithDate.map((asset) => saveAsset(asset)));
      await saveDesign({
        designId,
        templateKey: sampleTemplate.templateKey,
        createdAt,
        logo: {
          fileName: uploadedFile.name,
          mimeType: uploadedFile.type,
          sizeBytes: uploadedFile.size,
          crop,
          transparentLevel,
          monochrome
        },
        placement,
        pdf: {
          confirmAssetId: `asset:pdfConfirm:${designId}`,
          engraveAssetId: `asset:pdfEngrave:${designId}`
        }
      });
      downloadBlob(confirmPdf, `${designId}-confirm.pdf`);
      setToast("PDF確認用をダウンロードしました");
      setPhase("ISSUED");
      setIssuedDesignId(designId);
    } catch (error) {
      console.error(error);
      setToast("発行中にエラーが発生しました");
      setPhase("ERROR");
    } finally {
      setIsIssuing(false);
    }
  }, [imageBitmap, uploadedFile, crop, placement, transparentLevel, monochrome]);

  const cropInputs = useMemo(
    () => [
      { label: "横の位置", key: "x" as const, min: 0, max: 0.9 },
      { label: "縦の位置", key: "y" as const, min: 0, max: 0.9 },
      { label: "横の大きさ", key: "w" as const, min: 0.2, max: 1 },
      { label: "縦の大きさ", key: "h" as const, min: 0.2, max: 1 }
    ],
    []
  );

  return (
    <section className="space-y-6">
      {toast && (
        <div className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow">
          {toast}
        </div>
      )}
      <header className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            お客様画面
          </span>
          <p className="text-xs text-slate-400">管理ID: {sampleTemplate.templateKey}</p>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">デザインシミュレーター</h1>
        <p className="text-sm text-slate-500">
          ロゴを読み込んで、切り取りを調整し、デザインIDを発行します。
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-600">操作の3ステップ</p>
            <ol className="mt-2 space-y-1 text-sm text-slate-600">
              <li>1. ロゴをアップロード</li>
              <li>2. 切り取りを調整</li>
              <li>3. デザインIDを発行</li>
            </ol>
          </div>

          <Dropzone onFileAccepted={handleFileAccepted} onReject={handleReject} disabled={isIssuing} />

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-600">切り取り調整</p>
            <div
              className={`space-y-4 text-sm text-slate-500 ${!imageBitmap ? "opacity-50" : ""}`}
              aria-disabled={!imageBitmap}
            >
              {cropInputs.map((field) => (
                <div key={field.key} className="space-y-1">
                  <div className="flex items-center justify-between font-medium text-slate-600">
                    <span>{field.label}</span>
                    <span>{crop[field.key].toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={field.min}
                    max={field.max}
                    step={0.01}
                    value={crop[field.key]}
                    disabled={!imageBitmap}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      handleCropChange(field.key, value);
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">ロゴをアップロードすると調整できます。</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-600">配置</p>
            <p className="text-xs text-slate-500">位置は自動で中央に合わせています。</p>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-900 px-4 py-4 text-center text-white">
            <p className="text-sm font-semibold">デザインID発行（PDF保存）</p>
            <button
              type="button"
              className="w-full rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow"
              disabled={!imageBitmap || isIssuing}
              onClick={handleIssue}
            >
              {isIssuing ? "発行中..." : "デザインIDを発行する"}
            </button>
            <div className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-left">
              <p className="text-xs text-slate-300">デザインID</p>
              {issuedDesignId ? (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={issuedDesignId}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                  />
                  <button
                    type="button"
                    className="rounded-full border border-slate-500 px-2 py-1 text-xs text-slate-200"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(issuedDesignId);
                        setToast("デザインIDをコピーしました");
                      } catch (error) {
                        console.error(error);
                        setToast("コピーできませんでした");
                      }
                    }}
                  >
                    コピー
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-400">発行後に表示されます</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">見た目の確認</h2>
              <p className="text-xs text-slate-500">背景とロゴの見え方を確認できます。</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">倍率: 1.0x</span>
          </div>
          <div className="mt-4 h-[420px]">
            <StagePreview template={sampleTemplate} crop={crop} placement={placement} bitmap={imageBitmap} />
          </div>
        </div>
      </div>
    </section>
  );
}
