import { describe, it, expect } from "vitest";
import { resolveChop } from "../../src/engine/chop";

describe("resolveChop", () => {
  it("counts 4/5/6 as chops, 3 as miss", () => {
    const r = resolveChop([6, 5, 3]);
    expect(r.chops).toBe(2);
    expect(r.axeBreaks).toBe(false);
  });
  it("breaks the axe on 3+ ones/twos", () => {
    expect(resolveChop([1, 2, 1]).axeBreaks).toBe(true);
    expect(resolveChop([1, 2, 4]).axeBreaks).toBe(false);
  });
});
