import { describe, it, expect } from "vitest";
import { discardFromHand, discardTableauCard, moveCardBetween, addPlusMinus,
         fellStandingTree, returnChops, skipTurn } from "../../src/engine/cards/primitives";
import type { GameState, PlayerState } from "../../src/engine/types";

function player(over: Partial<PlayerState> = {}): PlayerState {
  return { uid: "u", name: "n", hand: [], axe: null, equipment: [], plusMinus: [],
           help: [], standingTree: null, scoredTrees: [], speedClimbPoints: 0,
           skipTurns: 0, redrawTo: 1, axeSetAside: false, giveMeAHand: [], cannotChopThisTurn: false, ...over };
}
function game(players: Record<number, PlayerState>): GameState {
  return { version: 0, players, seatOrder: Object.keys(players).map(Number),
           redDeck: [], redDiscard: [], treeDeck: [], treeDiscard: [],
           chopStockpile: 25, turn: { activeSeat: 0, phase: "play" }, lastRoll: [], winner: null, pendingReaction: null };
}

describe("primitives", () => {
  it("discardFromHand moves a card to redDiscard", () => {
    const g = game({ 0: player({ hand: ["flapjacks"] }) });
    discardFromHand(g, 0, "flapjacks");
    expect(g.players[0]!.hand).toEqual([]);
    expect(g.redDiscard).toContain("flapjacks");
  });
  it("addPlusMinus appends a modifier card to a player", () => {
    const g = game({ 0: player(), 1: player() });
    addPlusMinus(g, 1, "axe-slip");
    expect(g.players[1]!.plusMinus).toContain("axe-slip");
  });
  it("fellStandingTree scores it and returns chops", () => {
    const g = game({ 0: player({ standingTree: { treeId: "tree-red-oak", chops: 6 } }) });
    fellStandingTree(g, 0);
    expect(g.players[0]!.scoredTrees).toContain("tree-red-oak");
    expect(g.players[0]!.standingTree).toBeNull();
    expect(g.chopStockpile).toBe(25 + 6);
  });
  it("skipTurn sets the flag", () => {
    const g = game({ 0: player(), 1: player() });
    skipTurn(g, 1);
    expect(g.players[1]!.skipTurns).toBe(1);
  });
  it("returnChops adds to stockpile", () => {
    const g = game({ 0: player() });
    returnChops(g, 5);
    expect(g.chopStockpile).toBe(30);
  });
  it("discardTableauCard removes an axe to discard", () => {
    const g = game({ 0: player({ axe: "carpenters-axe" }) });
    const result = discardTableauCard(g, 0, "carpenters-axe");
    expect(result).toBe(true);
    expect(g.players[0]!.axe).toBeNull();
    expect(g.redDiscard).toContain("carpenters-axe");
  });
  it("discardTableauCard removes from equipment", () => {
    const g = game({ 0: player({ equipment: ["boots"] }) });
    const result = discardTableauCard(g, 0, "boots");
    expect(result).toBe(true);
    expect(g.players[0]!.equipment).toEqual([]);
    expect(g.redDiscard).toContain("boots");
  });
  it("moveCardBetween transfers an axe and discards old axe of target", () => {
    const g = game({ 0: player({ axe: "carpenters-axe" }), 1: player({ axe: "dull-axe" }) });
    const result = moveCardBetween(g, 0, 1, "carpenters-axe");
    expect(result).toBe(true);
    expect(g.players[0]!.axe).toBeNull();
    expect(g.players[1]!.axe).toBe("carpenters-axe");
    expect(g.redDiscard).toContain("dull-axe");
  });
});
