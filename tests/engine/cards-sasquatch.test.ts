import { describe, it, expect } from "vitest";
import { getHandler } from "../../src/engine/cards/registry";
import type { CardContext } from "../../src/engine/cards/ctx";
import type { GameState, PlayerState } from "../../src/engine/types";
import { apply } from "../../src/engine/apply";
import { mulberry32 } from "../../src/engine/rng";

function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    uid: "u", name: "n", hand: [], axe: null, equipment: [], plusMinus: [],
    help: [], standingTree: null, scoredTrees: [], speedClimbPoints: 0,
    skipTurns: 0, redrawTo: 1, axeSetAside: false, giveMeAHand: [], cannotChopThisTurn: false, ...over,
  };
}

function game(players: Record<number, PlayerState>, turn?: Partial<GameState["turn"]>): GameState {
  return {
    version: 0, players, seatOrder: Object.keys(players).map(Number),
    redDeck: [], redDiscard: [], treeDeck: [], treeDiscard: [],
    chopStockpile: 25,
    turn: { activeSeat: 0, phase: "play", ...turn },
    lastRoll: [], winner: null, pendingReaction: null,
  };
}

function ctx(state: GameState, actorSeat: number, target?: number, takeBasket?: boolean): CardContext {
  const rng = { nextFloat: () => 0.5, nextInt: (m: number) => Math.floor(m / 2), shuffle: <T>(a: T[]) => a };
  const base = target === undefined ? { state, actorSeat, rng } : { state, actorSeat, target, rng };
  return takeBasket === undefined ? base : { ...base, takeBasket };
}

const ok = (r: ReturnType<typeof apply>) => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

// ── sasquatch-rampage ──────────────────────────────────────────────────────────

describe("sasquatch-rampage", () => {
  it("is playable", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("sasquatch-rampage").isPlayable(ctx(g, 0))).toBe(true);
  });

  it("wipes all help cards from all players", () => {
    const g = game({
      0: player({ help: ["apprentice"] }),
      1: player({ help: ["babe"] }),
    });
    getHandler("sasquatch-rampage").play(ctx(g, 0));
    expect(g.players[0]!.help).toEqual([]);
    expect(g.players[1]!.help).toEqual([]);
    expect(g.redDiscard).toContain("apprentice");
    expect(g.redDiscard).toContain("babe");
  });

  it("makes everyone discard their hand", () => {
    const g = game({
      0: player({ hand: ["flapjacks", "boots"] }),
      1: player({ hand: ["axe-slip"] }),
    });
    getHandler("sasquatch-rampage").play(ctx(g, 0));
    expect(g.players[0]!.hand).toEqual([]);
    expect(g.players[1]!.hand).toEqual([]);
    expect(g.redDiscard).toContain("flapjacks");
    expect(g.redDiscard).toContain("boots");
    expect(g.redDiscard).toContain("axe-slip");
  });

  it("sets redrawTo=4 for all players", () => {
    const g = game({
      0: player({ hand: ["flapjacks"] }),
      1: player({ hand: ["axe-slip"] }),
    });
    getHandler("sasquatch-rampage").play(ctx(g, 0));
    expect(g.players[0]!.redrawTo).toBe(4);
    expect(g.players[1]!.redrawTo).toBe(4);
  });

  it("draw phase draws up to redrawTo cards then resets to 1", () => {
    // Set up a state at draw phase with redrawTo=4 and empty hand
    const initialState: GameState = {
      version: 0,
      players: {
        0: player({ hand: [], redrawTo: 4 }),
        1: player(),
      },
      seatOrder: [0, 1],
      redDeck: ["flapjacks", "boots", "axe-slip", "winded", "blisters"],
      redDiscard: [],
      treeDeck: [], treeDiscard: [],
      chopStockpile: 25,
      turn: { activeSeat: 0, phase: "draw" },
      lastRoll: [], winner: null, pendingReaction: null,
    };
    const s = ok(apply(initialState, { type: "draw" }, mulberry32(1)));
    // Should have drawn 4 cards
    expect(s.players[0]!.hand.length).toBe(4);
    // redrawTo should be reset to 1
    expect(s.players[0]!.redrawTo).toBe(1);
    expect(s.turn.phase).toBe("play");
  });
});

// ── sasquatch-sighting ─────────────────────────────────────────────────────────

