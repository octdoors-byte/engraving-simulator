import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useParams } from "react-router-dom";
import { Dropzone } from "@/components/sim/Dropzone";
import { CropModal } from "@/components/sim/CropModal";
import { StageCanvas } from "@/components/sim/StageCanvas";
import { Toast } from "@/components/common/Toast";
import { Modal } from "@/components/common/Modal";
import { generateDesignId } from "@/domain/id/designId";
import { processLogo } from "@/domain/image/processLogo";
import { prepareEngraveLogoBlob } from "@/domain/image/prepareEngraveLogo";
import { generateConfirmPdf } from "@/domain/pdf/generateConfirmPdf";
import { generateEngravePdf } from "@/domain/pdf/generateEngravePdf";
import { clampPlacement } from "@/domain/placement/clampPlacement";
import type { DesignPlacement, DesignLogoSettings, Template } from "@/domain/types";
import { getTemplate, listDesigns, loadTemplateBgFallback, saveDesign } from "@/storage/local";
import { AssetType, deleteAssets, getAssetById, saveAsset } from "@/storage/idb";
import { getWpKsimConfig, uploadConfirmPdfToWp } from "@/remote/wpKsimApi";

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

async function hasVisiblePixels(blob: Blob): Promise<boolean> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if ("close" in bitmap) {
      bitmap.close();
    }
    return true;
  }
  ctx.drawImage(bitmap, 0, 0);
  if ("close" in bitmap) {
    bitmap.close();
  }
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) {
      return true;
    }
  }
  return false;
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

function isUsableTemplate(template: Template | null | undefined): template is Template {
  return Boolean(template && (template.status === "tested" || template.status === "published"));
}

