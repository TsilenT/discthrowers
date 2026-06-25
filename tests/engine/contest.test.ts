/**
 * Task 4: rollContest(rng) — dice-off with reroll on ties.
 */
import { describe, it, expect } from "vitest";
import { rollContest } from "../../src/engine/contest";
import type { Rng } from "../../src/engine/rng";

/** Create a mock Rng that returns a sequence of integers [1..6] via nextInt(6). */
function seqRng(values: number[]): Rng {
  let i = 0;
  return {
    nextFloat: () => 0,
    nextInt: (max: number) => {
      // rollContest uses nextInt(6) to roll 1-6: floor(nextFloat * 6) + 1 conceptually,
      // but the implementation calls nextInt and adds 1.
      // Here we return pre-set values directly (0-indexed; the impl adds 1).
      const v = values[i++] ?? 0;
      return Math.min(v, max - 1);
    },
    shuffle: <T>(a: T[]) => a,
  };
}

/**
 * Build a Rng whose nextFloat() drives d6 rolls: nextInt(6) => floor(nextFloat*6).
 * We map desired die face to nextFloat value: face f => (f-1)/6.
 */
function dieRng(faces: number[]): Rng {
  let i = 0;
  return {
    nextFloat: () => {
      const f = faces[i++] ?? 1;
      return (f - 1) / 6; // maps face f to a float that gives nextInt(6) === f-1
    },
    nextInt: (max: number) => {
      const f = faces[i++] ?? 1;
      return Math.min(f - 1, max - 1);
    },
    shuffle: <T>(a: T[]) => a,
  };
}

describe("rollContest", () => {
  it("returns challengerRoll, opponentRoll, challengerWins when challenger wins", () => {
    // challenger rolls 5, opponent rolls 3
    const rng = dieRng([5, 3]);
    const result = rollContest(rng);
    expect(result.challengerRoll).toBe(5);
    expect(result.opponentRoll).toBe(3);
    expect(result.challengerWins).toBe(true);
  });

  it("returns challengerWins false when opponent wins", () => {
    // challenger rolls 2, opponent rolls 6
    const rng = dieRng([2, 6]);
    const result = rollContest(rng);
    expect(result.challengerRoll).toBe(2);
    expect(result.opponentRoll).toBe(6);
    expect(result.challengerWins).toBe(false);
  });

  it("rerolls ties until the rolls differ", () => {
    // First pair: both 4 (tie); second pair: 6 vs 2 (challenger wins)
    const rng = dieRng([4, 4, 6, 2]);
    const result = rollContest(rng);
    expect(result.challengerRoll).toBe(6);
    expect(result.opponentRoll).toBe(2);
    expect(result.challengerWins).toBe(true);
  });

  it("rerolls multiple ties before settling", () => {
    // Three ties, then challenger loses
    const rng = dieRng([3, 3, 5, 5, 1, 1, 4, 6]);
    const result = rollContest(rng);
    expect(result.challengerRoll).toBe(4);
    expect(result.opponentRoll).toBe(6);
    expect(result.challengerWins).toBe(false);
  });
});
