import type { TemplateStatus } from "@/domain/types";

const statusMap: Record<TemplateStatus, { label: string; className: string; icon: string }> = {
  draft: { label: "下書き", className: "border-orange-300 bg-gradient-to-r from-orange-50 to-orange-100 text-orange-800", icon: "📝" },
  tested: { label: "テスト済み", className: "border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800", icon: "✅" },
  published: { label: "公開中", className: "border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-800", icon: "🚀" },
  archive: { label: "アーカイブ", className: "border-slate-300 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700", icon: "📦" }
};

export function StatusBadge({ status }: { status: TemplateStatus }) {
  const config = statusMap[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-bold shadow-sm ${config.className}`}
      aria-label={`ステータス ${config.label}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
