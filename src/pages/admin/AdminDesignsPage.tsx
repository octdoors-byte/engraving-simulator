import { useCallback, useEffect, useMemo, useState } from "react";
import { Toast } from "@/components/common/Toast";
import { HelpIcon } from "@/components/common/HelpIcon";
import type { Design, TemplateSummary } from "@/domain/types";
import { generateConfirmPdf } from "@/domain/pdf/generateConfirmPdf";
import { processLogo } from "@/domain/image/processLogo";
import { deleteDesign, getDesign, getTemplate, listDesigns, listTemplates, loadTemplateBgFallback } from "@/storage/local";
import { deleteAssets, getAssetById, saveAsset } from "@/storage/idb";

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function normalizeLogoBlob(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png" || blob.type === "image/jpeg") {
    return blob;
  }
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
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (converted) => {
        if (converted) {
          resolve(converted);
        } else {
          reject(new Error("logo conversion failed"));
        }
      },
      "image/png",
      0.95
    );
  });
}

async function createLogoFromOriginal(
  blob: Blob,
  params: {
    crop: { x: number; y: number; w: number; h: number };
    transparentColor: { r: number; g: number; b: number } | null;
    monochrome: boolean;
  }
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    return await processLogo(bitmap, {
      crop: params.crop,
      transparentColor: params.transparentColor,
      monochrome: params.monochrome,
      maxOutputWidth: 1024,
      maxOutputHeight: 1024
    });
  } finally {
    if ("close" in bitmap) {
      bitmap.close();
    }
  }
}

