import { useCallback, useEffect, useRef, useState } from "react";
import { Toast } from "@/components/common/Toast";
import { HelpIcon } from "@/components/common/HelpIcon";
import type { CommonSettings } from "@/domain/types";
import { loadCommonSettings, saveCommonSettings } from "@/storage/local";

type ToastState = { message: string; tone?: "info" | "success" | "error" } | null;

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
const MAX_CATEGORIES = 3;
const FAQ_TEMPLATE = `Q. ご利用前に準備するものは？
お好きなブラウザと安定したネット環境をご用意ください。

Q. 推奨ブラウザは？
最新の Edge / Chrome / Firefox / Safari でご利用ください。

Q. 作ったデザインは保存できますか？
ブラウザに保存されます。別の端末では再度デザインしてください。`;
const DEFAULT_FAQ = [
  "Q.スマホでもデザイン画面を使えますか？",
  "スマートフォンでもご利用いただけます。PCと操作方法は変わりません。",
  "",
  "Q.推奨ブラウザを教えてください。",
  "Microsoft Edge、Google Chrome、Firefox、Safariです。いずれも最新バージョンでのご利用をおすすめいたします。",
  "",
  "Q.買い物アプリでもデザイン画面を使えますか？",
  "アプリでは動かない場合があります。デザイン画面が動かなかった場合は、大変お手数ですが、デザインだけスマートフォンのインターネット閲覧アプリ（ブラウザ）で行っていただくか、ブラウザからデザイン→注文を行って下さい。",
  "",
  "Q.デザインIDとはなんですか？",
  "お客様がデザインする毎に作成される、固有の英数字です。デザインをして、デザインIDを作成していただいたら、商品ページに戻り、デザインID欄に作成された英数字を貼り付けてから、ご購入手続きにお進み下さい。",
  "",
  "Q.デザイン画面の読み込みに時間がかかります。",
  "申し訳ございません。たくさんの方が一度にご利用いただいたりすると、一時的に動作が遅くなります。お手数ですが読み込みが終わるまでお待ち下さい。",
  "",
  "Q.確認してから気に入らないのでやり直したいのですが？",
  "何度でもデザイン画面で編集ボタンを押すとデザインをやり直すことができます。デザインを完了するボタンを押すと、やり直しは出来ませんので、その場合は再度新しくデザインし直して下さい。",
  "",
  "Q.作ったデザインが消えてしまいました。",
  "インターネット閲覧アプリ（ブラウザ）の戻るボタンを押すと、作ったデザインが消える場合がございます。申し訳ございませんが、再度デザインし直してくださいますようお願いいたします。",
  "",
  "Q.少しずつデザインを変えたものを複数注文したいのですが。",
  "１枚のみロゴをいれたデザインをしてください。テスト刻印後に店舗からご連絡します。",
  "",
  "Q.著作権はどうなりますか？",
  "お客様が当店のデザイン画面システムを利用して作成したデザインの著作権はお客様に帰属します。当店が著作権を行使したり所有権を主張することはございません。",
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
  const [hasBackup, setHasBackup] = useState(false);
  const genCategoryId = () => Math.random().toString(36).slice(2, 8);

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

  const handleCopyFaqTemplate = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(FAQ_TEMPLATE);
      setToast({ message: "ひな型をクリップボードにコピーしました。", tone: "success" });
    } catch (error) {
      console.error(error);
      setToast({ message: "コピーできませんでした。手動で選択してください。", tone: "error" });
    }
  }, []);

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

  const handleBackup = useCallback(() => {
    const current = settingsRef.current;
    const backupKey = "ksim:commonSettings:backup";
    localStorage.setItem(backupKey, JSON.stringify(current));
    setHasBackup(true);
    setToast({ message: "現在の設定をバックアップしました。", tone: "success" });
  }, []);

  const handleRestoreFromBackup = useCallback(() => {
    const backupKey = "ksim:commonSettings:backup";
    const backup = localStorage.getItem(backupKey);
    if (!backup) {
      setToast({ message: "バックアップが見つかりません。", tone: "error" });
      return;
    }
    try {
      const restored = JSON.parse(backup) as CommonSettings;
      setSettings(restored);
      settingsRef.current = restored;
      setIsDirty(true);
      setPreviewKey(Date.now());
      setToast({ message: "バックアップから復元しました。「保存する」を押して反映してください。", tone: "info" });
    } catch (error) {
      console.error(error);
      setToast({ message: "バックアップの復元に失敗しました。", tone: "error" });
    }
  }, []);

  const handleRestore = useCallback(() => {
    const confirmed = window.confirm("設定を初期値に戻しますか？この操作は取り消せません。\n\n※ 念のため、事前に「バックアップを取る」ボタンで現在の設定を保存しておくことをおすすめします。");
    if (!confirmed) return;
    const defaultSettings: CommonSettings = {
      headerText: "",
      footerText: "",
      landingTitle: "デザインシミュレーター",
      logoAlign: "left",
      headerTextAlign: "left",
      footerTextAlign: "center",
      logoSize: "md",
      headerTextSize: "md",
      footerTextSize: "md"
    };
    setSettings(defaultSettings);
    settingsRef.current = defaultSettings;
    setIsDirty(true);
    setPreviewKey(Date.now());
    setToast({ message: "設定を初期値に戻しました。「保存する」を押して反映してください。", tone: "info" });
  }, []);

  // ページ読み込み時にバックアップの有無を確認
  useEffect(() => {
    const backupKey = "ksim:commonSettings:backup";
    const backup = localStorage.getItem(backupKey);
    setHasBackup(!!backup);
  }, []);

  // カテゴリ設定（最大3件）
  const commonInfoCategories = settings.commonInfoCategories ?? [];
  const addCategory = () => {
    if (commonInfoCategories.length >= MAX_CATEGORIES) {
      setToast({ message: `カテゴリは最大 ${MAX_CATEGORIES} 件までです。`, tone: "info" });
      return;
    }
    const next = [...commonInfoCategories, { id: genCategoryId(), title: "", body: "" }];
    handleChange("commonInfoCategories", next);
  };
  const updateCategory = (index: number, key: "title" | "body", value: string) => {
    const next = [...commonInfoCategories];
    if (!next[index]) return;
    next[index] = { ...next[index], [key]: value };
    handleChange("commonInfoCategories", next);
  };
  const removeCategory = (index: number) => {
    const next = [...commonInfoCategories];
    next.splice(index, 1);
    handleChange("commonInfoCategories", next);
  };

  return (
    <section className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">基本設定</h1>
          <HelpIcon guideUrl="/basic_settings.html" title="基本設定の操作ガイド" />
        </div>
        <p className="mt-2 text-sm text-slate-600">トップメニューに共通説明を掲載するための設定です。詳細は？アイコンからご確認ください。</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
            onClick={handleBackup}
          >
            バックアップを取る
          </button>
          {hasBackup && (
            <button
              type="button"
              className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
              onClick={handleRestoreFromBackup}
            >
              バックアップから復元
            </button>
          )}
          <button
            type="button"
            className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
            onClick={handleRestore}
          >
            初期値に戻す
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
                      handleChange("logoImage", reader.result as string);
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
                onChange={(event) => handleChange("landingTitle", event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">ヘッダーテキスト</label>
              <textarea
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                rows={2}
                value={settings.headerText ?? ""}
                onChange={(event) => handleChange("headerText", event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">フッターテキスト</label>
              <textarea
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                rows={2}
                value={settings.footerText ?? ""}
                onChange={(event) => handleChange("footerText", event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">ヘッダー配置</label>
              <select
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                value={settings.headerTextAlign ?? "left"}
                onChange={(event) => handleChange("headerTextAlign", event.target.value as CommonSettings["headerTextAlign"])}
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
                onChange={(event) => handleChange("footerTextAlign", event.target.value as CommonSettings["footerTextAlign"])}
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
                onChange={(event) => handleChange("logoSize", event.target.value as CommonSettings["logoSize"])}
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
                onChange={(event) => handleChange("headerTextSize", event.target.value as CommonSettings["headerTextSize"])}
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
                onChange={(event) => handleChange("footerTextSize", event.target.value as CommonSettings["footerTextSize"])}
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>入力ルール:</span>
            <span className="rounded-full bg-amber-50 px-2 py-1">・質問は「Q.」で始める</span>
            <span className="rounded-full bg-amber-50 px-2 py-1">・回答は空行を入れずに続ける</span>
            <span className="rounded-full bg-amber-50 px-2 py-1">・カード間は空行1つ</span>
          </div>
          <textarea
            className="w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono leading-relaxed"
            rows={16}
            value={settings.commonInfoFaq ?? DEFAULT_FAQ}
            onChange={(event) => handleChange("commonInfoFaq", event.target.value)}
            placeholder={`Q. サンプルの質問を書きます。\n回答はこの行から書きます。\nさらに補足を書くときは改行を続けます。\n\nQ. 2つ目の質問は空行を挟んで追加します。\n回答は同じカードに収まります。`}
          />
          <div className="flex flex-wrap items-start gap-3">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">表示イメージ</p>
              <p className="mt-1">・カード1 = 質問行 + 回答行（空行なし）</p>
              <p>・カード同士は空行で区切ります</p>
              <p>・「Q.」は質問行の先頭に付けてください</p>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-800">ひな型（コピーして使えます）</p>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                  onClick={handleCopyFaqTemplate}
                >
                  ひな型をコピー
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-words rounded bg-slate-50 px-2 py-2 font-mono text-[11px] leading-relaxed text-slate-800">
{FAQ_TEMPLATE}
              </pre>
            </div>
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

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-800">カテゴリ設定（最大 {MAX_CATEGORIES} 件）</span>
              <span className="text-xs text-slate-500">共通説明をカテゴリごとに分けたい場合に使います</span>
            </div>
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={addCategory}
            >
              カテゴリを追加
            </button>
          </div>
          {commonInfoCategories.length === 0 && (
            <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              まだカテゴリがありません。必要に応じて追加してください。
            </div>
          )}
          <div className="space-y-3">
            {commonInfoCategories.map((cat, index) => (
              <div key={cat.id ?? index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">カテゴリ {index + 1}</span>
                  <button
                    type="button"
                    className="rounded-full border border-rose-200 bg-white px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50"
                    onClick={() => removeCategory(index)}
                  >
                    削除
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={cat.title ?? ""}
                    onChange={(e) => updateCategory(index, "title", e.target.value)}
                    placeholder="カテゴリ名（例: 楽天用、自社用）"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={cat.body ?? ""}
                    onChange={(e) => updateCategory(index, "body", e.target.value)}
                    placeholder="カテゴリの説明やメモ（任意）"
                    className="h-20 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            ))}
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
            <span>確認（ページ下部にスクロールして確認してください）</span>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700"
              onClick={() => setPreviewKey(Date.now())}
            >
              確認を更新
            </button>
          </div>
          <div className="h-[70vh] rounded-xl border border-slate-100 bg-slate-50">
            <iframe
              key={previewKey}
              title="共通説明確認"
              src="/common?hideNav=1"
              className="h-full w-full rounded-xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
