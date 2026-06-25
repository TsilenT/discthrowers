/**
 * Reaction card handlers.
 *
 * Reaction cards are NOT played during the normal play phase — they are played
 * via the `react` action when pendingReaction is set. Each reaction handler
 * exposes an optional `onCancel(state, actorSeat)` side-effect that runs when
 * the reaction cancels the pending card.
 *
 * The `isPlayable` and `play` fields on CardHandler are stubs for reactions
 * because they are dispatched via the `react` action, not `playCard`.
 */
import type { CardHandler } from "../registry";
import type { GameState, Seat } from "../../types";

export interface ReactionHandler extends CardHandler {
  /**
   * Optional side-effect that runs when this reaction cancels a pending card.
   * Mutates state. actorSeat is the seat that played the pending card.
   */
  onCancel?: (state: GameState, actorSeat: Seat) => void;
}

export const reactionHandlers: Record<string, ReactionHandler> = {
  /**
   * Debunk: stops any Sasquatch card.
   * No extra side effect beyond cancelling the card.
   */
  "debunk": {
    isPlayable: () => false, // can't be played in normal play phase
    play: () => {},
    // no onCancel side effect
  },

  /**
   * Northern Justice: stops Steal Axe or Steal Equipment.
   * Side effect: the thief (actor) cannot make a chopping roll this turn.
   */
  "northern-justice": {
    isPlayable: () => false,
    play: () => {},
    onCancel(state: GameState, actorSeat: Seat): void {
      state.players[actorSeat]!.cannotChopThisTurn = true;
    },
  },

  /**
   * Paperwork: stops Tree Hugger or Switch Tags.
   * No extra side effect.
   */
  "paperwork": {
    isPlayable: () => false,
    play: () => {},
    // no onCancel side effect
  },
};
