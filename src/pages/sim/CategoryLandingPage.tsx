import { useMemo } from "react";
import type { TemplateSummary } from "@/domain/types";
import { listTemplates, loadCommonSettings } from "@/storage/local";

type TemplateRow = {
  key: string;
  name: string;
  categories: string[];
  primaryTemplateKey: string;
  updatedAt: string;
};

function splitTemplateKey(templateKey: string): { baseKey: string; side: "front" | "back" | null } {
  if (templateKey.endsWith("_front")) {
    return { baseKey: templateKey.slice(0, -"_front".length), side: "front" };
  }
  if (templateKey.endsWith("_back")) {
    return { baseKey: templateKey.slice(0, -"_back".length), side: "back" };
  }
  return { baseKey: templateKey, side: null };
}

function groupTemplates(list: TemplateSummary[]): TemplateRow[] {
  const publishedOnly = list.filter((template) => template.status === "published");
  const map = new Map<string, TemplateSummary[]>();
  publishedOnly.forEach((template) => {
    const { baseKey, side } = splitTemplateKey(template.templateKey);
    const key = side ? baseKey : template.templateKey;
    const items = map.get(key) ?? [];
    items.push(template);
    map.set(key, items);
  });
  return Array.from(map.entries()).map(([key, items]) => {
    const sorted = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const preferred = items.find((item) => item.templateKey.endsWith("_front")) ?? items[0];
    const categories = Array.from(
      new Set(
        items.flatMap((item) =>
          item.categories && item.categories.length > 0
            ? item.categories
            : item.category
            ? [item.category]
            : []
        )
      )
    );
    return {
      key,
      name: items.length > 1 ? `${preferred.name}（表/裏）` : preferred.name,
      categories,
      primaryTemplateKey: preferred.templateKey,
      updatedAt: sorted[0]?.updatedAt ?? ""
    };
  });
}

const buildUrl = (path: string) =>
  typeof window !== "undefined" ? new URL(path, window.location.origin).toString() : path;

export function CategoryLandingPage() {
  const settings = loadCommonSettings();
  const templates = useMemo(() => groupTemplates(listTemplates()), []);

  const categoryTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    settings?.commonInfoCategories?.forEach((c) => {
      if (c.id) {
        map.set(c.id, c.title || c.id);
      }
    });
    return map;
  }, [settings?.commonInfoCategories]);

  const categorized = useMemo(() => {
    const buckets = new Map<string, TemplateRow[]>();
    const push = (cat: string, row: TemplateRow) => {
      const arr = buckets.get(cat) ?? [];
      arr.push(row);
      buckets.set(cat, arr);
    };
    templates.forEach((row) => {
      if (row.categories.length === 0) {
        push("未分類", row);
        return;
      }
      row.categories.forEach((cat) => push(cat, row));
    });
    buckets.forEach((rows, key) => {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    });
    return buckets;
  }, [templates]);

  const orderedCategories = useMemo(() => {
    const masterOrder = settings?.commonInfoCategories?.map((c) => c.id).filter(Boolean) ?? [];
    const others = Array.from(categorized.keys()).filter(
      (key) => key !== "未分類" && !masterOrder.includes(key)
    );
    const result = [...masterOrder];
    others.sort().forEach((id) => result.push(id));
    if (categorized.has("未分類")) {
      result.push("未分類");
    }
    return result;
  }, [categorized, settings?.commonInfoCategories]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">カテゴリ別URLまとめ</h1>
        <p className="mt-4 text-sm text-slate-600">
          公開中テンプレートをカテゴリごとに表示します。各カテゴリの一覧URLとテンプレートの公開URLをコピーできます。
        </p>
      </div>

      {orderedCategories.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          公開中のテンプレートがありません。
        </div>
      ) : (
        <div className="space-y-4">
          {orderedCategories.map((categoryId) => {
            const rows = categorized.get(categoryId) ?? [];
            const label = categoryTitleMap.get(categoryId) ?? categoryId;
            const listUrl = buildUrl(`/top?cat=${encodeURIComponent(categoryId)}`);
            return (
              <div key={categoryId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">カテゴリ</p>
                    <h2 className="text-xl font-semibold text-slate-900">{label}</h2>
                    <p className="text-xs text-slate-500">{rows.length} 件</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => window.open(listUrl, "_blank")}
                    >
                      一覧を開く
                    </button>
                  </div>
                </div>

                {rows.length === 0 ? (
                  <p className="py-3 text-sm text-slate-500">このカテゴリの公開テンプレートはありません。</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {rows.map((row) => {
                      const simPath = `/sim/${row.key}`;
                      const simUrl = buildUrl(`${simPath}?cat=${encodeURIComponent(categoryId)}`);
                      return (
                        <li key={row.key} className="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
                          <div>
                            <div className="text-base font-semibold text-slate-900">{row.name}</div>
                            <div className="text-xs text-slate-500">{row.primaryTemplateKey}</div>
                            <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-600">
                              {(row.categories.length > 0 ? row.categories : ["未分類"]).map((cat) => (
                                <span
                                  key={cat}
                                  className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5"
                                >
                                  {categoryTitleMap.get(cat) ?? cat}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => window.open(simUrl, "_blank")}
                            >
                              公開ページを開く
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
