export type TemplateStatus = "draft" | "tested" | "published";

export interface TemplateBackground {
  fileName: string;
  canvasWidthPx: number;
  canvasHeightPx: number;
}

export interface EngravingArea {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacementRules {
  allowRotate: boolean;
  keepInsideEngravingArea: boolean;
  minScale: number;
  maxScale: number;
}

export interface TemplatePdfSettings {
  pageSize: "A4";
  orientation: "portrait" | "landscape";
  dpi: number;
}

export interface TemplateLogoSettings {
  monochrome: boolean;
}

export interface Template {
  templateKey: string;
  name: string;
  status: TemplateStatus;
  updatedAt: string;
  background: TemplateBackground;
  engravingArea: EngravingArea;
  placementRules: PlacementRules;
  pdf: TemplatePdfSettings;
  logoSettings?: TemplateLogoSettings;
}

export interface DesignLogoSettings {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  crop: { x: number; y: number; w: number; h: number };
  transparentLevel: "weak" | "medium" | "strong";
  monochrome: boolean;
}

export interface DesignPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DesignPdfAssets {
  confirmAssetId: string;
  engraveAssetId: string;
}

export interface Design {
  designId: string;
  templateKey: string;
  createdAt: string;
  logo: DesignLogoSettings;
  placement: DesignPlacement;
  pdf: DesignPdfAssets;
}

export interface DesignSummary {
  designId: string;
  templateKey: string;
  createdAt: string;
}

export interface TemplateSummary {
  templateKey: string;
  name: string;
  status: TemplateStatus;
  updatedAt: string;
}

export interface CommonSettings {
  logoImage?: string;
  headerText?: string;
  footerText?: string;
  logoAlign?: "left" | "center" | "right";
  headerTextAlign?: "left" | "center" | "right";
  footerTextAlign?: "left" | "center" | "right";
  logoSize?: "sm" | "md" | "lg";
  headerTextSize?: "sm" | "md" | "lg";
  footerTextSize?: "sm" | "md" | "lg";
}
