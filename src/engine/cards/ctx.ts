import type { GameState, PlayerState, Seat } from "../types";
import type { Rng } from "../rng";

export interface CardContext {
  state: GameState;
  actorSeat: Seat;        // who played the card
  target?: Seat;          // chosen target seat, if the card needs one
  rng: Rng;
}

export function actor(ctx: CardContext): PlayerState { return ctx.state.players[ctx.actorSeat]!; }
export function targetPlayer(ctx: CardContext): PlayerState | null {
  return ctx.target === undefined ? null : (ctx.state.players[ctx.target] ?? null);
}
