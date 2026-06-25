/**
 * Reaction eligibility helpers.
 *
 * A reaction card R stops played card C if:
 *   - R.stops contains C's id, OR
 *   - R.stops contains C's category.
 *
 * Source of truth: src/engine/cards/deckData.ts
 */
import { RED_CARD_DATA } from "./cards/deckData";
import { redCard } from "./cards/catalog";
import type { CardId, GameState, Seat } from "./types";

/** Reaction cards and what they stop (ids or category names). */
interface ReactionEntry {
  id: CardId;
  stops: string[]; // card ids or category strings
}

/** Build the list of all reaction cards from the deck data. */
const REACTION_ENTRIES: ReactionEntry[] = RED_CARD_DATA
  .filter((c) => c.category === "reaction")
  .map((c) => ({
    id: c.id,
    stops: c.stops ?? [],
  }));

/**
 * Returns reaction card ids that can stop the given card.
 * A reaction stops C if its `stops` list contains C's id OR C's category.
 */
export function stoppersFor(cardId: CardId): CardId[] {
  let category: string | undefined;
  try {
    category = redCard(cardId).category;
  } catch {
    return [];
  }
  return REACTION_ENTRIES
    .filter((r) => r.stops.includes(cardId) || r.stops.includes(category!))
    .map((r) => r.id);
}

/**
 * Returns true if there is at least one reaction card that can stop cardId.
 */
export function isReactable(cardId: CardId): boolean {
  return stoppersFor(cardId).length > 0;
}

/**
 * Returns the seats (other than actorSeat) whose hand contains at least one
 * stopper card for the given played cardId.
 */
export function eligibleReactors(state: GameState, actorSeat: Seat, cardId: CardId): Seat[] {
  const stoppers = stoppersFor(cardId);
  if (stoppers.length === 0) return [];
  const result: Seat[] = [];
  for (const seat of state.seatOrder) {
    if (seat === actorSeat) continue;
    const p = state.players[seat];
    if (!p) continue;
    if (p.hand.some((c) => stoppers.includes(c))) {
      result.push(seat);
    }
  }
  return result;
}
