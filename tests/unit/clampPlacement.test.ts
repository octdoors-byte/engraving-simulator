import { describe, expect, it } from "vitest";
import { clampPlacement } from "@/domain/placement/clampPlacement";

const area = { label: "枠", x: 100, y: 100, w: 200, h: 200 };

describe("clampPlacement", () => {
  it("keeps placement inside the area", () => {
    const placement = { x: 50, y: 80, w: 120, h: 100 };
    const clamped = clampPlacement(placement, area);
    expect(clamped.x).toBe(100);
    expect(clamped.y).toBe(100);
  });

  it("clamps to max bounds", () => {
    const placement = { x: 250, y: 260, w: 120, h: 120 };
    const clamped = clampPlacement(placement, area);
    expect(clamped.x).toBe(180);
    expect(clamped.y).toBe(180);
  });
});

