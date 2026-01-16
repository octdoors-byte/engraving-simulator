import { useCallback, useEffect, useRef, useState } from "react";
import { Toast } from "@/components/common/Toast";
import type { CommonSettings } from "@/domain/types";
import { loadCommonSettings, saveCommonSettings } from "@/storage/local";

type ToastState = { message: string; tone?: "info" | "success" | "error" } | null;

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
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
  const [settings, setSettings] = useState<CommonSettings>(() => loadCommonSettings() ?? {});
  const [toast, setToast] = useState<ToastState>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [previewKey, setPreviewKey] = useState(() => Date.now());
  const dragIndexRef = useRef<number | null>(null);
  const settingsRef = useRef<CommonSettings>(settings);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const handleChange = useCallback(<K extends keyof CommonSettings>(key: K, value: CommonSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      settingsRef.current = next;
      return next;
    });
    setIsDirty(true);
    setPreviewKey(Date.now());
  }, []);

  const handleImageUpload = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const current = settings.commonInfoImages ?? (settings.commonInfoImage ? [settings.commonInfoImage] : []);
      const room = MAX_IMAGES - current.length;
      if (room <= 0) {
        setToast({ message: `画像は最大 ${MAX_IMAGES} 枚までです。`, tone: "error" });
        return;
      }
      const selected = Array.from(files).slice(0, room);
      const validReaders: Promise<string>[] = [];
      for (const file of selected) {
        if (file.size > MAX_IMAGE_BYTES) {
          setToast({ message: "画像は 2MB 以下にしてください。", tone: "error" });
          continue;
        }
        validReaders.push(
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject());
            reader.onerror = () => reject(reader.error ?? new Error("read error"));
            reader.readAsDataURL(file);
          })
        );
      }
      Promise.all(validReaders)
        .then((list) => {
          if (list.length === 0) return;
          const nextImages = [...current, ...list].slice(0, MAX_IMAGES);
          handleChange("commonInfoImages", nextImages);
          handleChange("commonInfoImage", undefined);
          setToast({ message: `画像を${list.length}枚追加しました。`, tone: "success" });
        })
        .catch(() => setToast({ message: "画像の読み込みに失敗しました。", tone: "error" }));
    },
    [handleChange, settings.commonInfoImage, settings.commonInfoImages]
  );

  const persistImages = useCallback(
    (next: string[]) => {
      const normalized = next.slice(0, MAX_IMAGES);
      handleChange("commonInfoImages", normalized);
      handleChange("commonInfoImage", undefined);
      setPreviewKey(Date.now());
    },
    [handleChange]
  );

  const currentImages: string[] = settings.commonInfoImages ?? (settings.commonInfoImage ? [settings.commonInfoImage] : []);

  const handlePdfUpload = useCallback(
    (file: File | null) => {
      if (!file) return;
      if (file.type !== "application/pdf") {
        setToast({ message: "PDF ファイルを選択してください。", tone: "error" });
        return;
      }
      if (file.size > MAX_PDF_BYTES) {
        setToast({ message: "PDF は 5MB 以下にしてください。", tone: "error" });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          handleChange("commonInfoPdf", { name: file.name, dataUrl: reader.result });
          setPreviewKey(Date.now());
          setToast({ message: "PDFを更新しました。", tone: "success" });
        }
      };
      reader.readAsDataURL(file);
    },
    [handleChange]
  );

  const handleManualSave = useCallback(() => {
    const latest = settingsRef.current;
    saveCommonSettings(latest);
    window.dispatchEvent(new CustomEvent("ksim:commonSettingsUpdated"));
    setToast({ message: "保存しました。", tone: "success" });
    setPreviewKey(Date.now());
    setIsDirty(false);
  }, []);

  return (
    <section className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">お客様向け 共通説明ページ</h1>
        <p className="mt-2 text-sm text-slate-600">トップメニューに共通説明を掲載するための設定です。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              isDirty
                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
            }`}
            disabled={!isDirty}
            onClick={handleManualSave}
          >
            保存する
          </button>
          <span className="text-xs text-slate-500">※ 「保存する」を押すと設定が反映されます。</span>
        </div>
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-600">ヘッダー/フッター・サイト共通設定</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-600">ロゴ画像</label>
              <input
                type="file"
                accept="image/*"
                className="mt-1 w-full text-xs"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === "string") {
                      setSettings((prev) => ({ ...prev, logoImage: reader.result }));
                      saveCommonSettings({ ...(settings ?? {}), logoImage: reader.result });
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">トップのタイトル</label>
              <input
                type="text"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                value={settings.landingTitle ?? "デザインシミュレーター"}
                onChange={(event) => {
                  const value = event.target.value;
                  setSettings((prev) => ({ ...prev, landingTitle: value }));
                  saveCommonSettings({ ...(settings ?? {}), landingTitle: value });
                }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">ヘッダーテキスト</label>
              <textarea
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                rows={2}
                value={settings.headerText ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setSettings((prev) => ({ ...prev, headerText: value }));
                  saveCommonSettings({ ...(settings ?? {}), headerText: value });
                }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">フッターテキスト</label>
              <textarea
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                rows={2}
                value={settings.footerText ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setSettings((prev) => ({ ...prev, footerText: value }));
                  saveCommonSettings({ ...(settings ?? {}), footerText: value });
                }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">ヘッダー配置</label>
              <select
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                value={settings.headerTextAlign ?? "left"}
                onChange={(event) => {
                  const value = event.target.value as CommonSettings["headerTextAlign"];
                  setSettings((prev) => ({ ...prev, headerTextAlign: value }));
                  saveCommonSettings({ ...(settings ?? {}), headerTextAlign: value });
                }}
              >
                <option value="left">左</option>
                <option value="center">中央</option>
                <option value="right">右</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">フッター配置</label>
              <select
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                value={settings.footerTextAlign ?? "center"}
                onChange={(event) => {
                  const value = event.target.value as CommonSettings["footerTextAlign"];
                  setSettings((prev) => ({ ...prev, footerTextAlign: value }));
                  saveCommonSettings({ ...(settings ?? {}), footerTextAlign: value });
                }}
              >
                <option value="left">左</option>
                <option value="center">中央</option>
                <option value="right">右</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">ロゴサイズ</label>
              <select
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                value={settings.logoSize ?? "md"}
                onChange={(event) => {
                  const value = event.target.value as CommonSettings["logoSize"];
                  setSettings((prev) => ({ ...prev, logoSize: value }));
                  saveCommonSettings({ ...(settings ?? {}), logoSize: value });
                }}
              >
                <option value="sm">小</option>
                <option value="md">中</option>
                <option value="lg">大</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">ヘッダー文字サイズ</label>
              <select
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                value={settings.headerTextSize ?? "md"}
                onChange={(event) => {
                  const value = event.target.value as CommonSettings["headerTextSize"];
                  setSettings((prev) => ({ ...prev, headerTextSize: value }));
                  saveCommonSettings({ ...(settings ?? {}), headerTextSize: value });
                }}
              >
                <option value="sm">小</option>
                <option value="md">中</option>
                <option value="lg">大</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">フッター文字サイズ</label>
              <select
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                value={settings.footerTextSize ?? "md"}
                onChange={(event) => {
                  const value = event.target.value as CommonSettings["footerTextSize"];
                  setSettings((prev) => ({ ...prev, footerTextSize: value }));
                  saveCommonSettings({ ...(settings ?? {}), footerTextSize: value });
                }}
              >
                <option value="sm">小</option>
                <option value="md">中</option>
                <option value="lg">大</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">タイトル</label>
          <input
            type="text"
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            value={settings.commonInfoTitle ?? ""}
            onChange={(event) => handleChange("commonInfoTitle", event.target.value)}
            placeholder="例）ご利用前のご案内"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">説明テキスト</label>
          <textarea
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            rows={10}
            value={settings.commonInfoBody ?? ""}
            onChange={(event) => handleChange("commonInfoBody", event.target.value)}
            placeholder="お客様向けの注意事項や手順を記載します。"
          />
          <p className="text-xs text-slate-500">※ 入力後は「保存する」を押して反映してください。</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-semibold text-slate-700">よくある質問（カード表示）</label>
            <span className="text-[11px] text-slate-500">1行目: 質問 / 2行目以降: 回答 / 空行で次のカード</span>
          </div>
          <textarea
            className="w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono leading-relaxed"
            rows={16}
            value={settings.commonInfoFaq ?? DEFAULT_FAQ}
            onChange={(event) => handleChange("commonInfoFaq", event.target.value)}
            placeholder={`Q. サンプルの質問を書きます。\n回答はこの行から書きます。\nさらに補足を書くときは改行を続けます。\n\nQ. 2つ目の質問は空行を挟んで追加します。\n回答は同じカードに収まります。`}
          />
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">表示イメージ</p>
            <p className="mt-1">・カード1 = 質問行 + 回答行（空行なし）</p>
            <p>・カード同士は空行で区切ります</p>
            <p>・「Q.」は質問行の先頭に付けてください</p>
          </div>
        </div>


        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">レイアウト</label>
          <select
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            value={settings.commonInfoLayout ?? "imageTop"}
            onChange={(event) => handleChange("commonInfoLayout", event.target.value as CommonSettings["commonInfoLayout"])}
          >
            <option value="imageTop">画像を上 / テキストを下</option>
            <option value="imageBottom">テキストを上 / 画像を下</option>
            <option value="imageLeft">画像が左 / テキストが右</option>
            <option value="imageRight">テキストが左 / 画像が右</option>
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-700">説明用画像（任意・2MB以下、最大5枚）</label>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700"
              onClick={() => imageInputRef.current?.click()}
            >
              画像を選択
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => handleImageUpload(event.target.files)}
            />
            <span className="text-xs text-slate-500">
              {Math.min(settings.commonInfoImages?.length ?? 0, MAX_IMAGES)}/{MAX_IMAGES} 枚
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(settings.commonInfoImages ?? (settings.commonInfoImage ? [settings.commonInfoImage] : [])).map(
                (img, index) => (
                  <div
                    key={`${img}-${index}`}
                    className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    draggable
                    onDragStart={() => {
                      dragIndexRef.current = index;
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const from = dragIndexRef.current;
                      if (from === null || from === index) return;
                      const next = [...currentImages];
                      const [moved] = next.splice(from, 1);
                      next.splice(index, 0, moved);
                      dragIndexRef.current = null;
                      persistImages(next);
                    }}
                  >
                    <div className="absolute left-2 top-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 shadow-sm">
                      ⇅ 並び替え
                    </div>
                    <img src={img} alt={`共通説明画像${index + 1}`} className="h-32 w-full object-contain bg-white" />
                    <div className="absolute right-2 top-2 flex flex-col gap-1">
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 shadow-sm"
                        onClick={() => {
                          if (index === 0) return;
                          const next = [...currentImages];
                          const [moved] = next.splice(index, 1);
                          next.splice(index - 1, 0, moved);
                          persistImages(next);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 shadow-sm"
                        onClick={() => {
                          if (index === currentImages.length - 1) return;
                          const next = [...currentImages];
                          const [moved] = next.splice(index, 1);
                          next.splice(index + 1, 0, moved);
                          persistImages(next);
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 bg-white px-2 py-1 text-[11px] text-rose-600 shadow-sm"
                        onClick={() => {
                          const next = currentImages.filter((_, i) => i !== index);
                          persistImages(next);
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )
              )}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-700">補足資料（PDF 5MB以下）</label>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700"
              onClick={() => pdfInputRef.current?.click()}
            >
              PDFを選択
            </button>
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                handlePdfUpload(file);
                event.target.value = "";
              }}
            />
            {settings.commonInfoPdf && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>{settings.commonInfoPdf.name}</span>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                  onClick={() => handleChange("commonInfoPdf", undefined)}
                >
                  削除
                </button>
              </div>
            )}
          </div>
        </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="flex flex-col">
              <span>お客様ページをプレビュー</span>
              <span className="text-xs text-slate-500">URL: https://localhost:5174/common?hideNav=1</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700"
                href="/common?hideNav=1"
                target="_blank"
                rel="noreferrer"
              >
                新しいタブで開く
              </a>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-sm text-slate-700">
            <span>プレビュー（ページ下部にスクロールして確認してください）</span>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700"
              onClick={() => setPreviewKey(Date.now())}
            >
              プレビューを更新
            </button>
          </div>
          <div className="h-[70vh] rounded-xl border border-slate-100 bg-slate-50">
            <iframe
              key={previewKey}
              title="共通説明プレビュー"
              src="/common?hideNav=1"
              className="h-full w-full rounded-xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
