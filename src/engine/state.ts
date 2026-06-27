import { buildRedDeck, buildTreeDeck } from "./deck";
import { rollTurnOrder } from "./order";
import type { Rng } from "./rng";
import { CHOP_STOCKPILE, STARTING_HAND, type GameState, type LogEntry, type OrderReveal, type PlayerState } from "./types";

export interface SeatInfo { uid: string; name: string; }

/**
 * @param opts.rollOff — when true, an opening "First Logger" roll-off sets the turn
 *   order (highest die first, ties reroll) and records it for a reveal popup. Real
 *   games pass this; tests default to the natural seat order for determinism.
 */
export function createInitialGame(seats: SeatInfo[], rng: Rng, opts?: { rollOff?: boolean }): GameState {
  const redDeck = buildRedDeck(rng);
  const treeDeck = buildTreeDeck(rng);
  const players: Record<number, PlayerState> = {};
  seats.forEach((s, i) => {
    const hand = redDeck.splice(0, STARTING_HAND);
    players[i] = {
      uid: s.uid, name: s.name, hand,
      axe: null, equipment: [], plusMinus: [], help: [],
      standingTree: null, scoredTrees: [], speedClimbPoints: 0, skipTurns: 0, redrawTo: 1,
      axeSetAside: false, giveMeAHand: [], cannotChopThisTurn: false,
    };
  });

  let seatOrder = seats.map((_, i) => i);
  let orderReveal: OrderReveal | null = null;
  const log: LogEntry[] = [];
  if (opts?.rollOff) {
    const result = rollTurnOrder(seatOrder, rng);
    seatOrder = result.order;
    orderReveal = { order: result.order, rounds: result.rounds };
    log.push({ k: "order", order: result.order });
  }

  return {
    version: 0, players, seatOrder,
    redDeck, redDiscard: [], treeDeck, treeDiscard: [],
    chopStockpile: CHOP_STOCKPILE,
    turn: { activeSeat: seatOrder[0]!, phase: "squareUp" },
    lastRoll: [], winner: null, pendingReaction: null,
    log, lastContest: null, lastSighting: null, orderReveal,
  };
}
