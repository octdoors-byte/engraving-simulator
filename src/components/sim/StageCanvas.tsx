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

  const viewScale = useMemo(() => {
    if (!viewWidth) return 1;
    return viewWidth / template.background.canvasWidthPx;
  }, [viewWidth, template.background.canvasWidthPx]);

  const viewHeight = template.background.canvasHeightPx * viewScale;

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
      const dx = (event.clientX - rect.left - dragState.startX) / viewScale;
      const dy = (event.clientY - rect.top - dragState.startY) / viewScale;
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
  }, [dragState, viewScale, applyClamp, onPlacementChange, logoBaseSize]);

  return (
    <div ref={containerRef} className="relative w-full rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <div style={{ height: viewHeight }} />
      {backgroundUrl && (
        <img
          src={backgroundUrl}
          alt="背景"
          className="absolute inset-0 h-full w-full rounded-2xl object-contain"
          draggable={false}
        />
      )}
      <div
        className="pointer-events-none absolute border-2 border-dashed border-amber-400/80 bg-amber-200/10"
        style={{
          left: template.engravingArea.x * viewScale,
          top: template.engravingArea.y * viewScale,
          width: template.engravingArea.w * viewScale,
          height: template.engravingArea.h * viewScale
        }}
      />
      {logoUrl && (
        <div
          className="absolute cursor-move rounded border-2 border-sky-400"
          style={{
            left: placement.x * viewScale,
            top: placement.y * viewScale,
            width: placement.w * viewScale,
            height: placement.h * viewScale
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
