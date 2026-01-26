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
const CATEGORY_COLORS = ["#94a3b8", "#a78bfa", "#fbbf24", "#34d399", "#fb7185", "#000000"];

const FAQ_TEMPLATE = [
  "Q. 推奨ブラウザは？",
  "最新の Edge / Chrome / Firefox / Safari でご利用ください。",
  "",
  "Q. スマホでも使えますか？",
  "スマートフォンでもご利用いただけます。PCと操作方法はほぼ同じです。",
  "",
  "Q. デザインは保存されますか？",
  "ブラウザに保存されます。別の端末では再度ログインしてください。"
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
  const [dirtySections, setDirtySections] = useState<Set<string>>(new Set());
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isHeaderFooterOpen, setIsHeaderFooterOpen] = useState(false);

  const commonInfoCategories = settings.commonInfoCategories ?? [];

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const backupKey = "ksim:commonSettings:backup";
    const backup = localStorage.getItem(backupKey);
    setHasBackup(!!backup);
  }, []);

  const handleChange = useCallback(<K extends keyof CommonSettings>(key: K, value: CommonSettings[K], section?: string) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      settingsRef.current = next;
      return next;
    });
    setIsDirty(true);
    if (section) {
      setDirtySections((prev) => new Set(prev).add(section));
    }
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
      const readers: Promise<string>[] = [];
      for (const file of selected) {
        if (file.size > MAX_IMAGE_BYTES) {
          setToast({ message: "画像は 2MB 以下にしてください。", tone: "error" });
          continue;
        }
        readers.push(
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject());
            reader.onerror = () => reject(reader.error ?? new Error("read error"));
            reader.readAsDataURL(file);
          })
        );
      }
      Promise.all(readers)
        .then((list) => {
          if (list.length === 0) return;
          const nextImages = [...current, ...list].slice(0, MAX_IMAGES);
          handleChange("commonInfoImages", nextImages, "commonInfo");
          handleChange("commonInfoImage", undefined, "commonInfo");
          setToast({ message: `画像を${list.length}枚追加しました。`, tone: "success" });
        })
        .catch(() => setToast({ message: "画像の読み込みに失敗しました。", tone: "error" }));
    },
    [handleChange, settings.commonInfoImage, settings.commonInfoImages]
  );

  const persistImages = useCallback(
    (next: string[]) => {
      handleChange("commonInfoImages", next.slice(0, MAX_IMAGES), "commonInfo");
      handleChange("commonInfoImage", undefined, "commonInfo");
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
          handleChange("commonInfoPdf", { name: file.name, dataUrl: reader.result }, "commonInfo");
          setPreviewKey(Date.now());
          setToast({ message: "PDFを更新しました。", tone: "success" });
        }
      };
      reader.readAsDataURL(file);
    },
    [handleChange]
  );

  const handleCopyFaqTemplate = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(FAQ_TEMPLATE);
      setToast({ message: "ひな型をコピーしました。", tone: "success" });
    } catch (error) {
      console.error(error);
      setToast({ message: "コピーできませんでした。手動で選択してください。", tone: "error" });
    }
  }, []);

  const handleManualSave = useCallback(() => {
    const latest = settingsRef.current;
    saveCommonSettings(latest);
    window.dispatchEvent(new CustomEvent("ksim:commonSettingsUpdated"));
    setToast({ message: "保存しました。", tone: "success" });
    setPreviewKey(Date.now());
    setIsDirty(false);
    setDirtySections(new Set());
  }, []);

  const handleSectionSave = useCallback((section: string) => {
    const latest = settingsRef.current;
    saveCommonSettings(latest);
    window.dispatchEvent(new CustomEvent("ksim:commonSettingsUpdated"));
    setToast({ message: `${section}を保存しました。`, tone: "success" });
    setPreviewKey(Date.now());
    setDirtySections((prev) => {
      const next = new Set(prev);
      next.delete(section);
      return next;
    });
    if (dirtySections.size === 1) {
      setIsDirty(false);
    }
  }, [dirtySections]);

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
    const confirmed = window.confirm(
      "設定を初期値に戻しますか？この操作は取り消せません。\n※ 念のため、事前に「バックアップを取る」で保存しておくことをおすすめします。"
    );
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

  const addCategory = () => {
    if (commonInfoCategories.length >= MAX_CATEGORIES) {
      setToast({ message: `カテゴリは最大 ${MAX_CATEGORIES} 件までです。`, tone: "info" });
      return;
    }
    const color = CATEGORY_COLORS[commonInfoCategories.length % CATEGORY_COLORS.length];
    const defaultTitle = `カテゴリ${commonInfoCategories.length + 1}`;
    const next = [
      ...commonInfoCategories,
      { id: Math.random().toString(36).slice(2, 8), title: defaultTitle, body: "", color }
    ];
    handleChange("commonInfoCategories", next, "category");
  };

  const updateCategory = (index: number, key: "title" | "body" | "color", value: string) => {
    const next = [...commonInfoCategories];
    if (!next[index]) return;
    next[index] = { ...next[index], [key]: value };
    setSettings((prev) => {
      const updated = { ...prev, commonInfoCategories: next };
      settingsRef.current = updated;
      return updated;
    });
  };

  const removeCategory = (index: number) => {
    const next = [...commonInfoCategories];
    next.splice(index, 1);
    handleChange("commonInfoCategories", next, "category");
  };

  return (
    <section className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">基本設定</h1>
          <HelpIcon guideUrl="/basic_settings.html" title="基本設定の操作ガイド" />
        </div>
        <p className="mt-2 text-sm text-slate-600">トップメニューに共通説明を掲載するための設定です。</p>

        {/* カテゴリ設定（基本設定の上部） */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-lg font-bold text-slate-700 transition hover:bg-slate-100"
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                aria-label={isCategoryOpen ? "閉じる" : "開く"}
              >
                {isCategoryOpen ? "−" : "+"}
              </button>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800">カテゴリ設定（最大 {MAX_CATEGORIES} 件）</span>
                <span className="text-xs text-slate-500">共通説明をカテゴリごとに分けたい場合に使います。</span>
              </div>
            </div>
            {isCategoryOpen && (
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                onClick={addCategory}
              >
                カテゴリを追加
              </button>
            )}
          </div>
          {isCategoryOpen && (
            <div className="space-y-3 border-t border-slate-200 p-4">
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
                    onChange={(e) => {
                      const next = [...commonInfoCategories];
                      if (!next[index]) return;
                      next[index] = { ...next[index], title: e.target.value };
                      handleChange("commonInfoCategories", next, "category");
                    }}
                    placeholder="カテゴリ名（例: 楽天用、自社用）"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={cat.body ?? ""}
                    onChange={(e) => {
                      const next = [...commonInfoCategories];
                      if (!next[index]) return;
                      next[index] = { ...next[index], body: e.target.value };
                      handleChange("commonInfoCategories", next, "category");
                    }}
                    placeholder="カテゴリの説明やメモ（任意）"
                    className="h-20 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  />
                  <div className="space-y-1 text-xs text-slate-600">
                    <p className="font-semibold">カラー（5色から選択）</p>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_COLORS.map((color) => {
                        const selected = (cat.color ?? CATEGORY_COLORS[0]) === color;
                        return (
                          <button
                            key={color}
                            type="button"
                            className={`h-8 w-10 rounded border ${selected ? "ring-2 ring-sky-400" : "border-slate-200"}`}
                            style={{ backgroundColor: color }}
                            aria-label={`色 ${color}`}
                            onClick={() => {
                              const next = [...commonInfoCategories];
                              if (!next[index]) return;
                              next[index] = { ...next[index], color };
                              handleChange("commonInfoCategories", next, "category");
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
              <div className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-600">※ 追加・編集後は「保存する」を押して反映してください。</span>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    dirtySections.has("category")
                      ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                  }`}
                  disabled={!dirtySections.has("category")}
                  onClick={() => handleSectionSave("カテゴリ設定")}
                >
                  保存する
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-lg font-bold text-slate-700 transition hover:bg-slate-100"
                onClick={() => setIsHeaderFooterOpen(!isHeaderFooterOpen)}
                aria-label={isHeaderFooterOpen ? "閉じる" : "開く"}
              >
                {isHeaderFooterOpen ? "−" : "+"}
              </button>
              <p className="text-xs font-semibold text-slate-600">ヘッダー/フッター・サイト共通設定</p>
            </div>
            {isHeaderFooterOpen && (
              <button
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  dirtySections.has("headerFooter")
                    ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                }`}
                disabled={!dirtySections.has("headerFooter")}
                onClick={() => handleSectionSave("ヘッダー/フッター設定")}
              >
                保存する
              </button>
            )}
          </div>
          {isHeaderFooterOpen && (
            <div className="space-y-2 border-t border-slate-200 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="logoImage" className="text-xs font-semibold text-slate-600">ロゴ画像</label>
              <input
                id="logoImage"
                type="file"
                accept="image/*"
                className="mt-1 w-full text-xs"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === "string") {
                      handleChange("logoImage", reader.result as string, "headerFooter");
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </div>
            <div>
              <label htmlFor="landingTitle" className="text-xs font-semibold text-slate-600">トップタイトル</label>
              <input
                id="landingTitle"
                type="text"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                value={settings.landingTitle ?? "デザインシミュレーター"}
                onChange={(event) => handleChange("landingTitle", event.target.value, "headerFooter")}
              />
            </div>
            <div>
              <label htmlFor="headerText" className="text-xs font-semibold text-slate-600">ヘッダーテキスト</label>
              <textarea
                id="headerText"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                rows={2}
                value={settings.headerText ?? ""}
                onChange={(event) => handleChange("headerText", event.target.value, "headerFooter")}
              />
            </div>
            <div>
              <label htmlFor="footerText" className="text-xs font-semibold text-slate-600">フッターテキスト</label>
              <textarea
                id="footerText"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                rows={2}
                value={settings.footerText ?? ""}
                onChange={(event) => handleChange("footerText", event.target.value, "headerFooter")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="headerTextAlign" className="text-xs font-semibold text-slate-600">ヘッダー配置</label>
                <select
                  id="headerTextAlign"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  value={settings.headerTextAlign ?? "left"}
                  onChange={(event) => handleChange("headerTextAlign", event.target.value as CommonSettings["headerTextAlign"], "headerFooter")}
                >
                  <option value="left">左</option>
                  <option value="center">中央</option>
                  <option value="right">右</option>
                </select>
              </div>
              <div>
                <label htmlFor="footerTextAlign" className="text-xs font-semibold text-slate-600">フッター配置</label>
                <select
                  id="footerTextAlign"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  value={settings.footerTextAlign ?? "center"}
                  onChange={(event) => handleChange("footerTextAlign", event.target.value as CommonSettings["footerTextAlign"], "headerFooter")}
                >
                  <option value="left">左</option>
                  <option value="center">中央</option>
                  <option value="right">右</option>
                </select>
              </div>
              <div>
                <label htmlFor="logoAlign" className="text-xs font-semibold text-slate-600">ロゴ配置</label>
                <select
                  id="logoAlign"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  value={settings.logoAlign ?? "left"}
                  onChange={(event) => handleChange("logoAlign", event.target.value as CommonSettings["logoAlign"], "headerFooter")}
                >
                  <option value="left">左</option>
                  <option value="center">中央</option>
                  <option value="right">右</option>
                </select>
              </div>
              <div>
                <label htmlFor="logoSize" className="text-xs font-semibold text-slate-600">ロゴサイズ</label>
                <select
                  id="logoSize"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  value={settings.logoSize ?? "md"}
                  onChange={(event) => handleChange("logoSize", event.target.value as CommonSettings["logoSize"], "headerFooter")}
                >
                  <option value="sm">小</option>
                  <option value="md">中</option>
                  <option value="lg">大</option>
                </select>
              </div>
              <div>
                <label htmlFor="headerTextSize" className="text-xs font-semibold text-slate-600">ヘッダー文字サイズ</label>
                <select
                  id="headerTextSize"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  value={settings.headerTextSize ?? "md"}
                  onChange={(event) => handleChange("headerTextSize", event.target.value as CommonSettings["headerTextSize"], "headerFooter")}
                >
                  <option value="sm">小</option>
                  <option value="md">中</option>
                  <option value="lg">大</option>
                </select>
              </div>
              <div>
                <label htmlFor="footerTextSize" className="text-xs font-semibold text-slate-600">フッター文字サイズ</label>
                <select
                  id="footerTextSize"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  value={settings.footerTextSize ?? "md"}
                  onChange={(event) => handleChange("footerTextSize", event.target.value as CommonSettings["footerTextSize"], "headerFooter")}
                >
                  <option value="sm">小</option>
                  <option value="md">中</option>
                  <option value="lg">大</option>
                </select>
              </div>
            </div>
          </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-slate-900">共通説明（お客様向け）</h2>
          <HelpIcon guideUrl="/common_info.html" title="共通説明ページのガイド" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="commonInfoTitle" className="text-sm font-semibold text-slate-700">タイトル</label>
            <input
              id="commonInfoTitle"
              type="text"
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={settings.commonInfoTitle ?? ""}
              onChange={(event) => handleChange("commonInfoTitle", event.target.value, "commonInfo")}
              placeholder="ご利用前のご案内 など"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="commonInfoLayout" className="text-sm font-semibold text-slate-700">レイアウト</label>
            <select
              id="commonInfoLayout"
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={settings.commonInfoLayout ?? "imageTop"}
              onChange={(event) => handleChange("commonInfoLayout", event.target.value as CommonSettings["commonInfoLayout"], "commonInfo")}
            >
              <option value="imageTop">画像を上 / テキストを下</option>
              <option value="imageBottom">テキストを上 / 画像を下</option>
              <option value="imageLeft">画像が左 / テキストが右</option>
              <option value="imageRight">テキストが左 / 画像が右</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="commonInfoBody" className="text-sm font-semibold text-slate-700">本文</label>
          <textarea
            id="commonInfoBody"
            className="h-32 w-full rounded border border-slate-200 px-3 py-2 text-sm"
            value={settings.commonInfoBody ?? ""}
            onChange={(event) => handleChange("commonInfoBody", event.target.value, "commonInfo")}
            placeholder="お客様に読んでほしい説明を入力してください。"
          />
        </div>

        <div className="space-y-3">
          <label htmlFor="commonInfoImages" className="text-sm font-semibold text-slate-700">説明用画像（任意／2MB以下、最大5枚）</label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700"
              onClick={() => imageInputRef.current?.click()}
            >
              画像を選ぶ
            </button>
            <input
              id="commonInfoImages"
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
            {currentImages.map((img, index) => (
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
                  並び替え可
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
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label htmlFor="commonInfoPdf" className="text-sm font-semibold text-slate-700">補足資料（PDF）5MB以下</label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700"
              onClick={() => pdfInputRef.current?.click()}
            >
              PDFを選ぶ
            </button>
            <input
              id="commonInfoPdf"
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
                  onClick={() => handleChange("commonInfoPdf", undefined, "commonInfo")}
                >
                  削除
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-800">よくある質問（FAQ）</span>
              <span className="text-xs text-slate-500">必要に応じて編集してください。</span>
            </div>
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
              onClick={handleCopyFaqTemplate}
            >
              ひな型をコピー
            </button>
          </div>
          <textarea
            className="h-40 w-full rounded border border-slate-200 px-3 py-2 font-mono text-xs leading-relaxed text-slate-800"
            value={settings.commonInfoFaq ?? ""}
            onChange={(event) => handleChange("commonInfoFaq", event.target.value, "commonInfo")}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">※ 入力後は「保存する」を押して反映してください。</p>
            <button
              type="button"
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                dirtySections.has("commonInfo")
                  ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
              }`}
              disabled={!dirtySections.has("commonInfo")}
              onClick={() => handleSectionSave("共通説明")}
            >
              保存する
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="flex flex-col">
            <span>お客様ページのプレビュー</span>
            <span className="text-xs text-slate-500">URL: https://localhost:5174/common?hideNav=1</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700"
              href={`${import.meta.env.BASE_URL || "/"}common?hideNav=1`}
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
              src={`${import.meta.env.BASE_URL || "/"}common?hideNav=1`}
              className="h-full w-full rounded-xl"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-slate-400 bg-slate-100 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`rounded-full border-2 px-6 py-3 text-base font-bold transition ${
                isDirty
                  ? "border-slate-500 bg-white text-slate-900 hover:bg-slate-50 shadow-md"
                  : "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-400"
              }`}
              disabled={!isDirty}
              onClick={handleManualSave}
            >
              すべて保存
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
          </div>
          <span className="text-xs text-slate-600">※ 「保存する」を押すと設定が反映されます。</span>
        </div>
      </div>
    </section>
  );
}
