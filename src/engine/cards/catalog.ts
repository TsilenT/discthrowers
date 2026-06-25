import { RED_CARD_DATA, TREE_CARD_DATA } from "./deckData";
import type { CardCategory, CardId, TreeId } from "../types";

export interface RedCard {
  id: CardId; category: CardCategory;
  subtype?: string; count: number;
  effect: Record<string, unknown>;
}
export interface TreeCard {
  id: TreeId; count: number; chopTarget: number; treeScore: number;
}

export const RED_CARDS: RedCard[] = RED_CARD_DATA;
export const TREE_CARDS: TreeCard[] = TREE_CARD_DATA;

const redById = new Map(RED_CARDS.map((c) => [c.id, c]));
const treeById = new Map(TREE_CARDS.map((t) => [t.id, t]));

/**
 * Synthetic cards that exist in the game state but are NOT part of the 40-card deck.
 * These are created by in-game effects (e.g. chainsaw-carving gives the winner a Chainsaw axe).
 */
const SYNTHETIC_CARDS: RedCard[] = [
  {
    id: "chainsaw",
    category: "equipment",
    subtype: "axe",
    count: 0, // not in the deck; spawned by chainsaw-carving
    effect: { baseChopDice: 5, isAxe: true },
  },
];
const syntheticById = new Map(SYNTHETIC_CARDS.map((c) => [c.id, c]));

export function redCard(id: CardId): RedCard {
  const c = redById.get(id) ?? syntheticById.get(id);
  if (!c) throw new Error(`Unknown red card: ${id}`);
  return c;
}
export function cardCategory(id: CardId): CardCategory { return redCard(id).category; }
export function isAxe(id: CardId): boolean { return redCard(id).subtype === "axe"; }
export function baseChopDice(id: CardId): number {
  return (redCard(id).effect.baseChopDice as number | undefined) ?? 0;
}
export function treeStats(id: TreeId): { chopTarget: number; treeScore: number } {
  const t = treeById.get(id);
  if (!t) throw new Error(`Unknown tree: ${id}`);
  return { chopTarget: t.chopTarget, treeScore: t.treeScore };
}
