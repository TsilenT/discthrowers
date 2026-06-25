/**
 * Task 10: Verify that M3-deferred cards return a handler whose isPlayable() === false.
 *
 * Deferred cards (still unimplemented from the base set):
 *   - Reaction cards: debunk, northern-justice, paperwork
 *     (playable only via the react action, not via normal playCard)
 *
 * NOTE: Contest cards (axe-throw, chainsaw-carving, log-rolling, speed-climb)
 * are now implemented in Task 4 and are tested in cards-contest.test.ts.
 *
 * NOTE: Complex action/help cards (give-me-a-hand, switch-tags, long-saw-and-partner)
 * are now implemented in Task 5 and are tested in cards-complex.test.ts / give-me-a-hand.test.ts.
 */
import { describe, it, expect } from "vitest";
import { getHandler } from "../../src/engine/cards/registry";
import type { CardContext } from "../../src/engine/cards/ctx";
import type { GameState, PlayerState } from "../../src/engine/types";
import type { Rng } from "../../src/engine/rng";

const dummyRng: Rng = {
  nextFloat: () => 0,
  nextInt: () => 0,
  shuffle: <T>(a: T[]): T[] => a,
};

function makePlayer(over: Partial<PlayerState> = {}): PlayerState {
  return {
    uid: "u",
    name: "p",
    hand: [],
    axe: "carpenters-axe",
    equipment: [],
    plusMinus: [],
    help: [],
    standingTree: null,
    scoredTrees: [],
    speedClimbPoints: 0,
    skipNextTurn: false,
    redrawTo: 1,
    axeSetAside: false,
    giveMeAHand: [],
    cannotChopThisTurn: false,
    ...over,
  };
}

function makeGame(): GameState {
  return {
    version: 0,
    players: {
      0: makePlayer(),
      1: makePlayer(),
    },
    seatOrder: [0, 1],
    redDeck: [],
    redDiscard: [],
    treeDeck: [],
    treeDiscard: [],
    chopStockpile: 25,
    turn: { activeSeat: 0, phase: "play" },
    lastRoll: [],
    winner: null,
    pendingReaction: null,
  };
}

function makeCtx(target?: number): CardContext {
  const state = makeGame();
  if (target !== undefined) {
    return { state, actorSeat: 0, target, rng: dummyRng };
  }
  return { state, actorSeat: 0, rng: dummyRng };
}

const DEFERRED_CARDS = [
  // Reaction cards (playable only via the react action, not via normal play)
  // isPlayable() in the normal play phase correctly returns false.
  "debunk",
  "northern-justice",
  "paperwork",
  // Contest cards are now implemented (Task 4) — see cards-contest.test.ts
  // Complex cards (give-me-a-hand, switch-tags, long-saw-and-partner) now implemented
  // in Task 5 — see cards-complex.test.ts and give-me-a-hand.test.ts
];

describe("deferred cards (M3)", () => {
  for (const cardId of DEFERRED_CARDS) {
    it(`${cardId}: isPlayable returns false (no target)`, () => {
      const handler = getHandler(cardId);
      expect(handler.isPlayable(makeCtx())).toBe(false);
    });

    it(`${cardId}: isPlayable returns false (with opponent target)`, () => {
      const handler = getHandler(cardId);
      expect(handler.isPlayable(makeCtx(1))).toBe(false);
    });
  }
});
