import type { CardHandler } from "../registry";
import type { CardContext } from "../ctx";
import { addEquipment } from "../primitives";

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

export const equipmentHandlers: Record<string, CardHandler> = {
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
        if (card === "blisters") {
          ctx.state.redDiscard.push(card);
        } else {
          kept.push(card);
        }
      }
      actor.plusMinus = kept;
      addEquipment(ctx.state, ctx.actorSeat, "gloves");
    },
  },
};