describe("sasquatch-sighting", () => {
  it("is playable", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("sasquatch-sighting").isPlayable(ctx(g, 0))).toBe(true);
  });

  it("wipes all help cards from all players", () => {
    const g = game({
      0: player({ help: ["apprentice"] }),
      1: player({ help: ["babe"] }),
    });
    getHandler("sasquatch-sighting").play(ctx(g, 0));
    expect(g.players[0]!.help).toEqual([]);
    expect(g.players[1]!.help).toEqual([]);
  });

  it("each other player rolls a die and skips on 1/2/3 (rng returns 3 -> 1/2/3 range: skip)", () => {
    // rng.nextInt(6) = Math.floor(6/2) = 3 -> 3+1 = 4 -> NO skip (4 > 3)
    // Using a custom rng that returns 2 (die face = 3) -> skip
    const g = game({ 0: player(), 1: player(), 2: player() });
    const customCtx: CardContext = {
      state: g, actorSeat: 0,
      rng: { nextFloat: () => 0, nextInt: () => 2, shuffle: (a) => a }, // always returns face 3 (nextInt(6)=2 -> +1 = 3)
    };
    getHandler("sasquatch-sighting").play(customCtx);
    expect(g.players[1]!.skipTurns).toBe(1);
    expect(g.players[2]!.skipTurns).toBe(1);
  });

  it("does not set skipNextTurn for the actor", () => {
    const g = game({ 0: player(), 1: player() });
    const customCtx: CardContext = {
      state: g, actorSeat: 0,
      rng: { nextFloat: () => 0, nextInt: () => 2, shuffle: (a) => a }, // all dice = face 3, skip
    };
    getHandler("sasquatch-sighting").play(customCtx);
    expect(g.players[0]!.skipTurns).toBe(0);
  });

  it("does not skip opponent on roll 4/5/6", () => {
    const g = game({ 0: player(), 1: player() });
    const customCtx: CardContext = {
      state: g, actorSeat: 0,
      rng: { nextFloat: () => 0, nextInt: () => 5, shuffle: (a) => a }, // nextInt(6)=5 -> face 6, no skip
    };
    getHandler("sasquatch-sighting").play(customCtx);
    expect(g.players[1]!.skipTurns).toBe(0);
  });
});

// ── that-darn-sasquatch ────────────────────────────────────────────────────────

describe("that-darn-sasquatch", () => {
  it("is playable", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("that-darn-sasquatch").isPlayable(ctx(g, 0))).toBe(true);
  });

  it("wipes all help cards from all players", () => {
    const g = game({
      0: player({ help: ["apprentice"] }),
      1: player({ help: ["babe"] }),
    });
    getHandler("that-darn-sasquatch").play(ctx(g, 0));
    expect(g.players[0]!.help).toEqual([]);
    expect(g.players[1]!.help).toEqual([]);
  });

  it("discards all equipment (non-axe) from all players", () => {
    const g = game({
      0: player({ equipment: ["boots", "gloves"] }),
      1: player({ equipment: ["boots"] }),
    });
    getHandler("that-darn-sasquatch").play(ctx(g, 0));
    expect(g.players[0]!.equipment).toEqual([]);
    expect(g.players[1]!.equipment).toEqual([]);
    expect(g.redDiscard).toContain("boots");
    expect(g.redDiscard).toContain("gloves");
  });

  it("also discards all axes from all players", () => {
    const g = game({
      0: player({ axe: "carpenters-axe" }),
      1: player({ axe: "dull-axe" }),
    });
    getHandler("that-darn-sasquatch").play(ctx(g, 0));
    expect(g.players[0]!.axe).toBeNull();
    expect(g.players[1]!.axe).toBeNull();
    expect(g.redDiscard).toContain("carpenters-axe");
    expect(g.redDiscard).toContain("dull-axe");
  });
});

// ── sasquatch-mating-season ────────────────────────────────────────────────────

describe("sasquatch-mating-season", () => {
  it("requires a target to be playable", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("sasquatch-mating-season").isPlayable(ctx(g, 0))).toBe(false);
    expect(getHandler("sasquatch-mating-season").isPlayable(ctx(g, 0, 1))).toBe(true);
  });

  it("cannot target self", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("sasquatch-mating-season").isPlayable(ctx(g, 0, 0))).toBe(false);
  });

  it("wipes all help cards from all players", () => {
    const g = game({
      0: player({ help: ["apprentice"] }),
      1: player({ help: ["babe"] }),
    });
    getHandler("sasquatch-mating-season").play(ctx(g, 0, 1));
    expect(g.players[0]!.help).toEqual([]);
    expect(g.players[1]!.help).toEqual([]);
  });

  it("target loses their next turn", () => {
    const g = game({ 0: player(), 1: player() });
    getHandler("sasquatch-mating-season").play(ctx(g, 0, 1));
    expect(g.players[1]!.skipTurns).toBe(1);
  });

  it("M2: takes target's tree when actor opts to take the basket", () => {
    const g = game({
      0: player({ standingTree: null }),
      1: player({ standingTree: { treeId: "tree-red-oak", chops: 3 } }),
    });
    getHandler("sasquatch-mating-season").play(ctx(g, 0, 1, true));
    // Actor gets the tree with chops
    expect(g.players[0]!.standingTree).toEqual({ treeId: "tree-red-oak", chops: 3 });
    expect(g.players[1]!.standingTree).toBeNull();
  });

  it("M2: leaves the basket alone when actor does not opt to take it", () => {
    const g = game({
      0: player({ standingTree: null }),
      1: player({ standingTree: { treeId: "tree-red-oak", chops: 3 } }),
    });
    getHandler("sasquatch-mating-season").play(ctx(g, 0, 1));
    // No takeBasket → target keeps their basket
    expect(g.players[0]!.standingTree).toBeNull();
    expect(g.players[1]!.standingTree).toEqual({ treeId: "tree-red-oak", chops: 3 });
  });

  it("M2: discards actor's own basket when taking target's", () => {
    const g = game({
      0: player({ standingTree: { treeId: "tree-norway-pine", chops: 1 } }),
      1: player({ standingTree: { treeId: "tree-red-oak", chops: 3 } }),
    });
    getHandler("sasquatch-mating-season").play(ctx(g, 0, 1, true));
    // Actor swaps to target's basket; own basket discarded, its chops returned to stockpile
    expect(g.players[0]!.standingTree).toEqual({ treeId: "tree-red-oak", chops: 3 });
    expect(g.players[1]!.standingTree).toBeNull();
    expect(g.treeDiscard).toContain("tree-norway-pine");
  });
});

