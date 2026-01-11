import { useState } from "react";
import type { TemplateStatus } from "@/domain/types";
import { listTemplates, loadCommonSettings } from "@/storage/local";

type ColumnKey = "name" | "templateKey" | "status" | "updatedAt" | "url";

const statusLabels: Record<TemplateStatus, string> = {
  draft: "下書き",
  tested: "テスト済み",
  published: "公開中"
};

const defaultColumns: Array<{ key: ColumnKey; label: string }> = [
  { key: "name", label: "表示名" },
  { key: "templateKey", label: "テンプレキー" },
  { key: "status", label: "状態" },
  { key: "updatedAt", label: "登録日" },
  { key: "url", label: "公開URL" }
];

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
  const templates = listTemplates();
  const settings = loadCommonSettings();
  const landingTitle = settings?.landingTitle?.trim() || "デザインシミュレーター";
  const [sortKey, setSortKey] = useState<"updatedAtDesc" | "updatedAtAsc" | "nameAsc">("updatedAtDesc");
  const [columns, setColumns] = useState(defaultColumns);
  const [selectedColumnKey, setSelectedColumnKey] = useState<ColumnKey>("name");
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(new Set());
  const [rowPadding, setRowPadding] = useState<"tight" | "normal" | "wide">("wide");
  const [rowPaddingPx, setRowPaddingPx] = useState(12);

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

  const rowPaddingClass =
    rowPadding === "tight" ? "py-2" : rowPadding === "normal" ? "py-4" : "py-5";
  const rowPaddingStyle = rowPadding === "tight" ? { paddingTop: rowPaddingPx, paddingBottom: rowPaddingPx } : undefined;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">{landingTitle}</h1>
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
          <span className="ml-2">行間</span>
          <select
            className="rounded border border-slate-200 px-2 py-1 text-sm"
            value={rowPadding}
            onChange={(event) => setRowPadding(event.target.value as typeof rowPadding)}
          >
            <option value="tight">狭い</option>
            <option value="normal">普通</option>
            <option value="wide">広い</option>
          </select>
          {rowPadding === "tight" && (
            <label className="inline-flex items-center gap-2 text-sm">
              <span>細かく</span>
              <input
                type="range"
                min={6}
                max={20}
                value={rowPaddingPx}
                onChange={(event) => setRowPaddingPx(Number(event.target.value))}
              />
              <span>{rowPaddingPx}px</span>
            </label>
          )}
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
                    <th key={col.key} className="px-6 py-4 text-left">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sortedTemplates.map((template) => {
                  const simPath = `/sim/${template.templateKey}`;
                  return (
                    <tr key={template.templateKey}>
                      {visibleColumns.map((col) => {
                        if (col.key === "name") {
                          return (
                            <td
                              key={col.key}
                              className={`px-6 ${rowPaddingClass} font-medium text-slate-900`}
                              style={rowPaddingStyle}
                            >
                              {template.name}
                            </td>
                          );
                        }
                        if (col.key === "templateKey") {
                          return (
                            <td key={col.key} className={`px-6 ${rowPaddingClass} text-slate-600`} style={rowPaddingStyle}>
                              {template.templateKey}
                            </td>
                          );
                        }
                        if (col.key === "status") {
                          const isPublished = template.status === "published";
                          return (
                            <td
                              key={col.key}
                              className={`px-6 ${rowPaddingClass} ${
                                isPublished ? "font-semibold text-emerald-600" : "text-slate-600"
                              }`}
                              style={rowPaddingStyle}
                            >
                              {statusLabels[template.status]}
                            </td>
                          );
                        }
                        if (col.key === "updatedAt") {
                          return (
                            <td key={col.key} className={`px-6 ${rowPaddingClass} text-slate-600`} style={rowPaddingStyle}>
                              {formatDateTime(template.updatedAt)}
                            </td>
                          );
                        }
                        return (
                          <td key={col.key} className={`px-6 ${rowPaddingClass}`} style={rowPaddingStyle}>
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