export function AdminDesignsPage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [toast, setToast] = useState<{ message: string; tone?: "info" | "success" | "error" } | null>(null);
  const [search, setSearch] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [templateOptions, setTemplateOptions] = useState<TemplateSummary[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewInfo, setPreviewInfo] = useState<{ designId: string; kind: "confirm" } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageName, setPreviewImageName] = useState<string | null>(null);

  const reload = useCallback(() => {
    const summaries = listDesigns();
    const full = summaries
      .map((summary) => getDesign(summary.designId))
      .filter((design): design is Design => Boolean(design));
    full.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setDesigns(full);
    setTemplateOptions(listTemplates());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let active = true;
    const blobUrls: string[] = [];
    const loadPreviews = async () => {
      const next: Record<string, string> = {};
      for (const design of designs) {
        const asset = await getAssetById(`asset:logoEdited:${design.designId}`);
        if (asset?.blob) {
          const url = URL.createObjectURL(asset.blob);
          blobUrls.push(url);
          next[design.designId] = url;
        }
      }
      if (!active) {
        blobUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setPreviewUrls((prev) => {
        Object.values(prev)
          .filter((url) => url.startsWith("blob:"))
          .forEach((url) => URL.revokeObjectURL(url));
        return next;
      });
    };
    loadPreviews();
    return () => {
      active = false;
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [designs]);

  const filteredDesigns = useMemo(() => {
    return designs.filter((design) => {
      const matchesSearch = search ? design.designId.includes(search) : true;
      const matchesTemplate = templateFilter ? design.templateKey === templateFilter : true;
      return matchesSearch && matchesTemplate;
    });
  }, [designs, search, templateFilter]);

  const allSelected = useMemo(() => {
    if (filteredDesigns.length === 0) return false;
    return filteredDesigns.every((design) => selectedIds.has(design.designId));
  }, [filteredDesigns, selectedIds]);

  const getPdfBlob = useCallback(async (design: Design, kind: "confirm") => {
    try {
      const confirmAssetId = design.pdf?.confirmAssetId ?? `asset:pdfConfirm:${design.designId}`;
      const confirmAsset = await getAssetById(confirmAssetId);
      if (confirmAsset?.blob && confirmAsset.blob.size > 0) {
        if (confirmAsset.blob.size < 5000) {
          console.warn("Confirm PDF seems too small, regenerating.");
        } else {
          return confirmAsset.blob;
        }
      }
      const assetId = confirmAssetId;
      const template = getTemplate(design.templateKey);
      if (!template) {
        setToast({ message: "テンプレートが見つかりません。", tone: "error" });
        return null;
      }
      let backgroundBlob: Blob | null = null;
      if (kind === "confirm") {
        const bgAsset = await getAssetById(`asset:templateBg:${design.templateKey}`);
        backgroundBlob = bgAsset?.blob ?? null;
        if (!backgroundBlob) {
          const fallback = loadTemplateBgFallback(design.templateKey);
          if (fallback) {
            try {
              const response = await fetch(fallback);
              backgroundBlob = await response.blob();
            } catch (error) {
              console.error(error);
            }
          }
        }
        if (!backgroundBlob && template.background.fileName) {
          try {
            const response = await fetch(`/assets/${template.background.fileName}`);
            if (response.ok) {
              backgroundBlob = await response.blob();
            }
          } catch (error) {
            console.error(error);
          }
        }
      }
      const editedAsset = await getAssetById(`asset:logoEdited:${design.designId}`);
      const originalAsset = await getAssetById(`asset:logoOriginal:${design.designId}`);
      let logoBlob = editedAsset?.blob ?? null;
      if (!logoBlob && originalAsset?.blob) {
        try {
          logoBlob = await createLogoFromOriginal(originalAsset.blob, {
            crop: design.logo.crop,
            transparentColor: design.logo.transparentColor,
            monochrome: design.logo.monochrome
          });
          await saveAsset({
            id: `asset:logoEdited:${design.designId}`,
            type: "logoEdited",
            blob: logoBlob,
            createdAt: design.createdAt
          });
        } catch (error) {
          console.error(error);
        }
      }
      if (!logoBlob && originalAsset?.blob) {
        logoBlob = originalAsset.blob;
      }
      if (!logoBlob) {
        setToast({ message: "ロゴ画像が見つかりません。", tone: "error" });
        return null;
      }
      try {
        logoBlob = await normalizeLogoBlob(logoBlob);
      } catch (error) {
        console.error(error);
      }
      const pdfBlob = await generateConfirmPdf(
        template,
        backgroundBlob ?? null,
        logoBlob,
        design.placement,
        design.designId
      );
      await saveAsset({
        id: assetId,
        type: "pdfConfirm",
        blob: pdfBlob,
        createdAt: new Date().toISOString()
      });
      return pdfBlob;
    } catch (error) {
      console.error(error);
      setToast({ message: "PDFのダウンロードに失敗しました。", tone: "error" });
      return null;
    }
  }, []);

  const handlePreview = useCallback(
    async (design: Design, kind: "confirm") => {
      setIsPreviewLoading(true);
      const blob = await getPdfBlob(design, kind);
      setIsPreviewLoading(false);
      if (!blob) return;
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewBlob(blob);
      setPreviewInfo({ designId: design.designId, kind });
    },
    [getPdfBlob, previewUrl]
  );

  const handleClosePreview = useCallback(() => {
    const urlToRevoke = previewUrl;
    setPreviewUrl(null);
    setPreviewBlob(null);
    setPreviewInfo(null);
    // objectがblob URLを読み込む前にrevokeされないよう、少し遅延してからrevoke
    // モーダルが閉じられ、objectがDOMから削除されるのを待つ
    if (urlToRevoke) {
      setTimeout(() => {
        URL.revokeObjectURL(urlToRevoke);
      }, 300);
    }
  }, [previewUrl]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const confirmed = window.confirm("選択したデザイン作成履歴を削除しますか？");
    if (!confirmed) return;
    await Promise.all(
      ids.map(async (designId) => {
        deleteDesign(designId);
        await deleteAssets([
          `asset:logoOriginal:${designId}`,
          `asset:logoEdited:${designId}`,
          `asset:pdfConfirm:${designId}`,
          `asset:pdfEngrave:${designId}`
        ]);
      })
    );
    setSelectedIds(new Set());
    reload();
    setToast({ message: "選択したデザイン作成履歴を削除しました。", tone: "success" });
  }, [selectedIds, reload]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const existing = new Set(designs.map((design) => design.designId));
      const next = new Set([...prev].filter((id) => existing.has(id)));
      return next;
    });
  }, [designs]);

  return (
    <section className="space-y-8">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      {/* Hero Section - Premium Design without Gradient */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmMWY1ZjkiIGZpbGwtb3BhY2l0eT0iMC4zIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500 text-3xl shadow-lg">
              🎨
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">デザイン作成履歴</h1>
              <p className="text-base text-slate-700 mt-1 font-medium">作成済みのデザインを一覧で確認</p>
            </div>
            <HelpIcon guideUrl="/design_history.html" title="デザイン作成履歴の操作ガイド" />
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="🔍 デザインIDで検索"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <select
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              value={templateFilter}
              onChange={(event) => setTemplateFilter(event.target.value)}
            >
              <option value="">📋 テンプレートIDで絞り込み</option>
              {templateOptions.map((template) => (
                <option key={template.templateKey} value={template.templateKey}>
                  {template.templateKey}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="rounded-xl border-2 border-rose-300 bg-rose-50 px-6 py-3 text-sm font-black text-rose-700 shadow-sm transition-all hover:border-rose-400 hover:bg-rose-100 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleBulkDelete}
            disabled={selectedIds.size === 0}
          >
            🗑️ 選択したものを削除 ({selectedIds.size})
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b-2 border-slate-200 bg-slate-100 px-8 py-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">一覧</h2>
            <div className="flex items-center gap-2 rounded-xl border-2 border-indigo-300 bg-indigo-50 px-4 py-2">
              <span className="text-sm font-black text-indigo-900">全{filteredDesigns.length}件</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-2 border-slate-300 text-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    checked={allSelected}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedIds(new Set(filteredDesigns.map((design) => design.designId)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                    aria-label="すべて選択"
                  />
                </th>
                <th className="px-6 py-4 text-left font-bold">プレビュー</th>
                <th className="px-6 py-4 text-left font-bold">デザインID</th>
                <th className="px-6 py-4 text-left font-bold">テンプレートID</th>
                <th className="px-6 py-4 text-left font-bold">作成日</th>
                <th className="px-6 py-4 text-left font-bold">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredDesigns.length === 0 ? (
                <tr>
                  <td className="px-6 py-12 text-center text-sm text-slate-500" colSpan={6}>
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">
                        📭
                      </div>
                      <p className="font-medium">デザイン作成履歴がありません</p>
                      <p className="text-xs text-slate-400">シミュレーターでデザインを作成すると、ここに表示されます</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDesigns.map((design) => (
                  <tr key={design.designId} className="transition-colors hover:bg-indigo-50/50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-2 border-slate-300 text-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        checked={selectedIds.has(design.designId)}
                        onChange={(event) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (event.target.checked) {
                              next.add(design.designId);
                            } else {
                              next.delete(design.designId);
                            }
                            return next;
                          });
                        }}
                        aria-label={`${design.designId} を選択`}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm transition-all hover:scale-105 hover:shadow-md">
                        {previewUrls[design.designId] ? (
                          <img
                            src={previewUrls[design.designId]}
                            alt={`${design.designId} のロゴ`}
                            className="h-full w-full cursor-pointer object-contain transition-all hover:opacity-90"
                            onClick={() => {
                              setPreviewImageUrl(previewUrls[design.designId]);
                              setPreviewImageName(design.designId);
                            }}
                          />
                        ) : (
                          <span className="text-xs text-slate-400">なし</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm font-semibold text-slate-900">{design.designId}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-lg border-2 px-3 py-1.5 text-xs font-bold ${
                        getTemplate(design.templateKey)
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-slate-300 bg-slate-100 text-slate-500"
                      }`}>
                        {getTemplate(design.templateKey) ? design.templateKey : "テンプレートなし"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-700">{formatDate(design.createdAt)}</td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        className="rounded-lg border-2 border-indigo-300 bg-indigo-50 px-4 py-2 text-xs font-black text-indigo-700 shadow-sm transition-all hover:border-indigo-400 hover:bg-indigo-100 hover:shadow-md"
                        onClick={() => handlePreview(design, "confirm")}
                      >
                        📄 確認用PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {previewUrl && previewInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-all">
          <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl transition-all">
            <div className="flex items-center justify-between border-b-2 border-slate-200 bg-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-lg shadow-md">
                  📄
                </div>
                <div>
                  <span className="text-lg font-black text-slate-900">{previewInfo.designId}</span>
                  <span className="ml-2 text-sm font-semibold text-slate-600">/ 確認用PDF</span>
                </div>
              </div>
              <button
                type="button"
                className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
                onClick={handleClosePreview}
              >
                ✕ 閉じる
              </button>
            </div>
            <div className="h-[70vh] bg-white">
              <object data={previewUrl} type="application/pdf" className="h-full w-full">
                <p className="p-4 text-sm text-slate-500">PDFを表示できません。</p>
              </object>
            </div>
            <div className="flex items-center justify-between border-t-2 border-slate-200 bg-slate-100 px-6 py-4">
              <span className="text-sm font-semibold text-slate-700">
                {isPreviewLoading ? "⏳ 確認画面を読み込み中..." : "✓ 確認画面を確認してからダウンロードできます。"}
              </span>
              <button
                type="button"
                className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-6 py-2 text-sm font-black text-emerald-700 shadow-sm transition-all hover:border-emerald-400 hover:bg-emerald-100 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!previewBlob}
                onClick={() => {
                  if (!previewBlob || !previewInfo) return;
                  downloadBlob(previewBlob, `${previewInfo.designId}-confirm.pdf`);
                }}
              >
                ⬇️ ダウンロード
              </button>
            </div>
          </div>
        </div>
      )}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-all"
          onClick={() => {
            setPreviewImageUrl(null);
            setPreviewImageName(null);
          }}
        >
          <div
            className="flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 bg-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-lg shadow-md">
                  🖼️
                </div>
                <span className="text-lg font-black text-slate-900">{previewImageName}</span>
              </div>
              <button
                type="button"
                className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
                onClick={() => {
                  setPreviewImageUrl(null);
                  setPreviewImageName(null);
                }}
              >
                ✕ 閉じる
              </button>
            </div>
            <div className="flex max-h-[80vh] items-center justify-center bg-white p-8">
              <img
                src={previewImageUrl}
                alt={previewImageName || "プレビュー"}
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