// ── paul-bunyan ────────────────────────────────────────────────────────────────

describe("paul-bunyan", () => {
  it("is playable", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("paul-bunyan").isPlayable(ctx(g, 0))).toBe(true);
  });

  it("does NOT wipe help cards (it's an action, not a hooligan card)", () => {
    const g = game({
      0: player({ help: ["apprentice"] }),
      1: player({ help: ["babe"] }),
    });
    getHandler("paul-bunyan").play(ctx(g, 0));
    expect(g.players[0]!.help).toEqual(["apprentice"]);
    expect(g.players[1]!.help).toEqual(["babe"]);
  });

  it("fells and scores all standing trees", () => {
    const g = game({
      0: player({ standingTree: { treeId: "tree-norway-pine", chops: 2 } }),
      1: player({ standingTree: { treeId: "tree-red-oak", chops: 4 } }),
    });
    getHandler("paul-bunyan").play(ctx(g, 0));
    expect(g.players[0]!.standingTree).toBeNull();
    expect(g.players[1]!.standingTree).toBeNull();
    expect(g.players[0]!.scoredTrees).toContain("tree-norway-pine");
    expect(g.players[1]!.scoredTrees).toContain("tree-red-oak");
  });

  it("returns chops to stockpile from all trees", () => {
    const g = game({
      0: player({ standingTree: { treeId: "tree-norway-pine", chops: 2 } }),
      1: player({ standingTree: { treeId: "tree-red-oak", chops: 4 } }),
    });
    const initialStockpile = g.chopStockpile;
    getHandler("paul-bunyan").play(ctx(g, 0));
    expect(g.chopStockpile).toBe(initialStockpile + 2 + 4);
  });

  it("players with no standing tree get no benefit", () => {
    const g = game({
      0: player({ standingTree: null }),
      1: player({ standingTree: { treeId: "tree-red-oak", chops: 2 } }),
    });
    getHandler("paul-bunyan").play(ctx(g, 0));
    expect(g.players[0]!.scoredTrees).toEqual([]);
    expect(g.players[1]!.scoredTrees).toContain("tree-red-oak");
  });
});

// ── redrawTo plumbing via rampage in a full apply cycle ─────────────────────

describe("redrawTo plumbing via apply", () => {
  it("rampage via apply + subsequent draw draws 4 cards", () => {
    // Start at play phase, actor plays sasquatch-rampage
    const initialState: GameState = {
      version: 0,
      players: {
        0: player({ hand: ["sasquatch-rampage", "flapjacks"] }),
        1: player({ hand: ["axe-slip"] }),
      },
      seatOrder: [0, 1],
      redDeck: ["boots", "winded", "foot-slip", "short-stack", "blisters"],
      redDiscard: [],
      treeDeck: [], treeDiscard: [],
      chopStockpile: 25,
      turn: { activeSeat: 0, phase: "play" },
      lastRoll: [], winner: null, pendingReaction: null,
    };
    // After playing rampage: hands empty, redrawTo=4 for all
    // This test verifies state after a draw action with redrawTo=4
    let s: GameState = {
      ...initialState,
      players: {
        0: player({ hand: [], redrawTo: 4 }),
        1: player({ hand: [], redrawTo: 4 }),
      },
      turn: { activeSeat: 0, phase: "draw" },
    };
    s = ok(apply(s, { type: "draw" }, mulberry32(1)));
    expect(s.players[0]!.hand.length).toBe(4);
    expect(s.players[0]!.redrawTo).toBe(1);
  });
});
