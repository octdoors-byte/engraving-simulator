import { sampleTemplate } from "@/data/sampleTemplate";
import type { TemplateStatus } from "@/domain/types";

const statusLabels: Record<TemplateStatus, string> = {
  draft: "下書き",
  tested: "テスト済み",
  published: "公開中"
};

const goalItems = [
  "ローカル起動（React / TypeScript / Tailwind）",
  "テンプレートの公開状態で /sim/:templateKey を制御",
  "画像アップロード → トリミング → 透過/モノクロ → 配置 → PDF発行"
];

export function SimLandingPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">刻印シミュレーター v1.1</h1>
        <p className="mt-2 text-slate-500">ローカル環境で完結する React + Vite + Tailwind の最小構成</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">テンプレート</p>
            <p className="mt-1 text-lg font-medium text-slate-900">{sampleTemplate.name}</p>
            <p className="text-sm text-slate-500">テンプレートキー: {sampleTemplate.templateKey}</p>
            <p className="text-sm text-slate-500">ステータス: {statusLabels[sampleTemplate.status]}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">背景サイズ</p>
            <p className="mt-1 text-lg font-medium text-slate-900">
              {sampleTemplate.background.canvasWidthPx} x {sampleTemplate.background.canvasHeightPx} px
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">刻印枠</p>
            <p className="mt-1 text-lg font-medium text-slate-900">
              {sampleTemplate.engravingArea.w} x {sampleTemplate.engravingArea.h} px
            </p>
            <p className="text-xs text-slate-500">{sampleTemplate.engravingArea.label}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">このツールでできること</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          {goalItems.map((text) => (
            <li key={text} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-900" aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">顧客画面 (/sim/:templateKey)</h3>
          <p className="mt-2 text-sm text-slate-500">
            画像アップロード → トリミング → 背景透過/モノクロ → 配置調整 → PDF発行を体験できます。
          </p>
          <p className="mt-3 text-xs text-slate-500">
            画像上限は 5MB、対応形式は PNG/JPEG/WEBP。トリミング後は正規化座標で保存します。
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">管理画面</h3>
          <p className="mt-2 text-sm text-slate-500">
            /admin/templates で template.json + 背景画像を登録し、/admin/designs で発行履歴と PDF を確認できます。
          </p>
          <p className="mt-3 text-xs text-slate-500">
            ステータスは「下書き / テスト済み / 公開中」。公開中以外はシミュレーター非公開です。
          </p>
        </div>
      </div>
    </section>
  );
}
