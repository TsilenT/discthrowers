import { describe, it, expect } from "vitest";
import { getHandler } from "../../src/engine/cards/registry";
import type { CardContext } from "../../src/engine/cards/ctx";
import type { GameState, PlayerState } from "../../src/engine/types";

function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    uid: "u", name: "n", hand: [], axe: null, equipment: [], plusMinus: [],
    help: [], standingTree: null, scoredTrees: [], speedClimbPoints: 0,
    skipNextTurn: false, redrawTo: 1, axeSetAside: false, giveMeAHand: [], cannotChopThisTurn: false, ...over,
  };
}

function game(players: Record<number, PlayerState>): GameState {
  return {
    version: 0, players, seatOrder: Object.keys(players).map(Number),
    redDeck: [], redDiscard: [], treeDeck: [], treeDiscard: [],
    chopStockpile: 25,
    turn: { activeSeat: 0, phase: "play" },
    lastRoll: [], winner: null, pendingReaction: null,
  };
}

function ctx(state: GameState, actorSeat: number, target?: number): CardContext {
  const rng = { nextFloat: () => 0, nextInt: () => 0, shuffle: <T>(a: T[]) => a };
  return target === undefined ? { state, actorSeat, rng } : { state, actorSeat, target, rng };
}

// ── axe-break ─────────────────────────────────────────────────────────────────

describe("axe-break", () => {
  it("requires a target with a non-Titanium axe to be playable", () => {
    const g = game({ 0: player(), 1: player({ axe: "carpenters-axe" }) });
    expect(getHandler("axe-break").isPlayable(ctx(g, 0, 1))).toBe(true);
  });

  it("is NOT playable when target has Titanium Axe", () => {
    const g = game({ 0: player(), 1: player({ axe: "titanium-axe" }) });
    expect(getHandler("axe-break").isPlayable(ctx(g, 0, 1))).toBe(false);
  });

  it("is NOT playable when target has no axe", () => {
    const g = game({ 0: player(), 1: player({ axe: null }) });
    expect(getHandler("axe-break").isPlayable(ctx(g, 0, 1))).toBe(false);
  });

  it("is NOT playable when no target given", () => {
    const g = game({ 0: player(), 1: player({ axe: "carpenters-axe" }) });
    expect(getHandler("axe-break").isPlayable(ctx(g, 0))).toBe(false);
  });

  it("play discards target's axe", () => {
    const g = game({ 0: player(), 1: player({ axe: "carpenters-axe" }) });
    getHandler("axe-break").play(ctx(g, 0, 1));
    expect(g.players[1]!.axe).toBeNull();
    expect(g.redDiscard).toContain("carpenters-axe");
  });
});

// ── beavers ───────────────────────────────────────────────────────────────────

describe("beavers", () => {
  it("requires a target with a standing tree to be playable", () => {
    const g = game({ 0: player(), 1: player({ standingTree: { treeId: "tree-red-oak", chops: 2 } }) });
    expect(getHandler("beavers").isPlayable(ctx(g, 0, 1))).toBe(true);
  });

  it("is NOT playable when target has no tree", () => {
    const g = game({ 0: player(), 1: player({ standingTree: null }) });
    expect(getHandler("beavers").isPlayable(ctx(g, 0, 1))).toBe(false);
  });

  it("is NOT playable without a target", () => {
    const g = game({ 0: player(), 1: player({ standingTree: { treeId: "tree-red-oak", chops: 2 } }) });
    expect(getHandler("beavers").isPlayable(ctx(g, 0))).toBe(false);
  });

  it("play destroys target's standing tree (no score)", () => {
    const g = game({ 0: player(), 1: player({ standingTree: { treeId: "tree-red-oak", chops: 2 } }) });
    getHandler("beavers").play(ctx(g, 0, 1));
    expect(g.players[1]!.standingTree).toBeNull();
    expect(g.players[1]!.scoredTrees).toEqual([]);
    expect(g.treeDiscard).toContain("tree-red-oak");
  });

  it("play returns chops to stockpile", () => {
    const g = game({ 0: player(), 1: player({ standingTree: { treeId: "tree-red-oak", chops: 3 } }) });
    getHandler("beavers").play(ctx(g, 0, 1));
    expect(g.chopStockpile).toBe(25 + 3);
  });
});

// ── forest-fire ───────────────────────────────────────────────────────────────

