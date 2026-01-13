import { useEffect, useRef, useState } from "react";
import type { Template, TemplateStatus, TemplateSummary } from "@/domain/types";
import { getTemplate, listTemplates, loadCommonSettings, saveTemplate } from "@/storage/local";

type ColumnKey = "name" | "comment" | "paper" | "templateKey" | "status" | "updatedAt" | "url";

const statusLabels: Record<TemplateStatus, string> = {
  draft: "下書き",
  tested: "テスト済み",
  published: "公開中"
};

const defaultColumns: Array<{ key: ColumnKey; label: string }> = [
  { key: "name", label: "表示名" },
  { key: "comment", label: "コメント" },
  { key: "paper", label: "用紙" },
  { key: "templateKey", label: "テンプレキー" },
  { key: "status", label: "状態" },
  { key: "updatedAt", label: "登録日" },
  { key: "url", label: "公開URL" }
];

type TemplateRow = {
  key: string;
  name: string;
  comment?: string;
  paper: string;
  status: TemplateStatus;
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
  if (!template?.pdf) return "-";
  const pageSize = template.pdf.pageSize ?? "A4";
  if (pageSize !== "A4") return pageSize;
  const isLandscape = template.pdf.orientation === "landscape";
  return isLandscape ? "297×210" : "210×297";
}

function getTemplateForRow(primaryTemplateKey: string): Template | null {
  return getTemplate(primaryTemplateKey);
}

