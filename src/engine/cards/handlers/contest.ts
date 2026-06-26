/**
 * Contest card handlers: axe-throw, chainsaw-carving, log-rolling, speed-climb.
 *
 * Contests resolve inline via RNG (no reaction window; opponent does not act).
 * Each card is targeted at "opponent" — isPlayable requires a valid opponent.
 *
 * A shared resolver rolls the dice-off once, records the result on state.lastContest
 * (for the reveal popup) and the event log, and returns winner/loser seats. Each card
 * then applies its own effect. The "contest" category is excluded from auto-discard in
 * resolvePlayedCard — the handler controls placement.
 */
import type { CardHandler } from "../registry";
import type { CardContext } from "../ctx";
import { rollContest } from "../../contest";
import { skipTurn } from "../primitives";
import type { CardId, GameState, Seat } from "../../types";

function isValidOpponent(ctx: CardContext): boolean {
  if (ctx.target === undefined) return false;
  if (ctx.target === ctx.actorSeat) return false;
  if (!ctx.state.players[ctx.target]) return false;
  return true;
}

/** Roll the dice-off, record the reveal + log entry, and return the seats. */
function resolveContest(state: GameState, card: CardId, challenger: Seat, opponent: Seat, rng: CardContext["rng"]): {
  winnerSeat: Seat; loserSeat: Seat;
} {
  const result = rollContest(rng);
  const winnerSeat = result.challengerWins ? challenger : opponent;
  const loserSeat = result.challengerWins ? opponent : challenger;
  const winnerRoll = result.challengerWins ? result.challengerRoll : result.opponentRoll;
  const loserRoll = result.challengerWins ? result.opponentRoll : result.challengerRoll;
  state.lastContest = {
    card, challenger, opponent,
    challengerRoll: result.challengerRoll,
    opponentRoll: result.opponentRoll,
    winner: winnerSeat,
  };
  (state.log ??= []).push({ k: "contest", card, winner: winnerSeat, winnerRoll, loserRoll });
  return { winnerSeat, loserSeat };
}

export const contestHandlers: Record<string, CardHandler> = {
  /** Axe Throw: winner gets +2 dice on their next chopping roll (via plusMinus). */
  "axe-throw": {
    isPlayable: (ctx) => isValidOpponent(ctx),
    play(ctx: CardContext): void {
      const { winnerSeat } = resolveContest(ctx.state, "axe-throw", ctx.actorSeat, ctx.target!, ctx.rng);
      ctx.state.players[winnerSeat]!.plusMinus.push("axe-throw");
    },
  },

  /** Chainsaw Carving: winner takes a Chainsaw axe (base 5 dice), discarding any old axe. */
  "chainsaw-carving": {
    isPlayable: (ctx) => isValidOpponent(ctx),
    play(ctx: CardContext): void {
      const { winnerSeat } = resolveContest(ctx.state, "chainsaw-carving", ctx.actorSeat, ctx.target!, ctx.rng);
      const winnerP = ctx.state.players[winnerSeat]!;
      if (winnerP.axe !== null) { ctx.state.redDiscard.push(winnerP.axe); winnerP.axe = null; }
      winnerP.axe = "chainsaw";
      ctx.state.redDiscard.push("chainsaw-carving"); // the card transforms into the axe
    },
  },

  /** Log Rolling: loser loses their next turn (skipNextTurn is the game effect). */
  "log-rolling": {
    isPlayable: (ctx) => isValidOpponent(ctx),
    play(ctx: CardContext): void {
      const { loserSeat } = resolveContest(ctx.state, "log-rolling", ctx.actorSeat, ctx.target!, ctx.rng);
      skipTurn(ctx.state, loserSeat);
    },
  },

  /** Speed Climb: winner gains 2 victory points (counts toward the 21-point win). */
  "speed-climb": {
    isPlayable: (ctx) => isValidOpponent(ctx),
    play(ctx: CardContext): void {
      const { winnerSeat } = resolveContest(ctx.state, "speed-climb", ctx.actorSeat, ctx.target!, ctx.rng);
      ctx.state.players[winnerSeat]!.speedClimbPoints += 2;
    },
  },
};