export function SimPage() {
  const { templateKey } = useParams();
  const [template, setTemplate] = useState<Template | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [phase, setPhase] = useState<SimPhase>("EMPTY");
  const [guideStep, setGuideStep] = useState<1 | 2 | 3 | null>(null);
  const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);

  // imageBitmapのクリーンアップ
  useEffect(() => {
    return () => {
      if (imageBitmap && "close" in imageBitmap) {
        imageBitmap.close();
      }
    };
  }, [imageBitmap]);
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
  const [rotationDeg, setRotationDeg] = useState<0 | 90 | 180 | 270>(0);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issuedDesignId, setIssuedDesignId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPdfBlob, setPreviewPdfBlob] = useState<Blob | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [pendingDesignId, setPendingDesignId] = useState<string | null>(null);
  const [pendingCreatedAt, setPendingCreatedAt] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const placementInitialized = useRef(false);
  const colorCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!templateKey) {
      setErrorMessage("テンプレートIDが指定されていません。");
      setTemplate(null);
      return;
    }
    const current = getTemplate(templateKey);
    if (!current) {
      setErrorMessage("テンプレートが見つかりません。");
      setTemplate(null);
      return;
    }
    setTemplate(current);
    setErrorMessage(isUsableTemplate(current) ? null : "このテンプレートは現在ご利用いただけません（未公開）。");
  }, [templateKey]);

  useEffect(() => {
    if (!template) return;
    placementInitialized.current = false;
    setPlacement(null);
    setRotationDeg(0);
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
    if (!previewPdfUrl) return;
    // iframe/objectがblob URLを読み込む前にrevokeされないよう、少し遅延してからrevoke
    // モーダルが閉じられ、iframeがDOMから削除されるのを待つ
    const timeoutId = window.setTimeout(() => {
      URL.revokeObjectURL(previewPdfUrl);
    }, 300);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [previewPdfUrl]);

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
    let bitmap: ImageBitmap | null = null;
    createImageBitmap(processedLogoBlob)
      .then((bmp) => {
        bitmap = bmp;
        if (cancelled) {
          if ("close" in bitmap) {
            bitmap.close();
          }
          return;
        }
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
      if (bitmap && "close" in bitmap) {
        bitmap.close();
      }
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
      setRotationDeg(0);
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

  const resetPreview = useCallback(() => {
    setPreviewPdfUrl(null);
    setPreviewPdfBlob(null);
    setPendingDesignId(null);
    setPendingCreatedAt(null);
    setPreviewOpen(false);
    // useEffectのクリーンアップで自動的にrevokeされる
  }, []);

  const handleIssue = useCallback(async () => {
    if (!template || !imageBitmap || !uploadedFile || !processedLogoBlob || !placement) {
      setToast({ message: "先に画像をアップロードしてください。", tone: "error" });
      return;
    }
    if (placement.w > template.engravingArea.w || placement.h > template.engravingArea.h) {
      setToast({
        message: "ロゴのサイズがデザインできる範囲より大きいので作成できません。",
        tone: "error"
      });
      return;
    }
    if (!isPlacementInside(placement, template.engravingArea)) {
      setToast({ message: "ロゴをデザインできる範囲内に収めてください。", tone: "error" });
      setPhase("PLACEMENT");
      return;
    }
    const createdAt = new Date().toISOString();
    const existingIds = new Set(listDesigns().map((entry) => entry.designId));
    const designId = generateDesignId(existingIds);
    try {
      const confirmPlacement = { ...placement, rotationDeg };
      const confirmPdf = await generateConfirmPdf(template, backgroundBlob, processedLogoBlob, confirmPlacement, designId);
      const url = URL.createObjectURL(confirmPdf);
      setPreviewPdfBlob(confirmPdf);
      setPreviewPdfUrl(url);
      setPendingDesignId(designId);
      setPendingCreatedAt(createdAt);
      setPreviewOpen(true);
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.error("[issue] confirm pdf generation failed", message, error);
      setToast({ message: "確認画面の生成に失敗しました。", tone: "error" });
    }
  }, [template, imageBitmap, uploadedFile, processedLogoBlob, placement, backgroundBlob, rotationDeg]);

  const finalizeIssue = useCallback(async () => {
    if (!template || !imageBitmap || !uploadedFile || !processedLogoBlob || !placement) {
      setToast({ message: "先に画像をアップロードしてください。", tone: "error" });
      return;
    }
    if (!pendingDesignId || !pendingCreatedAt || !previewPdfBlob) {
      setToast({ message: "確認画面がありません。", tone: "error" });
      return;
    }
    setIsIssuing(true);
    setPhase("ISSUING");
    try {
      console.log("[issue] step: start", {
        templateKey: template.templateKey,
        hasProcessedLogo: Boolean(processedLogoBlob),
        hasPlacement: Boolean(placement)
      });
      const logoSettings = template.logoSettings ?? { monochrome: false };
      let engraveSourceBlob = processedLogoBlob;
      if (!(await hasVisiblePixels(engraveSourceBlob)) && uploadedFile) {
        try {
          const bitmap = await createImageBitmap(uploadedFile);
          engraveSourceBlob = await processLogo(bitmap, {
            crop: { x: 0, y: 0, w: 1, h: 1 },
            transparentColor: null,
            monochrome: logoSettings.monochrome,
            maxOutputWidth: 1024,
            maxOutputHeight: 1024
          });
          if ("close" in bitmap) {
            bitmap.close();
          }
        } catch (error) {
          console.error(error);
        }
      }
      console.log("[issue] step: prepare engrave logo");
      const engraveLogoBlob = await prepareEngraveLogoBlob(engraveSourceBlob);
      console.log("[issue] step: generate engrave pdf");
      const engravePdf = await generateEngravePdf(template, engraveLogoBlob, { ...placement, rotationDeg }, {
        designId: pendingDesignId,
        createdAt: pendingCreatedAt
      });
      console.log("[issue] step: generate confirm pdf already done, now saving assets");
      const assets = [
        { id: `asset:logoOriginal:${pendingDesignId}`, type: "logoOriginal" as AssetType, blob: uploadedFile },
        { id: `asset:logoEdited:${pendingDesignId}`, type: "logoEdited" as AssetType, blob: processedLogoBlob },
        { id: `asset:pdfConfirm:${pendingDesignId}`, type: "pdfConfirm" as AssetType, blob: previewPdfBlob },
        { id: `asset:pdfEngrave:${pendingDesignId}`, type: "pdfEngrave" as AssetType, blob: engravePdf }
      ];
      await Promise.all(
        assets.map((asset) =>
          saveAsset({
            ...asset,
            createdAt: pendingCreatedAt
          })
        )
      );
      console.log("[issue] step: save design");
      saveDesign({
        designId: pendingDesignId,
        templateKey: template.templateKey,
        createdAt: pendingCreatedAt,
        logo: {
          fileName: uploadedFile.name,
          mimeType: uploadedFile.type,
          sizeBytes: uploadedFile.size,
          crop,
          transparentColor,
          monochrome: logoSettings.monochrome
        },
        placement: { ...placement, rotationDeg },
        pdf: {
          confirmAssetId: `asset:pdfConfirm:${pendingDesignId}`,
          engraveAssetId: `asset:pdfEngrave:${pendingDesignId}`
        }
      });

      // Optional: upload confirm PDF to WordPress so admins can access it across devices/users.
      // If not configured, the app keeps working with local-only storage.
      if (getWpKsimConfig()) {
        try {
          await uploadConfirmPdfToWp({
            designId: pendingDesignId,
            templateKey: template.templateKey,
            createdAt: pendingCreatedAt,
            pdfBlob: previewPdfBlob
          });
        } catch (error) {
          console.error("[issue] wp upload failed", error);
          setToast({
            message: "確認用PDFのサーバー保存に失敗しました（この端末内の履歴/保存は完了しています）。",
            tone: "error"
          });
        }
      }
      console.log("[issue] step: download confirm pdf");
      try {
        downloadBlob(previewPdfBlob, `${pendingDesignId}-confirm.pdf`);
      } catch (error) {
        console.error("[issue] download confirm pdf failed", error);
        throw error;
      }
      setIssuedDesignId(pendingDesignId);
      setToast({ message: "確認用PDFをダウンロードしました。", tone: "success" });
      setPhase("ISSUED");
      resetPreview();
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      const serialized = (() => {
        try {
          return JSON.stringify(error);
        } catch {
          return null;
        }
      })();
      console.error("[issue] finalize failed raw", error);
      console.error("[issue] finalize failed", message, stack ?? "", serialized ?? "", error);
      console.error("[issue] context", {
        hasTemplate: Boolean(template),
        hasProcessedLogo: Boolean(processedLogoBlob),
        hasPlacement: Boolean(placement),
        pendingDesignId,
        pendingCreatedAt,
        previewPdfBlob: Boolean(previewPdfBlob)
      });
      setToast({ message: "作成中にエラーが発生しました。", tone: "error" });
      setPhase("READY_TO_ISSUE");
      if (pendingDesignId) {
        await deleteAssets([
          `asset:logoOriginal:${pendingDesignId}`,
          `asset:logoEdited:${pendingDesignId}`,
          `asset:pdfConfirm:${pendingDesignId}`,
          `asset:pdfEngrave:${pendingDesignId}`
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
    pendingDesignId,
    pendingCreatedAt,
    previewPdfBlob,
    resetPreview,
    rotationDeg
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

  const paperLabel = (() => {
    const paper = template?.paper;
    if (paper?.width && paper?.height) {
      const isLandscape = paper.width >= paper.height;
      const size = `${paper.width}×${paper.height} mm`;
      return isLandscape ? `${size}（横）` : `${size}（縦）`;
    }
    const pageSize = template?.pdf?.pageSize ?? "A4";
    const orientation = template?.pdf?.orientation ?? "portrait";
    if (pageSize !== "A4") return pageSize;
    return orientation === "landscape" ? "297×210 mm（横）" : "210×297 mm（縦）";
  })();

  const sizeCheck = (() => {
    if (!template || !placement) return null;
    const dpi = template.pdf?.dpi ?? 300;
    if (!Number.isFinite(dpi) || dpi <= 0) return null;
    const wMm = (placement.w * 25.4) / dpi;
    const hMm = (placement.h * 25.4) / dpi;
    const minW = template.logoMinWidthMm ?? 3;
    const minH = template.logoMinHeightMm ?? 3;
    const isBelowMin = wMm < minW || hMm < minH;
    return {
      wMm,
      hMm,
      minW,
      minH,
      isBelowMin
    };
  })();

  const dpiCheck = (() => {
    if (!template || !placement || !logoBaseSize) return null;
    const dpi = template.pdf?.dpi ?? 300;
    if (!Number.isFinite(dpi) || dpi <= 0) return null;
    const wMm = (placement.w * 25.4) / dpi;
    const hMm = (placement.h * 25.4) / dpi;
    if (wMm <= 0 || hMm <= 0) return null;
    const widthIn = wMm / 25.4;
    const heightIn = hMm / 25.4;
    const dpiX = logoBaseSize.width / widthIn;
    const dpiY = logoBaseSize.height / heightIn;
    const effectiveDpi = Math.min(dpiX, dpiY);
    if (!Number.isFinite(effectiveDpi)) return null;
    const level =
      effectiveDpi < 150 ? "strong" : effectiveDpi < 300 ? "warn" : "ok";
    return {
      effectiveDpi,
      level
    };
  })();

  if (errorMessage) {
    return (
      <section className="rounded-lg border border-slate-300 bg-slate-50 p-6 text-sm font-medium text-slate-700">
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

      <header className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1">
            <div className="mb-2">
              <h1 className="text-4xl font-bold text-slate-800 tracking-tight">{template.name}</h1>
            </div>
            {template.comment && template.comment.trim() ? (
              <p className="text-sm text-slate-600 leading-relaxed">{template.comment.trim()}</p>
            ) : (
              <p className="text-sm text-slate-600 leading-relaxed">
                お手元のロゴ画像をアップロードして、刻印の仕上がりイメージを確認・保存できるテンプレートです。
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="order-2 space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:order-1">
          <div className="space-y-4">
            {/* ステップ1: ロゴアップロード */}
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-500 text-sm font-bold text-white shadow-sm">
                  1
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-rose-900">ロゴをアップロード</p>
                  <p className="text-xs text-rose-700 mt-0.5">画像ファイルを選択してください</p>
                </div>
                <button
                  type="button"
                  onClick={() => setGuideStep(1)}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-rose-300 bg-white text-rose-600 transition hover:border-rose-400 hover:bg-rose-50"
                  title="ステップ1の使い方ガイド"
                  aria-label="ステップ1の使い方ガイド"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              <div className="mt-3">
                <Dropzone onFileAccepted={handleFileAccepted} onReject={handleReject} disabled={isIssuing} />
              </div>
            </div>

            {/* ステップ2: 画像を調整（トリミング・透過・回転） */}
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-500 text-sm font-bold text-white shadow-sm">
                  2
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-sky-900">画像を調整</p>
                  <p className="text-xs text-sky-700 mt-0.5">トリミング・背景の透過・回転をまとめて設定します</p>
                </div>
                <button
                  type="button"
                  onClick={() => setGuideStep(2)}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-sky-300 bg-white text-sky-600 transition hover:border-sky-400 hover:bg-sky-50"
                  title="ステップ2の使い方ガイド"
                  aria-label="ステップ2の使い方ガイド"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              <button
                type="button"
                className="mt-3 w-full rounded-md border border-sky-300 bg-white px-4 py-2.5 text-sm font-semibold text-sky-700 shadow-sm transition-all hover:border-sky-400 hover:bg-sky-50 hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!imageBitmap}
                onClick={() => setCropOpen(true)}
              >
                トリミングを開く
              </button>
              <div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-medium text-slate-700">背景を透過する</p>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setTransparentColor(null)}
                    disabled={!imageBitmap}
                  >
                    リセット
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-2">画像内の色をクリックすると、その色が透明になります</p>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="透過色の選択"
                      className="max-h-40 w-full cursor-crosshair rounded object-contain"
                      onClick={handlePickTransparent}
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center">
                      <p className="text-center text-xs text-slate-400">ロゴをアップロードしてください</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="font-medium text-slate-600">透過色:</span>
                  {transparentColor ? (
                    <>
                      <span
                        className="h-5 w-5 rounded border border-slate-300 shadow-sm"
                        style={{
                          backgroundColor: `rgb(${transparentColor.r}, ${transparentColor.g}, ${transparentColor.b})`
                        }}
                      />
                      <span className="text-slate-600">RGB({transparentColor.r}, {transparentColor.g}, {transparentColor.b})</span>
                    </>
                  ) : (
                    <span className="text-slate-400">未設定</span>
                  )}
                </div>

                {/* 位置と回転の調整（任意） */}
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <p className="text-xs font-medium text-slate-700 mb-2">位置・回転の微調整（任意）</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm transition-all hover:border-amber-400 hover:bg-amber-50 hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!processedLogoBlob || !placement}
                      onClick={() => {
                        if (!placement) return;
                        const nextRotation = (((rotationDeg ?? 0) + 90) % 360) as 0 | 90 | 180 | 270;
                        const centerX = placement.x + placement.w / 2;
                        const centerY = placement.y + placement.h / 2;
                        const swap = nextRotation === 90 || nextRotation === 270;
                        const nextW = swap ? placement.h : placement.w;
                        const nextH = swap ? placement.w : placement.h;
                        const nextPlacement = {
                          ...placement,
                          x: centerX - nextW / 2,
                          y: centerY - nextH / 2,
                          w: nextW,
                          h: nextH
                        };
                        setRotationDeg(nextRotation);
                        handlePlacementChange(nextPlacement);
                      }}
                    >
                      90°回転
                    </button>
                    <span className="text-xs font-medium text-amber-700">現在: {rotationDeg}°</span>
                    <p className="w-full text-[11px] text-slate-500">
                      ※ロゴの向きが気になる場合のみ調整してください（省略しても構いません）
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ステップ3: デザインID発行（最後の工程） */}
          <div className="space-y-3 rounded-lg border-2 border-emerald-300 bg-emerald-50 px-5 py-5 shadow-lg">
            <div className="text-center mb-3">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-sm font-bold text-white shadow-md">
                  3
                </div>
                <p className="text-base font-bold text-emerald-900">デザインIDを発行</p>
                <button
                  type="button"
                  onClick={() => setGuideStep(3)}
                  className="ml-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-emerald-400 bg-white text-emerald-600 transition hover:border-emerald-500 hover:bg-emerald-50"
                  title="ステップ3の使い方ガイド"
                  aria-label="ステップ3の使い方ガイド"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                最後のステップです。確認画面を表示して、問題なければデザインIDを作成します
              </p>
            </div>
            <button
              type="button"
              className="w-full rounded-md border-2 border-emerald-500 bg-emerald-600 px-5 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:bg-emerald-700 hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600 disabled:hover:scale-100"
              disabled={!processedLogoBlob || !placement || isIssuing || phase !== "READY_TO_ISSUE"}
              onClick={handleIssue}
            >
              {isIssuing ? "作成中..." : "✓ 確認画面を表示してデザインIDを発行"}
            </button>

            {/* サイズチェック */}
            {sizeCheck && sizeCheck.isBelowMin && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-left">
                <p className="text-xs font-bold text-amber-900 mb-1">⚠️ サイズが小さめです</p>
                <p className="text-xs text-amber-800 leading-relaxed mb-1">
                  推奨の最小サイズより小さくなっています。仕上がりが見えにくくなる可能性があります。
                </p>
                <p className="text-[11px] font-medium text-amber-700">
                  推奨最小: 幅 {sizeCheck.minW}mm × 高さ {sizeCheck.minH}mm
                </p>
              </div>
            )}
            {sizeCheck && !sizeCheck.isBelowMin && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-left">
                <p className="text-xs font-semibold text-emerald-800">
                  ✓ サイズ: OK（幅 {sizeCheck.wMm.toFixed(1)}mm × 高さ {sizeCheck.hMm.toFixed(1)}mm）
                </p>
              </div>
            )}

            {/* DPIチェック */}
            {dpiCheck && dpiCheck.level !== "ok" && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-left">
                <p className="text-xs font-bold text-amber-900 mb-1">⚠️ 画像の解像度が低い可能性があります</p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  仕上がりが粗く見える場合があります。高解像度のロゴ画像をご用意ください。
                </p>
                <p className="text-[11px] font-medium text-amber-700 mt-1">
                  現在の解像度: 約 {Math.round(dpiCheck.effectiveDpi)} dpi
                </p>
              </div>
            )}

            {/* デザインID表示 */}
            <div className="rounded-md border-2 border-emerald-300 bg-emerald-50 px-4 py-4 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1 w-6 bg-emerald-400 rounded-full"></div>
                <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide">発行されたデザインID</p>
              </div>
              {issuedDesignId ? (
                <div className="space-y-3">
                  <div className="rounded-md border-2 border-emerald-400 bg-emerald-100 px-4 py-4 text-center text-lg font-bold tracking-wider text-slate-900 shadow-sm">
                    {issuedDesignId}
                  </div>
                  <button
                    type="button"
                    className="w-full rounded-md border border-emerald-400 bg-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-sm transition-all hover:border-emerald-500 hover:bg-emerald-300 hover:shadow"
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
                    📋 デザインIDをコピー
                  </button>
                </div>
              ) : (
                <p className="text-sm text-emerald-700 text-center py-3 font-medium">デザインID発行後に表示されます</p>
              )}
            </div>
          </div>
        </div>

        <div className="order-1 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:order-2">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-slate-900">プレビュー</h2>
              <div
                className="flex flex-col items-end gap-1 text-xs font-medium text-slate-600"
                data-testid="sim-status"
                data-state={phase}
              >
                <span>用紙: {paperLabel}</span>
                <span>
                  状態:{" "}
                  {phase === "READY_TO_ISSUE"
                    ? "✓ 作成可能"
                    : phase === "EMPTY"
                      ? "ロゴ未選択"
                      : phase === "UPLOADED"
                        ? "読込済み"
                        : phase === "EDITING"
                          ? "調整中"
                          : phase === "PLACEMENT"
                            ? "位置調整中"
                            : phase === "ISSUING"
                              ? "作成中..."
                              : phase === "ISSUED"
                                ? "✓ 作成済み"
                                : phase === "ERROR"
                                  ? "エラー"
                                  : phase}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              ロゴの位置と大きさをドラッグして調整できます。枠内に収まるように配置してください。
            </p>
          </div>
          <div className="mt-4">
            <StageCanvas
              template={template}
              backgroundUrl={backgroundUrl}
              logoUrl={processedLogoUrl}
              rotationDeg={rotationDeg}
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
            {!imageBitmap && (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                {template.comment?.trim() || "左側からロゴをアップロードすると、ここで位置を調整できます。"}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal title="確認画面" open={previewOpen} onClose={resetPreview}>
        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 overflow-hidden">
            {previewPdfUrl ? (
              <iframe 
                title="確認PDF" 
                src={`${previewPdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} 
                className="h-[85vh] w-full rounded-md" 
              />
            ) : (
              <div className="p-6 text-center text-sm font-medium text-slate-500">確認画面を作成中です...</div>
            )}
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              確認画面をご確認ください。問題なければ「デザインIDを作成」をクリックしてください。
              修正が必要な場合は「戻る」をクリックして調整してください。
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={resetPreview}
                disabled={isIssuing}
              >
                戻る
              </button>
              <button
                type="button"
                className="rounded-md border-2 border-emerald-500 bg-emerald-600 px-5 py-3 text-base font-bold text-white shadow-lg transition-all hover:bg-emerald-700 hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600 disabled:hover:scale-100"
                onClick={finalizeIssue}
                disabled={isIssuing}
              >
                {isIssuing ? "作成中..." : "✓ デザインIDを発行する"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

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

      {/* ステップガイドモーダル */}
      <Modal title={guideStep === 1 ? "ステップ1: ロゴをアップロード" : guideStep === 2 ? "ステップ2: 画像を調整" : "ステップ3: デザインIDを発行"} open={guideStep !== null} onClose={() => setGuideStep(null)}>
        {guideStep === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
              <h3 className="mb-2 text-sm font-bold text-rose-900">このステップでできること</h3>
              <p className="text-sm text-rose-800 leading-relaxed">
                ロゴ画像をアップロードして、シミュレーターで使用する画像を準備します。
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <h4 className="mb-1 text-sm font-semibold text-slate-900">対応形式</h4>
                <ul className="ml-4 list-disc space-y-1 text-sm text-slate-700">
                  <li>PNG形式（推奨）</li>
                  <li>JPEG形式</li>
                  <li>WEBP形式</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-semibold text-slate-900">ファイルサイズ</h4>
                <p className="text-sm text-slate-700">最大5MBまでアップロードできます</p>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-semibold text-slate-900">アップロード方法</h4>
                <ul className="ml-4 list-disc space-y-1 text-sm text-slate-700">
                  <li>「画像ファイルを選択」エリアをクリックしてファイルを選択</li>
                  <li>または、画像ファイルをドラッグ&ドロップ</li>
                </ul>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-700">💡 ヒント</p>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  背景が透明なPNG形式のロゴを使用すると、次のステップで透過処理が簡単になります。
                </p>
              </div>
            </div>
          </div>
        )}
        {guideStep === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
              <h3 className="mb-2 text-sm font-bold text-sky-900">このステップでできること</h3>
              <p className="text-sm text-sky-800 leading-relaxed">
                ロゴ画像をトリミング、背景透過、回転の調整を行い、最終的な見た目を整えます。
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <h4 className="mb-1 text-sm font-semibold text-slate-900">1. トリミング</h4>
                <p className="mb-2 text-sm text-slate-700">「トリミングを開く」ボタンをクリックして、画像の不要な部分を切り取ります。</p>
                <ul className="ml-4 list-disc space-y-1 text-xs text-slate-600">
                  <li>トリミング範囲をドラッグして調整</li>
                  <li>適用ボタンで確定</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-semibold text-slate-900">2. 背景を透過する</h4>
                <p className="mb-2 text-sm text-slate-700">画像内の特定の色を透明にできます。</p>
                <ul className="ml-4 list-disc space-y-1 text-xs text-slate-600">
                  <li>画像内の色をクリックすると、その色が透明になります</li>
                  <li>「リセット」ボタンで透過を解除</li>
                  <li>白背景のロゴを透過する際に便利です</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-semibold text-slate-900">3. 位置・回転の微調整（任意）</h4>
                <p className="mb-2 text-sm text-slate-700">ロゴの向きを90度ずつ回転できます。</p>
                <ul className="ml-4 list-disc space-y-1 text-xs text-slate-600">
                  <li>「90°回転」ボタンで時計回りに回転</li>
                  <li>0°、90°、180°、270°の4方向に対応</li>
                  <li>向きが正しければ省略しても構いません</li>
                </ul>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-700">💡 ヒント</p>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  背景透過は、画像内の単色部分をクリックすると効果的です。複雑な背景の場合は、事前に画像編集ソフトで処理することをおすすめします。
                </p>
              </div>
            </div>
          </div>
        )}
        {guideStep === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="mb-2 text-sm font-bold text-emerald-900">このステップでできること</h3>
              <p className="text-sm text-emerald-800 leading-relaxed">
                確認画面でPDFプレビューを表示し、問題がなければデザインIDを発行します。
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <h4 className="mb-1 text-sm font-semibold text-slate-900">確認画面の表示</h4>
                <p className="mb-2 text-sm text-slate-700">「確認画面を表示してデザインIDを発行」ボタンをクリックすると、PDFプレビューが表示されます。</p>
                <ul className="ml-4 list-disc space-y-1 text-xs text-slate-600">
                  <li>PDFで最終的な仕上がりを確認</li>
                  <li>問題があれば「戻る」ボタンで前のステップに戻れます</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-semibold text-slate-900">デザインIDの発行</h4>
                <p className="mb-2 text-sm text-slate-700">確認画面で問題がなければ、「✓ デザインIDを発行する」ボタンをクリックします。</p>
                <ul className="ml-4 list-disc space-y-1 text-xs text-slate-600">
                  <li>発行後、デザインIDが表示されます</li>
                  <li>デザインIDは発行履歴に保存されます</li>
                  <li>確認用PDFと刻印用PDFをダウンロードできます</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-semibold text-slate-900">ダウンロード</h4>
                <p className="mb-2 text-sm text-slate-700">発行後、以下のPDFをダウンロードできます。</p>
                <ul className="ml-4 list-disc space-y-1 text-xs text-slate-600">
                  <li>確認用PDF：お客様への確認用</li>
                  <li>刻印用PDF：実際の刻印作業で使用</li>
                </ul>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-700">💡 ヒント</p>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  デザインIDは一度発行すると変更できません。発行前に必ずPDFプレビューで確認してください。
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
