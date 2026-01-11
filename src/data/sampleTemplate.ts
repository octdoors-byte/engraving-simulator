import type { Template } from "@/domain/types";

export const sampleTemplate: Template = {
  templateKey: "certificate_cover_a4_v1",
  name: "証書カバー A4 右下刻印",
  status: "published",
  updatedAt: "2026-01-09T10:00:00.000+09:00",
  background: {
    fileName: "certificate-cover-a4.png",
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
  logoSettings: {
    monochrome: false
  },
  pdf: {
    pageSize: "A4",
    orientation: "portrait",
    dpi: 300
  }
};
