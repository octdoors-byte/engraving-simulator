import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useParams } from "react-router-dom";
import { Dropzone } from "@/components/sim/Dropzone";
import { CropModal } from "@/components/sim/CropModal";
import { StageCanvas } from "@/components/sim/StageCanvas";
import { Toast } from "@/components/common/Toast";
import { generateDesignId } from "@/domain/id/designId";
import { processLogo } from "@/domain/image/processLogo";
import { generateConfirmPdf } from "@/domain/pdf/generateConfirmPdf";
import { generateEngravePdf } from "@/domain/pdf/generateEngravePdf";
import { clampPlacement } from "@/domain/placement/clampPlacement";
import type { DesignPlacement, DesignLogoSettings, Template } from "@/domain/types";
import { getTemplate, listDesigns, loadTemplateBgFallback, saveDesign } from "@/storage/local";
import { AssetType, deleteAssets, getAssetById, saveAsset } from "@/storage/idb";

type SimPhase =
  | "EMPTY"
  | "UPLOADED"
  | "EDITING"
  | "PLACEMENT"
  | "READY_TO_ISSUE"
  | "ISSUING"
  | "ISSUED"
  | "ERROR";

type LogoBaseSize = { width: number; height: number };

type ToastState = { message: string; tone?: "info" | "success" | "error" } | null;

type TemplateSet = {
  baseKey: string;
  single?: Template;
  front?: Template;
  back?: Template;
};

type TemplateSide = "single" | "front" | "back";

