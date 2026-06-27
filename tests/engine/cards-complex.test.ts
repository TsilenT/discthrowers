/**
 * Task 5: Tests for the three complex cards:
 *   - switch-tags   (action)
 *   - long-saw-and-partner  (help)
 *
 * give-me-a-hand has its own file (give-me-a-hand.test.ts)
 * because the mechanic spans two turns (apply-level integration).
 */
import { describe, it, expect } from "vitest";
import { getHandler } from "../../src/engine/cards/registry";
import type { CardContext } from "../../src/engine/cards/ctx";
import type { GameState, PlayerState } from "../../src/engine/types";
import { apply } from "../../src/engine/apply";
import { mulberry32 } from "../../src/engine/rng";

function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    uid: "u", name: "n", hand: [], axe: "carpenters-axe", equipment: [], plusMinus: [],
    help: [], standingTree: null, scoredTrees: [], speedClimbPoints: 0,
    skipTurns: 0, redrawTo: 1, axeSetAside: false, giveMeAHand: [], cannotChopThisTurn: false,
    ...over,
  };
}

function game(players: Record<number, PlayerState>, extra: Partial<GameState> = {}): GameState {
  return {
    version: 0, players, seatOrder: Object.keys(players).map(Number),
    redDeck: [], redDiscard: [], treeDeck: [], treeDiscard: [],
    chopStockpile: 25,
    turn: { activeSeat: 0, phase: "play" },
    lastRoll: [], winner: null, pendingReaction: null,
    ...extra,
  };
}

function ctx(state: GameState, actorSeat: number, target?: number): CardContext {
  const rng = { nextFloat: () => 0, nextInt: () => 0, shuffle: <T>(a: T[]) => a };
  return target === undefined ? { state, actorSeat, rng } : { state, actorSeat, target, rng };
}

const ok = (r: ReturnType<typeof apply>) => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

// ── switch-tags ────────────────────────────────────────────────────────────────

