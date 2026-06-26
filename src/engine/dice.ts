import { baseChopDice, redCard } from "./cards/catalog";
import { BASE_CHOP_DICE, type GameState, type PlayerState, type Seat } from "./types";

/** The dice-count modifier a single Plus/Minus (or Axe Throw winner) card contributes. */
export function cardDiceModifier(card: string): number {
  const effect = redCard(card).effect;
  return (effect.diceModifier as number | undefined)
    ?? (effect.winnerDiceModifier as number | undefined)
    ?? 0;
}
function scopeOf(card: string): string | undefined {
  return redCard(card).effect.scope as string | undefined;
}

/** Sum of all the player's pending Plus/Minus dice modifiers. */
export function plusMinusTotal(p: PlayerState): number {
  return p.plusMinus.reduce((sum, c) => sum + cardDiceModifier(c), 0);
}

export function collectChopDice(p: PlayerState): number {
  const axeBase = p.axe ? (baseChopDice(p.axe) || BASE_CHOP_DICE) : BASE_CHOP_DICE;
  return Math.max(0, axeBase + plusMinusTotal(p));
}

/** After a chopping roll, discard consumed Plus/Minus cards; keep persistent ones (Blisters). */
export function consumePlusMinusAfterRoll(s: GameState, seat: Seat): void {
  const p = s.players[seat]!;
  const keep: string[] = [];
  for (const c of p.plusMinus) {
    if (scopeOf(c) === "until-gloves") keep.push(c); // persistent
    else s.redDiscard.push(c);
  }
  p.plusMinus = keep;
}
