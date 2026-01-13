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
    comment: template.comment,
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

function normalizeEngravingArea(template: Template): Template {
  if (template.engravingArea) {
    const label = template.engravingArea.label || "刻印枠";
    if (label !== template.engravingArea.label) {
      return { ...template, engravingArea: { ...template.engravingArea, label } };
    }
    return template;
  }
  const width = template.background?.canvasWidthPx ?? 0;
  const height = template.background?.canvasHeightPx ?? 0;
  return {
    ...template,
    engravingArea: {
      label: "刻印枠",
      x: 0,
      y: 0,
      w: width > 0 ? width : 1,
      h: height > 0 ? height : 1
    }
  };
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
  const template = readJson<Template>(`${STORAGE_PREFIX}template:${templateKey}`);
  return template ? normalizeEngravingArea(template) : null;
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

const GARBLED_TEXT_MAP: Record<string, string> = {
  "險ｼ譖ｸ繧ｫ繝舌・ A4 蜿ｳ荳句綾蜊ｰ": "証書カバー A4 右下刻印",
  "險ｼ譖ｸ繧ｫ繝舌・ A4 蟾ｦ荳句綾蜊ｰ": "証書カバー A4 左下刻印"
};

function fixGarbledText(value: string): string {
  let next = value;
  Object.entries(GARBLED_TEXT_MAP).forEach(([from, to]) => {
    if (next.includes(from)) {
      next = next.replaceAll(from, to);
    }
  });
  next = next.replaceAll("証書カバ\uFFFD", "証書カバー");
  next = next.replaceAll("デザインシミュレータ\uFFFD", "デザインシミュレーター");
  return next;
}

export function migrateLegacyText(): void {
  const templates = listTemplates();
  templates.forEach((summary) => {
    const template = getTemplate(summary.templateKey);
    if (!template) return;
    const normalized = normalizeEngravingArea(template);
    const nextName = fixGarbledText(normalized.name);
    const nextLabel = fixGarbledText(normalized.engravingArea.label);
    if (nextName !== normalized.name || nextLabel !== normalized.engravingArea.label || normalized !== template) {
      saveTemplate({
        ...normalized,
        name: nextName,
        engravingArea: { ...normalized.engravingArea, label: nextLabel }
      });
    }
  });

  const settings = loadCommonSettings();
  if (settings) {
    const nextHeader = settings.headerText ? fixGarbledText(settings.headerText) : settings.headerText;
    const nextFooter = settings.footerText ? fixGarbledText(settings.footerText) : settings.footerText;
    const nextTitle = settings.landingTitle ? fixGarbledText(settings.landingTitle) : settings.landingTitle;
    if (
      nextHeader !== settings.headerText ||
      nextFooter !== settings.footerText ||
      nextTitle !== settings.landingTitle
    ) {
      saveCommonSettings({
        ...settings,
        headerText: nextHeader,
        footerText: nextFooter,
        landingTitle: nextTitle
      });
    }
  }
}




