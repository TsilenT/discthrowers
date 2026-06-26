import type { CardHandler } from "../registry";
import type { CardContext } from "../ctx";
import { addPlusMinus } from "../primitives";
import { redCard } from "../catalog";

/** Returns the list of gear IDs that block this card (from deckData blockedBy). */
function blockedBy(cardId: string): string[] {
  const effect = redCard(cardId).effect;
  const val = effect["blockedBy"];
  return Array.isArray(val) ? (val as string[]) : [];
}

/** True if the target player has any equipment that blocks this card.
 *  Checks both: the card's own effect.blockedBy AND each equipped gear's effect.immuneTo. */
function targetIsImmune(ctx: CardContext, cardId: string): boolean {
  if (ctx.target === undefined) return false;
  const targetP = ctx.state.players[ctx.target];
  if (!targetP) return false;
  // Check explicit blockedBy on the attacking card
  const blockers = blockedBy(cardId);
  if (blockers.some((b) => targetP.equipment.includes(b))) return true;
  // Check immuneTo on each piece of target's equipment
  for (const gear of targetP.equipment) {
    const immuneEffect = redCard(gear).effect["immuneTo"];
    const immuneList = Array.isArray(immuneEffect) ? (immuneEffect as string[]) : [];
    if (immuneList.includes(cardId)) return true;
  }
  return false;
}

/** Create a self-target Plus/Minus handler. */
function selfPlusMinusHandler(cardId: string): CardHandler {
  return {
    isPlayable(_ctx: CardContext): boolean {
      return true;
    },
    play(ctx: CardContext): void {
      addPlusMinus(ctx.state, ctx.actorSeat, cardId);
    },
  };
}

/** Create an opponent-target Plus/Minus handler with optional immunity. */
function opponentPlusMinusHandler(cardId: string): CardHandler {
  return {
    isPlayable(ctx: CardContext): boolean {
      if (ctx.target === undefined) return false;
      if (ctx.target === ctx.actorSeat) return false;
      const targetP = ctx.state.players[ctx.target];
      if (!targetP) return false;
      if (targetIsImmune(ctx, cardId)) return false;
      // No doubles: can't play a Plus/Minus the target already has in front of them
      // (e.g. Sore Fingers / Blisters, which persists until Gloves).
      if (targetP.plusMinus.includes(cardId)) return false;
      return true;
    },
    play(ctx: CardContext): void {
      addPlusMinus(ctx.state, ctx.target!, cardId);
    },
  };
}

export const plusMinusHandlers: Record<string, CardHandler> = {
  "flapjacks": selfPlusMinusHandler("flapjacks"),
  "short-stack": selfPlusMinusHandler("short-stack"),
  "side-of-bacon": selfPlusMinusHandler("side-of-bacon"),
  "axe-slip": opponentPlusMinusHandler("axe-slip"),
  "foot-slip": opponentPlusMinusHandler("foot-slip"),
  "winded": opponentPlusMinusHandler("winded"),
  "blisters": opponentPlusMinusHandler("blisters"),
};