describe("forest-fire", () => {
  it("is playable (no conditions)", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("forest-fire").isPlayable(ctx(g, 0))).toBe(true);
  });

  it("play destroys all standing trees (no score)", () => {
    const g = game({
      0: player({ standingTree: { treeId: "tree-norway-pine", chops: 2 } }),
      1: player({ standingTree: { treeId: "tree-red-oak", chops: 3 } }),
    });
    getHandler("forest-fire").play(ctx(g, 0));
    expect(g.players[0]!.standingTree).toBeNull();
    expect(g.players[1]!.standingTree).toBeNull();
    expect(g.players[0]!.scoredTrees).toEqual([]);
    expect(g.players[1]!.scoredTrees).toEqual([]);
  });

  it("play returns all chops to stockpile", () => {
    const g = game({
      0: player({ standingTree: { treeId: "tree-norway-pine", chops: 2 } }),
      1: player({ standingTree: { treeId: "tree-red-oak", chops: 3 } }),
    });
    getHandler("forest-fire").play(ctx(g, 0));
    expect(g.chopStockpile).toBe(25 + 2 + 3);
  });
});

// ── steal-axe ─────────────────────────────────────────────────────────────────

describe("steal-axe", () => {
  it("requires a target with an axe to be playable", () => {
    const g = game({ 0: player(), 1: player({ axe: "carpenters-axe" }) });
    expect(getHandler("steal-axe").isPlayable(ctx(g, 0, 1))).toBe(true);
  });

  it("is NOT playable when target has no axe", () => {
    const g = game({ 0: player(), 1: player({ axe: null }) });
    expect(getHandler("steal-axe").isPlayable(ctx(g, 0, 1))).toBe(false);
  });

  it("is NOT playable without a target", () => {
    const g = game({ 0: player(), 1: player({ axe: "carpenters-axe" }) });
    expect(getHandler("steal-axe").isPlayable(ctx(g, 0))).toBe(false);
  });

  it("play moves target's axe to actor, discarding actor's old axe", () => {
    const g = game({
      0: player({ axe: "dull-axe" }),
      1: player({ axe: "carpenters-axe" }),
    });
    getHandler("steal-axe").play(ctx(g, 0, 1));
    expect(g.players[0]!.axe).toBe("carpenters-axe");
    expect(g.players[1]!.axe).toBeNull();
    expect(g.redDiscard).toContain("dull-axe");
  });

  it("play moves target's axe when actor has no axe", () => {
    const g = game({
      0: player({ axe: null }),
      1: player({ axe: "carpenters-axe" }),
    });
    getHandler("steal-axe").play(ctx(g, 0, 1));
    expect(g.players[0]!.axe).toBe("carpenters-axe");
    expect(g.players[1]!.axe).toBeNull();
  });
});

// ── steal-equipment ───────────────────────────────────────────────────────────

describe("steal-equipment", () => {
  it("requires a target with equipment to be playable", () => {
    const g = game({ 0: player(), 1: player({ equipment: ["boots"] }) });
    expect(getHandler("steal-equipment").isPlayable(ctx(g, 0, 1))).toBe(true);
  });

  it("is NOT playable when target has no equipment", () => {
    const g = game({ 0: player(), 1: player({ equipment: [] }) });
    expect(getHandler("steal-equipment").isPlayable(ctx(g, 0, 1))).toBe(false);
  });

  it("is NOT playable without a target", () => {
    const g = game({ 0: player(), 1: player({ equipment: ["boots"] }) });
    expect(getHandler("steal-equipment").isPlayable(ctx(g, 0))).toBe(false);
  });

  it("play moves first equipment from target to actor", () => {
    const g = game({
      0: player({ equipment: [] }),
      1: player({ equipment: ["boots", "gloves"] }),
    });
    getHandler("steal-equipment").play(ctx(g, 0, 1));
    // Takes first (boots)
    expect(g.players[0]!.equipment).toContain("boots");
    expect(g.players[1]!.equipment).not.toContain("boots");
  });

  it("discards existing copy if actor already had that equipment (no-doubles)", () => {
    const g = game({
      0: player({ equipment: ["boots"] }),
      1: player({ equipment: ["boots"] }),
    });
    getHandler("steal-equipment").play(ctx(g, 0, 1));
    // Actor gets the stolen boots, old boots discarded
    expect(g.players[0]!.equipment.filter((e) => e === "boots").length).toBe(1);
    expect(g.redDiscard).toContain("boots");
  });
});

// ── tree-hugger ───────────────────────────────────────────────────────────────