describe("switch-tags", () => {
  it("isPlayable: requires actor ≥1 scored tree AND opponent ≥1 scored tree", () => {
    const g = game({
      0: player({ scoredTrees: ["tree-red-oak"] }),
      1: player({ scoredTrees: ["tree-norway-pine"] }),
    });
    expect(getHandler("switch-tags").isPlayable(ctx(g, 0, 1))).toBe(true);
  });

  it("isPlayable: false when no target given", () => {
    const g = game({
      0: player({ scoredTrees: ["tree-red-oak"] }),
      1: player({ scoredTrees: ["tree-norway-pine"] }),
    });
    expect(getHandler("switch-tags").isPlayable(ctx(g, 0))).toBe(false);
  });

  it("isPlayable: false when actor has no scored trees", () => {
    const g = game({
      0: player({ scoredTrees: [] }),
      1: player({ scoredTrees: ["tree-norway-pine"] }),
    });
    expect(getHandler("switch-tags").isPlayable(ctx(g, 0, 1))).toBe(false);
  });

  it("isPlayable: false when target has no scored trees", () => {
    const g = game({
      0: player({ scoredTrees: ["tree-red-oak"] }),
      1: player({ scoredTrees: [] }),
    });
    expect(getHandler("switch-tags").isPlayable(ctx(g, 0, 1))).toBe(false);
  });

  it("isPlayable: false when targeting self", () => {
    const g = game({
      0: player({ scoredTrees: ["tree-red-oak"] }),
      1: player({ scoredTrees: ["tree-norway-pine"] }),
    });
    expect(getHandler("switch-tags").isPlayable(ctx(g, 0, 0))).toBe(false);
  });

  it("play: swaps the first scored tree of actor and target", () => {
    const g = game({
      0: player({ scoredTrees: ["tree-red-oak", "tree-cottonwood"] }),
      1: player({ scoredTrees: ["tree-norway-pine"] }),
    });
    getHandler("switch-tags").play(ctx(g, 0, 1));
    // Actor's first scored tree (red-oak) swaps with target's first scored tree (norway-pine)
    expect(g.players[0]!.scoredTrees[0]).toBe("tree-norway-pine");
    expect(g.players[1]!.scoredTrees[0]).toBe("tree-red-oak");
    // Actor still has cottonwood (index 1 untouched)
    expect(g.players[0]!.scoredTrees).toContain("tree-cottonwood");
  });

  it("play: swaps when each player has exactly one scored tree", () => {
    const g = game({
      0: player({ scoredTrees: ["tree-red-oak"] }),
      1: player({ scoredTrees: ["tree-norway-pine"] }),
    });
    getHandler("switch-tags").play(ctx(g, 0, 1));
    expect(g.players[0]!.scoredTrees).toEqual(["tree-norway-pine"]);
    expect(g.players[1]!.scoredTrees).toEqual(["tree-red-oak"]);
  });

  it("play: speedClimbPoints are NOT swapped", () => {
    const g = game({
      0: player({ scoredTrees: ["tree-red-oak"], speedClimbPoints: 4 }),
      1: player({ scoredTrees: ["tree-norway-pine"], speedClimbPoints: 2 }),
    });
    getHandler("switch-tags").play(ctx(g, 0, 1));
    expect(g.players[0]!.speedClimbPoints).toBe(4);
    expect(g.players[1]!.speedClimbPoints).toBe(2);
  });

  it("via apply: switch-tags resolves and advances to chop", () => {
    // switch-tags is reactable by paperwork; with no paperwork in opponents' hands → resolves immediately
    const s = ok(apply(game({
      0: player({ hand: ["switch-tags"], scoredTrees: ["tree-red-oak"] }),
      1: player({ scoredTrees: ["tree-norway-pine"] }),
    }), { type: "playCard", card: "switch-tags", target: 1 }, mulberry32(1)));
    // Cards swapped
    expect(s.players[0]!.scoredTrees).toContain("tree-norway-pine");
    expect(s.players[1]!.scoredTrees).toContain("tree-red-oak");
    // switch-tags goes to discard (action category)
    expect(s.redDiscard).toContain("switch-tags");
    expect(s.turn.phase).toBe("chop");
  });

  it("via apply: switch-tags sets pendingReaction when opponent holds paperwork", () => {
    // Actor plays switch-tags when opponent holds paperwork → reaction window opens
    const s = ok(apply(game({
      0: player({ hand: ["switch-tags"], scoredTrees: ["tree-red-oak"] }),
      1: player({ hand: ["paperwork"], scoredTrees: ["tree-norway-pine"] }),
    }), { type: "playCard", card: "switch-tags", target: 1 }, mulberry32(1)));
    expect(s.pendingReaction).not.toBeNull();
    expect(s.pendingReaction?.card).toBe("switch-tags");
    // Trees NOT yet swapped (pending)
    expect(s.players[0]!.scoredTrees).toContain("tree-red-oak");
    expect(s.players[1]!.scoredTrees).toContain("tree-norway-pine");
  });

  it("via apply: switch-tags can trigger a win when the swap brings actor to ≥21 points", () => {
    // Actor: tree-mighty-oak (12pts) + switch-tags play swaps to get tree-american-elm+red-oak (8+7=15)
    // Build: actor already has a scored tree worth 12 (mighty-oak), needs 9 more.
    // Target has: tree-american-elm (8pts). Actor gets 12+8=20, not enough.
    // Let's use: actor has tree-red-oak (7pts) already; target has tree-silver-maple (8pts) and tree-mighty-oak (12pts).
    // After swap: actor gets tree-silver-maple (8pts), total 7+8=15. Still not 21.
    // More direct: actor has many trees already summing to 13, gets a 8-point tree to reach 21.
    // actor: scoredTrees=["tree-red-oak"(7), "tree-red-oak"(7)] -> 14 pts
    // target: scoredTrees=["tree-mighty-oak"(12)] -> 12 pts
    // After swap: actor gets tree-mighty-oak (12) instead of first red-oak: 12+7=19 (not 21)
    // Let's do: actor scoredTrees=["tree-red-oak"(7),"tree-silver-maple"(8)]=15, target has tree-red-oak(7) -> no win
    // actor scoredTrees=["tree-norway-pine"(4),"tree-red-oak"(7),"tree-silver-maple"(8)]=19
    // target has tree-cottonwood(6) -> swap first: actor gets cottonwood(6), total=6+7+8=21 → win!
    // Wait: swap first scored tree: actor[0]=norway-pine(4) swaps with target[0]=cottonwood(6)
    // actor new scoredTrees: [cottonwood(6), red-oak(7), silver-maple(8)] = 21 -> WIN
    const g = game({
      0: player({
        hand: ["switch-tags"],
        scoredTrees: ["tree-norway-pine", "tree-red-oak", "tree-silver-maple"],
      }),
      1: player({ scoredTrees: ["tree-cottonwood"] }),
    });
    const s = ok(apply(g, { type: "playCard", card: "switch-tags", target: 1 }, mulberry32(1)));
    expect(s.winner).toBe(0);
    expect(s.turn.phase).toBe("gameOver");
    // Actor has cottonwood(6)+red-oak(7)+silver-maple(8)=21
    expect(s.players[0]!.scoredTrees).toContain("tree-cottonwood");
    expect(s.players[0]!.scoredTrees).toContain("tree-red-oak");
    expect(s.players[0]!.scoredTrees).toContain("tree-silver-maple");
    // Target now has norway-pine(4) -> not enough to win
    expect(s.players[1]!.scoredTrees).toContain("tree-norway-pine");
  });
});

// ── long-saw-and-partner ───────────────────────────────────────────────────────

