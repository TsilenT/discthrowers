/**
 * Task 4: Contest card handlers.
 * Tests all four contest cards: axe-throw, chainsaw-carving, log-rolling, speed-climb.
 * Uses a rigged rng to control who wins.
 */
import { describe, it, expect } from "vitest";
import { getHandler } from "../../src/engine/cards/registry";
import { apply } from "../../src/engine/apply";
import { baseChopDice, isAxe } from "../../src/engine/cards/catalog";
import { collectChopDice } from "../../src/engine/dice";
import type { CardContext } from "../../src/engine/cards/ctx";
import type { GameState, PlayerState } from "../../src/engine/types";
import type { Rng } from "../../src/engine/rng";

/** A Rng that emits d6 faces in sequence. rollContest calls nextInt(6) twice. */
function dieRng(faces: number[]): Rng {
  let i = 0;
  return {
    nextFloat: () => {
      const f = faces[i++] ?? 1;
      return (f - 1) / 6;
    },
    nextInt: (max: number) => {
      const f = faces[i++] ?? 1;
      return Math.min(f - 1, max - 1);
    },
    shuffle: <T>(a: T[]) => a,
  };
}

function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    uid: "u", name: "n", hand: [], axe: null, equipment: [], plusMinus: [],
    help: [], standingTree: null, scoredTrees: [], speedClimbPoints: 0,
    skipNextTurn: false, redrawTo: 1, axeSetAside: false, giveMeAHand: [],
    cannotChopThisTurn: false, ...over,
  };
}

function game(over: Partial<GameState> = {}): GameState {
  return {
    version: 0,
    players: {
      0: player(),
      1: player(),
    },
    seatOrder: [0, 1],
    redDeck: [], redDiscard: [], treeDeck: [], treeDiscard: [],
    chopStockpile: 25,
    turn: { activeSeat: 0, phase: "play" },
    lastRoll: [], winner: null, pendingReaction: null,
    ...over,
  };
}

function ctx(state: GameState, actorSeat: number, target?: number, rng?: Rng): CardContext {
  const r = rng ?? dieRng([6, 1]); // challenger wins by default
  return target === undefined
    ? { state, actorSeat, rng: r }
    : { state, actorSeat, target, rng: r };
}

// ── isPlayable ──────────────────────────────────────────────────────────────

describe("contest cards: isPlayable", () => {
  const contestCards = ["axe-throw", "chainsaw-carving", "log-rolling", "speed-climb"];

  for (const card of contestCards) {
    it(`${card}: not playable without a target`, () => {
      const g = game();
      expect(getHandler(card).isPlayable(ctx(g, 0))).toBe(false);
    });

    it(`${card}: not playable targeting self`, () => {
      const g = game();
      expect(getHandler(card).isPlayable(ctx(g, 0, 0))).toBe(false);
    });

    it(`${card}: playable targeting a valid opponent`, () => {
      const g = game();
      expect(getHandler(card).isPlayable(ctx(g, 0, 1))).toBe(true);
    });

    it(`${card}: not playable if target seat doesn't exist`, () => {
      const g = game();
      expect(getHandler(card).isPlayable(ctx(g, 0, 99))).toBe(false);
    });
  }
});

// ── axe-throw ───────────────────────────────────────────────────────────────

describe("axe-throw", () => {
  it("challenger wins: winner (seat 0) gets axe-throw in plusMinus", () => {
    const g = game();
    const rng = dieRng([6, 1]); // challenger rolls 6, opponent rolls 1
    getHandler("axe-throw").play(ctx(g, 0, 1, rng));
    expect(g.players[0]!.plusMinus).toContain("axe-throw");
    expect(g.players[1]!.plusMinus).not.toContain("axe-throw");
  });

  it("opponent wins: winner (seat 1) gets axe-throw in plusMinus", () => {
    const g = game();
    const rng = dieRng([1, 6]); // challenger rolls 1, opponent rolls 6
    getHandler("axe-throw").play(ctx(g, 0, 1, rng));
    expect(g.players[1]!.plusMinus).toContain("axe-throw");
    expect(g.players[0]!.plusMinus).not.toContain("axe-throw");
  });

  it("tie → reroll: winner gets plusMinus after reroll", () => {
    const g = game();
    const rng = dieRng([3, 3, 5, 2]); // tie, then challenger wins
    getHandler("axe-throw").play(ctx(g, 0, 1, rng));
    expect(g.players[0]!.plusMinus).toContain("axe-throw");
  });
});

// ── chainsaw-carving ────────────────────────────────────────────────────────

describe("chainsaw-carving", () => {
  it("challenger wins: seat 0 gets axe='chainsaw', old axe discarded", () => {
    const g = game({ players: { 0: player({ axe: "carpenters-axe" }), 1: player() } });
    const rng = dieRng([6, 1]);
    getHandler("chainsaw-carving").play(ctx(g, 0, 1, rng));
    expect(g.players[0]!.axe).toBe("chainsaw");
    expect(g.redDiscard).toContain("carpenters-axe");
  });

  it("opponent wins: seat 1 gets axe='chainsaw', discards their old axe", () => {
    const g = game({
      players: {
        0: player(),
        1: player({ axe: "double-bladed-axe" }),
      }
    });
    const rng = dieRng([1, 6]);
    getHandler("chainsaw-carving").play(ctx(g, 0, 1, rng));
    expect(g.players[1]!.axe).toBe("chainsaw");
    expect(g.redDiscard).toContain("double-bladed-axe");
  });

  it("winner with no existing axe just gets chainsaw (no discard)", () => {
    const g = game();
    const rng = dieRng([6, 1]);
    getHandler("chainsaw-carving").play(ctx(g, 0, 1, rng));
    expect(g.players[0]!.axe).toBe("chainsaw");
    expect(g.redDiscard).not.toContain(null); // no spurious discard
  });
});

