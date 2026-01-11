import type { CommonSettings, Design, DesignSummary, Template, TemplateSummary } from "../domain/types";

const STORAGE_PREFIX = "ksim:";
const APP_VERSION = "1.1.0";
const KEY_APP_VERSION = `${STORAGE_PREFIX}appVersion`;
const INDEX_TEMPLATES = `${STORAGE_PREFIX}templates:index`;
const INDEX_DESIGNS = `${STORAGE_PREFIX}designs:index`;
const TEMPLATE_BG_FALLBACK_PREFIX = `${STORAGE_PREFIX}templateBgFallback:`;

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function updateTemplateIndex(template: Template): void {
  const list = (readJson<TemplateSummary[]>(INDEX_TEMPLATES) ?? []).filter(
    (entry) => entry.templateKey !== template.templateKey
  );
  list.push({
    templateKey: template.templateKey,
    name: template.name,
    status: template.status,
    updatedAt: template.updatedAt
  });
  writeJson(INDEX_TEMPLATES, list);
}

function updateDesignIndex(design: Design): void {
  const list = (readJson<DesignSummary[]>(INDEX_DESIGNS) ?? []).filter(
    (entry) => entry.designId !== design.designId
  );
  list.push({
    designId: design.designId,
    templateKey: design.templateKey,
    createdAt: design.createdAt
  });
  writeJson(INDEX_DESIGNS, list);
}

export function saveTemplate(template: Template): void {
  writeJson(`${STORAGE_PREFIX}template:${template.templateKey}`, template);
  updateTemplateIndex(template);
}

export function ensureAppVersion(): string {
  localStorage.setItem(KEY_APP_VERSION, APP_VERSION);
  return APP_VERSION;
}

export function getAppVersion(): string | null {
  return localStorage.getItem(KEY_APP_VERSION);
}

export function listTemplates(): TemplateSummary[] {
  return readJson<TemplateSummary[]>(INDEX_TEMPLATES) ?? [];
}

export function getTemplate(templateKey: string): Template | null {
  return readJson<Template>(`${STORAGE_PREFIX}template:${templateKey}`);
}

export function deleteTemplate(templateKey: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}template:${templateKey}`);
  localStorage.removeItem(`${TEMPLATE_BG_FALLBACK_PREFIX}${templateKey}`);
  const remaining = (readJson<TemplateSummary[]>(INDEX_TEMPLATES) ?? []).filter(
    (entry) => entry.templateKey !== templateKey
  );
  writeJson(INDEX_TEMPLATES, remaining);
}

export function saveDesign(design: Design): void {
  writeJson(`${STORAGE_PREFIX}design:${design.designId}`, design);
  updateDesignIndex(design);
}

export function listDesigns(): DesignSummary[] {
  return readJson<DesignSummary[]>(INDEX_DESIGNS) ?? [];
}

export function getDesign(designId: string): Design | null {
  return readJson<Design>(`${STORAGE_PREFIX}design:${designId}`);
}

export function deleteDesign(designId: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}design:${designId}`);
  const remaining = (readJson<DesignSummary[]>(INDEX_DESIGNS) ?? []).filter(
    (entry) => entry.designId !== designId
  );
  writeJson(INDEX_DESIGNS, remaining);
}

export function saveCommonSettings(settings: CommonSettings): void {
  writeJson(`${STORAGE_PREFIX}commonSettings`, settings);
  window.dispatchEvent(new CustomEvent("ksim:commonSettingsUpdated"));
}

export function loadCommonSettings(): CommonSettings | null {
  return readJson<CommonSettings>(`${STORAGE_PREFIX}commonSettings`);
}

export function saveTemplateBgFallback(templateKey: string, dataUrl: string): void {
  localStorage.setItem(`${TEMPLATE_BG_FALLBACK_PREFIX}${templateKey}`, dataUrl);
}

export function loadTemplateBgFallback(templateKey: string): string | null {
  return localStorage.getItem(`${TEMPLATE_BG_FALLBACK_PREFIX}${templateKey}`);
}
