import { afterEach, describe, expect, it } from "vitest";
import { getTemplate } from "@/storage/local";

const KEY_PREFIX = "ksim:template:";

function writeRawTemplate(key: string, value: unknown) {
  localStorage.setItem(`${KEY_PREFIX}${key}`, JSON.stringify(value));
}

afterEach(() => {
  localStorage.clear();
});

describe("getTemplate normalization", () => {
  it("fills missing engravingArea from background", () => {
    writeRawTemplate("missing_area", {
      templateKey: "missing_area",
      name: "欠落テスト",
      status: "published",
      updatedAt: "2026-01-13T00:00:00.000Z",
      background: { fileName: "bg.png", canvasWidthPx: 300, canvasHeightPx: 200 },
      placementRules: { allowRotate: false, keepInsideEngravingArea: true, minScale: 0.1, maxScale: 6 },
      pdf: { pageSize: "A4", orientation: "portrait", dpi: 300 }
    });

    const template = getTemplate("missing_area");
    expect(template?.engravingArea).toBeTruthy();
    expect(template?.engravingArea.label).toBe("刻印枠");
    expect(template?.engravingArea.x).toBe(0);
    expect(template?.engravingArea.y).toBe(0);
    expect(template?.engravingArea.w).toBe(300);
    expect(template?.engravingArea.h).toBe(200);
  });

  it("fills missing pdf settings", () => {
    writeRawTemplate("missing_pdf", {
      templateKey: "missing_pdf",
      name: "欠落テスト",
      status: "published",
      updatedAt: "2026-01-13T00:00:00.000Z",
      background: { fileName: "bg.png", canvasWidthPx: 300, canvasHeightPx: 200 },
      engravingArea: { label: "枠", x: 0, y: 0, w: 100, h: 100 },
      placementRules: { allowRotate: false, keepInsideEngravingArea: true, minScale: 0.1, maxScale: 6 }
    });

    const template = getTemplate("missing_pdf");
    expect(template?.pdf).toBeTruthy();
    expect(template?.pdf.pageSize).toBe("A4");
    expect(template?.pdf.orientation).toBe("portrait");
    expect(template?.pdf.dpi).toBe(300);
  });

  it("fills missing background with safe defaults", () => {
    writeRawTemplate("missing_bg", {
      templateKey: "missing_bg",
      name: "欠落テスト",
      status: "published",
      updatedAt: "2026-01-13T00:00:00.000Z",
      engravingArea: { label: "枠", x: 0, y: 0, w: 100, h: 100 },
      placementRules: { allowRotate: false, keepInsideEngravingArea: true, minScale: 0.1, maxScale: 6 },
      pdf: { pageSize: "A4", orientation: "portrait", dpi: 300 }
    });

    const template = getTemplate("missing_bg");
    expect(template?.background).toBeTruthy();
    expect(template?.background.canvasWidthPx).toBe(1);
    expect(template?.background.canvasHeightPx).toBe(1);
  });
});
