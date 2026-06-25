import { RED_CARDS, TREE_CARDS } from "./cards/catalog";
import type { Rng } from "./rng";
import type { CardId, TreeId } from "./types";

function expand<T extends { id: string; count: number }>(cards: T[]): string[] {
  const out: string[] = [];
  for (const c of cards) for (let i = 0; i < c.count; i++) out.push(c.id);
  return out;
}

export function buildRedDeck(rng: Rng): CardId[] {
  return rng.shuffle(expand(RED_CARDS));
}
export function buildTreeDeck(rng: Rng): TreeId[] {
  return rng.shuffle(expand(TREE_CARDS));
}
