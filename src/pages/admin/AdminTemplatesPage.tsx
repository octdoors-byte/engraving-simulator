import { sampleTemplate } from "@/data/sampleTemplate";
import { StatusBadge } from "@/components/common/StatusBadge";

const columns = [
  { label: "テンプレート名", key: "name" },
  { label: "テンプレートキー", key: "templateKey" },
  { label: "ステータス", key: "status" },
  { label: "更新日時", key: "updatedAt" }
] as const;

export function AdminTemplatesPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-slate-900">テンプレート管理</h1>
          <p className="text-sm text-slate-500">
            template.json と背景画像をドラッグ&ドロップで登録します。ステータスは「下書き / テスト済み /
            公開中」に切り替えできます。背景ファイル名は JSON の fileName と一致が必要です。
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          <p>ドロップゾーンに template.json と背景画像の 2 ファイルを同時に置いてください。</p>
          <p>背景画像の fileName は template.json 側と一致させます。</p>
          <p>登録後は template.json を localStorage、背景画像を IndexedDB に保存します。</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">テンプレート一覧</h2>
            <button className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700">
              新規登録（ドラッグ&ドロップ）
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
                <th className="px-6 py-3 text-left">操作</th>
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
                    <button className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">編集</button>
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
