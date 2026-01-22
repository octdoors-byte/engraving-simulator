import { useMemo } from "react";
import type { TemplateSummary } from "@/domain/types";
import { listTemplates, loadCommonSettings } from "@/storage/local";

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
      if (c.id) map.set(c.id, c.title || c.id);
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

  const flatRows = useMemo(() => {
    const rows: Array<{ categoryId: string; categoryLabel: string; row: TemplateRow }> = [];
    orderedCategories.forEach((catId) => {
      const list = categorized.get(catId) ?? [];
      list.forEach((row) => rows.push({ categoryId: catId, categoryLabel: categoryTitleMap.get(catId) ?? catId, row }));
    });
    return rows;
  }, [categorized, orderedCategories, categoryTitleMap]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">カテゴリ一覧（公開URL集）</h1>
        <p className="mt-4 text-sm text-slate-600">テンプレート名・公開URL・コピー・開くを1行の表で一覧できます。</p>
      </div>

      {flatRows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          公開中のテンプレートがありません。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">カテゴリ</th>
                <th className="px-4 py-3 text-left">テンプレート名</th>
                <th className="px-4 py-3 text-left">公開URL</th>
                <th className="px-4 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flatRows.map(({ categoryId, categoryLabel, row }) => {
                const url = buildUrl(`/sim/${row.templateKey}?cat=${encodeURIComponent(categoryId)}`);
                return (
                  <tr key={`${categoryId}-${row.templateKey}`} className="whitespace-nowrap">
                    <td className="px-4 py-2 text-slate-800">{categoryLabel}</td>
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
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
