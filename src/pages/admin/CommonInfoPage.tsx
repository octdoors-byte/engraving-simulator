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
      handleChange("commonInfoImages", next.slice(0, MAX_IMAGES));
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
    handleChange("commonInfoCategories", next);
  };

  const updateCategory = (index: number, key: "title" | "body" | "color", value: string) => {
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
    <section className="space-y-8">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      {/* Hero Section - Refined Business Design */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-8 shadow-md">
        <div className="absolute top-0 right-0 h-32 w-32 bg-slate-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-1 w-12 bg-slate-400 rounded-full"></div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Basic Settings</span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">基本設定</h1>
              <p className="text-base text-slate-600 leading-relaxed">トップメニューに共通説明を掲載するための設定</p>
            </div>
            <HelpIcon guideUrl="/basic_settings.html" title="基本設定の操作ガイド" />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-2xl font-bold text-slate-900">設定管理</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            type="button"
            className={`rounded-xl border-2 px-6 py-3 text-sm font-black shadow-sm transition-all ${
              isDirty
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100 hover:shadow-md"
                : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            }`}
            disabled={!isDirty}
            onClick={handleManualSave}
          >
            💾 保存する
          </button>
          <button
            type="button"
            className="rounded-xl border-2 border-blue-300 bg-blue-50 px-6 py-3 text-sm font-black text-blue-700 shadow-sm transition-all hover:border-blue-400 hover:bg-blue-100 hover:shadow-md"
            onClick={handleBackup}
          >
            📦 バックアップを取る
          </button>
          {hasBackup && (
            <button
              type="button"
              className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-6 py-3 text-sm font-black text-emerald-700 shadow-sm transition-all hover:border-emerald-400 hover:bg-emerald-100 hover:shadow-md"
              onClick={handleRestoreFromBackup}
            >
              🔄 バックアップから復元
            </button>
          )}
          <button
            type="button"
            className="rounded-xl border-2 border-amber-300 bg-amber-50 px-6 py-3 text-sm font-black text-amber-700 shadow-sm transition-all hover:border-amber-400 hover:bg-amber-100 hover:shadow-md"
            onClick={handleRestore}
          >
            🔙 初期値に戻す
          </button>
          <span className="text-xs font-semibold text-slate-500">※ 「保存する」を押すと設定が反映されます。</span>
        </div>

        {/* カテゴリ設定（基本設定の上部） */}
        <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-slate-900">カテゴリ設定（最大 {MAX_CATEGORIES} 件）</span>
              <span className="text-xs text-slate-600 mt-1">共通説明をカテゴリごとに分けたい場合に使います。</span>
            </div>
            <button
              type="button"
              className="rounded-xl border-2 border-slate-300 bg-gradient-to-r from-slate-50 to-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:from-slate-100 hover:to-white hover:shadow-md"
              onClick={addCategory}
            >
              ➕ カテゴリを追加
            </button>
          </div>
          {commonInfoCategories.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-slate-300 bg-gradient-to-r from-slate-50 to-white px-6 py-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">📁</span>
                <p className="text-sm font-semibold text-slate-600">まだカテゴリがありません</p>
                <p className="text-xs text-slate-500">必要に応じて追加してください</p>
              </div>
            </div>
          )}
          <div className="space-y-4">
            {commonInfoCategories.map((cat, index) => (
              <div key={cat.id ?? index} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-4 bg-slate-400 rounded-full"></div>
                    <span className="text-sm font-bold text-slate-900">カテゴリ {index + 1}</span>
                  </div>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 hover:shadow"
                    onClick={() => removeCategory(index)}
                  >
                    削除
                  </button>
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={cat.title ?? ""}
                    onChange={(e) => updateCategory(index, "title", e.target.value)}
                    placeholder="カテゴリ名（例: 楽天用、自社用）"
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  />
                  <textarea
                    value={cat.body ?? ""}
                    onChange={(e) => updateCategory(index, "body", e.target.value)}
                    placeholder="カテゴリの説明やメモ（任意）"
                    className="h-24 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition-all focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  />
                  <div className="space-y-2 rounded-xl border-2 border-slate-200 bg-white p-3">
                    <p className="text-xs font-bold text-slate-700">カラー（5色から選択）</p>
                    <div className="flex flex-wrap gap-3">
                      {CATEGORY_COLORS.map((color) => {
                        const selected = (cat.color ?? CATEGORY_COLORS[0]) === color;
                        return (
                          <button
                            key={color}
                            type="button"
                            className={`h-10 w-12 rounded-xl border-2 shadow-sm transition-all hover:scale-110 ${
                              selected ? "ring-4 ring-rose-300 ring-offset-2 border-rose-400" : "border-slate-200 hover:border-slate-300"
                            }`}
                            style={{ backgroundColor: color }}
                            aria-label={`色 ${color}`}
                            onClick={() => updateCategory(index, "color", color)}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span>※ 追加・編集後は「保存する」を押して反映してください。</span>
            <button
              type="button"
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                isDirty
                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
              }`}
              disabled={!isDirty}
              onClick={handleManualSave}
            >
              保存する
            </button>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 text-lg shadow-md">
              🎨
            </div>
            <p className="text-lg font-bold text-slate-900">ヘッダー/フッター・サイト共通設定</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="logoImage" className="block text-sm font-bold text-slate-700 mb-2">ロゴ画像</label>
              <input
                id="logoImage"
                type="file"
                accept="image/*"
                className="w-full rounded-xl border-2 border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
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
              <label htmlFor="landingTitle" className="block text-sm font-bold text-slate-700 mb-2">トップタイトル</label>
              <input
                id="landingTitle"
                type="text"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                value={settings.landingTitle ?? "デザインシミュレーター"}
                onChange={(event) => handleChange("landingTitle", event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="headerText" className="block text-sm font-bold text-slate-700 mb-2">ヘッダーテキスト</label>
              <textarea
                id="headerText"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition-all focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                rows={3}
                value={settings.headerText ?? ""}
                onChange={(event) => handleChange("headerText", event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="footerText" className="block text-sm font-bold text-slate-700 mb-2">フッターテキスト</label>
              <textarea
                id="footerText"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition-all focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                rows={3}
                value={settings.footerText ?? ""}
                onChange={(event) => handleChange("footerText", event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="headerTextAlign" className="block text-sm font-bold text-slate-700 mb-2">ヘッダー配置</label>
                <select
                  id="headerTextAlign"
                  className="w-full rounded-xl border-2 border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  value={settings.headerTextAlign ?? "left"}
                  onChange={(event) => handleChange("headerTextAlign", event.target.value as CommonSettings["headerTextAlign"])}
                >
                  <option value="left">左</option>
                  <option value="center">中央</option>
                  <option value="right">右</option>
                </select>
              </div>
              <div>
                <label htmlFor="footerTextAlign" className="block text-sm font-bold text-slate-700 mb-2">フッター配置</label>
                <select
                  id="footerTextAlign"
                  className="w-full rounded-xl border-2 border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  value={settings.footerTextAlign ?? "center"}
                  onChange={(event) => handleChange("footerTextAlign", event.target.value as CommonSettings["footerTextAlign"])}
                >
                  <option value="left">左</option>
                  <option value="center">中央</option>
                  <option value="right">右</option>
                </select>
              </div>
              <div>
                <label htmlFor="logoAlign" className="block text-sm font-bold text-slate-700 mb-2">ロゴ配置</label>
                <select
                  id="logoAlign"
                  className="w-full rounded-xl border-2 border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  value={settings.logoAlign ?? "left"}
                  onChange={(event) => handleChange("logoAlign", event.target.value as CommonSettings["logoAlign"])}
                >
                  <option value="left">左</option>
                  <option value="center">中央</option>
                  <option value="right">右</option>
                </select>
              </div>
              <div>
                <label htmlFor="logoSize" className="block text-sm font-bold text-slate-700 mb-2">ロゴサイズ</label>
                <select
                  id="logoSize"
                  className="w-full rounded-xl border-2 border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  value={settings.logoSize ?? "md"}
                  onChange={(event) => handleChange("logoSize", event.target.value as CommonSettings["logoSize"])}
                >
                  <option value="sm">小</option>
                  <option value="md">中</option>
                  <option value="lg">大</option>
                </select>
              </div>
              <div>
                <label htmlFor="headerTextSize" className="block text-sm font-bold text-slate-700 mb-2">ヘッダー文字サイズ</label>
                <select
                  id="headerTextSize"
                  className="w-full rounded-xl border-2 border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  value={settings.headerTextSize ?? "md"}
                  onChange={(event) => handleChange("headerTextSize", event.target.value as CommonSettings["headerTextSize"])}
                >
                  <option value="sm">小</option>
                  <option value="md">中</option>
                  <option value="lg">大</option>
                </select>
              </div>
              <div>
                <label htmlFor="footerTextSize" className="block text-sm font-bold text-slate-700 mb-2">フッター文字サイズ</label>
                <select
                  id="footerTextSize"
                  className="w-full rounded-xl border-2 border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
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
      </div>

      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-8 shadow-md space-y-6">
        <div className="absolute top-0 right-0 h-32 w-32 bg-slate-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-1 w-12 bg-slate-400 rounded-full"></div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Common Info</span>
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">共通説明（お客様向け）</h2>
              <p className="text-base text-slate-600 leading-relaxed">お客様に表示される共通説明ページの設定</p>
            </div>
            <HelpIcon guideUrl="/common_info.html" title="共通説明ページのガイド" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="commonInfoTitle" className="text-sm font-semibold text-slate-700">タイトル</label>
            <input
              id="commonInfoTitle"
              type="text"
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={settings.commonInfoTitle ?? ""}
              onChange={(event) => handleChange("commonInfoTitle", event.target.value)}
              placeholder="ご利用前のご案内 など"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="commonInfoLayout" className="text-sm font-semibold text-slate-700">レイアウト</label>
            <select
              id="commonInfoLayout"
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
        </div>

        <div className="space-y-2">
          <label htmlFor="commonInfoBody" className="text-sm font-semibold text-slate-700">本文</label>
          <textarea
            id="commonInfoBody"
            className="h-32 w-full rounded border border-slate-200 px-3 py-2 text-sm"
            value={settings.commonInfoBody ?? ""}
            onChange={(event) => handleChange("commonInfoBody", event.target.value)}
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
                  onClick={() => handleChange("commonInfoPdf", undefined)}
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
            onChange={(event) => handleChange("commonInfoFaq", event.target.value)}
          />
          <p className="text-xs text-slate-500">※ 入力後は「保存する」を押して反映してください。</p>
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
      </div>
    </section>
  );
}
