import { useEffect, useRef, useState } from "react";
import type { Template, TemplateSummary } from "@/domain/types";
import { useMemo } from "react";
import { getTemplate, listTemplates, loadCommonSettings, saveTemplate } from "@/storage/local";
import { HelpIcon } from "@/components/common/HelpIcon";
import { useLocation } from "react-router-dom";

type ColumnKey = "name" | "category" | "comment" | "paper" | "templateKey" | "info" | "url";

const defaultColumns: Array<{ key: ColumnKey; label: string }> = [
  { key: "name", label: "表示名" },
  { key: "category", label: "カテゴリ" },
  { key: "comment", label: "備考" },
  { key: "paper", label: "用紙" },
  { key: "templateKey", label: "テンプレID" },
  { key: "info", label: "共通説明URL" },
  { key: "url", label: "公開URL" }
];

type TemplateRow = {
  key: string;
  name: string;
  categories: string[];
  comment?: string;
  paper: string;
  updatedAt: string;
};

function formatPaperLabel(template: Template | null): string {
  if (!template) return "-";
  if (template.paper?.width && template.paper?.height) {
    return `${template.paper.width}×${template.paper.height} mm`;
  }
  if (!template.pdf) return "-";
  const pageSize = template.pdf.pageSize ?? "A4";
  if (pageSize !== "A4") return pageSize;
  const isLandscape = template.pdf.orientation === "landscape";
  return isLandscape ? "297×210 mm" : "210×297 mm";
}

function groupTemplates(list: TemplateSummary[]): TemplateRow[] {
  const publishedOnly = list.filter((template) => template.status === "published");
  return publishedOnly.map((summary) => {
    const categories =
      summary.categories && summary.categories.length > 0 ? summary.categories : summary.category ? [summary.category] : [];
    const template = getTemplate(summary.templateKey);
    return {
      key: summary.templateKey,
      name: summary.name,
      categories,
      comment: summary.comment,
      paper: formatPaperLabel(template),
      updatedAt: summary.updatedAt
    };
  });
}

