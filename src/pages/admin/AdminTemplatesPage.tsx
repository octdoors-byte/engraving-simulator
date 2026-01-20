import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Toast } from "@/components/common/Toast";
import type { CommonSettings, Template, TemplateStatus, TemplateSummary } from "@/domain/types";
import { validateTemplate } from "@/domain/template/validateTemplate";
import {
  listDesigns,
  listTemplates,
  saveCommonSettings,
  saveTemplate,
  getTemplate,
  deleteTemplate,
  loadCommonSettings,
  loadTemplateBgFallback,
  saveTemplateBgFallback
} from "@/storage/local";
import { getAssetById, saveAsset, deleteAsset } from "@/storage/idb";
import { createBackupPayload, getAutoBackupPayload, restoreFromPayload } from "@/storage/backup";

const columns = [
  { label: "プレビュー", key: "preview" },
  { label: "表示名", key: "name" },
  { label: "テンプレキー", key: "templateKey" },
  { label: "状態", key: "status" },
  { label: "更新日", key: "updatedAt" }
] as const;

type ToastState = { message: string; tone?: "info" | "success" | "error" } | null;

async function adjustTemplateToImage(template: Template, imageFile: File): Promise<{
  template: Template;
  adjusted: boolean;
}> {
  try {
    const bitmap = await createImageBitmap(imageFile);
    const imageWidth = bitmap.width;
    const imageHeight = bitmap.height;
    if ("close" in bitmap) {
      bitmap.close();
    }
    if (!imageWidth || !imageHeight) {
      return { template, adjusted: false };
    }
    const canvasWidth = template.background.canvasWidthPx;
    const canvasHeight = template.background.canvasHeightPx;
    if (canvasWidth === imageWidth && canvasHeight === imageHeight) {
      return { template, adjusted: false };
    }
    const scaleX = imageWidth / canvasWidth;
    const scaleY = imageHeight / canvasHeight;
    let x = Math.round(template.engravingArea.x * scaleX);
    let y = Math.round(template.engravingArea.y * scaleY);
    let w = Math.max(1, Math.round(template.engravingArea.w * scaleX));
    let h = Math.max(1, Math.round(template.engravingArea.h * scaleY));
    x = Math.max(0, Math.min(x, imageWidth - 1));
    y = Math.max(0, Math.min(y, imageHeight - 1));
    if (x + w > imageWidth) {
      w = Math.max(1, imageWidth - x);
    }
    if (y + h > imageHeight) {
      h = Math.max(1, imageHeight - y);
    }
    return {
      template: {
        ...template,
        background: {
          ...template.background,
          canvasWidthPx: imageWidth,
          canvasHeightPx: imageHeight
        },
        engravingArea: {
          ...template.engravingArea,
          x,
          y,
          w,
          h
        }
      },
      adjusted: true
    };
  } catch (error) {
    console.error(error);
    return { template, adjusted: false };
  }
}

