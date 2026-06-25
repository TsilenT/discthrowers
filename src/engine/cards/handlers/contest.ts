/**
 * Contest card handlers: axe-throw, chainsaw-carving, log-rolling, speed-climb.
 *
 * Contests resolve inline via RNG (no reaction window; opponent does not act).
 * Each card is targeted at "opponent" — isPlayable requires:
 *   - ctx.target !== undefined
 *   - ctx.target !== ctx.actorSeat
 *   - the target seat exists in state.players
 *
 * After a contest, the HANDLER controls card placement (not resolvePlayedCard).
 * The "contest" category is excluded from the auto-discard in resolvePlayedCard.
 */
import type { CardHandler } from "../registry";
import type { CardContext } from "../ctx";
import { rollContest } from "../../contest";
import { skipTurn } from "../primitives";

function isValidOpponent(ctx: CardContext): boolean {
  if (ctx.target === undefined) return false;
  if (ctx.target === ctx.actorSeat) return false;
  if (!ctx.state.players[ctx.target]) return false;
  return true;
}

export const contestHandlers: Record<string, CardHandler> = {
  /**
   * Axe Throw: winner gets +2 dice on their next chopping roll.
   * Implemented by pushing "axe-throw" into the winner's plusMinus.
   * dice.ts reads effect.winnerDiceModifier (=2) as the modifier.
   * scope is "next-roll" → consumePlusMinusAfterRoll discards it after the roll.
   */
  "axe-throw": {
    isPlayable(ctx: CardContext): boolean {
      return isValidOpponent(ctx);
    },
    play(ctx: CardContext): void {
      const { state, actorSeat, target, rng } = ctx;
      const result = rollContest(rng);
      const winnerSeat = result.challengerWins ? actorSeat : target!;
      // Push the contest card id into winner's plusMinus so the dice modifier applies
      state.players[winnerSeat]!.plusMinus.push("axe-throw");
      // The card itself is now placed in the winner's plusMinus zone — handler controls placement.
    },
  },

  /**
   * Chainsaw Carving: winner takes a Chainsaw axe (base 5 dice).
   * The winner's existing axe (if any) is discarded to redDiscard first.
   * "chainsaw" is a synthetic catalog entry (not in the 40-card deck).
   */
  "chainsaw-carving": {
    isPlayable(ctx: CardContext): boolean {
      return isValidOpponent(ctx);
    },
    play(ctx: CardContext): void {
      const { state, actorSeat, target, rng } = ctx;
      const result = rollContest(rng);
      const winnerSeat = result.challengerWins ? actorSeat : target!;
      const winnerP = state.players[winnerSeat]!;
      // Discard old axe first
      if (winnerP.axe !== null) {
        state.redDiscard.push(winnerP.axe);
        winnerP.axe = null;
      }
      winnerP.axe = "chainsaw";
      // The chainsaw-carving card itself is consumed by the transformation — handler controls placement.
      // Per card-data persists: true, but the card transforms into the chainsaw axe;
      // the original chainsaw-carving card is effectively discarded.
      state.redDiscard.push("chainsaw-carving");
    },
  },

  /**
   * Log Rolling: loser loses their next turn.
   * The card persists as a reminder in the loser's area (skipNextTurn flag handles the game rule).
   * The handler controls placement — contest cards are not auto-discarded by resolvePlayedCard.
   * Per card-data persists: true — the card stays visible until the turn is consumed.
   * For the engine, the skipNextTurn flag is the authoritative mechanism.
   * The card is placed in the loser's plusMinus zone as a visual reminder (or just left alone —
   * since the game rule is purely expressed via skipNextTurn, the card can be consumed with no
   * physical placement. No redDiscard push here since the handler fully controls placement.
   */
  "log-rolling": {
    isPlayable(ctx: CardContext): boolean {
      return isValidOpponent(ctx);
    },
    play(ctx: CardContext): void {
      const { state, actorSeat, target, rng } = ctx;
      const result = rollContest(rng);
      const loserSeat = result.challengerWins ? target! : actorSeat;
      skipTurn(state, loserSeat);
      // Handler controls placement. The skipNextTurn flag is the game effect.
      // Card is not pushed to redDiscard here — it persists with the loser as a reminder token.
    },
  },

  /**
   * Speed Climb: winner gains 2 victory points (speedClimbPoints += 2).
   * These count toward the 21-point win condition (checkAnyWin in resolvePlayedCard checks this).
   * The card persists with the winner's scored area (not re-discarded generically).
   * Per card-data: persists: true, isTree: false, switchTagsImmune: true.
   * The card is NOT placed in redDiscard — it stays attached to the winner as a scoring token.
   */
  "speed-climb": {
    isPlayable(ctx: CardContext): boolean {
      return isValidOpponent(ctx);
    },
    play(ctx: CardContext): void {
      const { state, actorSeat, target, rng } = ctx;
      const result = rollContest(rng);
      const winnerSeat = result.challengerWins ? actorSeat : target!;
      state.players[winnerSeat]!.speedClimbPoints += 2;
      // The card persists with the winner — it becomes part of their score area.
      // Handler controls placement; resolvePlayedCard won't auto-discard contest cards.
    },
  },
};
