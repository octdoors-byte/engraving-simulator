import type { TemplateStatus } from "@/domain/types";

const statusMap: Record<TemplateStatus, { label: string; className: string }> = {
  draft: { label: "下書き", className: "border border-orange-300 bg-orange-50 text-orange-700" },
  tested: { label: "テスト済み", className: "border border-blue-300 bg-blue-50 text-blue-700" },
  published: { label: "公開中", className: "border border-emerald-300 bg-emerald-50 text-emerald-700" },
  archive: { label: "アーカイブ", className: "border border-slate-300 bg-slate-100 text-slate-600" }
};

export function StatusBadge({ status }: { status: TemplateStatus }) {
  const config = statusMap[status];
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${config.className}`}
      aria-label={`ステータス ${config.label}`}
    >
      {config.label}
    </span>
  );
}
