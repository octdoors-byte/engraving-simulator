import { sampleTemplate } from "@/data/sampleTemplate";

const goalItems = [
  "ローカル起動 + React/TypeScript/Tailwind 構成",
  "テンプレート公開状態による /sim/:templateKey へのアクセス制御",
  "画像アップロード → トリミング → 透過/モノクロ → 配置 → PDF発行・ダウンロード"
];

export function SimLandingPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">刻印シミュレーター v1.1</h1>
        <p className="mt-2 text-slate-500">ローカル環境で完結する React + Vite + Tailwind の MVP</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">テンプレート</p>
            <p className="mt-1 text-lg font-medium text-slate-900">{sampleTemplate.name}</p>
            <p className="text-sm text-slate-500">キー: {sampleTemplate.templateKey}</p>
            <p className="text-sm text-slate-500">ステータス: {sampleTemplate.status}</p>
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
        <h2 className="text-xl font-semibold text-slate-900">このツールで実現するフロー</h2>
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
            アップロード → トリミング → 背景透過/モノクロ → 配置調整 → 発行（PDF生成 + Design ID）を体験できます。
          </p>
          <p className="mt-3 text-xs text-slate-500">
            画像上限 5MB、formats: PNG/JPEG/WEBP、トリミング後は正規化座標で保存、透過閾値は weak/medium/strong 。
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">管理画面</h3>
          <p className="mt-2 text-sm text-slate-500">
            /admin/templates で template.json + 背景画像の D&D 登録、/admin/designs で発行履歴と PDF を再ダウンロード。
          </p>
          <p className="mt-3 text-xs text-slate-500">
            ステータスは draft/tested/published、published 以外はシミュレータ非公開、IndexedDB に PDF/画像を永続化。
          </p>
        </div>
      </div>
    </section>
  );
}
