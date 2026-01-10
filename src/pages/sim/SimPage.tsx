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

const simPhaseLabels: Record<SimPhase, string> = {
  EMPTY: "未アップロード",
  UPLOADED: "画像読み込み済み",
  EDITING: "トリミング中",
  PLACEMENT: "配置調整中",
  READY_TO_ISSUE: "発行準備完了",
  ISSUING: "発行中",
  ISSUED: "発行済み",
  ERROR: "エラー"
};

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

const MIN_PLACEMENT_SIZE = 10;

function clampPlacement(next: DesignPlacement): DesignPlacement {
  const area = sampleTemplate.engravingArea;
  const width = Math.min(Math.max(next.w, MIN_PLACEMENT_SIZE), area.w);
  const height = Math.min(Math.max(next.h, MIN_PLACEMENT_SIZE), area.h);
  const maxX = area.x + area.w - width;
  const maxY = area.y + area.h - height;
  const x = Math.min(Math.max(next.x, area.x), maxX);
  const y = Math.min(Math.max(next.y, area.y), maxY);
  return { x, y, w: width, h: height };
}

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

  const phaseEntries = useMemo(
    () =>
      ([
        "EMPTY",
        "UPLOADED",
        "EDITING",
        "PLACEMENT",
        "READY_TO_ISSUE",
        "ISSUING",
        "ISSUED",
        "ERROR"
      ] as SimPhase[]),
    []
  );

  const updatePlacement = useCallback(
    (next: Partial<DesignPlacement>) => {
      setPlacement((prev) => clampPlacement({ ...prev, ...next }));
    },
    [setPlacement]
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
      { label: "X (左)", key: "x" as const, min: 0, max: 0.9 },
      { label: "Y (上)", key: "y" as const, min: 0, max: 0.9 },
      { label: "幅", key: "w" as const, min: 0.2, max: 1 },
      { label: "高さ", key: "h" as const, min: 0.2, max: 1 }
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
        <h1 className="text-2xl font-semibold text-slate-900">シミュレーター</h1>
        <p className="text-sm text-slate-500">
          templateKey: {sampleTemplate.templateKey} ({sampleTemplate.status})
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-600">ステータス</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {phaseEntries.map((entry) => (
                <span
                  key={entry}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    entry === phase ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-500"
                  }`}
                >
                  {simPhaseLabels[entry]}
                </span>
              ))}
            </div>
          </div>

          <Dropzone onFileAccepted={handleFileAccepted} onReject={handleReject} disabled={isIssuing} />

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-600">トリミング (正規化座標)</p>
            <div className="space-y-4 text-sm text-slate-500">
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
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      handleCropChange(field.key, value);
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              値はすべて 0〜1 の正規化座標です。幅・高さは 0.2 以上で固定し、画像に対して切り抜きます。
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-600">背景透過 / モノクロ</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(["weak", "medium", "strong"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`rounded-full border px-2 py-1 transition ${
                    transparentLevel === level
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                  onClick={() => setTransparentLevel(level)}
                >
                  {level}
                </button>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={monochrome}
                onChange={(event) => setMonochrome(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
              />
              モノクロ化
            </label>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-600">配置（刻印枠内を維持）</p>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
              <label className="space-y-1">
                <span className="text-slate-600">X</span>
                <input
                  type="number"
                  value={placement.x}
                  step={1}
                  min={sampleTemplate.engravingArea.x}
                  max={sampleTemplate.engravingArea.x + sampleTemplate.engravingArea.w - MIN_PLACEMENT_SIZE}
                  className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                  onChange={(event) => updatePlacement({ x: Number(event.target.value) })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-600">Y</span>
                <input
                  type="number"
                  value={placement.y}
                  step={1}
                  min={sampleTemplate.engravingArea.y}
                  max={sampleTemplate.engravingArea.y + sampleTemplate.engravingArea.h - MIN_PLACEMENT_SIZE}
                  className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                  onChange={(event) => updatePlacement({ y: Number(event.target.value) })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-600">幅 (px)</span>
                <input
                  type="number"
                  value={placement.w}
                  step={1}
                  min={MIN_PLACEMENT_SIZE}
                  max={sampleTemplate.engravingArea.w}
                  className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                  onChange={(event) => updatePlacement({ w: Number(event.target.value) })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-600">高さ (px)</span>
                <input
                  type="number"
                  value={placement.h}
                  step={1}
                  min={MIN_PLACEMENT_SIZE}
                  max={sampleTemplate.engravingArea.h}
                  className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                  onChange={(event) => updatePlacement({ h: Number(event.target.value) })}
                />
              </label>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-slate-500 underline underline-offset-2"
              onClick={() => setPlacement(basePlacement)}
            >
              枠内中央にリセット
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-center text-white">
            <p className="text-xs uppercase">最終ステップ</p>
            <p className="text-lg font-semibold">発行（PDF確認 + 刻印用）</p>
            <p className="text-xs text-slate-200">Design ID + IndexedDB 保存 + PDF 自動ダウンロード</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">プレビュー</h2>
              <p className="text-xs text-slate-500">背景 + 刻印枠 + 透過/モノクロ反映ロゴ</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">Scale: 1.0x</span>
          </div>
          <div className="mt-4 h-[420px]">
            <StagePreview template={sampleTemplate} crop={crop} placement={placement} bitmap={imageBitmap} />
          </div>

          <div className="mt-4 grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            <div>
              <p className="text-xs text-slate-500">Design ID</p>
              <p className="font-semibold text-slate-900">発行後に自動生成</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">PDF</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-full border border-slate-200 py-2 text-xs font-semibold text-slate-700"
                  disabled
                >
                  確認用をダウンロード
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-full border border-slate-200 py-2 text-xs font-semibold text-slate-700"
                  disabled
                >
                  刻印用を保存
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              className="w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white shadow"
              disabled={!imageBitmap || isIssuing}
              onClick={handleIssue}
            >
              {isIssuing ? "発行中..." : "発行する（PDF生成＋IndexedDB保存）"}
            </button>
            <p className="mt-2 text-left text-xs text-slate-400">
              発行後は localStorage / IndexedDB に design・PDF が保持され、/admin/designs で再ダウンロードできます。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
