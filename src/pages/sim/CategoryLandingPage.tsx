import { useMemo } from "react";
import type { TemplateSummary } from "@/domain/types";
import { listTemplates, loadCommonSettings } from "@/storage/local";
import { HelpIcon } from "@/components/common/HelpIcon";

type TemplateRow = {
  name: string;
  categories: string[];
  templateKey: string;
};

function splitTemplateKey(templateKey: string): { baseKey: string; side: "front" | "back" | null } {
  if (templateKey.endsWith("_front")) return { baseKey: templateKey.slice(0, -"_front".length), side: "front" };
  if (templateKey.endsWith("_back")) return { baseKey: templateKey.slice(0, -"_back".length), side: "back" };
  return { baseKey: templateKey, side: null };
}

// 公開中のみをカテゴリごとにまとめ、front/backがあれば表側を優先してURLに使う
function groupByCategory(list: TemplateSummary[]): Map<string, TemplateRow[]> {
  const published = list.filter((tpl) => tpl.status === "published");
  const groupedByBase = new Map<string, TemplateSummary[]>();
  published.forEach((tpl) => {
    const { baseKey, side } = splitTemplateKey(tpl.templateKey);
    const key = side ? baseKey : tpl.templateKey;
    const arr = groupedByBase.get(key) ?? [];
    arr.push(tpl);
    groupedByBase.set(key, arr);
  });

  const result = new Map<string, TemplateRow[]>();
  const push = (cat: string, row: TemplateRow) => {
    const list = result.get(cat) ?? [];
    list.push(row);
    result.set(cat, list);
  };

  groupedByBase.forEach((items) => {
    const preferred =
      items.find((i) => i.templateKey.endsWith("_front")) ??
      items.find((i) => i.templateKey.endsWith("_back")) ??
      items[0];
    const categories = Array.from(
      new Set(
        items.flatMap((i) =>
          i.categories && i.categories.length > 0 ? i.categories : i.category ? [i.category] : []
        )
      )
    );
    const row: TemplateRow = {
      name: items.length > 1 ? `${preferred.name}（表/裏）` : preferred.name,
      categories,
      templateKey: preferred.templateKey
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
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-semibold text-slate-900">カテゴリ別公開URL（お客様向け）</h1>
          <HelpIcon guideUrl="/categories_guide.html" title="カテゴリ一覧ガイド" />
        </div>
        <p className="mt-4 text-sm text-slate-600">
          カテゴリごとにテンプレート名・公開URL・コピー・開くボタンを1行で確認できます。カテゴリごとに表を分けています。
        </p>
      </div>

      {orderedCategories.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          公開中のテンプレートがありません。
        </div>
      ) : (
        orderedCategories.map((categoryId) => {
          const rows = categorized.get(categoryId) ?? [];
          const label = categoryTitleMap.get(categoryId) ?? categoryId;
          return (
            <div key={categoryId} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">カテゴリ</p>
                  <h2 className="text-lg font-semibold text-slate-900">{label}</h2>
                </div>
                <p className="text-xs text-slate-500">公開テンプレート {rows.length} 件</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left">テンプレート名</th>
                      <th className="px-4 py-3 text-left">公開URL</th>
                      <th className="px-4 py-3 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-3 text-sm text-slate-500" colSpan={3}>
                          このカテゴリには公開中の商品がありません。
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const url = buildUrl(`/sim/${row.templateKey}?cat=${encodeURIComponent(categoryId)}`);
                        return (
                          <tr key={`${categoryId}-${row.templateKey}`} className="whitespace-nowrap">
                            <td className="px-4 py-2 font-semibold text-slate-900">{row.name}</td>
                            <td className="px-4 py-2">
                              <div className="break-all rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                                {url}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-white"
                                  onClick={() => navigator.clipboard.writeText(url)}
                                >
                                  コピー
                                </button>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-white"
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
