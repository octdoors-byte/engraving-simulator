import { useEffect, useRef, useState } from "react";
import type { Template, TemplateSummary } from "@/domain/types";
import { getTemplate, listTemplates, loadCommonSettings, saveTemplate } from "@/storage/local";

type ColumnKey = "name" | "category" | "comment" | "paper" | "templateKey" | "info" | "url";

const defaultColumns: Array<{ key: ColumnKey; label: string }> = [
  { key: "name", label: "表示名" },
  { key: "category", label: "カテゴリ" },
  { key: "comment", label: "備考（お客様表示用）" },
  { key: "paper", label: "用紙" },
  { key: "templateKey", label: "テンプレキー" },
  { key: "info", label: "共通説明＋公開URL" },
  { key: "url", label: "公開URL" }
];

type TemplateRow = {
  key: string;
  name: string;
  category?: string;
  comment?: string;
  paper: string;
  updatedAt: string;
  primaryTemplateKey: string;
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

function getTemplateForRow(primaryTemplateKey: string): Template | null {
  return getTemplate(primaryTemplateKey);
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
    const name = items.length > 1 ? `${preferred.name}（表/裏）` : preferred.name;
    const template = getTemplateForRow(preferred.templateKey);
    return {
      key,
      name,
      category: preferred.category,
      comment: preferred.comment,
      paper: formatPaperLabel(template),
      updatedAt: sorted[0]?.updatedAt ?? "",
      primaryTemplateKey: preferred.templateKey
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
  const [rowPaddingPx, setRowPaddingPx] = useState(12);
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
    const all = listTemplates();
    const targets = all.filter((item) => splitTemplateKey(item.templateKey).baseKey === row.key);
    const base = targets.length ? targets : all.filter((item) => item.templateKey === row.primaryTemplateKey);
    base.forEach((template) => {
      saveTemplate({
        ...template,
        comment: nextComment ? nextComment : undefined,
        updatedAt: new Date().toISOString()
      });
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

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">公開テンプレート一覧</h1>
        <div className="mt-5 space-y-3 text-base text-slate-700">
          <p className="font-semibold text-slate-800">使い方</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">ステップ1</span>
            <span>テンプレート一覧から使いたいテンプレートを選ぶ</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">ステップ2</span>
            <span>公開URLをクリックしてシミュレーターを開く</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">ステップ3</span>
            <span>ロゴをアップロードして、配置を確認</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">ステップ4</span>
            <span>問題がなければPDFを発行する</span>
          </div>
          <p className="mt-2 text-sm text-amber-700">
            注意：用紙のサイズやデザイン範囲の大きさが、テンプレートの大きさと相違が出ないか必ずチェックしてください。
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-base text-slate-600">
          ここから使いたいテンプレートを選びます。公開中のテンプレートだけ利用できます。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-base text-slate-700">
          <span>並び替え</span>
          <select
            className="rounded border border-slate-200 px-2 py-1 text-base"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as typeof sortKey)}
          >
            <option value="updatedAtDesc">登録日（新しい順）</option>
            <option value="updatedAtAsc">登録日（古い順）</option>
          <option value="nameAsc">表示名（あいうえお順）</option>
        </select>
        <span className="text-sm text-slate-400">※ 列名をドラッグで並び替えできます</span>
        <span className="ml-2">文字サイズ</span>
        <label className="inline-flex items-center gap-2 text-base">
          <input
            type="range"
            min={12}
            max={22}
              value={tableFontSizePx}
              onChange={(event) => setTableFontSizePx(Number(event.target.value))}
            />
            <span>{tableFontSizePx}px</span>
          </label>
          <span className="ml-2">表示</span>
          {columns.map((col) => (
            <label key={col.key} className="inline-flex items-center gap-1 text-base">
              <input
                type="checkbox"
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
        {sortedTemplates.length === 0 ? (
          <p className="mt-3 text-base text-slate-500">テンプレートがありません。</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table
              className="min-w-full divide-y divide-slate-100"
              style={{ fontSize: tableFontSizePx, tableLayout: "fixed" }}
            >
              <thead className="bg-slate-50 uppercase tracking-wide text-slate-600">
                <tr>
                  {visibleColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-6 py-4 text-left ${draggingKey === col.key ? "bg-slate-100" : ""}`}
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
                      <div className="flex items-center gap-2">
                        <span className="cursor-move">{col.label}</span>
                        <span
                          role="separator"
                          aria-label="列幅の調整"
                          className="ml-auto h-5 w-2 shrink-0 cursor-col-resize rounded bg-slate-300"
                          onMouseDown={(event) => handleResizeStart(event, col.key)}
                        />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sortedTemplates.map((row) => {
                  const simPath = `/sim/${row.key}`;
                  return (
                    <tr key={row.key}>
                      {visibleColumns.map((col) => {
                        if (col.key === "name") {
                          return (
                            <td key={col.key} className="px-6 font-medium text-slate-900" style={rowPaddingStyle}>
                              {row.name}
                            </td>
                          );
                        }
                        if (col.key === "category") {
                          return (
                            <td key={col.key} className="px-6 text-slate-600" style={rowPaddingStyle}>
                              {row.category || "-"}
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
                            <td
                              key={col.key}
                              className="px-6 text-slate-700"
                              style={rowPaddingStyle}
                            >
                              {isEditing ? (
                                <input
                                  ref={commentInputRef}
                                  type="text"
                                  className="w-full rounded border border-amber-200 bg-amber-50 px-2 py-1 text-base"
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
                                  className="cursor-pointer rounded border border-amber-100 bg-amber-50/70 px-2 py-1 hover:border-amber-200 hover:bg-amber-50"
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
                                  {row.comment || "-"}
                                </div>
                              )}
                            </td>
                          );
                        }
                        if (col.key === "paper") {
                          return (
                            <td key={col.key} className="px-6 text-slate-600" style={rowPaddingStyle}>
                              {row.paper}
                            </td>
                          );
                        }
                        if (col.key === "templateKey") {
                          return (
                            <td key={col.key} className="px-6 text-slate-600" style={rowPaddingStyle}>
                              {row.key}
                            </td>
                          );
                        }
                        if (col.key === "info") {
                          const infoUrl = `/common?next=${encodeURIComponent(simPath)}&hideNav=1`;
                          return (
                            <td key={col.key} className="px-6 text-slate-600" style={rowPaddingStyle}>
                              <a
                                href={infoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-600 underline decoration-slate-300 hover:text-slate-800"
                              >
                                {infoUrl}
                              </a>
                            </td>
                          );
                        }
                        return (
                          <td key={col.key} className="px-6" style={rowPaddingStyle}>
                            <a
                              href={simPath}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-[11px] text-slate-700 hover:border-slate-300 hover:text-slate-900"
                            >
                              開く
                            </a>
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
    </section>
  );
}
