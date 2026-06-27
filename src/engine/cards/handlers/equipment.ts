import type { CardHandler } from "../registry";
import type { CardContext } from "../ctx";
import { addEquipment, discardOldAxe } from "../primitives";
import type { CardId, GameState, Seat } from "../../types";

/** Create a self-target equipment handler (no doubles: not playable if already owned). */
function selfEquipmentHandler(cardId: string): CardHandler {
  return {
    isPlayable(ctx: CardContext): boolean {
      const actor = ctx.state.players[ctx.actorSeat]!;
      return !actor.equipment.includes(cardId);
    },
    play(ctx: CardContext): void {
      addEquipment(ctx.state, ctx.actorSeat, cardId);
    },
  };
}

/** Equip an axe on a seat, discarding any axe that seat already had (one axe at a time). */
function equipAxe(state: GameState, seat: Seat, cardId: CardId): void {
  discardOldAxe(state, seat); // logs what (if anything) got replaced
  state.players[seat]!.axe = cardId;
}

/**
 * A disc (axe) can be equipped on ANY player — yourself (no target) or an opponent.
 * "No doubles": not playable on a player who already holds that exact disc. Equipping
 * otherwise replaces the recipient's current disc (one at a time).
 */
function axeHandler(cardId: CardId): CardHandler {
  return {
    isPlayable: (ctx) => ctx.state.players[ctx.target ?? ctx.actorSeat]?.axe !== cardId,
    play: (ctx) => equipAxe(ctx.state, ctx.target ?? ctx.actorSeat, cardId),
  };
}

export const equipmentHandlers: Record<string, CardHandler> = {
  // Non-axe gear (self only)
  "boots": selfEquipmentHandler("boots"),
  "gloves": {
    isPlayable(ctx: CardContext): boolean {
      const actor = ctx.state.players[ctx.actorSeat]!;
      return !actor.equipment.includes("gloves");
    },
    play(ctx: CardContext): void {
      const actor = ctx.state.players[ctx.actorSeat]!;
      // Discard any blisters in actor's plusMinus before equipping
      const kept: string[] = [];
      for (const card of actor.plusMinus) {
        if (card === "blisters") ctx.state.redDiscard.push(card);
        else kept.push(card);
      }
      actor.plusMinus = kept;
      addEquipment(ctx.state, ctx.actorSeat, "gloves");
    },
  },

  // Discs — playable on any player (self or opponent).
  "carpenters-axe": axeHandler("carpenters-axe"),
  "chopping-axe": axeHandler("chopping-axe"),
  "swedish-broad-axe": axeHandler("swedish-broad-axe"),
  "double-bladed-axe": axeHandler("double-bladed-axe"),
  "titanium-axe": axeHandler("titanium-axe"),
  "dull-axe": axeHandler("dull-axe"),
};
