import { describe, it, expect } from "vitest";
import { getHandler } from "../../src/engine/cards/registry";
import type { CardContext } from "../../src/engine/cards/ctx";
import type { GameState, PlayerState } from "../../src/engine/types";

function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    uid: "u", name: "n", hand: [], axe: null, equipment: [], plusMinus: [],
    help: [], standingTree: null, scoredTrees: [], speedClimbPoints: 0,
    skipTurns: 0, redrawTo: 1, axeSetAside: false, giveMeAHand: [], cannotChopThisTurn: false, ...over,
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

describe("flapjacks", () => {
  it("is playable on self with no conditions", () => {
    const g = game({ 0: player({ hand: ["flapjacks"] }), 1: player() });
    const h = getHandler("flapjacks");
    expect(h.isPlayable(ctx(g, 0))).toBe(true);
  });

  it("play adds flapjacks to actor's plusMinus", () => {
    const g = game({ 0: player(), 1: player() });
    const h = getHandler("flapjacks");
    h.play(ctx(g, 0));
    expect(g.players[0]!.plusMinus).toContain("flapjacks");
  });
});

describe("short-stack", () => {
  it("is playable on self", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("short-stack").isPlayable(ctx(g, 0))).toBe(true);
  });

  it("play adds short-stack to actor's plusMinus", () => {
    const g = game({ 0: player(), 1: player() });
    getHandler("short-stack").play(ctx(g, 0));
    expect(g.players[0]!.plusMinus).toContain("short-stack");
  });
});

describe("side-of-bacon", () => {
  it("is playable on self", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("side-of-bacon").isPlayable(ctx(g, 0))).toBe(true);
  });

  it("play adds side-of-bacon to actor's plusMinus", () => {
    const g = game({ 0: player(), 1: player() });
    getHandler("side-of-bacon").play(ctx(g, 0));
    expect(g.players[0]!.plusMinus).toContain("side-of-bacon");
  });
});

describe("axe-slip", () => {
  it("is playable on an opponent with no immunity", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("axe-slip").isPlayable(ctx(g, 0, 1))).toBe(true);
  });

  it("play adds axe-slip to target's plusMinus", () => {
    const g = game({ 0: player(), 1: player() });
    getHandler("axe-slip").play(ctx(g, 0, 1));
    expect(g.players[1]!.plusMinus).toContain("axe-slip");
  });

  it("is not playable when target has gloves (immune)", () => {
    const g = game({ 0: player(), 1: player({ equipment: ["gloves"] }) });
    expect(getHandler("axe-slip").isPlayable(ctx(g, 0, 1))).toBe(false);
  });

  it("is not playable when no target is given", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("axe-slip").isPlayable(ctx(g, 0))).toBe(false);
  });
});

describe("foot-slip", () => {
  it("is playable on an opponent with no boots", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("foot-slip").isPlayable(ctx(g, 0, 1))).toBe(true);
  });

  it("play adds foot-slip to target's plusMinus", () => {
    const g = game({ 0: player(), 1: player() });
    getHandler("foot-slip").play(ctx(g, 0, 1));
    expect(g.players[1]!.plusMinus).toContain("foot-slip");
  });

  it("is not playable when target has boots (immune)", () => {
    const g = game({ 0: player(), 1: player({ equipment: ["boots"] }) });
    expect(getHandler("foot-slip").isPlayable(ctx(g, 0, 1))).toBe(false);
  });

  it("is not playable when no target is given", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("foot-slip").isPlayable(ctx(g, 0))).toBe(false);
  });
});

describe("winded", () => {
  it("is playable on an opponent", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("winded").isPlayable(ctx(g, 0, 1))).toBe(true);
  });

  it("play adds winded to target's plusMinus", () => {
    const g = game({ 0: player(), 1: player() });
    getHandler("winded").play(ctx(g, 0, 1));
    expect(g.players[1]!.plusMinus).toContain("winded");
  });

  it("is not playable when no target is given", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("winded").isPlayable(ctx(g, 0))).toBe(false);
  });
});

describe("blisters", () => {
  it("is playable on an opponent without gloves", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("blisters").isPlayable(ctx(g, 0, 1))).toBe(true);
  });

  it("play adds blisters to target's plusMinus", () => {
    const g = game({ 0: player(), 1: player() });
    getHandler("blisters").play(ctx(g, 0, 1));
    expect(g.players[1]!.plusMinus).toContain("blisters");
  });

  it("is not playable when target has gloves (immune)", () => {
    const g = game({ 0: player(), 1: player({ equipment: ["gloves"] }) });
    expect(getHandler("blisters").isPlayable(ctx(g, 0, 1))).toBe(false);
  });

  it("is not playable when no target is given", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("blisters").isPlayable(ctx(g, 0))).toBe(false);
  });
});
