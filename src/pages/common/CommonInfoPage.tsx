import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getTemplate, loadCommonSettings } from "@/storage/local";

const DEFAULT_FAQ = [
  "Q.スマホでもデザインエディタを使えますか？",
  "スマートフォンでもご利用いただけます。PCと操作方法は変わりません。",
  "",
  "Q.推奨ブラウザを教えてください。",
  "Microsoft Edge、Google Chrome、Firefox、Safariです。いずれも最新バージョンでのご利用をおすすめいたします。",
  "",
  "Q.買い物アプリでもデザインエディタを使えますか？",
  "アプリでは動かない場合があります。デザインエディタが動かなかった場合は、大変お手数ですが、デザインだけスマートフォンのインターネット閲覧アプリ（ブラウザ）で行っていただくか、ブラウザからデザイン→注文を行って下さい。",
  "",
  "Q.デザインIDとはなんですか？",
  "お客様がデザインする毎に発行される、ユニークな英数字です。デザインをして、デザインIDを発行していただいたら、商品ページに戻り、デザインID欄に発行された英数字を貼り付けてから、ご購入手続きにお進み下さい。",
  "",
  "Q.キャンバスの読み込みに時間がかかります。",
  "申し訳ございません。たくさんの方が一度にご利用いただいたりすると、一時的に動作が遅くなります。お手数ですが読み込みが終わるまでお待ち下さい。",
  "",
  "Q.プレビューしてから気に入らないのでやり直したいのですが？",
  "何度でもキャンバスで編集ボタンを押すとデザインをやり直すことができます。デザインを完了するボタンを押すと、やり直しは出来ませんので、その場合は再度新しくデザインし直して下さい。",
  "",
  "Q.作ったデザインが消えてしまいました。",
  "ブラウザの戻るボタンを押すと、作ったデザインが消える場合がございます。申し訳ございませんが、再度デザインし直してくださいますようお願いいたします。",
  "",
  "Q.少しずつデザインを変えたものを複数注文したいのですが。",
  "１枚のみロゴをいれたデザインをしてください。テスト刻印後に店舗からご連絡します。",
  "",
  "Q.著作権はどうなりますか？",
  "お客様が当店のデザインエディタシステムを利用して作成したデザインの著作権はお客様に帰属します。当店が著作権を行使したり所有権を主張することはございません。",
  "",
  "Q.キャラクターもののオリジナルグッズを作ってもらえませんか？",
  "申し訳ございませんが、当店では権利侵害に当たる行為に加担することはできません。また、お客様がデザインして当店が作成した成果物によって起きたあらゆる損害について、当店ではその責任を負いません。",
  "",
  "Q.以前作ったものと同じものをもう一度作って欲しいです。",
  "デザインの保管期限内であれば可能です。以前お作りしたデザインのデザインIDを教えていただければ、同じデザインで制作することが可能です。詳しくはお問い合わせください。",
  "",
  "Q.デザインは保管してもらえますか？",
  "デザインの保管期限は1年間です。",
  "",
  "ご不明な点はショップへお問い合わせください。"
].join("\n");

export function CommonInfoPage() {
  const settings = useMemo(() => loadCommonSettings(), []);
  const location = useLocation();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const title = settings?.commonInfoTitle?.trim() || "ご利用前のご案内";
  const body = settings?.commonInfoBody?.trim() || "共通説明がまだ登録されていません。";
  const images = settings?.commonInfoImages ?? (settings?.commonInfoImage ? [settings.commonInfoImage] : []);
  const layout = settings?.commonInfoLayout ?? "imageTop";
  const pdf = settings?.commonInfoPdf;
  const faqText = settings?.commonInfoFaq?.trim() || DEFAULT_FAQ;
  const faqBlocks = faqText.split(/\n{2,}/).map((block) => block.split("\n"));
  const nextParam = new URLSearchParams(location.search).get("next");
  const nextHref = nextParam || "/top";
  const targetTemplate = useMemo(() => {
    try {
      const url = new URL(nextHref, window.location.origin);
      if (url.pathname.startsWith("/sim/")) {
        const key = url.pathname.replace("/sim/", "");
        return getTemplate(key);
      }
    } catch (error) {
      console.error(error);
    }
    return null;
  }, [nextHref]);

  const isRow = false; // 強制的に縦並びにする
  const reversed = false;
  const stackReverse = layout === "imageBottom";

  const imageBlock =
    images.length > 0 ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3">
          {images.map((img, index) => (
            <div
              key={`${img}-${index}`}
              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 flex items-center justify-center"
            >
              <div className="w-full max-w-5xl">
                <img
                  src={img}
                  alt={`共通説明画像${index + 1}`}
                  className="w-full h-auto max-h-[80vh] object-contain bg-white"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : null;

  const textBlock = (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {targetTemplate && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold uppercase tracking-wide text-amber-700">
              対象
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-semibold leading-tight text-amber-900">{targetTemplate.name}</span>
            </div>
          </div>
        </div>
      )}
      <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
      <div className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-slate-800">{body}</div>
    </div>
  );

  return (
    <section className="space-y-6">
      {isRow ? (
        <div className={`grid gap-6 lg:grid-cols-2`} style={{ gridAutoFlow: reversed ? "dense" : "row" }}>
          {reversed ? (
            <>
              {textBlock}
              {imageBlock}
            </>
          ) : (
            <>
              {imageBlock}
              {textBlock}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {stackReverse ? (
            <>
              {textBlock}
              {imageBlock}
            </>
          ) : (
            <>
              {imageBlock}
              {textBlock}
            </>
          )}
        </div>
      )}

      {pdf && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">補足資料（PDF）</p>
            <a
              href={pdf.dataUrl}
              download={pdf.name || "common-info.pdf"}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              ダウンロード
            </a>
          </div>
          <div className="h-[60vh] rounded-xl border border-slate-100 bg-slate-50">
            <object data={pdf.dataUrl} type="application/pdf" className="h-full w-full rounded-xl">
              <p className="p-4 text-sm text-slate-500">PDFを表示できません。上のボタンからダウンロードしてください。</p>
            </object>
          </div>
        </div>
      )}

      <div className="rounded-2xl border-2 border-amber-300 bg-white p-5 shadow-md">
        <p className="text-sm font-semibold text-slate-900">ご確認のうえ進んでください</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              className="h-5 w-5 accent-slate-900"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            <span>上記の内容を確認しました</span>
          </label>
          <button
            type="button"
            className={`rounded-full px-5 py-2 text-sm font-semibold shadow ${
              agreed
                ? "bg-slate-900 text-white"
                : "bg-slate-200 text-slate-500 cursor-not-allowed"
            }`}
            disabled={!agreed}
            onClick={() => navigate(nextHref)}
          >
            開始する
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-2xl font-semibold text-slate-900">よくある質問</h2>
        <div className="space-y-3 text-sm leading-relaxed text-slate-800">
          {faqBlocks.map((lines, idx) => (
            <div key={idx}>
              {lines.map((line, i) => (
                <p key={i} className={line.startsWith("Q.") ? "font-semibold text-slate-900" : ""}>
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
