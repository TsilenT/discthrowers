import { describe, it, expect } from "vitest";
import { assignSeats } from "../src/net/lobby";

describe("assignSeats", () => {
  it("packs a non-contiguous roster into a contiguous 0-based array in ascending slot order", () => {
    const roster = {
      0: { uid: "u0", name: "Alice" },
      2: { uid: "u2", name: "Bob" },
      5: { uid: "u5", name: "Carol" },
    };
    const result = assignSeats(roster);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ uid: "u0", name: "Alice" });
    expect(result[1]).toEqual({ uid: "u2", name: "Bob" });
    expect(result[2]).toEqual({ uid: "u5", name: "Carol" });
  });

  it("handles a single claimed slot", () => {
    const roster = { 3: { uid: "uX", name: "Solo" } };
    const result = assignSeats(roster);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ uid: "uX", name: "Solo" });
  });

  it("returns an empty array for an empty roster", () => {
    expect(assignSeats({})).toEqual([]);
  });

  it("preserves ascending slot order regardless of key insertion order", () => {
    // Object keys may not be iterated in numeric order in all runtimes without sorting
    const roster = {
      5: { uid: "u5", name: "Fifth" },
      1: { uid: "u1", name: "First" },
      3: { uid: "u3", name: "Third" },
    };
    const result = assignSeats(roster);
    expect(result.map((s) => s.name)).toEqual(["First", "Third", "Fifth"]);
  });
});
