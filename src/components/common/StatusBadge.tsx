import type { TemplateStatus } from "@/domain/types";

const statusMap: Record<TemplateStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-orange-100 text-orange-700" },
  tested: { label: "Tested", className: "bg-blue-100 text-blue-700" },
  published: { label: "Published", className: "bg-emerald-100 text-emerald-700" }
};

export function StatusBadge({ status }: { status: TemplateStatus }) {
  const config = statusMap[status];
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}
      aria-label={`status ${config.label}`}
    >
      {config.label}
    </span>
  );
}