export function SimLandingPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>(() => groupTemplates(listTemplates()));
  const settings = loadCommonSettings();
  const landingTitle = settings?.landingTitle?.trim() || "デザインシミュレーター";
  const [sortKey, setSortKey] = useState<"updatedAtDesc" | "updatedAtAsc" | "nameAsc">("updatedAtDesc");
  const [columns, setColumns] = useState(defaultColumns);
  const [selectedColumnKey, setSelectedColumnKey] = useState<ColumnKey>("name");
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(new Set());
  const [rowPaddingPx, setRowPaddingPx] = useState(4);
  const [tableFontSizePx, setTableFontSizePx] = useState(16);
  const [draggingKey, setDraggingKey] = useState<ColumnKey | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number | undefined>>({
    name: 220,
    category: 160,
    comment: 240,
    paper: 140,
    templateKey: 220,
    info: 200,
    url: 260
  });
  const resizingRef = useRef<{ key: ColumnKey; startX: number; startWidth: number } | null>(null);
  const resizingActiveRef = useRef(false);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  const normalizedSearch = searchText.trim().toLowerCase();

  const filteredTemplates = templates.filter((row) => {
    const matchesSearch =
      !normalizedSearch ||
      row.name.toLowerCase().includes(normalizedSearch) ||
      row.key.toLowerCase().includes(normalizedSearch) ||
      (row.comment ?? "").toLowerCase().includes(normalizedSearch);
    const matchesCategory =
      selectedCategories.size === 0 ||
      (row.categories.length > 0 && row.categories.some((cat) => selectedCategories.has(cat))) ||
      (row.categories.length === 0 && selectedCategories.has("未分類"));
    return matchesSearch && matchesCategory;
  });

  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    if (sortKey === "updatedAtAsc") {
      return a.updatedAt.localeCompare(b.updatedAt);
    }
    if (sortKey === "nameAsc") {
      return a.name.localeCompare(b.name);
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  const categoryCountMap = templates.reduce<Record<string, number>>((acc, row) => {
    const cats = row.categories.length > 0 ? row.categories : ["未分類"];
    cats.forEach((cat) => {
      acc[cat] = (acc[cat] ?? 0) + 1;
    });
    return acc;
  }, {});
  const categoryList = Object.entries(categoryCountMap).sort((a, b) => a[0].localeCompare(b[0]));

  const categoryTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    settings?.commonInfoCategories?.forEach((c) => {
      if (c.id) map.set(c.id, c.title?.trim() || "未設定");
    });
    return map;
  }, [settings?.commonInfoCategories]);

  const categoryColorMap = useMemo(() => {
    const map = new Map<string, string>();
    settings?.commonInfoCategories?.forEach((c) => {
      if (c.id && c.color) map.set(c.id, c.color);
    });
    return map;
  }, [settings?.commonInfoCategories]);

  const visibleColumns = columns.filter((col) => !hiddenColumns.has(col.key));

  const moveColumn = (direction: "left" | "right") => {
    const index = columns.findIndex((col) => col.key === selectedColumnKey);
    if (index < 0) return;
    const nextIndex = direction === "left" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= columns.length) return;
    const next = [...columns];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    setColumns(next);
  };

  const moveColumnByKeys = (fromKey: ColumnKey, toKey: ColumnKey) => {
    if (fromKey === toKey) return;
    const fromIndex = columns.findIndex((col) => col.key === fromKey);
    const toIndex = columns.findIndex((col) => col.key === toKey);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...columns];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    setColumns(next);
  };

  const rowPaddingStyle = { paddingTop: rowPaddingPx, paddingBottom: rowPaddingPx };

  const refreshTemplates = () => {
    setTemplates(groupTemplates(listTemplates()));
  };

  useEffect(() => {
    refreshTemplates();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cats = params.getAll("cat").filter(Boolean);
    if (cats.length === 0) {
      setSelectedCategories(new Set());
      return;
    }
    setSelectedCategories(new Set(cats));
  }, [location.search]);

  useEffect(() => {
    if (!editingKey) return;
    commentInputRef.current?.focus();
  }, [editingKey]);

  const commitComment = (row: TemplateRow) => {
    const nextComment = editingComment.trim();
    const template = getTemplate(row.key);
    if (!template) return;
    saveTemplate({
      ...template,
      comment: nextComment ? nextComment : undefined,
      updatedAt: new Date().toISOString()
    });
    setEditingKey(null);
    refreshTemplates();
  };

  const cancelEditing = () => {
    setEditingKey(null);
    setEditingComment("");
  };

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!resizingRef.current) return;
      const { key, startX, startWidth } = resizingRef.current;
      const nextWidth = Math.max(10, startWidth + (event.clientX - startX));
      setColumnWidths((prev) => ({ ...prev, [key]: nextWidth }));
    };
    const handleUp = () => {
      resizingRef.current = null;
      resizingActiveRef.current = false;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  const handleResizeStart = (event: React.MouseEvent<HTMLSpanElement>, key: ColumnKey) => {
    event.preventDefault();
    event.stopPropagation();
    const th = event.currentTarget.closest("th");
    const startWidth = columnWidths[key] ?? th?.getBoundingClientRect().width ?? 120;
    resizingRef.current = { key, startX: event.clientX, startWidth };
    resizingActiveRef.current = true;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      window.alert(`${label}を保存しました`);
    } catch (err) {
      console.error(err);
      window.alert(`${label}の保存に失敗しました`);
    }
  };

  return (
    <section className="space-y-8">
      {/* Hero Section - Premium Design without Gradient */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmMWY1ZjkiIGZpbGwtb3BhY2l0eT0iMC4zIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-3xl shadow-lg">
              📋
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">公開テンプレート一覧</h1>
              <p className="text-base text-slate-700 font-medium">
                テンプレート一覧から使いたいテンプレートを選び、公開URLでシミュレーターを開きます
              </p>
            </div>
            <HelpIcon guideUrl="/public_templates.html" title="公開テンプレート一覧の操作ガイド" />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-2xl">
        <div className="mb-6">
          <p className="text-lg font-bold text-slate-900 mb-1">テンプレート選択</p>
          <p className="text-sm text-slate-600">公開中のテンプレートだけ利用できます</p>
        </div>
        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            {/* Controls Section - Premium Design */}
            <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-5 shadow-lg">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 text-base">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700">🔄 並び替え</span>
                    <select
                      className="rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:border-slate-400 hover:shadow-md focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={sortKey}
                      onChange={(event) => setSortKey(event.target.value as typeof sortKey)}
                    >
                      <option value="updatedAtDesc">登録日（新しい順）</option>
                      <option value="updatedAtAsc">登録日（古い順）</option>
                      <option value="nameAsc">表示名（あいうえお順）</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700">📏 文字サイズ</span>
                    <label className="inline-flex items-center gap-3">
                      <input
                        type="range"
                        min={12}
                        max={22}
                        value={tableFontSizePx}
                        onChange={(event) => setTableFontSizePx(Number(event.target.value))}
                        className="w-24"
                      />
                      <span className="text-sm font-bold text-slate-900 w-10">{tableFontSizePx}px</span>
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t-2 border-slate-200">
                  <span className="text-sm font-bold text-slate-700">👁️ 表示列</span>
                  {columns.map((col) => (
                    <label key={col.key} className="inline-flex items-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:shadow-md cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-2 border-slate-300 text-emerald-500 focus:ring-2 focus:ring-emerald-200"
                        checked={!hiddenColumns.has(col.key)}
                        onChange={(event) => {
                          setHiddenColumns((prev) => {
                            const next = new Set(prev);
                            if (event.target.checked) {
                              next.delete(col.key);
                            } else {
                              next.add(col.key);
                            }
                            return next;
                          });
                        }}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 font-medium">💡 列名をドラッグで並び替えできます</p>
              </div>
            </div>

            {/* Search Section - Premium Design */}
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-lg">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="🔍 テンプレート名・ID・備考を検索"
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-base font-semibold text-slate-900 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div className="flex items-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-2.5">
                  <span className="text-sm font-black text-emerald-900">{filteredTemplates.length}</span>
                  <span className="text-xs font-semibold text-emerald-700">/</span>
                  <span className="text-sm font-bold text-emerald-800">全 {templates.length} 件</span>
                </div>
              </div>
            </div>

            {sortedTemplates.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-4xl">
                    📭
                  </div>
                  <p className="text-lg font-bold text-slate-700">条件に合うテンプレートがありません</p>
                  <p className="text-sm text-slate-500">検索条件を変更してください</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border-2 border-slate-200 bg-white shadow-xl">
            <table className="min-w-full divide-y divide-slate-200" style={{ fontSize: tableFontSizePx, tableLayout: "auto" }}>
                  <thead className="bg-slate-100 uppercase tracking-wide">
                    <tr>
                      {visibleColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-4 text-left font-black text-slate-700 ${draggingKey === col.key ? "bg-slate-200" : ""}`}
                      draggable
                      style={{ width: columnWidths[col.key], minWidth: 10 }}
                          onDragStart={(event) => {
                            if (resizingActiveRef.current) {
                              event.preventDefault();
                              return;
                            }
                            setDraggingKey(col.key);
                          }}
                          onDragEnd={() => setDraggingKey(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            if (draggingKey) {
                              moveColumnByKeys(draggingKey, col.key);
                            }
                            setDraggingKey(null);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="cursor-move font-bold">{col.label}</span>
                            <span
                              role="separator"
                              aria-label="列幅の調整"
                              className="ml-auto h-6 w-1.5 shrink-0 cursor-col-resize rounded-full bg-slate-400 transition-all hover:bg-slate-600"
                              onMouseDown={(event) => handleResizeStart(event, col.key)}
                            />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {sortedTemplates.map((row) => {
                      const simPath = `/sim/${row.key}`;
                      const simUrl =
                        typeof window !== "undefined" ? new URL(simPath, window.location.origin).toString() : simPath;
                      return (
                        <tr key={row.key} className="transition-colors hover:bg-slate-50">
                          {visibleColumns.map((col) => {
                            if (col.key === "name") {
                              return (
                                <td key={col.key} className="px-4 font-bold text-slate-900" style={rowPaddingStyle}>
                                  <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                                    {row.name}
                                  </span>
                                </td>
                              );
                            }
                            if (col.key === "category") {
                              return (
                                <td key={col.key} className="px-4" style={rowPaddingStyle}>
                                  <div className="flex flex-wrap gap-2">
                                    {(row.categories.length > 0 ? row.categories : ["未分類"]).map((cat) => {
                                      const label = categoryTitleMap.get(cat) ?? "未設定";
                                      const short = label ? label[0] : "";
                                      const bg = categoryColorMap.get(cat);
                                      return (
                                        <span
                                          key={cat}
                                          className="inline-flex items-center justify-center h-8 w-8 rounded-xl border-2 border-slate-300 text-xs font-black shadow-sm transition-all hover:scale-110 hover:shadow-md"
                                          style={
                                            bg
                                              ? { backgroundColor: bg, color: "#ffffff", borderColor: bg }
                                              : { backgroundColor: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" }
                                          }
                                          title={label}
                                        >
                                          {short}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </td>
                              );
                            }
                            if (col.key === "comment") {
                              const isEditing = editingKey === row.key;
                              const handleBlur = () => {
                                window.setTimeout(() => {
                                  if (document.activeElement === commentInputRef.current) return;
                                  commitComment(row);
                                }, 0);
                              };
                              return (
                            <td key={col.key} className="px-4" style={rowPaddingStyle}>
                                  {isEditing ? (
                                    <input
                                      ref={commentInputRef}
                                      type="text"
                                      className="w-full rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-2 text-base font-semibold text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                                      style={{ fontSize: tableFontSizePx }}
                                      value={editingComment}
                                      onChange={(event) => setEditingComment(event.target.value)}
                                      onBlur={handleBlur}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          commitComment(row);
                                        }
                                        if (event.key === "Escape") {
                                          cancelEditing();
                                        }
                                      }}
                                      placeholder="備考（お客様表示用）"
                                    />
                                  ) : (
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      className="cursor-pointer rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-2 font-medium text-slate-700 shadow-sm transition-all hover:border-amber-300 hover:bg-amber-100 hover:shadow-md"
                                      onDoubleClick={() => {
                                        setEditingKey(row.key);
                                        setEditingComment(row.comment ?? "");
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          setEditingKey(row.key);
                                          setEditingComment(row.comment ?? "");
                                        }
                                      }}
                                    >
                                      {row.comment || <span className="text-slate-400">-</span>}
                                    </div>
                                  )}
                                </td>
                              );
                            }
                            if (col.key === "paper") {
                              return (
                            <td key={col.key} className="px-4 font-semibold text-slate-700" style={rowPaddingStyle}>
                                  <span className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm">
                                    {row.paper}
                                  </span>
                                </td>
                              );
                            }
                            if (col.key === "templateKey") {
                              return (
                            <td key={col.key} className="px-4" style={rowPaddingStyle}>
                                  <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-sm font-bold text-slate-700 shadow-sm">
                                    {row.key}
                                  </span>
                                </td>
                              );
                            }
                        if (col.key === "info") {
                          const basePath = import.meta.env.BASE_URL || "/";
                          const infoUrl = `${basePath}common?next=${encodeURIComponent(simPath)}&hideNav=1`;
                          const infoFullUrl =
                            typeof window !== "undefined"
                              ? new URL(infoUrl, window.location.origin).toString()
                              : infoUrl;
                          return (
                            <td key={col.key} className="px-4" style={rowPaddingStyle}>
                              <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-xl border-2 border-sky-300 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700 shadow-sm transition-all hover:border-sky-400 hover:bg-sky-100 hover:shadow-md"
                                onClick={() => copyToClipboard(infoFullUrl, "共通説明URL")}
                              >
                                📄 共通説明URL
                              </button>
                            </td>
                          );
                        }
                        // 公開URL（カテゴリ別コピー対応）
                        const cats = row.categories.length > 0 ? row.categories : ["default"];
                        return (
                          <td key={col.key} className="px-4" style={rowPaddingStyle}>
                            <div className="flex flex-wrap gap-2">
                              {cats.map((cat) => {
                                const label = categoryTitleMap.get(cat) ?? cat;
                                const url =
                                  typeof window !== "undefined"
                                    ? new URL(`${simPath}?cat=${encodeURIComponent(cat)}`, window.location.origin).toString()
                                    : `${simPath}?cat=${encodeURIComponent(cat)}`;
                                return (
                                  <button
                                    key={cat}
                                    type="button"
                                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm transition-all hover:border-emerald-400 hover:bg-emerald-100 hover:shadow-md"
                                    onClick={() => copyToClipboard(url, `公開URL(${label})`)}
                                    title={`${label} のURLをコピー`}
                                  >
                                    🔗 {label}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Category Filter Section - Premium Design */}
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-5">
              <h3 className="text-xl font-black text-slate-900 mb-1">🔍 検索・カテゴリ</h3>
              <p className="text-xs text-slate-600 font-medium">カテゴリで絞り込み</p>
            </div>
            <div className="space-y-3">
              {categoryList.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                  <p className="text-sm font-semibold text-slate-500">カテゴリがありません</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {categoryList.map(([category, count]) => {
                    const key = category;
                    const checked = selectedCategories.has(key);
                    const label = categoryTitleMap.get(key) ?? key;
                    return (
                      <label key={key} className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-sm font-semibold shadow-sm transition-all cursor-pointer ${
                        checked
                          ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:shadow-md"
                      }`}>
                        <span className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            className="h-5 w-5 rounded border-2 border-slate-300 text-emerald-500 focus:ring-2 focus:ring-emerald-200"
                            checked={checked}
                            onChange={() => {
                              setSelectedCategories((prev) => {
                                const next = new Set(prev);
                                if (checked) {
                                  next.delete(key);
                                } else {
                                  next.add(key);
                                }
                                return next;
                              });
                            }}
                          />
                          <span className="font-bold">{label}</span>
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${
                          checked ? "bg-emerald-200 text-emerald-900" : "bg-slate-200 text-slate-700"
                        }`}>{count}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {selectedCategories.size > 0 && (
                <button
                  type="button"
                  className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 hover:shadow-md"
                  onClick={() => setSelectedCategories(new Set())}
                >
                  ✕ カテゴリ選択をクリア
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