// ── log-rolling ─────────────────────────────────────────────────────────────

describe("log-rolling", () => {
  it("loser (seat 1) gets skipNextTurn when challenger wins", () => {
    const g = game();
    const rng = dieRng([6, 1]);
    getHandler("log-rolling").play(ctx(g, 0, 1, rng));
    expect(g.players[1]!.skipNextTurn).toBe(true);
    expect(g.players[0]!.skipNextTurn).toBe(false);
  });

  it("loser (seat 0) gets skipNextTurn when opponent wins", () => {
    const g = game();
    const rng = dieRng([1, 6]);
    getHandler("log-rolling").play(ctx(g, 0, 1, rng));
    expect(g.players[0]!.skipNextTurn).toBe(true);
    expect(g.players[1]!.skipNextTurn).toBe(false);
  });
});

// ── speed-climb ─────────────────────────────────────────────────────────────

describe("speed-climb", () => {
  it("winner (seat 0) gains 2 speedClimbPoints when challenger wins", () => {
    const g = game();
    const rng = dieRng([6, 1]);
    getHandler("speed-climb").play(ctx(g, 0, 1, rng));
    expect(g.players[0]!.speedClimbPoints).toBe(2);
    expect(g.players[1]!.speedClimbPoints).toBe(0);
  });

  it("winner (seat 1) gains 2 speedClimbPoints when opponent wins", () => {
    const g = game();
    const rng = dieRng([1, 6]);
    getHandler("speed-climb").play(ctx(g, 0, 1, rng));
    expect(g.players[1]!.speedClimbPoints).toBe(2);
    expect(g.players[0]!.speedClimbPoints).toBe(0);
  });

  it("speed-climb win via apply triggers game over (winner reaches 21)", () => {
    // Start seat 0 with 19 points from scored trees and 0 speed-climb points
    // Playing speed-climb and winning should bring to 21 → game over.
    // Setup: give seat 0 scored trees worth 19 pts = 2x red-oak(7) + norway-pine(4) + river-birch(5) = 23 pts
    // Simpler: 2x red-oak(7) + 1x river-birch(5) = 19 pts
    const g = game({
      players: {
        0: player({
          hand: ["speed-climb"],
          scoredTrees: ["tree-red-oak", "tree-red-oak", "tree-river-birch"], // 7+7+5=19
          speedClimbPoints: 0,
        }),
        1: player(),
      },
    });

    // Challenger (seat 0) wins the contest: rolls 6, opponent rolls 1
    const rng = dieRng([6, 1]);
    const result = apply(g, { type: "playCard", card: "speed-climb", target: 1 }, rng);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.winner).toBe(0);
    expect(result.state.turn.phase).toBe("gameOver");
  });
});

// ── axe-throw diceModifier integration ─────────────────────────────────────

describe("axe-throw: diceModifier via dice.ts", () => {
  it("axe-throw in plusMinus adds +2 to collectChopDice", () => {
    // collectChopDice reads effect.diceModifier ?? effect.winnerDiceModifier
    // axe-throw has winnerDiceModifier: 2
    const p = player({ axe: "carpenters-axe", plusMinus: ["axe-throw"] });
    // carpenters-axe base 3 + axe-throw +2 = 5
    expect(collectChopDice(p)).toBe(5);
  });
});

// ── chainsaw-carving catalog integration ────────────────────────────────────

describe("chainsaw synthetic catalog entry", () => {
  it("baseChopDice('chainsaw') === 5", () => {
    expect(baseChopDice("chainsaw")).toBe(5);
  });

  it("isAxe('chainsaw') === true", () => {
    expect(isAxe("chainsaw")).toBe(true);
  });
});

// ── discard wiring: contest cards not auto-discarded by resolvePlayedCard ──

describe("contest card discard wiring", () => {
  it("playing log-rolling does NOT add log-rolling to redDiscard", () => {
    const g = game({
      players: {
        0: player({ hand: ["log-rolling"] }),
        1: player(),
      },
    });
    const rng = dieRng([6, 1]); // challenger wins
    const result = apply(g, { type: "playCard", card: "log-rolling", target: 1 }, rng);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // log-rolling should NOT appear in redDiscard (handler controls placement)
    expect(result.state.redDiscard).not.toContain("log-rolling");
  });

  it("playing speed-climb does NOT add speed-climb to redDiscard", () => {
    const g = game({
      players: {
        0: player({ hand: ["speed-climb"] }),
        1: player(),
      },
    });
    const rng = dieRng([6, 1]);
    const result = apply(g, { type: "playCard", card: "speed-climb", target: 1 }, rng);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.redDiscard).not.toContain("speed-climb");
  });
});
