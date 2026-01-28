import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Toast } from "@/components/common/Toast";
import { HelpIcon } from "@/components/common/HelpIcon";
import { Modal } from "@/components/common/Modal";
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
  { label: "テンプレートID", key: "templateKey" },
  { label: "状態", key: "status" },
  { label: "更新日", key: "updatedAt" }
] as const;

type ToastState = { message: string; tone?: "info" | "success" | "error" } | null;

function formatUpdatedAt(isoString: string): string {
  try {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

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
  const categoryOptions = useMemo(
    () => settings.commonInfoCategories?.map((c) => ({ value: c.id, label: c.title || c.id })) ?? [],
    [settings.commonInfoCategories]
  );
  const categoryLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    categoryOptions.forEach((opt) => map.set(opt.value, opt.label));
    return map;
  }, [categoryOptions]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCategories, setEditingCategories] = useState<string[]>([]);
  const [templatePreviewUrls, setTemplatePreviewUrls] = useState<Record<string, string>>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageName, setPreviewImageName] = useState<string | null>(null);
  const [pendingJsonFile, setPendingJsonFile] = useState<File | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [testingTemplateKey, setTestingTemplateKey] = useState<string | null>(null);
  const [testChecklist, setTestChecklist] = useState<Record<string, boolean>>({
    sizeMatch: false,
    designIdIssued: false,
    logoDisplay: false,
    pdfGenerated: false
  });
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
    const createdUrls: string[] = [];
    const loadPreviews = async () => {
      const next: Record<string, string> = {};
      for (const template of templates) {
        if (!active) break;
        try {
          const asset = await getAssetById(`asset:templateBg:${template.templateKey}`);
          if (asset?.blob) {
            const url = URL.createObjectURL(asset.blob);
            createdUrls.push(url);
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
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
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
      // 非同期処理中に作成されたURLも含めてクリーンアップ
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
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

  const processTemplateRegistration = useCallback(
    async (jsonFile: File, imageFile: File) => {
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
        let template: Template = {
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

  const handleTemplateFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const fileList = Array.from(files);
      const jsonFile = fileList.find((file) => file.name.toLowerCase().endsWith(".json"));
      const imageFile = fileList.find((file) => file.type.startsWith("image/"));
      
      // JSONファイルがアップロードされた場合
      if (jsonFile && !imageFile) {
        if (pendingImageFile) {
          // 既に画像が保存されている場合は、それと組み合わせて登録
          await processTemplateRegistration(jsonFile, pendingImageFile);
          setPendingJsonFile(null);
          setPendingImageFile(null);
        } else {
          setPendingJsonFile(jsonFile);
          setToast({ message: "template.json を読み込みました。次に背景画像をアップロードしてください。", tone: "info" });
        }
        return;
      }
      
      // 画像ファイルがアップロードされた場合
      if (imageFile && !jsonFile) {
        if (pendingJsonFile) {
          // 既にJSONが保存されている場合は、それと組み合わせて登録
          await processTemplateRegistration(pendingJsonFile, imageFile);
          setPendingJsonFile(null);
          setPendingImageFile(null);
        } else {
          setPendingImageFile(imageFile);
          setToast({ message: "背景画像を読み込みました。次に template.json をアップロードしてください。", tone: "info" });
        }
        return;
      }
      
      // 両方が同時にアップロードされた場合
      if (jsonFile && imageFile) {
        await processTemplateRegistration(jsonFile, imageFile);
        setPendingJsonFile(null);
        setPendingImageFile(null);
        return;
      }
      
      // どちらも見つからない場合
      setToast({ message: "template.json または背景画像を選択してください。", tone: "error" });
    },
    [pendingJsonFile, pendingImageFile, processTemplateRegistration]
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
    const nextCategories = editingCategories.map((c) => c.trim()).filter((c) => c.length > 0);
    if (!nextName) {
      setToast({ message: "表示名は必須です。", tone: "error" });
      return;
    }
    const next: Template = {
      ...template,
      name: nextName,
      category: nextCategories[0] ?? template.category,
      categories: nextCategories,
      updatedAt: new Date().toISOString()
    };
    saveTemplate(next);
    reloadTemplates();
    setEditingKey(null);
    setToast({ message: "表示名とカテゴリを更新しました。", tone: "success" });
  },
  [editingName, editingCategories, reloadTemplates]
);

const cancelEditing = useCallback(() => {
  setEditingKey(null);
  setEditingName("");
  setEditingCategories([]);
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
          const next: CommonSettings = { ...prev, logoImage: reader.result as string };
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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">テンプレート管理</h1>
            <HelpIcon guideUrl="/template_management.html" title="テンプレート管理の操作ガイド" />
          </div>
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
          <p className="text-sm text-slate-600">デザイン範囲と背景画像のふたつをアップロードしてください</p>
          {(pendingJsonFile || pendingImageFile) && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              {pendingJsonFile && <p>✓ template.json を読み込み済み</p>}
              {pendingImageFile && <p>✓ 背景画像を読み込み済み</p>}
              <p className="mt-1 text-amber-700">
                {pendingJsonFile && !pendingImageFile && "次に背景画像をアップロードしてください"}
                {pendingImageFile && !pendingJsonFile && "次に template.json をアップロードしてください"}
              </p>
            </div>
          )}
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
          <p className="mt-4 text-sm text-slate-600">
            表示名はダブルクリックで変更できます。詳細は？アイコンからご確認ください。
          </p>
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
                            className="h-full w-full cursor-pointer object-contain transition hover:opacity-80"
                            onClick={() => {
                              setPreviewImageUrl(templatePreviewUrls[template.templateKey]);
                              setPreviewImageName(template.name);
                            }}
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
                          <div className="space-y-1 rounded border border-slate-200 p-2">
                            <p className="text-[11px] text-slate-600">カテゴリ（複数選択可）</p>
                            <div className="flex flex-wrap gap-2 text-[11px]">
                              {categoryOptions.length === 0 && (
                                <span className="text-slate-400">カテゴリマスターが未登録です</span>
                              )}
                              {categoryOptions.map((opt) => {
                                const checked = editingCategories.includes(opt.value);
                                return (
                                  <label key={opt.value} className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        setEditingCategories((prev) => {
                                          const next = new Set(prev);
                                          if (e.target.checked) next.add(opt.value);
                                          else next.delete(opt.value);
                                          return Array.from(next);
                                        });
                                      }}
                                    />
                                    <span>{opt.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
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
                          tabIndex={0}
                          onDoubleClick={() => {
                            if (template.status === "archive") {
                              setToast({ message: "アーカイブは編集できません。", tone: "error" });
                              return;
                            }
                            setEditingKey(template.templateKey);
                            setEditingName(template.name);
                            const nextCats =
                              template.categories && template.categories.length > 0
                                ? template.categories
                                : template.category
                                ? [template.category]
                                : [];
                            setEditingCategories(nextCats);
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            if (template.status === "archive") {
                              setToast({ message: "アーカイブは編集できません。", tone: "error" });
                              return;
                            }
                            setEditingKey(template.templateKey);
                            setEditingName(template.name);
                            const nextCats =
                              template.categories && template.categories.length > 0
                                ? template.categories
                                : template.category
                                ? [template.category]
                                : [];
                            setEditingCategories(nextCats);
                          }}
                        >
                          <span
                            className={
                              template.status === "archive"
                                ? "text-slate-400"
                                : "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800 hover:border-amber-300 hover:bg-amber-100"
                            }
                          >
                            {template.name}
                          </span>
                          <div className="flex flex-wrap gap-1 text-xs">
                            {(template.categories && template.categories.length > 0
                              ? template.categories
                              : template.category
                              ? [template.category]
                              : []
                            ).map((cat) => (
                              <span
                                key={cat}
                                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-slate-700"
                              >
                                {categoryLabelMap.get(cat) ?? cat}
                              </span>
                            ))}
                            {(template.categories?.length ?? 0) === 0 && !template.category && (
                              <span className="text-slate-400">カテゴリ未設定</span>
                            )}
                          </div>
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
                    <td className="px-6 py-4">{formatUpdatedAt(template.updatedAt)}</td>
                    <td className="px-6 py-4 space-x-2 text-xs">
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-3 py-1 text-slate-600"
                        disabled={template.status === "archive"}
                        onClick={() => {
                          setTestingTemplateKey(template.templateKey);
                          setTestChecklist({
                            sizeMatch: false,
                            designIdIssued: false,
                            logoDisplay: false,
                            pdfGenerated: false
                          });
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

      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setPreviewImageUrl(null);
            setPreviewImageName(null);
          }}
        >
          <div
            className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm">
              <span className="font-semibold text-slate-900">{previewImageName}</span>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                onClick={() => {
                  setPreviewImageUrl(null);
                  setPreviewImageName(null);
                }}
              >
                閉じる
              </button>
            </div>
            <div className="flex max-h-[80vh] items-center justify-center bg-slate-50 p-8">
              <img
                src={previewImageUrl}
                alt={previewImageName || "プレビュー"}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
      {testingTemplateKey && (
        <Modal
          title={`テンプレートテスト: ${getTemplate(testingTemplateKey)?.name || testingTemplateKey}`}
          open={testingTemplateKey !== null}
          onClose={() => {
            setTestingTemplateKey(null);
            setTestChecklist({
              sizeMatch: false,
              designIdIssued: false,
              logoDisplay: false,
              pdfGenerated: false
            });
          }}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              テスト画面を開いて、以下を確認してください。チェックを入れて完了したら「テスト完了」を押してください。
            </p>
            <div className="flex justify-center pb-2">
              <button
                type="button"
                onClick={() => {
                  window.open(`/sim/${testingTemplateKey}`, "_blank", "width=1280,height=720");
                }}
                className="rounded-full border-2 border-emerald-400 bg-emerald-50 px-6 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                テスト画面を開く（PC表示）
              </button>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testChecklist.sizeMatch}
                  onChange={(e) =>
                    setTestChecklist((prev) => ({ ...prev, sizeMatch: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">
                  作成したサイズと同じか（キャンバスサイズ・刻印範囲が正しく表示されているか）
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testChecklist.designIdIssued}
                  onChange={(e) =>
                    setTestChecklist((prev) => ({ ...prev, designIdIssued: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">
                  デザインIDが発行されるか（ステップ3でデザインIDが正常に発行されるか）
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testChecklist.logoDisplay}
                  onChange={(e) =>
                    setTestChecklist((prev) => ({ ...prev, logoDisplay: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">
                  ロゴの配置が正しく表示されるか（位置・大きさ・回転が意図通りか）
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testChecklist.pdfGenerated}
                  onChange={(e) =>
                    setTestChecklist((prev) => ({ ...prev, pdfGenerated: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">
                  PDFが正常に生成されるか（確認用PDFがダウンロードできるか）
                </span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setTestingTemplateKey(null);
                  setTestChecklist({
                    sizeMatch: false,
                    designIdIssued: false,
                    logoDisplay: false,
                    pdfGenerated: false
                  });
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  const allChecked = Object.values(testChecklist).every((v) => v);
                  if (allChecked) {
                    if (getTemplate(testingTemplateKey)?.status === "draft") {
                      handleStatusChange(testingTemplateKey, "tested");
                    }
                    setToast({
                      message: "テストが完了しました。",
                      tone: "success"
                    });
                  } else {
                    setToast({
                      message: "すべての項目にチェックを入れてください。",
                      tone: "info"
                    });
                    return;
                  }
                  setTestingTemplateKey(null);
                  setTestChecklist({
                    sizeMatch: false,
                    designIdIssued: false,
                    logoDisplay: false,
                    pdfGenerated: false
                  });
                }}
                className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                テスト完了
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}







