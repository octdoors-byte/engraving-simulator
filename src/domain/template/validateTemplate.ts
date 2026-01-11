import type { Template } from "@/domain/types";

const TEMPLATE_KEY_PATTERN = /^[a-zA-Z0-9_-]{3,64}$/;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && value > 0;
}

export function validateTemplate(raw: unknown): { ok: boolean; errors: string[]; template?: Template } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["template.json の形式が正しくありません。"] };
  }
  const template = raw as Template;
  if (!template.templateKey || !TEMPLATE_KEY_PATTERN.test(template.templateKey)) {
    errors.push("templateKey は英数字と _- の3〜64文字で指定してください。");
  }
  if (!template.name || typeof template.name !== "string") {
    errors.push("name は必須です。");
  }
  if (!template.status || !["draft", "tested", "published"].includes(template.status)) {
    errors.push("status は draft/tested/published のいずれかで指定してください。");
  }
  if (!template.updatedAt || typeof template.updatedAt !== "string") {
    errors.push("updatedAt は必須です。");
  }
  if (!template.background || typeof template.background !== "object") {
    errors.push("background が不足しています。");
  } else {
    if (!template.background.fileName || typeof template.background.fileName !== "string") {
      errors.push("background.fileName は必須です。");
    }
    const width = template.background.canvasWidthPx;
    const height = template.background.canvasHeightPx;
    if (!isPositiveInteger(width) || width < 200 || width > 20000) {
      errors.push("background.canvasWidthPx は200〜20000の整数で指定してください。");
    }
    if (!isPositiveInteger(height) || height < 200 || height > 20000) {
      errors.push("background.canvasHeightPx は200〜20000の整数で指定してください。");
    }
  }
  if (!template.engravingArea || typeof template.engravingArea !== "object") {
    errors.push("engravingArea が不足しています。");
  } else {
    const { x, y, w, h } = template.engravingArea;
    if (![x, y, w, h].every(Number.isInteger)) {
      errors.push("engravingArea の x/y/w/h は整数で指定してください。");
    }
    if (!isPositiveInteger(w) || !isPositiveInteger(h)) {
      errors.push("engravingArea の w/h は 1 以上で指定してください。");
    }
    if (
      isFiniteNumber(x) &&
      isFiniteNumber(y) &&
      isFiniteNumber(w) &&
      isFiniteNumber(h) &&
      template.background
    ) {
      const maxX = template.background.canvasWidthPx;
      const maxY = template.background.canvasHeightPx;
      if (x < 0 || y < 0 || x + w > maxX || y + h > maxY) {
        errors.push("engravingArea がキャンバス外に出ています。");
      }
    }
  }
  if (!template.placementRules || typeof template.placementRules !== "object") {
    errors.push("placementRules が不足しています。");
  } else {
    if (typeof template.placementRules.allowRotate !== "boolean") {
      errors.push("placementRules.allowRotate は boolean で指定してください。");
    }
    if (typeof template.placementRules.keepInsideEngravingArea !== "boolean") {
      errors.push("placementRules.keepInsideEngravingArea は boolean で指定してください。");
    }
    if (!isFiniteNumber(template.placementRules.minScale)) {
      errors.push("placementRules.minScale は数値で指定してください。");
    }
    if (!isFiniteNumber(template.placementRules.maxScale)) {
      errors.push("placementRules.maxScale は数値で指定してください。");
    }
  }
  if (!template.pdf || typeof template.pdf !== "object") {
    errors.push("pdf が不足しています。");
  } else {
    if (template.pdf.pageSize !== "A4") {
      errors.push("pdf.pageSize は A4 のみ対応です。");
    }
    if (!["portrait", "landscape"].includes(template.pdf.orientation)) {
      errors.push("pdf.orientation は portrait/landscape を指定してください。");
    }
    if (!isFiniteNumber(template.pdf.dpi)) {
      errors.push("pdf.dpi は数値で指定してください。");
    }
  }
  return { ok: errors.length === 0, errors, template: errors.length === 0 ? template : undefined };
}
