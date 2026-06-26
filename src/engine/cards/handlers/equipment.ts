import type { CardHandler } from "../registry";
import type { CardContext } from "../ctx";
import { addEquipment } from "../primitives";
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
  const p = state.players[seat]!;
  if (p.axe !== null) state.redDiscard.push(p.axe);
  p.axe = cardId;
}

/** A normal axe you equip on yourself (no doubles: not playable if you already hold that axe). */
function selfAxe(cardId: CardId): CardHandler {
  return {
    isPlayable: (ctx) => ctx.state.players[ctx.actorSeat]!.axe !== cardId,
    play: (ctx) => equipAxe(ctx.state, ctx.actorSeat, cardId),
  };
}

/**
 * Dull Axe — the one axe you play on someone else (to replace a better axe and slow
 * them down). Targeted at any player; "no doubles" stops it if the recipient already
 * has a Dull Axe. The UI offers opponents; the engine also permits a self target.
 */
const dullAxe: CardHandler = {
  isPlayable: (ctx) => ctx.target !== undefined && ctx.state.players[ctx.target]?.axe !== "dull-axe",
  play: (ctx) => equipAxe(ctx.state, ctx.target!, "dull-axe"),
};

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

  // Axes — normal axes equip on yourself; Dull Axe can be forced onto an opponent.
  "carpenters-axe": selfAxe("carpenters-axe"),
  "chopping-axe": selfAxe("chopping-axe"),
  "swedish-broad-axe": selfAxe("swedish-broad-axe"),
  "double-bladed-axe": selfAxe("double-bladed-axe"),
  "titanium-axe": selfAxe("titanium-axe"),
  "dull-axe": dullAxe,
};
