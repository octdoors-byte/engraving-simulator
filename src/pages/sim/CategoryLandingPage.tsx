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

  const categoryColorMap = useMemo(() => {
    const map = new Map<string, string>();
    settings?.commonInfoCategories?.forEach((c) => {
      if (c.id && c.color) {
        map.set(c.id, c.color);
      }
    });
    return map;
  }, [settings?.commonInfoCategories]);

  const getCategoryColorStyles = (color: string | undefined) => {
    if (!color) {
      return {
        bg: "#f1f5f9",
        border: "#cbd5e1",
        text: "#0f172a",
        accent: "#64748b"
      };
    }

    // 16進数カラーコードの場合、直接使用
    if (color.startsWith("#")) {
      // 16進数からRGBに変換して、背景色（薄く）とテキスト色（濃く）を生成
      let hex = color.replace("#", "");
      // 3桁の場合は6桁に変換
      if (hex.length === 3) {
        hex = hex.split("").map((c) => c + c).join("");
      }
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);

      // 背景色（薄く、透明度を上げる）
      const bgR = Math.min(255, Math.round(r + (255 - r) * 0.9));
      const bgG = Math.min(255, Math.round(g + (255 - g) * 0.9));
      const bgB = Math.min(255, Math.round(b + (255 - b) * 0.9));
      const bg = `rgb(${bgR}, ${bgG}, ${bgB})`;

      // ボーダー色（少し薄く）
      const borderR = Math.min(255, Math.round(r + (255 - r) * 0.6));
      const borderG = Math.min(255, Math.round(g + (255 - g) * 0.6));
      const borderB = Math.min(255, Math.round(b + (255 - b) * 0.6));
      const border = `rgb(${borderR}, ${borderG}, ${borderB})`;

      // テキスト色（濃く、元の色を少し暗く）
      const textR = Math.max(0, Math.round(r * 0.4));
      const textG = Math.max(0, Math.round(g * 0.4));
      const textB = Math.max(0, Math.round(b * 0.4));
      const text = `rgb(${textR}, ${textG}, ${textB})`;

      // アクセント色（中間）
      const accentR = Math.max(0, Math.round(r * 0.6));
      const accentG = Math.max(0, Math.round(g * 0.6));
      const accentB = Math.max(0, Math.round(b * 0.6));
      const accent = `rgb(${accentR}, ${accentG}, ${accentB})`;

      return { bg, border, text, accent };
    }

    // 色名の場合（後方互換性のため）
    const colorMap: Record<string, { bg: string; border: string; text: string; accent: string }> = {
      emerald: { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46", accent: "#047857" },
      blue: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af", accent: "#1d4ed8" },
      rose: { bg: "#fff1f2", border: "#fecdd3", text: "#881337", accent: "#9f1239" },
      amber: { bg: "#fffbeb", border: "#fde68a", text: "#78350f", accent: "#92400e" },
      purple: { bg: "#faf5ff", border: "#e9d5ff", text: "#581c87", accent: "#6b21a8" },
      black: { bg: "#f1f5f9", border: "#cbd5e1", text: "#0f172a", accent: "#334155" }
    };
    return colorMap[color] || colorMap.black;
  };

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
      {/* Hero Section - Refined Business Design */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-8 shadow-md">
        <div className="absolute top-0 right-0 h-32 w-32 bg-slate-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
        <div className="relative">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-1 w-12 bg-slate-400 rounded-full"></div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Category List</span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">カテゴリ別公開URL</h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                カテゴリごとにテンプレート名・公開URL・コピー・開くボタンを1行で確認できます
              </p>
            </div>
            <HelpIcon guideUrl="/categories_guide.html" title="カテゴリ一覧ガイド" />
          </div>
        </div>
      </div>

      {orderedCategories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 mb-3">
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">公開中のテンプレートがありません</p>
        </div>
      ) : (
        orderedCategories.map((categoryId) => {
          const rows = categorized.get(categoryId) ?? [];
          const label = categoryTitleMap.get(categoryId) ?? categoryId;
          const categoryColor = categoryColorMap.get(categoryId);
          const colors = getCategoryColorStyles(categoryColor);

          return (
            <div key={categoryId} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
              <div
                className="flex items-center justify-between border-b backdrop-blur-sm px-6 py-4"
                style={{
                  backgroundColor: colors.bg,
                  borderBottomColor: colors.border
                }}
              >
                <div>
                  <h2 className="text-xl font-bold" style={{ color: colors.text }}>
                    {label}
                  </h2>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-1.5 shadow-sm">
                  <span className="text-sm font-bold text-slate-800">{rows.length}</span>
                  <span className="text-xs font-medium text-slate-500">件</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-100/80 backdrop-blur-sm text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 text-left font-bold text-slate-700">テンプレート名</th>
                      <th className="px-6 py-4 text-left font-bold text-slate-700">公開URL</th>
                      <th className="px-6 py-4 text-left font-bold text-slate-700">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {rows.length === 0 ? (
                      <tr>
                        <td className="px-6 py-8 text-center text-sm font-medium text-slate-500" colSpan={3}>
                          このカテゴリには公開中の商品がありません
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const url = buildUrl(`/sim/${row.templateKey}?cat=${encodeURIComponent(categoryId)}`);
                        return (
                          <tr key={`${categoryId}-${row.templateKey}`} className="whitespace-nowrap transition-all hover:bg-slate-50/80 border-b border-slate-100">
                            <td className="px-6 py-4 font-semibold text-slate-900">{row.name}</td>
                            <td className="px-6 py-4">
                              <div className="break-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-medium text-slate-700 shadow-sm">
                                {url}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 hover:shadow"
                                  onClick={() => navigator.clipboard.writeText(url)}
                                >
                                  コピー
                                </button>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 hover:shadow"
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
