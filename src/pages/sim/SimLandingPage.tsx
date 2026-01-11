import { Link } from "react-router-dom";
import type { TemplateStatus } from "@/domain/types";
import { listTemplates } from "@/storage/local";

const statusLabels: Record<TemplateStatus, string> = {
  draft: "下書き",
  tested: "テスト済み",
  published: "公開中"
};

export function SimLandingPage() {
  const templates = listTemplates();

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">刻印シミュレーター v1.1</h1>
        <p className="mt-2 text-slate-500">ローカル環境で完結する React + Vite + Tailwind の最小構成</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">テンプレート一覧</h2>
        {templates.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">テンプレートが登録されていません。</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <div key={template.templateKey} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs uppercase text-slate-500">テンプレート</p>
                <p className="mt-1 text-lg font-medium text-slate-900">{template.name}</p>
                <p className="text-sm text-slate-500">キー: {template.templateKey}</p>
                <p className="text-sm text-slate-500">ステータス: {statusLabels[template.status]}</p>
                <Link
                  to={`/sim/${template.templateKey}`}
                  className="mt-3 inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                >
                  シミュレーターを開く
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
