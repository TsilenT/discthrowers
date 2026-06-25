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

describe("boots", () => {
  it("is playable when actor does not already own boots", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("boots").isPlayable(ctx(g, 0))).toBe(true);
  });

  it("is NOT playable when actor already has boots (no doubles)", () => {
    const g = game({ 0: player({ equipment: ["boots"] }), 1: player() });
    expect(getHandler("boots").isPlayable(ctx(g, 0))).toBe(false);
  });

  it("play adds boots to actor's equipment", () => {
    const g = game({ 0: player(), 1: player() });
    getHandler("boots").play(ctx(g, 0));
    expect(g.players[0]!.equipment).toContain("boots");
  });

  it("play does NOT add boots to opponents", () => {
    const g = game({ 0: player(), 1: player() });
    getHandler("boots").play(ctx(g, 0));
    expect(g.players[1]!.equipment).not.toContain("boots");
  });
});

describe("gloves", () => {
  it("is playable when actor does not already own gloves", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("gloves").isPlayable(ctx(g, 0))).toBe(true);
  });

  it("is NOT playable when actor already has gloves (no doubles)", () => {
    const g = game({ 0: player({ equipment: ["gloves"] }), 1: player() });
    expect(getHandler("gloves").isPlayable(ctx(g, 0))).toBe(false);
  });

  it("play adds gloves to actor's equipment", () => {
    const g = game({ 0: player(), 1: player() });
    getHandler("gloves").play(ctx(g, 0));
    expect(g.players[0]!.equipment).toContain("gloves");
  });

  it("play removes blisters from actor's plusMinus and puts it in redDiscard", () => {
    const g = game({ 0: player({ plusMinus: ["blisters"] }), 1: player() });
    getHandler("gloves").play(ctx(g, 0));
    expect(g.players[0]!.plusMinus).not.toContain("blisters");
    expect(g.redDiscard).toContain("blisters");
  });

  it("play removes multiple blisters cards from actor's plusMinus", () => {
    const g = game({ 0: player({ plusMinus: ["blisters", "axe-slip", "blisters"] }), 1: player() });
    getHandler("gloves").play(ctx(g, 0));
    expect(g.players[0]!.plusMinus).not.toContain("blisters");
    expect(g.players[0]!.plusMinus).toContain("axe-slip");
    expect(g.redDiscard.filter((c) => c === "blisters").length).toBe(2);
  });

  it("play does not remove blisters from opponent", () => {
    const g = game({ 0: player(), 1: player({ plusMinus: ["blisters"] }) });
    getHandler("gloves").play(ctx(g, 0));
    expect(g.players[1]!.plusMinus).toContain("blisters");
  });
});
