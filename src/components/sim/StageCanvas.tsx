import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DesignPlacement, Template } from "@/domain/types";
import { clampPlacement } from "@/domain/placement/clampPlacement";

type StageCanvasProps = {
  template: Template;
  backgroundUrl: string | null;
  logoUrl: string | null;
  placement: DesignPlacement;
  logoBaseSize: { width: number; height: number } | null;
  onPlacementChange: (next: DesignPlacement) => void;
};

type DragState =
  | { type: "move"; startX: number; startY: number; origin: DesignPlacement }
  | { type: "resize"; startX: number; startY: number; origin: DesignPlacement }
  | null;

const MIN_LOGO_SIZE = 10;
const A4_SIZE = { width: 595.28, height: 841.89 };

function getPageDimensions(template: Template) {
  const { orientation } = template.pdf;
  if (orientation === "portrait") {
    return { width: A4_SIZE.width, height: A4_SIZE.height };
  }
  return { width: A4_SIZE.height, height: A4_SIZE.width };
}

function formatPaperMm(template: Template): string {
  const orientation = template.pdf.orientation;
  return orientation === "landscape" ? "297×210 mm" : "210×297 mm";
}

export function StageCanvas({
  template,
  backgroundUrl,
  logoUrl,
  placement,
  logoBaseSize,
  onPlacementChange
}: StageCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewWidth, setViewWidth] = useState(0);
  const [dragState, setDragState] = useState<DragState>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width ?? 0;
      setViewWidth(width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const pageSize = useMemo(() => getPageDimensions(template), [template]);
  const pageHeight = viewWidth ? viewWidth * (pageSize.height / pageSize.width) : 0;
  const canvasWidth = template.background.canvasWidthPx;
  const canvasHeight = template.background.canvasHeightPx;
  const scale = useMemo(() => {
    if (!viewWidth || !pageHeight) return 1;
    return Math.min(viewWidth / canvasWidth, pageHeight / canvasHeight);
  }, [viewWidth, pageHeight, canvasWidth, canvasHeight]);
  const offsetX = (viewWidth - canvasWidth * scale) / 2;
  const offsetY = (pageHeight - canvasHeight * scale) / 2;

  const applyClamp = useCallback(
    (next: DesignPlacement) => {
      let result = next;
      const maxScale = template.placementRules.maxScale;
      const minScale = template.placementRules.minScale;
      if (logoBaseSize) {
        const maxW = Math.min(template.engravingArea.w, logoBaseSize.width * maxScale);
        const minW = Math.max(MIN_LOGO_SIZE, logoBaseSize.width * minScale);
        const nextW = Math.max(minW, Math.min(maxW, next.w));
        const ratio = logoBaseSize.height / logoBaseSize.width;
        const nextH = Math.max(MIN_LOGO_SIZE, nextW * ratio);
        result = { ...result, w: nextW, h: nextH };
    }
    if (template.placementRules.keepInsideEngravingArea) {
        result = clampPlacement(result, template.engravingArea);
      }
      return result;
    },
    [logoBaseSize, template.engravingArea, template.placementRules]
  );

  useEffect(() => {
    if (!dragState) return;
    const handleMove = (event: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = (event.clientX - rect.left - dragState.startX) / scale;
      const dy = (event.clientY - rect.top - dragState.startY) / scale;
      if (dragState.type === "move") {
        const next = {
          ...dragState.origin,
          x: dragState.origin.x + dx,
          y: dragState.origin.y + dy
        };
        onPlacementChange(applyClamp(next));
      }
      if (dragState.type === "resize" && logoBaseSize) {
        const nextW = dragState.origin.w + dx;
        const ratio = logoBaseSize.height / logoBaseSize.width;
        const nextH = nextW * ratio;
        const next = { ...dragState.origin, w: nextW, h: nextH };
        onPlacementChange(applyClamp(next));
      }
    };
    const handleUp = () => setDragState(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragState, scale, applyClamp, onPlacementChange, logoBaseSize]);

  return (
    <div ref={containerRef} className="relative w-full rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <div style={{ height: pageHeight }} />
      <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-600 shadow">
        用紙: {formatPaperMm(template)}
      </div>
      {backgroundUrl && (
        <img
          src={backgroundUrl}
          alt="背景"
          className="absolute rounded-2xl object-contain"
          style={{
            left: offsetX,
            top: offsetY,
            width: canvasWidth * scale,
            height: canvasHeight * scale
          }}
          draggable={false}
        />
      )}
      <div
        className="pointer-events-none absolute border-2 border-dashed border-amber-400/80 bg-amber-200/10"
        style={{
          left: offsetX + template.engravingArea.x * scale,
          top: offsetY + template.engravingArea.y * scale,
          width: template.engravingArea.w * scale,
          height: template.engravingArea.h * scale
        }}
      />
      {logoUrl && (
        <div
          className="absolute cursor-move rounded border-2 border-sky-400"
          style={{
            left: offsetX + placement.x * scale,
            top: offsetY + placement.y * scale,
            width: placement.w * scale,
            height: placement.h * scale
          }}
          onPointerDown={(event) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            setDragState({
              type: "move",
              startX: event.clientX - rect.left,
              startY: event.clientY - rect.top,
              origin: placement
            });
          }}
        >
          <img src={logoUrl} alt="ロゴ" className="h-full w-full object-contain" draggable={false} />
          <button
            type="button"
            aria-label="サイズ変更"
            className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full border border-sky-400 bg-white"
            onPointerDown={(event) => {
              event.stopPropagation();
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              setDragState({
                type: "resize",
                startX: event.clientX - rect.left,
                startY: event.clientY - rect.top,
                origin: placement
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
