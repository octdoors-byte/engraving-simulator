import type { Design } from "@/domain/types";

const sampleDesign: Design = {
  designId: "260109_K7M3Q9XR",
  templateKey: "certificate_cover_a4_v1",
  createdAt: "2026-01-09T10:12:34.000+09:00",
  logo: {
    fileName: "logo.png",
    mimeType: "image/png",
    sizeBytes: 123456,
    crop: { x: 0.12, y: 0.08, w: 0.76, h: 0.81 },
    transparentLevel: "medium",
    monochrome: true
  },
  placement: {
    x: 860,
    y: 1260,
    w: 180,
    h: 90
  },
  pdf: {
    confirmAssetId: "asset:pdfConfirm:260109_K7M3Q9XR",
    engraveAssetId: "asset:pdfEngrave:260109_K7M3Q9XR"
  }
};

export function AdminDesignsPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">刻印履歴</h1>
        <p className="text-sm text-slate-500">
          発行済みのデザイン一覧です。概要は localStorage、PDF/画像は IndexedDB に保存されます。
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">一覧</h2>
            <div className="flex gap-3 text-xs text-slate-500">
              <span>検索: デザインID</span>
              <span>絞り込み: テンプレートキー</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3 text-left">デザインID</th>
                <th className="px-6 py-3 text-left">テンプレートキー</th>
                <th className="px-6 py-3 text-left">作成日時</th>
                <th className="px-6 py-3 text-left">PDF</th>
                <th className="px-6 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              <tr>
                <td className="px-6 py-4">{sampleDesign.designId}</td>
                <td className="px-6 py-4">{sampleDesign.templateKey}</td>
                <td className="px-6 py-4">{sampleDesign.createdAt}</td>
                <td className="px-6 py-4 space-x-2">
                  <button className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">
                    確認用
                  </button>
                  <button className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">
                    刻印用
                  </button>
                </td>
                <td className="px-6 py-4">
                  <button className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">削除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
