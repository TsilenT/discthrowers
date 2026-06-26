import type { CardHandler } from "../registry";
import type { CardContext } from "../ctx";
import { addHelp } from "../primitives";

/** Create a self-target help card handler. No doubles: you can't play a help card
 *  you already have in front of you (a second copy isn't allowed by the rules). */
function selfHelpHandler(cardId: string): CardHandler {
  return {
    isPlayable(ctx: CardContext): boolean {
      return !ctx.state.players[ctx.actorSeat]!.help.includes(cardId);
    },
    play(ctx: CardContext): void {
      addHelp(ctx.state, ctx.actorSeat, cardId);
    },
  };
}

export const helpHandlers: Record<string, CardHandler> = {
  "apprentice": selfHelpHandler("apprentice"),
  "babe": selfHelpHandler("babe"),

  /**
   * Long Saw & Partner: self-target help card.
   * play() adds the card to the actor's help via addHelp and sets axeSetAside = true.
   *
   * While axeSetAside is true:
   *   - The chop phase skips the roll (handled in apply.ts chop case).
   *   - manageHelp rolls 5 dice for this card; each 4/5/6 chops.
   *   - If 4+ of the 5 dice are breaks (1-2) or misses (3), the card passes to the
   *     player on the right: removed from this player's help (axeSetAside cleared),
   *     added to the next seat's help (their axeSetAside set to true).
   *
   * M3: base 5 dice only (Plus/Minus scaling deferred to M4).
   */
  "long-saw-and-partner": {
    isPlayable(ctx: CardContext): boolean {
      return !ctx.state.players[ctx.actorSeat]!.help.includes("long-saw-and-partner");
    },
    play(ctx: CardContext): void {
      addHelp(ctx.state, ctx.actorSeat, "long-saw-and-partner");
      ctx.state.players[ctx.actorSeat]!.axeSetAside = true;
    },
  },
};