function groupTemplates(list: TemplateSummary[]): TemplateRow[] {
  const map = new Map<string, TemplateSummary[]>();
  list.forEach((template) => {
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
    const status = items.some((item) => item.status === "published")
      ? "published"
      : items.some((item) => item.status === "tested")
        ? "tested"
        : "draft";
    const template = getTemplateForRow(preferred.templateKey);
    return {
      key,
      name,
      comment: preferred.comment,
      paper: formatPaperLabel(template),
      status,
      updatedAt: sorted[0]?.updatedAt ?? "",
      primaryTemplateKey: preferred.templateKey
    };
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

export function SimLandingPage() {
  const templates = groupTemplates(listTemplates());
  const settings = loadCommonSettings();
  const landingTitle = settings?.landingTitle?.trim() || "デザインシミュレーター";
  const [sortKey, setSortKey] = useState<"updatedAtDesc" | "updatedAtAsc" | "nameAsc">("updatedAtDesc");
  const [columns, setColumns] = useState(defaultColumns);
  const [selectedColumnKey, setSelectedColumnKey] = useState<ColumnKey>("name");
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(new Set());
  const [rowPaddingPx, setRowPaddingPx] = useState(12);
  const [draggingKey, setDraggingKey] = useState<ColumnKey | null>(null);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingComment, setEditingComment] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const focusFieldRef = useRef<"name" | "comment">("name");

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

  useEffect(() => {
    if (!editingKey) return;
    if (focusFieldRef.current == "comment") {
      commentInputRef.current?.focus();
      return;
    }
    nameInputRef.current?.focus();
  }, [editingKey]);

  const commitRow = (row: TemplateRow) => {
    const nextName = editingName.trim();
    const nextComment = editingComment.trim();
    if (!nextName) return;
    const all = listTemplates();
    const targets = all.filter((item) => splitTemplateKey(item.templateKey).baseKey === row.key);
    const base = targets.length ? targets : all.filter((item) => item.templateKey === row.primaryTemplateKey);
    base.forEach((template) => {
      saveTemplate({
        ...template,
        name: nextName,
        comment: nextComment ? nextComment : undefined,
        updatedAt: new Date().toISOString()
      });
    });
    setEditingKey(null);
  };

  const cancelEditing = () => {
    setEditingKey(null);
    setEditingName("");
    setEditingComment("");
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">{landingTitle}</h1>
        <div className="mt-5 space-y-3 text-base text-slate-700">
          <p className="font-semibold text-slate-800">使い方</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
              ステップ1
            </span>
            <span>テンプレート一覧から使いたいテンプレートを選ぶ</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
              ステップ2
            </span>
            <span>公開URLをクリックしてシミュレーターを開く</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              ステップ3
            </span>
            <span>ロゴをアップロードして、配置を確認する</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              ステップ4
            </span>
            <span>問題がなければPDFを発行する</span>
          </div>
          <p className="mt-2 text-sm text-amber-700">
            注意：用紙のサイズやデザイン範囲の大きさが、テンプレートの大きさと相違が出ないか必ずチェックしてください。
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">テンプレート一覧</h2>
        <p className="mt-2 text-sm text-slate-500">
          ここから使いたいテンプレートを選びます。公開中のテンプレートだけ利用できます。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span>並び替え</span>
          <select
            className="rounded border border-slate-200 px-2 py-1 text-sm"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as typeof sortKey)}
          >
            <option value="updatedAtDesc">登録日（新しい順）</option>
            <option value="updatedAtAsc">登録日（古い順）</option>
            <option value="nameAsc">表示名（あいうえお順）</option>
          </select>
          <span className="ml-2">列の並び替え</span>
          <select
            className="rounded border border-slate-200 px-2 py-1 text-sm"
            value={selectedColumnKey}
            onChange={(event) => setSelectedColumnKey(event.target.value as ColumnKey)}
          >
            {columns.map((col) => (
              <option key={col.key} value={col.key}>
                {col.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded border border-slate-200 px-2 py-1 text-sm"
            onClick={() => moveColumn("left")}
          >
            左へ
          </button>
          <button
            type="button"
            className="rounded border border-slate-200 px-2 py-1 text-sm"
            onClick={() => moveColumn("right")}
          >
            右へ
          </button>
          <span className="text-xs text-slate-400">※ 列名をドラッグでも並び替えできます</span>
          <span className="ml-2">行間</span>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="range"
              min={6}
              max={24}
              value={rowPaddingPx}
              onChange={(event) => setRowPaddingPx(Number(event.target.value))}
            />
            <span>{rowPaddingPx}px</span>
          </label>
          <span className="ml-2">表示</span>
          {columns.map((col) => (
            <label key={col.key} className="inline-flex items-center gap-1 text-sm">
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
          <p className="mt-3 text-sm text-slate-500">テンプレートがありません。</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-base">
              <thead className="bg-slate-50 text-sm uppercase tracking-wide text-slate-600">
                <tr>
                  {visibleColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-6 py-4 text-left ${draggingKey === col.key ? "bg-slate-100" : ""}`}
                      draggable
                      onDragStart={() => setDraggingKey(col.key)}
                      onDragEnd={() => setDraggingKey(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (draggingKey) {
                          moveColumnByKeys(draggingKey, col.key);
                        }
                        setDraggingKey(null);
                      }}
                    >
                      <span className="cursor-move">{col.label}</span>
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
                          const isEditing = editingKey === row.key;
                          const handleBlur = () => {
                            window.setTimeout(() => {
                              const active = document.activeElement;
                              if (active === nameInputRef.current || active === commentInputRef.current) return;
                              commitRow(row);
                            }, 0);
                          };
                          return (
                            <td key={col.key} className="px-6 font-medium text-slate-900" style={rowPaddingStyle}>
                              {isEditing ? (
                                <div className="space-y-2">
                                  <input
                                    ref={nameInputRef}
                                    type="text"
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                    value={editingName}
                                    onChange={(event) => setEditingName(event.target.value)}
                                    onBlur={handleBlur}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        commitRow(row);
                                      }
                                      if (event.key === "Escape") {
                                        cancelEditing();
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <div
                                  role="button"
                                  tabIndex={0}
                                  className="cursor-pointer"
                                  onDoubleClick={() => {
                                    setEditingKey(row.key);
                                    setEditingName(row.name);
                                    setEditingComment(row.comment ?? "");
                                    focusFieldRef.current = "name";
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      setEditingKey(row.key);
                                      setEditingName(row.name);
                                      setEditingComment(row.comment ?? "");
                                      focusFieldRef.current = "name";
                                    }
                                  }}
                                >
                                  {row.name}
                                </div>
                              )}
                            </td>
                          );
                        }
                        if (col.key === "comment") {
                          const isEditing = editingKey === row.key;
                          const handleBlur = () => {
                            window.setTimeout(() => {
                              const active = document.activeElement;
                              if (active === nameInputRef.current || active === commentInputRef.current) return;
                              commitRow(row);
                            }, 0);
                          };
                          return (
                            <td key={col.key} className="px-6 text-slate-600" style={rowPaddingStyle}>
                              {isEditing ? (
                                <input
                                  ref={commentInputRef}
                                  type="text"
                                  className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                  value={editingComment}
                                  onChange={(event) => setEditingComment(event.target.value)}
                                  onBlur={handleBlur}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      commitRow(row);
                                    }
                                    if (event.key === "Escape") {
                                      cancelEditing();
                                    }
                                  }}
                                  placeholder="コメント（任意）"
                                />
                              ) : (
                                <div
                                  role="button"
                                  tabIndex={0}
                                  className="cursor-pointer"
                                  onDoubleClick={() => {
                                    setEditingKey(row.key);
                                    setEditingName(row.name);
                                    setEditingComment(row.comment ?? "");
                                    focusFieldRef.current = "comment";
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      setEditingKey(row.key);
                                      setEditingName(row.name);
                                      setEditingComment(row.comment ?? "");
                                      focusFieldRef.current = "comment";
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
                        if (col.key === "status") {
                          const isPublished = row.status === "published";
                          return (
                            <td
                              key={col.key}
                              className={`px-6 ${
                                isPublished ? "font-semibold text-emerald-600" : "text-slate-600"
                              }`}
                              style={rowPaddingStyle}
                            >
                              {statusLabels[row.status]}
                            </td>
                          );
                        }
                        if (col.key === "updatedAt") {
                          return (
                            <td key={col.key} className="px-6 text-slate-600" style={rowPaddingStyle}>
                              {formatDateTime(row.updatedAt)}
                            </td>
                          );
                        }
                        return (
                          <td key={col.key} className="px-6" style={rowPaddingStyle}>
                            <a
                              href={simPath}
                              className="text-sm text-slate-500 underline decoration-slate-300 hover:text-slate-700"
                            >
                              {simPath}
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




