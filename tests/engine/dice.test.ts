import { describe, it, expect } from "vitest";
import { collectChopDice, consumePlusMinusAfterRoll } from "../../src/engine/dice";
import type { GameState, PlayerState } from "../../src/engine/types";

const base = (over: Partial<PlayerState> = {}): PlayerState => ({
  uid: "u", name: "n", hand: [], axe: "carpenters-axe", equipment: [], plusMinus: [],
  help: [], standingTree: null, scoredTrees: [], speedClimbPoints: 0, skipNextTurn: false, redrawTo: 1, axeSetAside: false, giveMeAHand: [], cannotChopThisTurn: false, ...over });

describe("collectChopDice", () => {
  it("uses axe base (3) with no modifiers", () => {
    expect(collectChopDice(base())).toBe(3);
  });
  it("adds +2 Flapjacks and -1 Axe Slip", () => {
    expect(collectChopDice(base({ plusMinus: ["flapjacks", "axe-slip"] }))).toBe(4);
  });
  it("never goes below 0", () => {
    expect(collectChopDice(base({ axe: "dull-axe", plusMinus: ["foot-slip", "winded"] }))).toBe(0);
  });
  it("double-bladed axe gives base 4", () => {
    expect(collectChopDice(base({ axe: "double-bladed-axe" }))).toBe(4);
  });
});

describe("consumePlusMinusAfterRoll", () => {
  function game(p: PlayerState): GameState {
    return {
      version: 0,
      players: { 0: p },
      seatOrder: [0],
      redDeck: [], redDiscard: [], treeDeck: [], treeDiscard: [],
      chopStockpile: 25,
      turn: { activeSeat: 0, phase: "chop" },
      lastRoll: [], winner: null, pendingReaction: null,
    };
  }

  it("discards next-roll modifiers after roll", () => {
    const p = base({ plusMinus: ["axe-slip", "flapjacks"] });
    const g = game(p);
    consumePlusMinusAfterRoll(g, 0);
    expect(g.players[0]!.plusMinus).toEqual([]);
    expect(g.redDiscard).toContain("axe-slip");
    expect(g.redDiscard).toContain("flapjacks");
  });

  it("keeps blisters (scope: until-gloves) after roll", () => {
    const p = base({ plusMinus: ["blisters", "axe-slip"] });
    const g = game(p);
    consumePlusMinusAfterRoll(g, 0);
    expect(g.players[0]!.plusMinus).toEqual(["blisters"]);
    expect(g.redDiscard).toContain("axe-slip");
    expect(g.redDiscard).not.toContain("blisters");
  });
});
