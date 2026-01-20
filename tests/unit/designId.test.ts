import { describe, expect, it } from "vitest";
import { generateDesignId } from "@/domain/id/designId";

const allowed = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function isAllowedSuffix(value: string) {
  return value.split("").every((char) => allowed.includes(char));
}

describe("generateDesignId", () => {
  it("returns YYMMDD_XXXXXXXX format", () => {
    const id = generateDesignId(new Set());
    expect(id).toMatch(/^\d{6}_[A-Z2-9]{8}$/);
  });

  it("uses allowed character set", () => {
    const id = generateDesignId(new Set());
    const suffix = id.split("_")[1];
    expect(suffix).toHaveLength(8);
    expect(isAllowedSuffix(suffix)).toBe(true);
  });
});

