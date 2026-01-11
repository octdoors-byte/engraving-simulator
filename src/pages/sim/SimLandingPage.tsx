import { Link } from "react-router-dom";
import type { TemplateStatus } from "@/domain/types";
import { listTemplates, loadCommonSettings } from "@/storage/local";

const statusLabels: Record<TemplateStatus, string> = {
  draft: "下書き",
  tested: "テスト済み",
  published: "公開中"
};

export function SimLandingPage() {
  const templates = listTemplates();
  const settings = loadCommonSettings();
  const landingTitle = settings?.landingTitle?.trim() || "デザインシミュレーター";

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
        {templates.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">テンプレートがありません。</p>
        ) : (
          <div className="mt-4 space-y-3">
            {templates.map((template) => {
              const simPath = `/sim/${template.templateKey}`;
              return (
                <div
                  key={template.templateKey}
                  className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-medium text-slate-900">{template.name}</p>
                      <p className="text-sm text-slate-500">キー: {template.templateKey}</p>
                      <p className="text-sm text-slate-500">状態: {statusLabels[template.status]}</p>
                    </div>
                    <Link
                      to={simPath}
                      className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                    >
                      シミュレーターを開く
                    </Link>
                  </div>
                  <a
                    href={simPath}
                    className="text-xs text-slate-500 underline decoration-slate-300 hover:text-slate-700"
                  >
                    {simPath}
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}