export function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [toast, setToast] = useState<ToastState>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [settings, setSettings] = useState<CommonSettings>(() => loadCommonSettings() ?? {});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [templatePreviewUrls, setTemplatePreviewUrls] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);
  const settingsRef = useRef<CommonSettings>(settings);

  const statusLabels: Record<TemplateStatus, string> = {
    draft: "下書き",
    tested: "テスト済み",
    published: "公開中",
    archive: "アーカイブ"
  };

  const statusOptions: Array<{ value: TemplateStatus; label: string }> = [
    { value: "draft", label: statusLabels.draft },
    { value: "tested", label: statusLabels.tested },
    { value: "published", label: statusLabels.published },
    { value: "archive", label: statusLabels.archive }
  ];

  const allowedTransitions: Record<TemplateStatus, TemplateStatus[]> = {
    draft: ["draft", "tested", "archive"],
    tested: ["tested", "published", "archive"],
    published: ["published", "archive"],
    archive: ["archive"]
  };

  const reloadTemplates = useCallback(() => {
    const list = listTemplates();
    list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    setTemplates(list);
  }, []);

  useEffect(() => {
    reloadTemplates();
  }, [reloadTemplates]);

  useEffect(() => {
    let active = true;
    const blobUrls: string[] = [];
    const loadPreviews = async () => {
      const next: Record<string, string> = {};
      for (const template of templates) {
        try {
          const asset = await getAssetById(`asset:templateBg:${template.templateKey}`);
          if (asset?.blob) {
            const url = URL.createObjectURL(asset.blob);
            blobUrls.push(url);
            next[template.templateKey] = url;
            continue;
          }
        } catch (error) {
          console.error(error);
        }
        const fallback = loadTemplateBgFallback(template.templateKey);
        if (fallback) {
          next[template.templateKey] = fallback;
        }
      }
      if (!active) {
        blobUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setTemplatePreviewUrls((prev) => {
        Object.values(prev)
          .filter((url) => url.startsWith("blob:"))
          .forEach((url) => URL.revokeObjectURL(url));
        return next;
      });
    };
    loadPreviews();
    return () => {
      active = false;
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [templates]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      saveCommonSettings(settings);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [settings]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    return () => {
      saveCommonSettings(settingsRef.current);
    };
  }, []);


  const handleTemplateFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const fileList = Array.from(files);
      const jsonFile = fileList.find((file) => file.name.toLowerCase().endsWith(".json"));
      const imageFile = fileList.find((file) => file.type.startsWith("image/"));
      if (!jsonFile || !imageFile) {
        setToast({ message: "template.json と背景画像を同時に選択してください。", tone: "error" });
        return;
      }
      const readAsDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("Invalid data URL"));
            }
          };
          reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
          reader.readAsDataURL(file);
        });
      try {
        const raw = JSON.parse(await jsonFile.text());
        const validation = validateTemplate(raw);
        if (!validation.ok || !validation.template) {
          setToast({ message: validation.errors.join(" / "), tone: "error" });
          return;
        }
        let template = {
          ...validation.template,
          logoSettings: validation.template.logoSettings ?? {
            monochrome: false
          }
        };
        if (template.background.fileName !== imageFile.name) {
          setToast({ message: "背景画像のファイル名が template.json と一致しません。", tone: "error" });
          return;
        }
        const adjusted = await adjustTemplateToImage(template, imageFile);
        if (adjusted.adjusted) {
          template = adjusted.template;
          setToast({
            message: "背景画像サイズに合わせてテンプレートを自動補正しました。",
            tone: "info"
          });
        }
        if (listTemplates().some((entry) => entry.templateKey === template.templateKey)) {
          setToast({ message: "同じキーが既に登録されています。", tone: "error" });
          return;
        }
        saveTemplate(template);
        try {
          await saveAsset({
            id: `asset:templateBg:${template.templateKey}`,
            type: "templateBg",
            blob: imageFile,
            createdAt: new Date().toISOString()
          });
        } catch (error) {
          console.error(error);
          const dataUrl = await readAsDataUrl(imageFile);
          saveTemplateBgFallback(template.templateKey, dataUrl);
          setToast({ message: "背景をローカル保存に切り替えました。", tone: "info" });
        }
        reloadTemplates();
        setToast({ message: "テンプレートを登録しました。", tone: "success" });
      } catch (error) {
        console.error(error);
        setToast({ message: "テンプレートの登録に失敗しました。", tone: "error" });
      }
    },
    [reloadTemplates]
  );

  const handleStatusChange = useCallback(
    (templateKey: string, status: TemplateStatus) => {
      const template = getTemplate(templateKey);
      if (!template) return;
      if (template.status === "archive") {
        setToast({ message: "アーカイブは変更できません。", tone: "error" });
        return;
      }
      if (status === template.status) return;
      const allowed = allowedTransitions[template.status] ?? [template.status];
      if (!allowed.includes(status)) {
        setToast({ message: "この状態には変更できません。", tone: "error" });
        return;
      }
      const next: Template = { ...template, status, updatedAt: new Date().toISOString() };
      saveTemplate(next);
      reloadTemplates();
      setToast({ message: "状態を更新しました。", tone: "success" });
    },
    [allowedTransitions, reloadTemplates]
  );

  const handleLogoSettingsChange = useCallback(
    (templateKey: string, updates: Partial<Template["logoSettings"]>) => {
      const template = getTemplate(templateKey);
      if (!template) return;
      if (template.status === "archive") {
        setToast({ message: "アーカイブは編集できません。", tone: "error" });
        return;
      }
      const current = template.logoSettings ?? { monochrome: false };
      const next: Template = {
        ...template,
        logoSettings: { ...current, ...updates },
        updatedAt: new Date().toISOString()
      };
      saveTemplate(next);
      reloadTemplates();
      setToast({ message: "ロゴ設定を更新しました。", tone: "success" });
    },
    [reloadTemplates]
  );

  const commitTemplateMeta = useCallback(
    (templateKey: string) => {
      const template = getTemplate(templateKey);
      if (!template) return;
      if (template.status === "archive") {
        setToast({ message: "アーカイブは編集できません。", tone: "error" });
        return;
      }
      const nextName = editingName.trim();
      const nextCategory = editingCategory.trim();
      if (!nextName) {
        setToast({ message: "表示名は必須です。", tone: "error" });
        return;
      }
      const next: Template = {
        ...template,
        name: nextName,
        category: nextCategory ? nextCategory : template.category,
        updatedAt: new Date().toISOString()
      };
      saveTemplate(next);
      reloadTemplates();
      setEditingKey(null);
      setToast({ message: "表示名とカテゴリを更新しました。", tone: "success" });
    },
    [editingName, editingCategory, reloadTemplates]
  );

  const cancelEditing = useCallback(() => {
    setEditingKey(null);
    setEditingName("");
    setEditingCategory("");
  }, []);

  const handleDelete = useCallback(
    async (templateKey: string) => {
      const hasDesigns = listDesigns().some((design) => design.templateKey === templateKey);
      if (hasDesigns) {
        setToast({ message: "デザインが紐づいているため削除できません。アーカイブにしてください。", tone: "error" });
        return;
      }
      const confirmed = window.confirm("テンプレートを削除しますか？");
      if (!confirmed) return;
      deleteTemplate(templateKey);
      await deleteAsset(`asset:templateBg:${templateKey}`);
      reloadTemplates();
      setToast({ message: "テンプレートを削除しました。", tone: "success" });
    },
    [reloadTemplates]
  );

  const handleLogoChange = useCallback(async (file: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setToast({ message: "ロゴ画像は 2MB 以下にしてください。", tone: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSettings((prev) => {
          const next = { ...prev, logoImage: reader.result };
          saveCommonSettings(next);
          return next;
        });
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleResetStorage = useCallback(() => {
    const confirmed = window.confirm("保存データを初期化します。よろしいですか？");
    if (!confirmed) return;
    Object.keys(localStorage)
      .filter((key) => key.startsWith("ksim:"))
      .forEach((key) => localStorage.removeItem(key));
    Object.keys(localStorage)
      .filter((key) => key.startsWith("ksim:templateBgFallback:"))
      .forEach((key) => localStorage.removeItem(key));
    const request = indexedDB.deleteDatabase("ksim_db");
    request.onsuccess = () => window.location.reload();
    request.onerror = () => window.location.reload();
  }, []);

  const handleBackupExport = useCallback(async () => {
    try {
      const payload = await createBackupPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ksim-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setToast({ message: "バックアップを保存しました。", tone: "success" });
    } catch (error) {
      console.error(error);
      setToast({ message: "バックアップの保存に失敗しました。", tone: "error" });
    }
  }, []);

  const handleBackupRestore = useCallback(async (file: File | null) => {
    if (!file) return;
    const confirmed = window.confirm("現在のデータは上書きされます。復元しますか？");
    if (!confirmed) return;
    try {
      const raw = JSON.parse(await file.text());
      await restoreFromPayload(raw);
      setToast({ message: "バックアップを復元しました。再読み込みします。", tone: "success" });
      window.location.reload();
    } catch (error) {
      console.error(error);
      setToast({ message: "バックアップの復元に失敗しました。", tone: "error" });
    }
  }, []);

  const handleAutoBackupRestore = useCallback(async () => {
    const payload = await getAutoBackupPayload();
    if (!payload) {
      setToast({ message: "自動バックアップが見つかりません。", tone: "error" });
      return;
    }
    const confirmed = window.confirm("自動バックアップで復元します。現在のデータは上書きされます。");
    if (!confirmed) return;
    try {
      await restoreFromPayload(payload);
      setToast({ message: "自動バックアップを復元しました。再読み込みします。", tone: "success" });
      window.location.reload();
    } catch (error) {
      console.error(error);
      setToast({ message: "自動バックアップの復元に失敗しました。", tone: "error" });
    }
  }, []);

  return (
    <section className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-slate-900">テンプレート管理</h1>
        </div>

        <div
          className={`mt-6 flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed px-6 py-10 text-base ${
            isDragging ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-300 bg-white text-slate-600"
          }`}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            handleTemplateFiles(event.dataTransfer.files);
          }}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
            ⬆️
          </div>
          <p className="text-lg font-semibold text-slate-800">新規登録（ドラッグ&ドロップ）</p>
          <p>ここに template.json と背景画像をまとめて置いてください</p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept=".json,image/*"
            onChange={(event) => handleTemplateFiles(event.target.files)}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">テンプレート一覧</h2>
          </div>
          <div className="mt-4 space-y-1 text-base leading-relaxed text-slate-600">
            <p>・表示名はダブルクリックで変更</p>
            <p>・テスト／スマホ／PCで表示確認</p>
            <p>・状態は「下書き・テスト済み・公開中・アーカイブ」から選ぶ</p>
            <p>・登録後はシミュレーターとPDFで見た目を確認</p>
            <p>・template.json と背景画像を一緒に置く</p>
            <p>・画像の名前は JSON に書いた名前と同じ</p>
            <p>・JSON と画像はブラウザに保存される</p>
          </div>
          <div className="mt-3">
            <button
              type="button"
              className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600"
              onClick={handleResetStorage}
            >
              保存データを初期化
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="px-6 py-3 text-left">
                    {col.label}
                  </th>
                ))}
                <th className="px-6 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {templates.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-sm text-slate-500" colSpan={6}>
                    テンプレートがありません。
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.templateKey}>
                    <td className="px-6 py-4">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
                        {templatePreviewUrls[template.templateKey] ? (
                          <img
                            src={templatePreviewUrls[template.templateKey]}
                            alt={`${template.name} の背景`}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-slate-400">なし</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {editingKey === template.templateKey ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitTemplateMeta(template.templateKey);
                              }
                              if (event.key === "Escape") {
                                cancelEditing();
                              }
                            }}
                            autoFocus
                          />
                          <input
                            type="text"
                            className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                            value={editingCategory}
                            onChange={(event) => setEditingCategory(event.target.value)}
                            placeholder="カテゴリ（任意）"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitTemplateMeta(template.templateKey);
                              }
                              if (event.key === "Escape") {
                                cancelEditing();
                              }
                            }}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600"
                              onClick={() => commitTemplateMeta(template.templateKey)}
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500"
                              onClick={cancelEditing}
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`flex flex-wrap items-center gap-2 ${
                            template.status === "archive" ? "" : "cursor-pointer"
                          }`}
                          onDoubleClick={() => {
                            if (template.status === "archive") {
                              setToast({ message: "アーカイブは編集できません。", tone: "error" });
                              return;
                            }
                            setEditingKey(template.templateKey);
                            setEditingName(template.name);
                            setEditingCategory(template.category ?? "");
                          }}
                        >
                          <span
                            role="button"
                            tabIndex={0}
                            className={
                              template.status === "archive"
                                ? "text-slate-400"
                                : "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800 hover:border-amber-300 hover:bg-amber-100 cursor-pointer"
                            }
                            onDoubleClick={() => {
                              if (template.status === "archive") {
                                setToast({ message: "アーカイブは編集できません。", tone: "error" });
                                return;
                              }
                              setEditingKey(template.templateKey);
                              setEditingName(template.name);
                              setEditingCategory(template.category ?? "");
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                if (template.status === "archive") {
                                  setToast({ message: "アーカイブは編集できません。", tone: "error" });
                                  return;
                                }
                                setEditingKey(template.templateKey);
                                setEditingName(template.name);
                                setEditingCategory(template.category ?? "");
                              }
                            }}
                          >
                            {template.name}
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            className={
                              template.status === "archive"
                                ? "text-xs font-normal text-slate-500"
                                : "text-xs font-normal text-slate-500 underline decoration-dotted underline-offset-4"
                            }
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              if (template.status === "archive") {
                                setToast({ message: "アーカイブは編集できません。", tone: "error" });
                                return;
                              }
                              setEditingKey(template.templateKey);
                              setEditingName(template.name);
                              setEditingCategory(template.category ?? "");
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                if (template.status === "archive") {
                                  setToast({ message: "アーカイブは編集できません。", tone: "error" });
                                  return;
                                }
                                setEditingKey(template.templateKey);
                                setEditingName(template.name);
                                setEditingCategory(template.category ?? "");
                              }
                            }}
                          >
                            ［{template.category && template.category.trim() ? template.category : "カテゴリ未設定"}］
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">{template.templateKey}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <StatusBadge status={template.status} />
                        <select
                          className="rounded border border-slate-200 px-2 py-1 text-xs"
                          value={template.status}
                          disabled={template.status === "archive"}
                          onChange={(event) =>
                            handleStatusChange(template.templateKey, event.target.value as TemplateStatus)
                          }
                        >
                          {statusOptions.map((option) => {
                            const allowed = allowedTransitions[template.status]?.includes(option.value);
                            return (
                              <option key={option.value} value={option.value} disabled={!allowed}>
                                {option.label}
                              </option>
                            );
                          })}
                        </select>
                        <label className="flex items-center gap-1 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={getTemplate(template.templateKey)?.logoSettings?.monochrome ?? false}
                            disabled={template.status === "archive"}
                            onChange={(event) =>
                              handleLogoSettingsChange(template.templateKey, {
                                monochrome: event.target.checked
                              })
                            }
                          />
                          モノクロ
                        </label>
                      </div>
                    </td>
                    <td className="px-6 py-4">{template.updatedAt}</td>
                    <td className="px-6 py-4 space-x-2 text-xs">
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-3 py-1 text-slate-600"
                        disabled={template.status === "archive"}
                        onClick={() => {
                          if (template.status === "draft") {
                            handleStatusChange(template.templateKey, "tested");
                          }
                          window.open(`/sim/${template.templateKey}`, "_blank", "width=390,height=844");
                        }}
                      >
                        テスト
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-3 py-1 text-slate-600"
                        onClick={() =>
                          window.open(`/sim/${template.templateKey}`, "_blank", "width=390,height=844")
                        }
                      >
                        スマホ表示
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-3 py-1 text-slate-600"
                        onClick={() =>
                          window.open(`/sim/${template.templateKey}`, "_blank", "width=1280,height=720")
                        }
                      >
                        PC表示
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-3 py-1 text-slate-600"
                        onClick={() => handleDelete(template.templateKey)}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </section>
  );
}







