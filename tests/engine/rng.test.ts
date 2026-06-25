import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect([a.nextInt(6), a.nextInt(6), a.nextInt(6)])
      .toEqual([b.nextInt(6), b.nextInt(6), b.nextInt(6)]);
  });
  it("shuffle is a permutation", () => {
    const arr = [1, 2, 3, 4, 5];
    const out = mulberry32(7).shuffle([...arr]);
    expect([...out].sort()).toEqual(arr);
  });
});
