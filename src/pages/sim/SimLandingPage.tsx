import { useEffect, useRef, useState } from "react";
import type { Template, TemplateSummary } from "@/domain/types";
import { useMemo } from "react";
import { getTemplate, listTemplates, loadCommonSettings, saveTemplate } from "@/storage/local";
import { HelpIcon } from "@/components/common/HelpIcon";
import { Link } from "react-router-dom";

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

  const sortedTemplates = [...templates].sort((a, b) => {
    if (sortKey === "updatedAtAsc") {
      return a.updatedAt.localeCompare(b.updatedAt);
    }
    if (sortKey === "nameAsc") {
      return a.name.localeCompare(b.name);
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });

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
      {/* Hero Section - Refined Business Design */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-8 shadow-md">
        <div className="absolute top-0 right-0 h-32 w-32 bg-slate-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
        <div className="relative">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-1 w-12 bg-slate-400 rounded-full"></div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Template List</span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">公開テンプレート一覧</h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                テンプレート一覧から使いたいテンプレートを選び、公開URLでシミュレーターを開きます
              </p>
            </div>
            <HelpIcon guideUrl="/public_templates.html" title="公開テンプレート一覧の操作ガイド" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-md">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-0.5 w-8 bg-slate-300 rounded-full"></div>
            <p className="text-sm font-semibold text-slate-700">テンプレート選択</p>
          </div>
          <p className="text-xs text-slate-500 ml-10">公開中のテンプレートだけ利用できます</p>
        </div>
        <div className="grid gap-8">
          <div className="space-y-4">
            {/* Controls Section - Refined Business Design */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">並び替え</span>
                    <select
                      className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 shadow-sm transition-all hover:border-slate-400 hover:shadow focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      value={sortKey}
                      onChange={(event) => setSortKey(event.target.value as typeof sortKey)}
                    >
                      <option value="updatedAtDesc">登録日（新しい順）</option>
                      <option value="updatedAtAsc">登録日（古い順）</option>
                      <option value="nameAsc">表示名（あいうえお順）</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">文字サイズ</span>
                    <label className="inline-flex items-center gap-2.5">
                      <input
                        type="range"
                        min={12}
                        max={22}
                        value={tableFontSizePx}
                        onChange={(event) => setTableFontSizePx(Number(event.target.value))}
                        className="w-24 accent-slate-600"
                      />
                      <span className="text-xs font-semibold text-slate-800 w-10">{tableFontSizePx}px</span>
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-200">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">表示列</span>
                  {columns.map((col) => (
                    <label key={col.key} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border border-slate-300 text-slate-600 focus:ring-2 focus:ring-slate-200"
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
                <p className="text-xs text-slate-500 italic">列名をドラッグで並び替えできます</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="text-sm font-semibold text-slate-900">
                  公開中テンプレート: {templates.length} 件
                </div>
                <div className="text-xs text-slate-600">
                  カテゴリごとに見たい場合は{" "}
                  <Link to="/categories" className="font-semibold text-emerald-700 hover:text-emerald-800 underline">
                    カテゴリ一覧
                  </Link>
                  を確認してください。
                </div>
              </div>
            </div>

            {sortedTemplates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 mb-3">
                  <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">条件に合うテンプレートがありません</p>
                <p className="text-xs text-slate-500">検索条件を変更してください</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200" style={{ fontSize: tableFontSizePx, tableLayout: "auto" }}>
                  <thead className="bg-slate-100/80 backdrop-blur-sm text-xs uppercase tracking-wider">
                    <tr>
                      {visibleColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-5 py-4 text-left font-bold text-slate-700 ${draggingKey === col.key ? "bg-slate-200" : ""}`}
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
                              className="ml-auto h-6 w-1 shrink-0 cursor-col-resize rounded-full bg-slate-400 transition-all hover:bg-slate-600"
                              onMouseDown={(event) => handleResizeStart(event, col.key)}
                            />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {sortedTemplates.map((row) => {
                      const basePath = import.meta.env.BASE_URL || "/";
                      const simPath = `${basePath}sim/${row.key}`.replace(/\/+/g, "/");
                      const simUrl =
                        typeof window !== "undefined" ? new URL(simPath, window.location.origin).toString() : simPath;
                      return (
                        <tr key={row.key} className="transition-all hover:bg-slate-50/80 border-b border-slate-100">
                          {visibleColumns.map((col) => {
                            if (col.key === "name") {
                              return (
                                <td key={col.key} className="px-5 font-semibold text-slate-900" style={rowPaddingStyle}>
                                  {row.name}
                                </td>
                              );
                            }
                            if (col.key === "category") {
                              return (
                                <td key={col.key} className="px-5" style={rowPaddingStyle}>
                                  <div className="flex flex-wrap gap-2">
                                    {(row.categories.length > 0 ? row.categories : ["未分類"]).map((cat) => {
                                      const label = categoryTitleMap.get(cat) ?? "未設定";
                                      const short = label ? label[0] : "";
                                      const bg = categoryColorMap.get(cat);
                                      return (
                                        <span
                                          key={cat}
                                          className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-slate-300 text-xs font-semibold shadow-sm transition-all hover:scale-105"
                                          style={
                                            bg
                                              ? { backgroundColor: bg, color: "#ffffff", borderColor: bg }
                                              : { backgroundColor: "#f8fafc", color: "#475569", borderColor: "#cbd5e1" }
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
                            <td key={col.key} className="px-5" style={rowPaddingStyle}>
                                  {isEditing ? (
                                    <input
                                      ref={commentInputRef}
                                      type="text"
                                      className="w-full rounded-md border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
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
                                      className="cursor-pointer rounded-md border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-amber-300 hover:bg-amber-100 hover:shadow"
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
                            <td key={col.key} className="px-5 text-sm font-medium text-slate-600" style={rowPaddingStyle}>
                                  {row.paper}
                                </td>
                              );
                            }
                            if (col.key === "templateKey") {
                              return (
                            <td key={col.key} className="px-5" style={rowPaddingStyle}>
                                  <span className="font-mono text-xs font-medium text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                    {row.key}
                                  </span>
                                </td>
                              );
                            }
                        if (col.key === "info") {
                          const basePath = import.meta.env.BASE_URL || "/";
                          const fullSimPath = `${basePath}sim/${row.key}`.replace(/\/+/g, "/");
                          const infoUrl = `${basePath}common?next=${encodeURIComponent(fullSimPath)}&hideNav=1`.replace(/\/+/g, "/");
                          const infoFullUrl =
                            typeof window !== "undefined"
                              ? new URL(infoUrl, window.location.origin).toString()
                              : infoUrl;
                          return (
                            <td key={col.key} className="px-5" style={rowPaddingStyle}>
                              <a
                                href={infoFullUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 hover:shadow"
                              >
                                共通説明URL
                              </a>
                            </td>
                          );
                        }
                        const basePath = import.meta.env.BASE_URL || "/";
                        const fullSimPath = `${basePath}sim/${row.key}`.replace(/\/+/g, "/");
                        const url =
                          typeof window !== "undefined"
                            ? new URL(fullSimPath, window.location.origin).toString()
                            : fullSimPath;
                        return (
                          <td key={col.key} className="px-5" style={rowPaddingStyle}>
                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 hover:shadow"
                                title="公開URLを開く"
                              >
                                開く
                              </a>
                              <button
                                type="button"
                                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 hover:shadow"
                                onClick={() => copyToClipboard(url, "公開URL")}
                                title="公開URLをコピー"
                              >
                                コピー
                              </button>
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

        </div>
      </div>
    </section>
  );
}
