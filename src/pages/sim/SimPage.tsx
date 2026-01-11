import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getTemplate, listDesigns, saveDesign } from "@/storage/local";
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

export function SimPage() {
  const { templateKey } = useParams();
  const [template, setTemplate] = useState<Template | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone?: "info" | "success" | "error" } | null>(null);
  const [phase, setPhase] = useState<SimPhase>("EMPTY");
  const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [backgroundBlob, setBackgroundBlob] = useState<Blob | null>(null);
  const [crop, setCrop] = useState<DesignLogoSettings["crop"]>({ x: 0, y: 0, w: 1, h: 1 });
  const [transparentLevel, setTransparentLevel] = useState<DesignLogoSettings["transparentLevel"]>("medium");
  const [monochrome, setMonochrome] = useState(false);
  const [processedLogoBlob, setProcessedLogoBlob] = useState<Blob | null>(null);
  const [processedLogoUrl, setProcessedLogoUrl] = useState<string | null>(null);
  const [logoBaseSize, setLogoBaseSize] = useState<LogoBaseSize | null>(null);
  const [placement, setPlacement] = useState<DesignPlacement | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issuedDesignId, setIssuedDesignId] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const placementInitialized = useRef(false);

  useEffect(() => {
    if (!templateKey) {
      setErrorMessage("テンプレートキーが指定されていません。");
      return;
    }
    const loaded = getTemplate(templateKey);
    if (!loaded) {
      setErrorMessage("テンプレートが見つかりません。");
      return;
    }
    if (!["tested", "published"].includes(loaded.status)) {
      setErrorMessage("このテンプレートは現在ご利用いただけません（未公開）。");
      return;
    }
    setTemplate(loaded);
    setErrorMessage(null);
  }, [templateKey]);

  useEffect(() => {
    if (!template) return;
    let active = true;
    const loadBackground = async () => {
      const asset = await getAssetById(`asset:templateBg:${template.templateKey}`);
      if (!active) return;
      if (asset?.blob) {
        setBackgroundBlob(asset.blob);
        setBackgroundUrl(URL.createObjectURL(asset.blob));
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
    if (!backgroundUrl) return;
    return () => URL.revokeObjectURL(backgroundUrl);
  }, [backgroundUrl]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (imageUrl) {
      return () => URL.revokeObjectURL(imageUrl);
    }
  }, [imageUrl]);

  useEffect(() => {
    if (processedLogoUrl) {
      return () => URL.revokeObjectURL(processedLogoUrl);
    }
  }, [processedLogoUrl]);

  useEffect(() => {
    if (!imageBitmap) {
      setProcessedLogoBlob(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const blob = await processLogo(imageBitmap, {
          crop,
          transparentLevel,
          monochrome,
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
  }, [imageBitmap, crop, transparentLevel, monochrome]);

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
      setPhase("READY_TO_ISSUE");
    }
  }, [processedLogoBlob, placement, isIssuing, phase]);

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
      setTransparentLevel("medium");
      setMonochrome(false);
      setPlacement(null);
      placementInitialized.current = false;
      setImageUrl(URL.createObjectURL(file));
      setPhase("EDITING");
      setCropOpen(true);
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
        setPhase("READY_TO_ISSUE");
      }
    },
    [template, isIssuing]
  );

  const handleIssue = useCallback(async () => {
    if (!template || !imageBitmap || !uploadedFile || !processedLogoBlob || !placement) {
      setToast({ message: "先に画像をアップロードしてください。", tone: "error" });
      return;
    }
    setIsIssuing(true);
    setPhase("ISSUING");
    const createdAt = new Date().toISOString();
    let designId = "";
    try {
      const existingIds = new Set(listDesigns().map((entry) => entry.designId));
      designId = generateDesignId(existingIds);
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
    transparentLevel,
    monochrome,
    backgroundBlob,
  ]);

  const cropInputs = useMemo(
    () => [
      { label: "横の位置", key: "x" as const, min: 0, max: 0.9 },
      { label: "縦の位置", key: "y" as const, min: 0, max: 0.9 },
      { label: "横の大きさ", key: "w" as const, min: 0.2, max: 1 },
      { label: "縦の大きさ", key: "h" as const, min: 0.2, max: 1 }
    ],
    []
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
          <p className="text-xs text-slate-400">管理ID: {template.templateKey}</p>
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
              <li>2. トリミングと加工</li>
              <li>3. 配置してデザインIDを発行</li>
            </ol>
          </div>

          <Dropzone onFileAccepted={handleFileAccepted} onReject={handleReject} disabled={isIssuing} />

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-600">トリミング調整</p>
            <div
              className={`space-y-4 text-sm text-slate-500 ${!imageBitmap ? "opacity-50" : ""}`}
              aria-disabled={!imageBitmap}
            >
              <button
                type="button"
                className="w-full rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-600"
                disabled={!imageBitmap}
                onClick={() => setCropOpen(true)}
              >
                トリミングを開く
              </button>
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
                      setCrop((prev) => {
                        const next = { ...prev, [field.key]: value };
                        if (field.key === "w" && next.x + value > 1) {
                          next.x = Math.max(0, 1 - value);
                        }
                        if (field.key === "h" && next.y + value > 1) {
                          next.y = Math.max(0, 1 - value);
                        }
                        if (field.key === "x") {
                          next.x = Math.min(value, 1 - next.w);
                        }
                        if (field.key === "y") {
                          next.y = Math.min(value, 1 - next.h);
                        }
                        return next;
                      });
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">ロゴをアップロードすると調整できます。</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-600">背景透過</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {(["weak", "medium", "strong"] as DesignLogoSettings["transparentLevel"][]).map((level) => (
                <label key={level} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1">
                  <input
                    type="radio"
                    name="transparentLevel"
                    value={level}
                    checked={transparentLevel === level}
                    onChange={() => setTransparentLevel(level)}
                    disabled={!imageBitmap}
                  />
                  {level === "weak" ? "弱" : level === "medium" ? "中" : "強"}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-600">モノクロ</p>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={monochrome}
                onChange={(event) => setMonochrome(event.target.checked)}
                disabled={!imageBitmap}
              />
              モノクロに変換する
            </label>
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
                        setToast({ message: "デザインIDをコピーしました。", tone: "success" });
                      } catch (error) {
                        console.error(error);
                        setToast({ message: "コピーできませんでした。", tone: "error" });
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
            <span className="text-xs font-semibold text-slate-500">
              状態: {phase === "READY_TO_ISSUE" ? "発行可能" : phase}
            </span>
          </div>
          <div className="mt-4">
            {placement && (
              <StageCanvas
                template={template}
                backgroundUrl={backgroundUrl}
                logoUrl={processedLogoUrl}
                placement={placement}
                logoBaseSize={logoBaseSize}
                onPlacementChange={handlePlacementChange}
              />
            )}
            {!placement && <div className="text-xs text-slate-400">ロゴをアップロードするとプレビューが表示されます。</div>}
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
    </section>
  );
}
