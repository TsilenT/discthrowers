import type { CardContext } from "./ctx";
import { cardCategory, isAxe } from "./catalog";
import type { CardId } from "../types";

export interface CardHandler {
  /** Can the actor legally play this card right now (in the play phase)? */
  isPlayable(ctx: CardContext): boolean;
  /** Apply the card's effect by mutating ctx.state. Assumes isPlayable passed. */
  play(ctx: CardContext): void;
}

import { equipmentHandlers } from "./handlers/equipment";
import { plusMinusHandlers } from "./handlers/plusminus";
import { helpHandlers } from "./handlers/help";
import { sasquatchHandlers } from "./handlers/sasquatch";
import { actionHandlers } from "./handlers/action";
import { reactionHandlers } from "./handlers/reaction";
import { contestHandlers } from "./handlers/contest";

const REGISTRY: Record<CardId, CardHandler> = {
  ...equipmentHandlers, ...plusMinusHandlers, ...helpHandlers,
  ...sasquatchHandlers, ...actionHandlers, ...reactionHandlers, ...contestHandlers,
};

/** A deferred/unimplemented card: never playable yet. */
const deferred: CardHandler = { isPlayable: () => false, play: () => {} };

/** Axe cards are equipped directly in apply(); expose a trivially-playable handler. */
const axeEquip: CardHandler = { isPlayable: () => true, play: () => {} };

export function getHandler(id: CardId): CardHandler {
  if (REGISTRY[id]) return REGISTRY[id]!;
  if (isAxe(id)) return axeEquip;
  // Unknown/complex cards default to deferred so they're simply unplayable.
  void cardCategory; // category fallbacks can be added here later
  return deferred;
}
