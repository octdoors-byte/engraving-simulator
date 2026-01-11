import type { DesignPlacement, EngravingArea } from "@/domain/types";

export function clampPlacement(
  placement: DesignPlacement,
  engravingArea: EngravingArea
): DesignPlacement {
  const maxX = engravingArea.x + engravingArea.w - placement.w;
  const maxY = engravingArea.y + engravingArea.h - placement.h;
  return {
    x: Math.min(Math.max(placement.x, engravingArea.x), maxX),
    y: Math.min(Math.max(placement.y, engravingArea.y), maxY),
    w: placement.w,
    h: placement.h
  };
}
