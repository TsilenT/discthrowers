import { describe, it, expect } from "vitest";
import { getHandler } from "../../src/engine/cards/registry";

describe("registry", () => {
  it("returns a handler for a known card", () => {
    const h = getHandler("flapjacks");
    expect(typeof h.isPlayable).toBe("function");
    expect(typeof h.play).toBe("function");
  });
  it("axe cards have a handler too (equipped via apply, but playable)", () => {
    expect(getHandler("carpenters-axe").isPlayable).toBeTypeOf("function");
  });
});
