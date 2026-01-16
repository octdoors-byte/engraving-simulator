import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DesignPlacement, Template } from "@/domain/types";
import { clampPlacement } from "@/domain/placement/clampPlacement";

type StageCanvasProps = {
  template: Template;
  backgroundUrl: string | null;
  logoUrl: string | null;
  placement: DesignPlacement;
  logoBaseSize: { width: number; height: number } | null;
  rotationDeg?: 0 | 90 | 180 | 270;
  onPlacementChange: (next: DesignPlacement) => void;
};

type DragState =
  | { type: "move"; startX: number; startY: number; origin: DesignPlacement }
  | { type: "resize"; startX: number; startY: number; origin: DesignPlacement }
  | null;

const MIN_LOGO_SIZE = 10;
const MIN_CANVAS_SIZE = 200;
const MAX_CANVAS_SIZE = 20000;
const A4_SIZE = { width: 595.28, height: 841.89 };

function getPageDimensions(template: Template) {
  const { orientation } = template.pdf;
  if (orientation === "portrait") {
    return { width: A4_SIZE.width, height: A4_SIZE.height };
  }
  return { width: A4_SIZE.height, height: A4_SIZE.width };
}

function clampCanvasSize(value: number) {
  if (!Number.isFinite(value)) return MIN_CANVAS_SIZE;
  return Math.max(MIN_CANVAS_SIZE, Math.min(MAX_CANVAS_SIZE, value));
}


export function StageCanvas({
  template,
  backgroundUrl,
  logoUrl,
  placement,
  logoBaseSize,
  rotationDeg = 0,
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
  const canvasWidth = clampCanvasSize(template.background.canvasWidthPx);
  const canvasHeight = clampCanvasSize(template.background.canvasHeightPx);
  const placementRules = template.placementRules ?? {
    allowRotate: false,
    keepInsideEngravingArea: true,
    minScale: 0.1,
    maxScale: 6
  };
  const safeEngravingArea = useMemo(() => {
    const base = template.engravingArea ?? {
      label: "刻印枠",
      x: 0,
      y: 0,
      w: canvasWidth,
      h: canvasHeight
    };
    const x = Number.isFinite(base.x) ? base.x : 0;
    const y = Number.isFinite(base.y) ? base.y : 0;
    const w = Number.isFinite(base.w) ? base.w : canvasWidth;
    const h = Number.isFinite(base.h) ? base.h : canvasHeight;
    const isInvalid =
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(w) ||
      !Number.isFinite(h) ||
      w <= 1 ||
      h <= 1 ||
      w > canvasWidth ||
      h > canvasHeight;
    if (isInvalid) {
      const fallbackW = Math.max(1, Math.round(canvasWidth * 0.6));
      const fallbackH = Math.max(1, Math.round(canvasHeight * 0.6));
      const fallbackX = Math.max(0, Math.round((canvasWidth - fallbackW) / 2));
      const fallbackY = Math.max(0, Math.round((canvasHeight - fallbackH) / 2));
      return { ...base, x: fallbackX, y: fallbackY, w: fallbackW, h: fallbackH };
    }
    const nextX = Math.max(0, Math.min(x, canvasWidth - 1));
    const nextY = Math.max(0, Math.min(y, canvasHeight - 1));
    const nextW = Math.max(1, Math.min(w, canvasWidth - nextX));
    const nextH = Math.max(1, Math.min(h, canvasHeight - nextY));
    return { ...base, x: nextX, y: nextY, w: nextW, h: nextH };
  }, [template.engravingArea, canvasWidth, canvasHeight]);
  const scale = useMemo(() => {
    if (!viewWidth || !pageHeight) return 1;
    return Math.min(viewWidth / canvasWidth, pageHeight / canvasHeight);
  }, [viewWidth, pageHeight, canvasWidth, canvasHeight]);
  const offsetX = (viewWidth - canvasWidth * scale) / 2;
  const offsetY = (pageHeight - canvasHeight * scale) / 2;

  const effectiveLogoBaseSize = useMemo(() => {
    if (!logoBaseSize) return null;
    if (rotationDeg === 90 || rotationDeg === 270) {
      return { width: logoBaseSize.height, height: logoBaseSize.width };
    }
    return logoBaseSize;
  }, [logoBaseSize, rotationDeg]);

  const applyClamp = useCallback(
    (next: DesignPlacement) => {
      let result = next;
      const maxScale = placementRules.maxScale;
      const minScale = placementRules.minScale;
      if (effectiveLogoBaseSize) {
        const maxW = Math.min(safeEngravingArea.w, effectiveLogoBaseSize.width * maxScale);
        const minW = Math.max(MIN_LOGO_SIZE, effectiveLogoBaseSize.width * minScale);
        const nextW = Math.max(minW, Math.min(maxW, next.w));
        const ratio = effectiveLogoBaseSize.height / effectiveLogoBaseSize.width;
        const nextH = Math.max(MIN_LOGO_SIZE, nextW * ratio);
        result = { ...result, w: nextW, h: nextH };
      }
      if (placementRules.keepInsideEngravingArea) {
        result = clampPlacement(result, safeEngravingArea);
      }
      return result;
    },
    [effectiveLogoBaseSize, safeEngravingArea, placementRules]
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
      if (dragState.type === "resize" && effectiveLogoBaseSize) {
        const nextW = dragState.origin.w + dx;
        const ratio = effectiveLogoBaseSize.height / effectiveLogoBaseSize.width;
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
  }, [dragState, scale, applyClamp, onPlacementChange, effectiveLogoBaseSize]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm"
    >
      <div style={{ height: pageHeight }} />
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
          left: offsetX + safeEngravingArea.x * scale,
          top: offsetY + safeEngravingArea.y * scale,
          width: safeEngravingArea.w * scale,
          height: safeEngravingArea.h * scale
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
          <img
            src={logoUrl}
            alt="ロゴ"
            className="h-full w-full object-contain"
            style={{
              transform: rotationDeg ? `rotate(${rotationDeg}deg)` : "none",
              transformOrigin: "center"
            }}
            draggable={false}
          />
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


