import type { TemplateStatus } from "@/domain/types";

const statusMap: Record<TemplateStatus, { label: string; className: string; icon: string }> = {
  draft: { label: "下書き", className: "border-2 border-orange-300 bg-orange-50 text-orange-800", icon: "📝" },
  tested: { label: "テスト済み", className: "border-2 border-blue-300 bg-blue-50 text-blue-800", icon: "✅" },
  published: { label: "公開中", className: "border-2 border-emerald-300 bg-emerald-50 text-emerald-800", icon: "🚀" },
  archive: { label: "アーカイブ", className: "border-2 border-slate-300 bg-slate-100 text-slate-700", icon: "📦" }
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
