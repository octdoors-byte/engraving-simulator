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
  loadCommonSettings
} from "@/storage/local";
import { saveAsset, deleteAsset } from "@/storage/idb";

const columns = [
  { label: "表示名", key: "name" },
  { label: "テンプレキー", key: "templateKey" },
  { label: "状態", key: "status" },
  { label: "更新日", key: "updatedAt" }
] as const;

export function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [toast, setToast] = useState<{ message: string; tone?: "info" | "success" | "error" } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [settings, setSettings] = useState<CommonSettings>(() => loadCommonSettings() ?? {});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  const reloadTemplates = useCallback(() => {
    const list = listTemplates();
    list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    setTemplates(list);
  }, []);

  useEffect(() => {
    reloadTemplates();
  }, [reloadTemplates]);

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

  const templateOptions = useMemo(
    () =>
      (["draft", "tested", "published"] as TemplateStatus[]).map((status) => ({
        value: status,
        label: status === "draft" ? "下書き" : status === "tested" ? "テスト済み" : "公開中"
      })),
    []
  );

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
      try {
        const raw = JSON.parse(await jsonFile.text());
        const validation = validateTemplate(raw);
        if (!validation.ok || !validation.template) {
          setToast({ message: validation.errors.join(" / "), tone: "error" });
          return;
        }
        const template = validation.template;
        if (template.background.fileName !== imageFile.name) {
          setToast({ message: "背景画像のファイル名が template.json と一致しません。", tone: "error" });
          return;
        }
        if (listTemplates().some((entry) => entry.templateKey === template.templateKey)) {
          setToast({ message: "同じキーが既に登録されています。", tone: "error" });
          return;
        }
        saveTemplate(template);
        await saveAsset({
          id: `asset:templateBg:${template.templateKey}`,
          type: "templateBg",
          blob: imageFile,
          createdAt: new Date().toISOString()
        });
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
      if (template.status === "published" && status === "draft") {
        const confirmed = window.confirm("公開中から下書きへ戻します。続行しますか？");
        if (!confirmed) return;
      }
      const next: Template = { ...template, status, updatedAt: new Date().toISOString() };
      saveTemplate(next);
      reloadTemplates();
      setToast({ message: "状態を更新しました。", tone: "success" });
    },
    [reloadTemplates]
  );

  const commitDisplayName = useCallback(
    (templateKey: string) => {
      const template = getTemplate(templateKey);
      if (!template) return;
      const nextName = editingName.trim();
      if (!nextName) {
        setToast({ message: "表示名は必須です。", tone: "error" });
        return;
      }
      const next: Template = { ...template, name: nextName, updatedAt: new Date().toISOString() };
      saveTemplate(next);
      reloadTemplates();
      setEditingKey(null);
      setToast({ message: "表示名を更新しました。", tone: "success" });
    },
    [editingName, reloadTemplates]
  );

  const handleDelete = useCallback(
    async (templateKey: string) => {
      const hasDesigns = listDesigns().some((design) => design.templateKey === templateKey);
      const confirmed = window.confirm(
        hasDesigns
          ? "このテンプレートを参照するデザインがあります。削除を続けますか？"
          : "テンプレートを削除しますか？"
      );
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
        setSettings((prev) => ({ ...prev, logoImage: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  }, []);

  return (
    <section className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">テンプレート管理</h1>
        <p className="text-sm text-slate-500">
            template.json と背景画像を同時に登録します。背景画像のファイル名は template.background.fileName と一致が必要です。
        </p>
      </div>

        <div
          className={`mt-6 flex flex-col gap-3 rounded-2xl border-2 border-dashed p-4 text-sm ${
            isDragging ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-300 bg-white text-slate-500"
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
          <p>template.json と背景画像を同時に置いてください。</p>
          <p>背景画像の fileName は JSON と一致が必要です。</p>
          <p>JSON は localStorage、画像は IndexedDB に保存されます。</p>
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
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              onClick={() => inputRef.current?.click()}
            >
              新規登録（ドラッグ&ドロップ）
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
                  <td className="px-6 py-6 text-sm text-slate-500" colSpan={5}>
                    テンプレートがありません。
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.templateKey}>
                    <td className="px-6 py-4">
                      {editingKey === template.templateKey ? (
                        <input
                          type="text"
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          onBlur={() => commitDisplayName(template.templateKey)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitDisplayName(template.templateKey);
                            }
                            if (event.key === "Escape") {
                              setEditingKey(null);
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <span
                          role="button"
                          tabIndex={0}
                          className="cursor-pointer"
                          onDoubleClick={() => {
                            setEditingKey(template.templateKey);
                            setEditingName(template.name);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              setEditingKey(template.templateKey);
                              setEditingName(template.name);
                            }
                          }}
                        >
                          {template.name}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">{template.templateKey}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <StatusBadge status={template.status} />
                        <select
                          className="rounded border border-slate-200 px-2 py-1 text-xs"
                          value={template.status}
                          onChange={(event) =>
                            handleStatusChange(template.templateKey, event.target.value as TemplateStatus)
                          }
                        >
                          {templateOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4">{template.updatedAt}</td>
                    <td className="px-6 py-4 space-x-2 text-xs">
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

      <details className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          ＋ 共通ヘッダー / フッター設定
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">ロゴ画像</label>
            <input
              type="file"
              accept="image/*"
              className="mt-1 w-full text-xs"
              onChange={(event) => handleLogoChange(event.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">ロゴ配置</label>
            <select
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
              value={settings.logoAlign ?? "left"}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, logoAlign: event.target.value as CommonSettings["logoAlign"] }))
              }
            >
              <option value="left">左</option>
              <option value="center">中央</option>
              <option value="right">右</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">ヘッダーテキスト</label>
            <textarea
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
              rows={2}
              value={settings.headerText ?? ""}
              onChange={(event) => setSettings((prev) => ({ ...prev, headerText: event.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">フッターテキスト</label>
            <textarea
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
              rows={2}
              value={settings.footerText ?? ""}
              onChange={(event) => setSettings((prev) => ({ ...prev, footerText: event.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">ヘッダー配置</label>
            <select
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
              value={settings.headerTextAlign ?? "left"}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  headerTextAlign: event.target.value as CommonSettings["headerTextAlign"]
                }))
              }
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
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  footerTextAlign: event.target.value as CommonSettings["footerTextAlign"]
                }))
              }
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
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, logoSize: event.target.value as CommonSettings["logoSize"] }))
              }
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
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  headerTextSize: event.target.value as CommonSettings["headerTextSize"]
                }))
              }
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
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  footerTextSize: event.target.value as CommonSettings["footerTextSize"]
                }))
              }
            >
              <option value="sm">小</option>
              <option value="md">中</option>
              <option value="lg">大</option>
            </select>
          </div>
        </div>
      </details>
    </section>
  );
}
