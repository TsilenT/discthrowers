import { isAxe } from "./catalog";
import type { CardId, GameState, LogEntry, Seat } from "../types";

/** Append a log entry, capping history at the most recent 80 (mirrors apply.ts pushLog). */
export function logEvent(s: GameState, entry: LogEntry): void {
  const log = (s.log ??= []);
  log.push(entry);
  if (log.length > 80) s.log = log.slice(-80);
}

/** Discard a seat's current driver (if any) and log what was tossed before equipping a new one. */
export function discardOldAxe(s: GameState, seat: Seat): void {
  const p = s.players[seat]!;
  if (p.axe === null) return;
  s.redDiscard.push(p.axe);
  logEvent(s, { k: "axeReplaced", seat, discarded: p.axe });
  p.axe = null;
}

export function discardFromHand(s: GameState, seat: Seat, card: CardId): void {
  const p = s.players[seat]!; const i = p.hand.indexOf(card);
  if (i !== -1) p.hand.splice(i, 1);
  s.redDiscard.push(card);
}

export function addPlusMinus(s: GameState, seat: Seat, card: CardId): void {
  s.players[seat]!.plusMinus.push(card);
}

export function addEquipment(s: GameState, seat: Seat, card: CardId): void {
  s.players[seat]!.equipment.push(card);
}

export function addHelp(s: GameState, seat: Seat, card: CardId): void {
  s.players[seat]!.help.push(card);
}

/** Remove a card from a player's tableau (axe/equipment/plusMinus/help) -> redDiscard. */
export function discardTableauCard(s: GameState, seat: Seat, card: CardId): boolean {
  const p = s.players[seat]!;
  if (p.axe === card) { p.axe = null; s.redDiscard.push(card); return true; }
  for (const list of [p.equipment, p.plusMinus, p.help]) {
    const i = list.indexOf(card);
    if (i !== -1) { list.splice(i, 1); s.redDiscard.push(card); return true; }
  }
  return false;
}

/** Move a tableau card from one player to another (used by steals/lures). */
export function moveCardBetween(s: GameState, from: Seat, to: Seat, card: CardId): boolean {
  const src = s.players[from]!, dst = s.players[to]!;
  if (src.axe === card) {
    src.axe = null;
    if (dst.axe !== null) s.redDiscard.push(dst.axe); // one axe at a time
    dst.axe = card; return true;
  }
  for (const [list, target] of [[src.equipment, dst.equipment], [src.help, dst.help]] as const) {
    const i = list.indexOf(card);
    if (i !== -1) { list.splice(i, 1); target.push(card); return true; }
  }
  return false;
}

export function returnChops(s: GameState, n: number): void { s.chopStockpile += n; }

/** Fell the player's standing tree: score it, return chops, discard the tree. */
export function fellStandingTree(s: GameState, seat: Seat): void {
  const p = s.players[seat]!; const t = p.standingTree; if (!t) return;
  returnChops(s, t.chops);
  s.treeDiscard.push(t.treeId);
  p.scoredTrees.push(t.treeId);
  p.standingTree = null;
}

/** Discard a standing tree WITHOUT scoring (Beavers / Forest Fire). */
export function destroyStandingTree(s: GameState, seat: Seat): void {
  const p = s.players[seat]!; const t = p.standingTree; if (!t) return;
  returnChops(s, t.chops);
  s.treeDiscard.push(t.treeId);
  p.standingTree = null;
}

/** Add one skipped turn to a seat (stacks with any already pending). */
export function skipTurn(s: GameState, seat: Seat): void { s.players[seat]!.skipTurns += 1; }

/** Discard every Help card in play (any Sasquatch card triggers this). */
export function wipeAllHelp(s: GameState): void {
  for (const p of Object.values(s.players)) {
    while (p.help.length) s.redDiscard.push(p.help.pop()!);
  }
}

export const isAxeCard = isAxe;
