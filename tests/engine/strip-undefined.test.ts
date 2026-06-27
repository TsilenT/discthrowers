import { describe, it, expect } from "vitest";
import { stripUndefined } from "../../src/net/normalize";

describe("stripUndefined", () => {
  it("drops undefined object keys entirely", () => {
    const out = stripUndefined({ a: 1, b: undefined, c: "x" });
    expect(out).toEqual({ a: 1, c: "x" });
    expect("b" in out).toBe(false);
  });

  it("recurses into nested objects and arrays", () => {
    const out = stripUndefined({
      players: { 0: { axe: undefined, hand: ["a", undefined, "b"] } },
      pendingReaction: { card: "steal-equipment", stealItem: undefined },
    });
    expect(out).toEqual({
      players: { 0: { hand: ["a", null, "b"] } },
      pendingReaction: { card: "steal-equipment" },
    });
  });

  it("preserves null, zero, false and empty strings", () => {
    expect(stripUndefined({ a: null, b: 0, c: false, d: "" })).toEqual({ a: null, b: 0, c: false, d: "" });
  });
});
