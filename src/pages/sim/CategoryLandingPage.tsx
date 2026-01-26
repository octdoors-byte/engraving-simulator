import { useMemo } from "react";
import type { TemplateSummary } from "@/domain/types";
import { listTemplates, loadCommonSettings } from "@/storage/local";
import { HelpIcon } from "@/components/common/HelpIcon";

type TemplateRow = {
  name: string;
  categories: string[];
  templateKey: string;
};

// 公開中のみをカテゴリごとにまとめて表示する
function groupByCategory(list: TemplateSummary[]): Map<string, TemplateRow[]> {
  const published = list.filter((tpl) => tpl.status === "published");

  const result = new Map<string, TemplateRow[]>();
  const push = (cat: string, row: TemplateRow) => {
    const list = result.get(cat) ?? [];
    list.push(row);
    result.set(cat, list);
  };

  published.forEach((tpl) => {
    const categories =
      tpl.categories && tpl.categories.length > 0 ? tpl.categories : tpl.category ? [tpl.category] : [];
    const row: TemplateRow = {
      name: tpl.name,
      categories,
      templateKey: tpl.templateKey
    };
    if (categories.length === 0) {
      push("未分類", row);
    } else {
      categories.forEach((cat) => push(cat, row));
    }
  });

  result.forEach((rows) => rows.sort((a, b) => a.name.localeCompare(b.name)));
  return result;
}

const buildUrl = (path: string) =>
  typeof window !== "undefined" ? new URL(path, window.location.origin).toString() : path;

export function CategoryLandingPage() {
  const settings = loadCommonSettings();
  const categorized = useMemo(() => groupByCategory(listTemplates()), []);

  const categoryTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    settings?.commonInfoCategories?.forEach((c) => {
      if (c.id) map.set(c.id, c.title?.trim() || "未設定");
    });
    map.set("未分類", "未分類");
    return map;
  }, [settings?.commonInfoCategories]);

  const orderedCategories = useMemo(() => {
    const masterOrder = settings?.commonInfoCategories?.map((c) => c.id).filter(Boolean) ?? [];
    const others = Array.from(categorized.keys()).filter(
      (id) => id !== "未分類" && !masterOrder.includes(id)
    );
    others.sort();
    const result = [...masterOrder, ...others];
    if (categorized.has("未分類")) result.push("未分類");
    return result;
  }, [categorized, settings?.commonInfoCategories]);

  return (
    <section className="space-y-8">
      {/* Hero Section - Premium Design without Gradient */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmMWY1ZjkiIGZpbGwtb3BhY2l0eT0iMC4zIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500 text-3xl shadow-lg">
              📂
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">カテゴリ別公開URL</h1>
              <p className="text-base text-slate-700 font-medium">
                カテゴリごとにテンプレート名・公開URL・コピー・開くボタンを1行で確認できます
              </p>
            </div>
            <HelpIcon guideUrl="/categories_guide.html" title="カテゴリ一覧ガイド" />
          </div>
        </div>
      </div>

      {orderedCategories.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center shadow-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-4xl">
              📭
            </div>
            <p className="text-lg font-bold text-slate-700">公開中のテンプレートがありません</p>
          </div>
        </div>
      ) : (
        orderedCategories.map((categoryId) => {
          const rows = categorized.get(categoryId) ?? [];
          const label = categoryTitleMap.get(categoryId) ?? categoryId;
          return (
            <div key={categoryId} className="overflow-hidden rounded-3xl border-2 border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b-2 border-slate-200 bg-slate-100 px-8 py-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500 text-2xl shadow-md">
                    📁
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider font-black text-slate-500 mb-1">カテゴリ</p>
                    <h2 className="text-2xl font-black text-slate-900">{label}</h2>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl border-2 border-sky-300 bg-sky-50 px-4 py-2">
                  <span className="text-sm font-black text-sky-900">{rows.length}</span>
                  <span className="text-xs font-bold text-sky-700">件</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-100 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-6 py-4 text-left font-black text-slate-700">テンプレート名</th>
                      <th className="px-6 py-4 text-left font-black text-slate-700">公開URL</th>
                      <th className="px-6 py-4 text-left font-black text-slate-700">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {rows.length === 0 ? (
                      <tr>
                        <td className="px-6 py-8 text-center text-sm font-semibold text-slate-500" colSpan={3}>
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-2xl">📭</span>
                            <span>このカテゴリには公開中の商品がありません</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const url = buildUrl(`/sim/${row.templateKey}?cat=${encodeURIComponent(categoryId)}`);
                        return (
                          <tr key={`${categoryId}-${row.templateKey}`} className="whitespace-nowrap transition-colors hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center rounded-xl border-2 border-slate-200 bg-white px-4 py-2 font-bold text-slate-900 shadow-sm">
                                {row.name}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="break-all rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-xs font-semibold text-slate-700 shadow-sm">
                                {url}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 shadow-sm transition-all hover:border-emerald-400 hover:bg-emerald-100 hover:shadow-md"
                                  onClick={() => navigator.clipboard.writeText(url)}
                                >
                                  📋 コピー
                                </button>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center rounded-xl border-2 border-sky-300 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700 shadow-sm transition-all hover:border-sky-400 hover:bg-sky-100 hover:shadow-md"
                                >
                                  🔗 開く
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
