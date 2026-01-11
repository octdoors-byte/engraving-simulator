import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/common/Modal";

type CropRect = { x: number; y: number; w: number; h: number };

type CropModalProps = {
  open: boolean;
  imageUrl: string | null;
  crop: CropRect;
  onClose: () => void;
  onApply: (next: CropRect) => void;
};

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | null;

const MIN_SIZE = 0.05;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function CropModal({ open, imageUrl, crop, onClose, onApply }: CropModalProps) {
  const [localCrop, setLocalCrop] = useState<CropRect>(crop);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; origin: CropRect } | null>(null);
  const handleClose = useCallback(() => {
    setLocalCrop(crop);
    onClose();
  }, [crop, onClose]);

  useEffect(() => {
    setLocalCrop(crop);
  }, [crop, open]);

  const applyDrag = useCallback((dx: number, dy: number, mode: DragMode, origin: CropRect) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dxNorm = dx / rect.width;
    const dyNorm = dy / rect.height;
    let next = { ...origin };
    if (mode === "move") {
      next.x = clamp(origin.x + dxNorm, 0, 1 - origin.w);
      next.y = clamp(origin.y + dyNorm, 0, 1 - origin.h);
    }
    if (mode === "se") {
      next.w = clamp(origin.w + dxNorm, MIN_SIZE, 1 - origin.x);
      next.h = clamp(origin.h + dyNorm, MIN_SIZE, 1 - origin.y);
    }
    if (mode === "nw") {
      const nextX = clamp(origin.x + dxNorm, 0, origin.x + origin.w - MIN_SIZE);
      const nextY = clamp(origin.y + dyNorm, 0, origin.y + origin.h - MIN_SIZE);
      next.w = origin.w + (origin.x - nextX);
      next.h = origin.h + (origin.y - nextY);
      next.x = nextX;
      next.y = nextY;
    }
    if (mode === "ne") {
      const nextY = clamp(origin.y + dyNorm, 0, origin.y + origin.h - MIN_SIZE);
      next.w = clamp(origin.w + dxNorm, MIN_SIZE, 1 - origin.x);
      next.h = origin.h + (origin.y - nextY);
      next.y = nextY;
    }
    if (mode === "sw") {
      const nextX = clamp(origin.x + dxNorm, 0, origin.x + origin.w - MIN_SIZE);
      next.w = origin.w + (origin.x - nextX);
      next.h = clamp(origin.h + dyNorm, MIN_SIZE, 1 - origin.y);
      next.x = nextX;
    }
    setLocalCrop(next);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleMove = (event: PointerEvent) => {
      if (!dragRef.current) return;
      const { mode, startX, startY, origin } = dragRef.current;
      applyDrag(event.clientX - startX, event.clientY - startY, mode, origin);
    };
    const handleUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [applyDrag, open]);

  return (
    <Modal
      title="トリミング調整"
      open={open}
      onClose={handleClose}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>ドラッグで移動、ハンドルでサイズ調整します。</span>
          <div className="flex items-center gap-2">
            <span>ズーム</span>
            <input
              type="range"
              min={1}
              max={2}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </div>
        </div>
        <div
          ref={containerRef}
          className="relative h-[60vh] max-h-[600px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
        >
          <div
            className="absolute inset-0"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
          >
            {imageUrl && (
              <img
                src={imageUrl}
                alt="トリミング対象"
                className="absolute inset-0 h-full w-full object-contain"
                draggable={false}
              />
            )}
            <div
              className="absolute border-2 border-sky-400 bg-sky-200/10"
              style={{
                left: `${localCrop.x * 100}%`,
                top: `${localCrop.y * 100}%`,
                width: `${localCrop.w * 100}%`,
                height: `${localCrop.h * 100}%`
              }}
              onPointerDown={(event) => {
                dragRef.current = {
                  mode: "move",
                  startX: event.clientX,
                  startY: event.clientY,
                  origin: localCrop
                };
              }}
            >
              {(["nw", "ne", "sw", "se"] as DragMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`absolute h-3 w-3 rounded-full border border-sky-400 bg-white ${
                    mode === "nw"
                      ? "-left-1 -top-1"
                      : mode === "ne"
                        ? "-right-1 -top-1"
                        : mode === "sw"
                          ? "-left-1 -bottom-1"
                          : "-right-1 -bottom-1"
                  }`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    dragRef.current = {
                      mode,
                      startX: event.clientX,
                      startY: event.clientY,
                      origin: localCrop
                    };
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-600"
            onClick={handleClose}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
            onClick={() => onApply(localCrop)}
          >
            適用して配置へ
          </button>
        </div>
      </div>
    </Modal>
  );
}
