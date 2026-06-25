import type { GameState, PlayerState } from "../engine/types";

/**
 * Firebase RTDB does not store empty objects or arrays — a field that was `{}` or
 * `[]` when written comes back `undefined`. Rehydrate every collection the engine and
 * UI expect to exist, so a freshly-created game (all collections empty) survives the
 * round-trip. Mutates and returns a usable GameState; null passes through (missing game).
 */
export function normalizeState(raw: GameState | null): GameState | null {
  if (raw === null || raw === undefined) return null;
  const s = raw as GameState;

  // Scalar fields RTDB drops when falsy (e.g. null winner, zero version)
  s.winner = s.winner ?? null;
  s.pendingReaction = s.pendingReaction ?? null;

  // Top-level arrays — RTDB drops these when empty
  s.seatOrder = s.seatOrder ?? [];
  s.redDeck = s.redDeck ?? [];
  s.redDiscard = s.redDiscard ?? [];
  s.treeDeck = s.treeDeck ?? [];
  s.treeDiscard = s.treeDiscard ?? [];
  s.lastRoll = s.lastRoll ?? [];

  // players is a Record<number, PlayerState>; RTDB drops it when empty
  s.players = s.players ?? {};

  // Rehydrate each player's arrays and scalar defaults
  for (const key of Object.keys(s.players)) {
    const seat = Number(key);
    const p = s.players[seat] as PlayerState | undefined;
    if (!p) continue;
    p.hand = p.hand ?? [];
    p.equipment = p.equipment ?? [];
    p.plusMinus = p.plusMinus ?? [];
    p.help = p.help ?? [];
    p.scoredTrees = p.scoredTrees ?? [];
    p.axe = p.axe ?? null;
    p.standingTree = p.standingTree ?? null;
    p.speedClimbPoints = p.speedClimbPoints ?? 0;
    p.skipNextTurn = p.skipNextTurn ?? false;
    p.redrawTo = p.redrawTo ?? 1;
    p.axeSetAside = p.axeSetAside ?? false;
    p.giveMeAHand = p.giveMeAHand ?? [];
    p.cannotChopThisTurn = p.cannotChopThisTurn ?? false;
  }

  return s;
}