describe("tree-hugger", () => {
  it("requires a target to be playable", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("tree-hugger").isPlayable(ctx(g, 0, 1))).toBe(true);
  });

  it("is NOT playable without a target", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("tree-hugger").isPlayable(ctx(g, 0))).toBe(false);
  });

  it("cannot target self", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("tree-hugger").isPlayable(ctx(g, 0, 0))).toBe(false);
  });

  it("play sets skipNextTurn on target", () => {
    const g = game({ 0: player(), 1: player() });
    getHandler("tree-hugger").play(ctx(g, 0, 1));
    expect(g.players[1]!.skipNextTurn).toBe(true);
  });
});

// ── lure-help ─────────────────────────────────────────────────────────────────

describe("lure-help", () => {
  it("requires a target with a non-Babe help card to be playable", () => {
    const g = game({ 0: player(), 1: player({ help: ["apprentice"] }) });
    expect(getHandler("lure-help").isPlayable(ctx(g, 0, 1))).toBe(true);
  });

  it("is NOT playable when target only has Babe", () => {
    const g = game({ 0: player(), 1: player({ help: ["babe"] }) });
    expect(getHandler("lure-help").isPlayable(ctx(g, 0, 1))).toBe(false);
  });

  it("is NOT playable when target has no help cards", () => {
    const g = game({ 0: player(), 1: player({ help: [] }) });
    expect(getHandler("lure-help").isPlayable(ctx(g, 0, 1))).toBe(false);
  });

  it("is NOT playable without a target", () => {
    const g = game({ 0: player(), 1: player({ help: ["apprentice"] }) });
    expect(getHandler("lure-help").isPlayable(ctx(g, 0))).toBe(false);
  });

  it("play moves first non-Babe help card from target to actor", () => {
    const g = game({
      0: player({ help: [] }),
      1: player({ help: ["babe", "apprentice"] }),
    });
    getHandler("lure-help").play(ctx(g, 0, 1));
    expect(g.players[0]!.help).toContain("apprentice");
    expect(g.players[1]!.help).not.toContain("apprentice");
    // Babe stays with target
    expect(g.players[1]!.help).toContain("babe");
  });
});

// ── babe-biscuit ──────────────────────────────────────────────────────────────

describe("babe-biscuit", () => {
  it("is playable when another player has Babe", () => {
    const g = game({ 0: player(), 1: player({ help: ["babe"] }) });
    expect(getHandler("babe-biscuit").isPlayable(ctx(g, 0))).toBe(true);
  });

  it("is playable when Babe is in the discard pile", () => {
    const g = game({ 0: player(), 1: player() });
    g.redDiscard = ["babe"];
    expect(getHandler("babe-biscuit").isPlayable(ctx(g, 0))).toBe(true);
  });

  it("is NOT playable when Babe is not in play or discard", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("babe-biscuit").isPlayable(ctx(g, 0))).toBe(false);
  });

  it("is NOT playable when actor already has Babe", () => {
    const g = game({ 0: player({ help: ["babe"] }), 1: player() });
    expect(getHandler("babe-biscuit").isPlayable(ctx(g, 0))).toBe(false);
  });

  it("play moves Babe from another player to actor", () => {
    const g = game({ 0: player(), 1: player({ help: ["babe"] }) });
    getHandler("babe-biscuit").play(ctx(g, 0));
    expect(g.players[0]!.help).toContain("babe");
    expect(g.players[1]!.help).not.toContain("babe");
  });

  it("play takes Babe from discard pile to actor", () => {
    const g = game({ 0: player(), 1: player() });
    g.redDiscard = ["babe"];
    getHandler("babe-biscuit").play(ctx(g, 0));
    expect(g.players[0]!.help).toContain("babe");
    expect(g.redDiscard).not.toContain("babe");
  });

  it("preferentially takes Babe from another player over discard", () => {
    const g = game({ 0: player(), 1: player({ help: ["babe"] }) });
    g.redDiscard = ["babe"];
    getHandler("babe-biscuit").play(ctx(g, 0));
    expect(g.players[0]!.help).toContain("babe");
    // One babe should remain in discard (the one we didn't take)
    expect(g.players[0]!.help.filter((c) => c === "babe").length).toBe(1);
  });
});

// give-me-a-hand and switch-tags are now implemented in Task 5.
// See tests/engine/cards-complex.test.ts and tests/engine/give-me-a-hand.test.ts.
