import { buildRedDeck, buildTreeDeck } from "./deck";
import type { Rng } from "./rng";
import { CHOP_STOCKPILE, STARTING_HAND, type GameState, type PlayerState } from "./types";

export interface SeatInfo { uid: string; name: string; }

export function createInitialGame(seats: SeatInfo[], rng: Rng): GameState {
  const redDeck = buildRedDeck(rng);
  const treeDeck = buildTreeDeck(rng);
  const players: Record<number, PlayerState> = {};
  const seatOrder: number[] = [];
  seats.forEach((s, i) => {
    const hand = redDeck.splice(0, STARTING_HAND);
    players[i] = {
      uid: s.uid, name: s.name, hand,
      axe: null, equipment: [], plusMinus: [], help: [],
      standingTree: null, scoredTrees: [], speedClimbPoints: 0, skipNextTurn: false, redrawTo: 1,
      axeSetAside: false, giveMeAHand: [], cannotChopThisTurn: false,
    };
    seatOrder.push(i);
  });
  return {
    version: 0, players, seatOrder,
    redDeck, redDiscard: [], treeDeck, treeDiscard: [],
    chopStockpile: CHOP_STOCKPILE,
    turn: { activeSeat: seatOrder[0]!, phase: "squareUp" },
    lastRoll: [], winner: null, pendingReaction: null,
  };
}
