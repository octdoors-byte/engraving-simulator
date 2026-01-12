import { describe, expect, it } from "vitest";
import { validateTemplate } from "@/domain/template/validateTemplate";

const baseTemplate = {
  templateKey: "test_template_a4",
  name: "テストA4",
  status: "draft",
  updatedAt: "2026-01-11T00:00:00.000+09:00",
  background: {
    fileName: "bg.png",
    canvasWidthPx: 1200,
    canvasHeightPx: 1600
  },
  engravingArea: {
    label: "右下刻印枠",
    x: 820,
    y: 1220,
    w: 280,
    h: 180
  },
  placementRules: {
    allowRotate: false,
    keepInsideEngravingArea: true,
    minScale: 0.1,
    maxScale: 6.0
  },
  pdf: {
    pageSize: "A4",
    orientation: "portrait",
    dpi: 300
  }
};

describe("validateTemplate", () => {
  it("accepts a valid template", () => {
    const result = validateTemplate(baseTemplate);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects invalid templateKey", () => {
    const result = validateTemplate({ ...baseTemplate, templateKey: "??" });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects engravingArea out of bounds", () => {
    const result = validateTemplate({
      ...baseTemplate,
      engravingArea: { ...baseTemplate.engravingArea, x: 2000 }
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

