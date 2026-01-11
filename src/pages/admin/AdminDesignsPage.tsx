import { useCallback, useEffect, useMemo, useState } from "react";
import { Toast } from "@/components/common/Toast";
import type { Design, TemplateSummary } from "@/domain/types";
import { generateConfirmPdf } from "@/domain/pdf/generateConfirmPdf";
import { generateEngravePdf } from "@/domain/pdf/generateEngravePdf";
import { deleteDesign, getDesign, getTemplate, listDesigns, listTemplates } from "@/storage/local";
import { deleteAssets, getAssetById, saveAsset } from "@/storage/idb";

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
  const [previewInfo, setPreviewInfo] = useState<{ designId: string; kind: "confirm" | "engrave" } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

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

  const getPdfBlob = useCallback(async (design: Design, kind: "confirm" | "engrave") => {
    try {
      const assetId = kind === "confirm" ? design.pdf.confirmAssetId : design.pdf.engraveAssetId;
      const asset = await getAssetById(assetId);
      if (asset) {
        return asset.blob;
      }
      const template = getTemplate(design.templateKey);
      if (!template) {
        setToast({ message: "テンプレートが見つかりません。", tone: "error" });
        return null;
      }
      const bgAsset = await getAssetById(`asset:templateBg:${design.templateKey}`);
      const logoAsset = await getAssetById(`asset:logoEdited:${design.designId}`);
      if (!logoAsset) {
        setToast({ message: "ロゴ画像が見つかりません。", tone: "error" });
        return null;
      }
      const pdfBlob =
        kind === "confirm"
          ? await generateConfirmPdf(template, bgAsset?.blob ?? null, logoAsset.blob, design.placement, design.designId)
          : await generateEngravePdf(template, logoAsset.blob, design.placement, {
              designId: design.designId,
              createdAt: design.createdAt
            });
      await saveAsset({
        id: assetId,
        type: kind === "confirm" ? "pdfConfirm" : "pdfEngrave",
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
    async (design: Design, kind: "confirm" | "engrave") => {
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
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewBlob(null);
    setPreviewInfo(null);
  }, [previewUrl]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const confirmed = window.confirm("選択したデザイン発行履歴を削除しますか？");
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
    setToast({ message: "選択したデザイン発行履歴を削除しました。", tone: "success" });
  }, [selectedIds, reload]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const existing = new Set(designs.map((design) => design.designId));
      const next = new Set([...prev].filter((id) => existing.has(id)));
      return next;
    });
  }, [designs]);

  return (
    <section className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">デザイン発行履歴</h1>
        <p className="text-sm text-slate-500">発行済みのデザインを一覧で確認できます。</p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <input
            type="text"
            className="rounded-full border border-slate-200 px-3 py-2"
            placeholder="デザインIDで検索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="rounded-full border border-slate-200 px-3 py-2"
            value={templateFilter}
            onChange={(event) => setTemplateFilter(event.target.value)}
          >
            <option value="">テンプレキーで絞り込み</option>
            {templateOptions.map((template) => (
              <option key={template.templateKey} value={template.templateKey}>
                {template.templateKey}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleBulkDelete}
            disabled={selectedIds.size === 0}
          >
            選択したものを削除
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">一覧</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
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
                <th className="px-6 py-3 text-left">プレビュー</th>
                <th className="px-6 py-3 text-left">デザインID</th>
                <th className="px-6 py-3 text-left">テンプレキー</th>
                <th className="px-6 py-3 text-left">発行日</th>
                <th className="px-6 py-3 text-left">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredDesigns.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-sm text-slate-500" colSpan={6}>
                    デザイン発行履歴がありません。
                  </td>
                </tr>
              ) : (
                filteredDesigns.map((design) => (
                  <tr key={design.designId}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
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
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
                        {previewUrls[design.designId] ? (
                          <img
                            src={previewUrls[design.designId]}
                            alt={`${design.designId} のロゴ`}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-slate-400">なし</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">{design.designId}</td>
                    <td className="px-6 py-4">
                      {getTemplate(design.templateKey) ? design.templateKey : "テンプレートなし"}
                    </td>
                    <td className="px-6 py-4">{design.createdAt}</td>
                    <td className="px-6 py-4 space-x-2">
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                        onClick={() => handlePreview(design, "confirm")}
                      >
                        確認用プレビュー
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                        onClick={() => handlePreview(design, "engrave")}
                      >
                        刻印用プレビュー
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm">
              <span>
                {previewInfo.designId} / {previewInfo.kind === "confirm" ? "確認用" : "刻印用"}
              </span>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                onClick={handleClosePreview}
              >
                閉じる
              </button>
            </div>
            <div className="h-[70vh] bg-slate-50">
              <object data={previewUrl} type="application/pdf" className="h-full w-full">
                <p className="p-4 text-sm text-slate-500">PDFを表示できません。</p>
              </object>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs">
              <span className="text-slate-500">
                {isPreviewLoading ? "プレビューを読み込み中..." : "プレビューを確認してからダウンロードできます。"}
              </span>
              <button
                type="button"
                className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!previewBlob}
                onClick={() => {
                  if (!previewBlob || !previewInfo) return;
                  downloadBlob(previewBlob, `${previewInfo.designId}-${previewInfo.kind}.pdf`);
                }}
              >
                ダウンロード
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