function isPlacementInside(placement: DesignPlacement, area: Template["engravingArea"]) {
  return (
    placement.x >= area.x &&
    placement.y >= area.y &&
    placement.x + placement.w <= area.x + area.w &&
    placement.y + placement.h <= area.y + area.h
  );
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

function initialPlacement(template: Template, logoSize: LogoBaseSize): DesignPlacement {
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

function splitTemplateKey(templateKey: string): { baseKey: string; side: "front" | "back" | null } {
  if (templateKey.endsWith("_front")) {
    return { baseKey: templateKey.slice(0, -"_front".length), side: "front" };
  }
  if (templateKey.endsWith("_back")) {
    return { baseKey: templateKey.slice(0, -"_back".length), side: "back" };
  }
  return { baseKey: templateKey, side: null };
}

function isUsableTemplate(template: Template | null | undefined): template is Template {
  return Boolean(template && (template.status === "tested" || template.status === "published"));
}

export function SimPage() {
  const { templateKey } = useParams();
  const [template, setTemplate] = useState<Template | null>(null);
  const [templateSet, setTemplateSet] = useState<TemplateSet | null>(null);
  const [activeSide, setActiveSide] = useState<TemplateSide>("single");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [phase, setPhase] = useState<SimPhase>("EMPTY");
  const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [backgroundBlob, setBackgroundBlob] = useState<Blob | null>(null);
  const [crop, setCrop] = useState<DesignLogoSettings["crop"]>({ x: 0, y: 0, w: 1, h: 1 });
  const [transparentColor, setTransparentColor] = useState<DesignLogoSettings["transparentColor"]>(null);
  const [processedLogoBlob, setProcessedLogoBlob] = useState<Blob | null>(null);
  const [processedLogoUrl, setProcessedLogoUrl] = useState<string | null>(null);
  const [logoBaseSize, setLogoBaseSize] = useState<LogoBaseSize | null>(null);
  const [placement, setPlacement] = useState<DesignPlacement | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issuedDesignId, setIssuedDesignId] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const placementInitialized = useRef(false);
  const colorCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const baseKey = templateSet?.baseKey ?? template?.templateKey ?? "";
  const hasSides = Boolean(templateSet?.front || templateSet?.back);
  const frontAvailable = Boolean(templateSet?.front);
  const backAvailable = Boolean(templateSet?.back);
  const frontUsable = isUsableTemplate(templateSet?.front);
  const backUsable = isUsableTemplate(templateSet?.back);

  useEffect(() => {
    if (!templateKey) {
      setErrorMessage("テンプレートキーが指定されていません。");
      setTemplateSet(null);
      setTemplate(null);
      return;
    }
    const direct = getTemplate(templateKey);
    if (direct) {
      setTemplateSet({ baseKey: templateKey, single: direct });
      setActiveSide("single");
      setTemplate(direct);
      setErrorMessage(isUsableTemplate(direct) ? null : "このテンプレートは現在ご利用いただけません（未公開）。");
      return;
    }
    const { baseKey } = splitTemplateKey(templateKey);
    const front = getTemplate(`${baseKey}_front`);
    const back = getTemplate(`${baseKey}_back`);
    if (!front && !back) {
      setErrorMessage("テンプレートが見つかりません。");
      setTemplateSet(null);
      setTemplate(null);
      return;
    }
    setTemplateSet({ baseKey, front: front ?? undefined, back: back ?? undefined });
    const nextSide = isUsableTemplate(front)
      ? "front"
      : isUsableTemplate(back)
        ? "back"
        : front
          ? "front"
          : "back";
    setActiveSide(nextSide);
    setErrorMessage(null);
  }, [templateKey]);

  useEffect(() => {
    if (!templateSet) return;
    const next =
      activeSide === "front"
        ? templateSet.front ?? null
        : activeSide === "back"
          ? templateSet.back ?? null
          : templateSet.single ?? null;
    setTemplate(next);
    if (next && !isUsableTemplate(next)) {
      const hasUsable =
        isUsableTemplate(templateSet.single) ||
        isUsableTemplate(templateSet.front) ||
        isUsableTemplate(templateSet.back);
      setErrorMessage(hasUsable ? null : "このテンプレートは現在ご利用いただけません（未公開）。");
      return;
    }
    setErrorMessage(null);
  }, [activeSide, templateSet]);

  useEffect(() => {
    if (!template) return;
    placementInitialized.current = false;
    setPlacement(null);
    if (processedLogoBlob) {
      setPhase("PLACEMENT");
    }
  }, [processedLogoBlob, template?.templateKey]);

  useEffect(() => {
    if (!template) return;
    let active = true;
    const loadBackground = async () => {
      try {
        const asset = await getAssetById(`asset:templateBg:${template.templateKey}`);
        if (!active) return;
        if (asset?.blob) {
          setBackgroundBlob(asset.blob);
          setBackgroundUrl(URL.createObjectURL(asset.blob));
          return;
        }
      } catch (error) {
        console.error(error);
      }
      const fallback = loadTemplateBgFallback(template.templateKey);
      if (fallback) {
        const response = await fetch(fallback);
        const blob = await response.blob();
        if (!active) return;
        setBackgroundBlob(blob);
        setBackgroundUrl(URL.createObjectURL(blob));
        return;
      }
      try {
        const response = await fetch(`/assets/${template.background.fileName}`);
        if (!response.ok) throw new Error("background fetch failed");
        const blob = await response.blob();
        if (!active) return;
        setBackgroundBlob(blob);
        setBackgroundUrl(URL.createObjectURL(blob));
      } catch (error) {
        console.error(error);
      }
    };
    loadBackground();
    return () => {
      active = false;
    };
  }, [template]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!imageUrl) return;
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    if (!backgroundUrl) return;
    return () => URL.revokeObjectURL(backgroundUrl);
  }, [backgroundUrl]);

  useEffect(() => {
    if (!processedLogoUrl) return;
    return () => URL.revokeObjectURL(processedLogoUrl);
  }, [processedLogoUrl]);

  useEffect(() => {
    if (!imageBitmap || !template) {
      setProcessedLogoBlob(null);
      return;
    }
    const logoSettings = template.logoSettings ?? { monochrome: false };
    let cancelled = false;
    const run = async () => {
      try {
        const blob = await processLogo(imageBitmap, {
          crop,
          transparentColor,
          monochrome: logoSettings.monochrome,
          maxOutputWidth: 1024,
          maxOutputHeight: 1024
        });
        if (!cancelled) {
          setProcessedLogoBlob(blob);
        }
      } catch (error) {
        console.error(error);
        setToast({ message: "画像処理に失敗しました。", tone: "error" });
        setPhase("ERROR");
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [imageBitmap, crop, template, transparentColor]);

  useEffect(() => {
    if (!imageBitmap || !colorCanvasRef.current) return;
    const canvas = colorCanvasRef.current;
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageBitmap, 0, 0);
  }, [imageBitmap]);

  useEffect(() => {
    if (!processedLogoBlob || !template) return;
    const url = URL.createObjectURL(processedLogoBlob);
    setProcessedLogoUrl(url);
    let cancelled = false;
    createImageBitmap(processedLogoBlob)
      .then((bitmap) => {
        if (cancelled) return;
        const size = { width: bitmap.width, height: bitmap.height };
        setLogoBaseSize(size);
        if (!placementInitialized.current) {
          const nextPlacement = initialPlacement(template, size);
          setPlacement(clampPlacement(nextPlacement, template.engravingArea));
          placementInitialized.current = true;
        }
      })
      .catch((error) => {
        console.error(error);
      });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [processedLogoBlob, template]);

  useEffect(() => {
    if (processedLogoBlob && placement && !isIssuing && phase !== "ISSUED") {
      if (template && isPlacementInside(placement, template.engravingArea)) {
        setPhase("READY_TO_ISSUE");
      } else {
        setPhase("PLACEMENT");
      }
    }
  }, [processedLogoBlob, placement, isIssuing, phase, template]);

  const handleReject = useCallback((message: string) => {
    setToast({ message, tone: "error" });
    setPhase("EMPTY");
  }, []);

  const handleFileAccepted = useCallback(async (file: File) => {
    try {
      setPhase("UPLOADED");
      const bitmap = await createImageBitmap(file);
      setImageBitmap(bitmap);
      setUploadedFile(file);
      setCrop({ x: 0, y: 0, w: 1, h: 1 });
      setTransparentColor(null);
      setPlacement(null);
      placementInitialized.current = false;
      setImageUrl(URL.createObjectURL(file));
      setPhase("EDITING");
    } catch (error) {
      console.error(error);
      setToast({ message: "画像の読み込みに失敗しました。", tone: "error" });
      setPhase("EMPTY");
    }
  }, []);

  const handlePlacementChange = useCallback(
    (next: DesignPlacement) => {
      if (!template) return;
      const clamped = clampPlacement(next, template.engravingArea);
      setPlacement(clamped);
      if (!isIssuing) {
        setPhase(isPlacementInside(clamped, template.engravingArea) ? "READY_TO_ISSUE" : "PLACEMENT");
      }
    },
    [template, isIssuing]
  );

  const handleIssue = useCallback(async () => {
    if (!template || !imageBitmap || !uploadedFile || !processedLogoBlob || !placement) {
      setToast({ message: "先に画像をアップロードしてください。", tone: "error" });
      return;
    }
    if (placement.w > template.engravingArea.w || placement.h > template.engravingArea.h) {
      setToast({
        message: "ロゴのサイズが刻印枠より大きいので発行できません。",
        tone: "error"
      });
      return;
    }
    if (!isPlacementInside(placement, template.engravingArea)) {
      setToast({ message: "ロゴを刻印枠内に収めてください。", tone: "error" });
      setPhase("PLACEMENT");
      return;
    }
    setIsIssuing(true);
    setPhase("ISSUING");
    const createdAt = new Date().toISOString();
    let designId = "";
    try {
      const existingIds = new Set(listDesigns().map((entry) => entry.designId));
      designId = generateDesignId(existingIds);
      const logoSettings = template.logoSettings ?? { monochrome: false };
      const confirmPdf = await generateConfirmPdf(template, backgroundBlob, processedLogoBlob, placement, designId);
      const engravePdf = await generateEngravePdf(template, processedLogoBlob, placement, {
        designId,
        createdAt
      });
      const assets = [
        { id: `asset:logoOriginal:${designId}`, type: "logoOriginal" as AssetType, blob: uploadedFile },
        { id: `asset:logoEdited:${designId}`, type: "logoEdited" as AssetType, blob: processedLogoBlob },
        { id: `asset:pdfConfirm:${designId}`, type: "pdfConfirm" as AssetType, blob: confirmPdf },
        { id: `asset:pdfEngrave:${designId}`, type: "pdfEngrave" as AssetType, blob: engravePdf }
      ];
      await Promise.all(
        assets.map((asset) =>
          saveAsset({
            ...asset,
            createdAt
          })
        )
      );
      saveDesign({
        designId,
        templateKey: template.templateKey,
        createdAt,
        logo: {
          fileName: uploadedFile.name,
          mimeType: uploadedFile.type,
          sizeBytes: uploadedFile.size,
          crop,
          transparentColor,
          monochrome: logoSettings.monochrome
        },
        placement,
        pdf: {
          confirmAssetId: `asset:pdfConfirm:${designId}`,
          engraveAssetId: `asset:pdfEngrave:${designId}`
        }
      });
      downloadBlob(confirmPdf, `${designId}-confirm.pdf`);
      setIssuedDesignId(designId);
      setToast({ message: "PDF確認用をダウンロードしました。", tone: "success" });
      setPhase("ISSUED");
    } catch (error) {
      console.error(error);
      setToast({ message: "発行中にエラーが発生しました。", tone: "error" });
      setPhase("READY_TO_ISSUE");
      if (designId) {
        await deleteAssets([
          `asset:logoOriginal:${designId}`,
          `asset:logoEdited:${designId}`,
          `asset:pdfConfirm:${designId}`,
          `asset:pdfEngrave:${designId}`
        ]);
      }
    } finally {
      setIsIssuing(false);
    }
  }, [
    template,
    imageBitmap,
    uploadedFile,
    processedLogoBlob,
    placement,
    crop,
    transparentColor,
    backgroundBlob
  ]);

  const handlePickTransparent = useCallback(
    (event: MouseEvent<HTMLImageElement>) => {
      if (!imageBitmap || !colorCanvasRef.current) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const relX = (event.clientX - rect.left) / rect.width;
      const relY = (event.clientY - rect.top) / rect.height;
      const px = Math.min(imageBitmap.width - 1, Math.max(0, Math.floor(relX * imageBitmap.width)));
      const py = Math.min(imageBitmap.height - 1, Math.max(0, Math.floor(relY * imageBitmap.height)));
      const ctx = colorCanvasRef.current.getContext("2d");
      if (!ctx) return;
      const [r, g, b] = ctx.getImageData(px, py, 1, 1).data;
      setTransparentColor({ r, g, b });
    },
    [imageBitmap]
  );

  if (errorMessage) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        {errorMessage}
      </section>
    );
  }

  if (!template) {
    return null;
  }

  return (
    <section className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <header className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            お客様画面
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            ここからお客様画面
          </span>
          <p className="text-xs text-slate-400">管理ID: {baseKey}</p>
        </div>
        {hasSides && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">表示面</span>
            {frontAvailable && (
              <button
                type="button"
                className={`rounded-full border px-3 py-1 text-xs ${
                  activeSide === "front"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-600"
                } ${frontUsable ? "" : "cursor-not-allowed opacity-40"}`}
                disabled={!frontUsable}
                onClick={() => setActiveSide("front")}
              >
                表{frontUsable ? "" : "（未公開）"}
              </button>
            )}
            {backAvailable && (
              <button
                type="button"
                className={`rounded-full border px-3 py-1 text-xs ${
                  activeSide === "back"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-600"
                } ${backUsable ? "" : "cursor-not-allowed opacity-40"}`}
                disabled={!backUsable}
                onClick={() => setActiveSide("back")}
              >
                裏{backUsable ? "" : "（未公開）"}
              </button>
            )}
          </div>
        )}
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">デザインシミュレーター</h1>
        <p className="text-sm text-slate-500">ロゴを読み込んで、切り取りを調整し、デザインIDを発行します。</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="order-2 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:order-1">
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold text-white">
                  ステップ1
                </span>
                <p className="text-sm font-semibold text-rose-700">ロゴをアップロード</p>
              </div>
              <div className="mt-3">
                <Dropzone onFileAccepted={handleFileAccepted} onReject={handleReject} disabled={isIssuing} />
              </div>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white">
                  ステップ2
                </span>
                <p className="text-sm font-semibold text-sky-700">トリミングと透過</p>
              </div>
              <p className="mt-2 text-xs text-slate-500">ロゴをアップロードすると操作できます。</p>
              <button
                type="button"
                className="mt-3 w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shadow-sm"
                disabled={!imageBitmap}
                onClick={() => setCropOpen(true)}
              >
                トリミングを開く
              </button>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">ロゴの色をクリックして透過します。</p>
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                    onClick={() => setTransparentColor(null)}
                    disabled={!imageBitmap}
                  >
                    透過をリセット
                  </button>
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="透過色の選択"
                      className="max-h-40 w-full cursor-crosshair rounded-md object-contain"
                      onClick={handlePickTransparent}
                    />
                  ) : (
                    <p className="text-center text-xs text-slate-400">ロゴをアップロードしてください。</p>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                  <span>透過色:</span>
                  {transparentColor ? (
                    <>
                      <span
                        className="h-5 w-5 rounded-full border border-slate-200"
                        style={{
                          backgroundColor: `rgb(${transparentColor.r}, ${transparentColor.g}, ${transparentColor.b})`
                        }}
                      />
                      <span>RGB({transparentColor.r}, {transparentColor.g}, {transparentColor.b})</span>
                    </>
                  ) : (
                    <span className="text-slate-400">未設定</span>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
                  ステップ3
                </span>
                <p className="text-sm font-semibold text-amber-700">配置して発行</p>
              </div>
              <p className="mt-2 text-xs text-slate-500">右側のプレビューで配置を調整してください。</p>
              <p className="mt-1 text-xs text-slate-500">カラー/モノクロはテンプレート管理の設定が反映されます。</p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-900 px-4 py-4 text-center text-white">
            <p className="text-sm font-semibold">デザインID発行（PDF保存）</p>
            <button
              type="button"
              className="w-full rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow"
              disabled={!processedLogoBlob || !placement || isIssuing || phase !== "READY_TO_ISSUE"}
              onClick={handleIssue}
            >
              {isIssuing ? "発行中..." : "デザインIDを発行する"}
            </button>
            <div className="rounded-xl border border-amber-400/60 bg-slate-800 px-4 py-3 text-left shadow">
              <p className="text-xs font-semibold text-amber-300">デザインID</p>
              {issuedDesignId ? (
                <div className="mt-2 space-y-2">
                  <div className="rounded-lg border border-amber-400/40 bg-slate-900 px-3 py-3 text-center text-lg font-semibold tracking-widest text-amber-100">
                    {issuedDesignId}
                  </div>
                  <button
                    type="button"
                    className="w-full rounded-full border border-amber-300 bg-amber-200 px-3 py-2 text-xs font-semibold text-slate-900"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(issuedDesignId);
                        setToast({ message: "デザインIDをコピーしました。", tone: "success" });
                      } catch (error) {
                        console.error(error);
                        setToast({ message: "コピーできませんでした。", tone: "error" });
                      }
                    }}
                  >
                    デザインIDをコピー
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">発行後に表示されます</p>
              )}
            </div>
          </div>
        </div>

        <div className="order-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:order-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">見た目の確認</h2>
              <p className="text-xs text-slate-500">背景とロゴの見え方を確認できます。</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">状態: {phase === "READY_TO_ISSUE" ? "発行可能" : phase}</span>
          </div>
          <div className="mt-4">
            <StageCanvas
              template={template}
              backgroundUrl={backgroundUrl}
              logoUrl={processedLogoUrl}
              placement={
                placement ?? {
                  x: template.engravingArea.x,
                  y: template.engravingArea.y,
                  w: template.engravingArea.w,
                  h: template.engravingArea.h
                }
              }
              logoBaseSize={logoBaseSize}
              onPlacementChange={handlePlacementChange}
            />
            {!imageBitmap && <div className="mt-2 text-xs text-slate-400">ロゴをアップロードすると配置できます。</div>}
          </div>
        </div>
      </div>

      <CropModal
        open={cropOpen}
        imageUrl={imageUrl}
        crop={crop}
        onClose={() => setCropOpen(false)}
        onApply={(next) => {
          setCrop(next);
          setCropOpen(false);
          setPhase("PLACEMENT");
        }}
      />
      <canvas ref={colorCanvasRef} className="hidden" />
    </section>
  );
}


