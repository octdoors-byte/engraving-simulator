import type { TemplateStatus } from "@/domain/types";
import { listTemplates, loadCommonSettings } from "@/storage/local";

const statusLabels: Record<TemplateStatus, string> = {
  draft: "下書き",
  tested: "テスト済み",
  published: "公開中"
};

export function SimLandingPage() {
  const templates = listTemplates();
  const settings = loadCommonSettings();
  const landingTitle = settings?.landingTitle?.trim() || "デザインシミュレーター";
  const [sortKey, setSortKey] = useState<"updatedAtDesc" | "updatedAtAsc" | "nameAsc">("updatedAtDesc");

  const sortedTemplates = [...templates].sort((a, b) => {
    if (sortKey === "updatedAtAsc") {
      return a.updatedAt.localeCompare(b.updatedAt);
    }
    if (sortKey === "nameAsc") {
      return a.name.localeCompare(b.name);
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">{landingTitle}</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">テンプレート一覧</h2>
        <p className="mt-2 text-sm text-slate-500">
          ここから使いたいテンプレートを選びます。公開中のテンプレートだけ利用できます。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span>並び替え</span>
          <select
            className="rounded border border-slate-200 px-2 py-1 text-xs"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as typeof sortKey)}
          >
            <option value="updatedAtDesc">登録日（新しい順）</option>
            <option value="updatedAtAsc">登録日（古い順）</option>
            <option value="nameAsc">表示名（あいうえお順）</option>
          </select>
        </div>
        {sortedTemplates.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">テンプレートがありません。</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3 text-left">表示名</th>
                  <th className="px-6 py-3 text-left">テンプレキー</th>
                  <th className="px-6 py-3 text-left">状態</th>
                  <th className="px-6 py-3 text-left">登録日</th>
                  <th className="px-6 py-3 text-left">公開URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sortedTemplates.map((template) => {
                  const simPath = `/sim/${template.templateKey}`;
                  return (
                    <tr key={template.templateKey}>
                      <td className="px-6 py-4 font-medium text-slate-900">{template.name}</td>
                      <td className="px-6 py-4 text-slate-600">{template.templateKey}</td>
                      <td className="px-6 py-4 text-slate-600">{statusLabels[template.status]}</td>
                      <td className="px-6 py-4 text-slate-600">{template.updatedAt}</td>
                      <td className="px-6 py-4">
                        <a
                          href={simPath}
                          className="text-xs text-slate-500 underline decoration-slate-300 hover:text-slate-700"
                        >
                          {simPath}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