describe("long-saw-and-partner", () => {
  it("isPlayable: always true (self-target help card)", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("long-saw-and-partner").isPlayable(ctx(g, 0))).toBe(true);
  });

  it("play: adds long-saw-and-partner to actor's help and sets axeSetAside=true", () => {
    const g = game({ 0: player(), 1: player() });
    getHandler("long-saw-and-partner").play(ctx(g, 0));
    expect(g.players[0]!.help).toContain("long-saw-and-partner");
    expect(g.players[0]!.axeSetAside).toBe(true);
  });

  it("via apply: playing long-saw-and-partner sets axeSetAside and adds to help", () => {
    const s = ok(apply(game({
      0: player({ hand: ["long-saw-and-partner"] }),
      1: player(),
    }), { type: "playCard", card: "long-saw-and-partner" }, mulberry32(1)));
    expect(s.players[0]!.help).toContain("long-saw-and-partner");
    expect(s.players[0]!.axeSetAside).toBe(true);
    expect(s.turn.phase).toBe("chop");
  });

  it("chop phase: axeSetAside=true skips roll and goes to the longSaw phase", () => {
    // Player has axe + standingTree but axeSetAside=true → no chop roll
    const s = ok(apply(game({
      0: player({ axe: "carpenters-axe", standingTree: { treeId: "tree-norway-pine", chops: 0 }, axeSetAside: true }),
      1: player(),
    }, { turn: { activeSeat: 0, phase: "chop" } }), { type: "chop" }, mulberry32(1)));
    // Must go to longSaw, no changes to the tree
    expect(s.turn.phase).toBe("longSaw");
    expect(s.players[0]!.standingTree!.chops).toBe(0);
  });

  it("longSaw: long-saw rolls 5 dice; each 4/5/6 chops (seed 11 → all chops, no pass-right)", () => {
    // seed 11: dice=[4,4,4,4,6] → 5 chops, 0 breaks → no pass right
    // Norway Pine chopTarget=4; start at chops=0, 5 chops → fells and scores
    const s = ok(apply(game({
      0: player({
        axeSetAside: true,
        help: ["long-saw-and-partner"],
        standingTree: { treeId: "tree-norway-pine", chops: 0 },
      }),
      1: player(),
    }, { turn: { activeSeat: 0, phase: "longSaw" } }), { type: "longSaw" }, mulberry32(11)));
    // Tree felled (5 chops >= 4 chopTarget)
    expect(s.players[0]!.standingTree).toBeNull();
    expect(s.players[0]!.scoredTrees).toContain("tree-norway-pine");
    // Card stays in help (not passed right)
    expect(s.players[0]!.help).toContain("long-saw-and-partner");
    // axeSetAside stays true (card still held)
    expect(s.players[0]!.axeSetAside).toBe(true);
    expect(s.turn.phase).toBe("manageHelp");
  });

  it("longSaw: long-saw passes right on 4+ breaks/misses in 5 dice (seed 4 → [6,2,2,1,2])", () => {
    // seed 4: dice=[6,2,2,1,2] → 1 chop (6), 4 breaks (2,2,1,2) → pass right
    // seatOrder=[0,1]; player 0 has long-saw; right = player 1
    const initState: GameState = {
      version: 0,
      players: {
        0: player({ axeSetAside: true, help: ["long-saw-and-partner"], standingTree: { treeId: "tree-norway-pine", chops: 0 } }),
        1: player(),
      },
      seatOrder: [0, 1],
      redDeck: [], redDiscard: [], treeDeck: [], treeDiscard: [],
      chopStockpile: 25,
      turn: { activeSeat: 0, phase: "longSaw" },
      lastRoll: [], winner: null, pendingReaction: null,
    };
    const s = ok(apply(initState, { type: "longSaw" }, mulberry32(4)));
    // 1 chop applied first (the die=6)
    expect(s.players[0]!.standingTree!.chops).toBe(1);
    // Card passed right to seat 1
    expect(s.players[0]!.help).not.toContain("long-saw-and-partner");
    expect(s.players[0]!.axeSetAside).toBe(false);
    expect(s.players[1]!.help).toContain("long-saw-and-partner");
    expect(s.players[1]!.axeSetAside).toBe(true);
    expect(s.turn.phase).toBe("manageHelp");
  });

  it("manageHelp: long-saw passing right wraps around (last seat → first seat)", () => {
    // seatOrder=[0,1,2]; seat 2 has the card; passing right goes to seat 0
    const initState: GameState = {
      version: 0,
      players: {
        0: player(),
        1: player(),
        2: player({ axeSetAside: true, help: ["long-saw-and-partner"], standingTree: null }),
      },
      seatOrder: [0, 1, 2],
      redDeck: [], redDiscard: [], treeDeck: [], treeDiscard: [],
      chopStockpile: 25,
      turn: { activeSeat: 2, phase: "longSaw" },
      lastRoll: [], winner: null, pendingReaction: null,
    };
    // seed 4: [6,2,2,1,2] → 4 breaks/misses → pass right; wraps to seat 0
    const s = ok(apply(initState, { type: "longSaw" }, mulberry32(4)));
    expect(s.players[2]!.help).not.toContain("long-saw-and-partner");
    expect(s.players[2]!.axeSetAside).toBe(false);
    expect(s.players[0]!.help).toContain("long-saw-and-partner");
    expect(s.players[0]!.axeSetAside).toBe(true);
  });
});
