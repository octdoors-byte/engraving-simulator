export type TemplateStatus = "draft" | "tested" | "published" | "archive";

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

export interface TemplatePaper {
  width: number;
  height: number;
}

export interface TemplateLogoSettings {
  monochrome: boolean;
}

export interface Template {
  templateKey: string;
  name: string;
  category?: string;
  categories?: string[];
  comment?: string;
  logoMinWidthMm?: number;
  logoMinHeightMm?: number;
  status: TemplateStatus;
  updatedAt: string;
  background: TemplateBackground;
  engravingArea: EngravingArea;
  placementRules: PlacementRules;
  pdf: TemplatePdfSettings;
  paper?: TemplatePaper;
  logoSettings?: TemplateLogoSettings;
}

export interface DesignLogoSettings {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  crop: { x: number; y: number; w: number; h: number };
  transparentColor: { r: number; g: number; b: number } | null;
  monochrome: boolean;
}

export interface DesignPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
  rotationDeg?: 0 | 90 | 180 | 270;
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
  category?: string;
  categories?: string[];
  comment?: string;
  status: TemplateStatus;
  updatedAt: string;
}

export interface CommonSettings {
  logoImage?: string;
  headerText?: string;
  footerText?: string;
  landingTitle?: string;
  logoAlign?: "left" | "center" | "right";
  headerTextAlign?: "left" | "center" | "right";
  footerTextAlign?: "left" | "center" | "right";
  logoSize?: "sm" | "md" | "lg";
  headerTextSize?: "sm" | "md" | "lg";
  footerTextSize?: "sm" | "md" | "lg";
  commonInfoTitle?: string;
  commonInfoBody?: string;
  commonInfoImage?: string;
  commonInfoImages?: string[];
  commonInfoLayout?: "imageTop" | "imageBottom" | "imageLeft" | "imageRight";
  commonInfoPdf?: { name: string; dataUrl: string };
  commonInfoFaq?: string;
  commonInfoCategories?: Array<{
    id: string;
    title: string;
    body?: string;
    color?: string;
  }>;
}
