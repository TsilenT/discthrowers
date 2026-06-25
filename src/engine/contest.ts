/**
 * Contest dice-off helper.
 * Each participant rolls a d6. Ties are rerolled until the rolls differ.
 */
import type { Rng } from "./rng";

export interface ContestResult {
  challengerRoll: number;
  opponentRoll: number;
  challengerWins: boolean;
}

/** Roll a d6: returns 1-6. */
function d6(rng: Rng): number {
  return rng.nextInt(6) + 1;
}

/**
 * Roll a contest between the challenger (actor) and opponent.
 * Both roll a d6; if tied, reroll until the rolls differ.
 * challengerWins = challengerRoll > opponentRoll.
 */
export function rollContest(rng: Rng): ContestResult {
  let challengerRoll: number;
  let opponentRoll: number;
  do {
    challengerRoll = d6(rng);
    opponentRoll = d6(rng);
  } while (challengerRoll === opponentRoll);
  return {
    challengerRoll,
    opponentRoll,
    challengerWins: challengerRoll > opponentRoll,
  };
}
