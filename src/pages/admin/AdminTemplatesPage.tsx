import { sampleTemplate } from "@/data/sampleTemplate";
import { StatusBadge } from "@/components/common/StatusBadge";

const columns = [
  { label: "Template Name", key: "name" },
  { label: "Key", key: "templateKey" },
  { label: "Status", key: "status" },
  { label: "Updated", key: "updatedAt" }
] as const;

export function AdminTemplatesPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-slate-900">テンプレート管理</h1>
          <p className="text-sm text-slate-500">
            template.json + 背景画像を D&D で登録し、status を draft/tested/published に切り替えます。背景ファイル名は JSON の fileName と一致する必要があります。
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          <p>Dropzone: 2 ファイルを同時にドロップ（JSON + 画像）</p>
          <p>一致しない fileName はエラー</p>
          <p>登録後は template.json を localStorage & 背景を IndexedDB に保存</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">テンプレート一覧</h2>
            <button className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700">
              新規登録（ドラッグ & ドロップ）
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="px-6 py-3 text-left">
                    {col.label}
                  </th>
                ))}
                <th className="px-6 py-3 text-left">{/* actions */}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {[sampleTemplate].map((template) => (
                <tr key={template.templateKey}>
                  <td className="px-6 py-4">{template.name}</td>
                  <td className="px-6 py-4">{template.templateKey}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={template.status} />
                  </td>
                  <td className="px-6 py-4">{template.updatedAt}</td>
                  <td className="px-6 py-4 space-x-2 text-xs">
                    <button className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">表示</button>
                    <button className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
