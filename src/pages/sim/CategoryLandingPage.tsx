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
      {/* Hero Section - Modern Business Design */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">カテゴリ別公開URL</h1>
            <p className="text-sm text-slate-600">
              カテゴリごとにテンプレート名・公開URL・コピー・開くボタンを1行で確認できます
            </p>
          </div>
          <HelpIcon guideUrl="/categories_guide.html" title="カテゴリ一覧ガイド" />
        </div>
      </div>

      {orderedCategories.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm font-medium text-slate-600">公開中のテンプレートがありません</p>
        </div>
      ) : (
        orderedCategories.map((categoryId) => {
          const rows = categorized.get(categoryId) ?? [];
          const label = categoryTitleMap.get(categoryId) ?? categoryId;
          return (
            <div key={categoryId} className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-wide font-medium text-slate-500 mb-0.5">カテゴリ</p>
                  <h2 className="text-lg font-semibold text-slate-900">{label}</h2>
                </div>
                <div className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1">
                  <span className="text-xs font-semibold text-slate-700">{rows.length}</span>
                  <span className="text-xs text-slate-500">件</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">テンプレート名</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">公開URL</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {rows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={3}>
                          このカテゴリには公開中の商品がありません
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const url = buildUrl(`/sim/${row.templateKey}?cat=${encodeURIComponent(categoryId)}`);
                        return (
                          <tr key={`${categoryId}-${row.templateKey}`} className="whitespace-nowrap transition-colors hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                            <td className="px-4 py-3">
                              <div className="break-all rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-700">
                                {url}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50"
                                  onClick={() => navigator.clipboard.writeText(url)}
                                >
                                  コピー
                                </button>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50"
                                >
                                  開く
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
