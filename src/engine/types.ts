export type CardId = string; // e.g. "carpenters-axe"
export type TreeId = string; // e.g. "tree-red-oak"
export type Seat = number; // 0-based seat index

export type CardCategory =
  | "equipment" | "plus-minus" | "help"
  | "sasquatch" | "action" | "reaction" | "contest";

export type Phase =
  | "squareUp" | "draw" | "play" | "chop" | "longSaw" | "manageHelp" | "end" | "gameOver";

export interface StandingTree { treeId: TreeId; chops: number; }

export interface PendingReaction {
  card: CardId;           // the reactable card awaiting resolution
  actorSeat: Seat;        // who played it
  target?: Seat;          // its chosen target, if any
  swap?: { mine: number; theirs: number }; // Score Card Swap's chosen hole indices
  takeBasket?: boolean; // Hooligan Standoff: whether to also take the target's basket
  stealItem?: CardId; // Gear Grab: which of the target's equipment cards to take
  eligibleReactors: Seat[];
  passed: Seat[];
}

export interface PlayerState {
  uid: string;
  name: string;
  hand: CardId[];
  axe: CardId | null;
  equipment: CardId[]; // non-axe gear (boots, gloves) — populated in M2
  plusMinus: CardId[]; // pending dice modifiers — populated in M2
  help: CardId[];      // help cards — populated in M2
  standingTree: StandingTree | null;
  scoredTrees: TreeId[];
  speedClimbPoints: number;
  skipNextTurn: boolean;
  /** How many cards to draw up to on the next draw phase (reset to 1 after draw). Default 1. Rampage sets to 4. */
  redrawTo: number;
  /** Long Saw & Partner: while true, axe is set aside and chop skips the roll. */
  axeSetAside: boolean;
  /** Give Me a Hand: each entry is an opponent who has their Give Me a Hand on this player. */
  giveMeAHand: { bySeat: Seat }[];
  /** Northern Justice side-effect: if true, chop skips the roll → manageHelp this turn. Cleared at endTurn. */
  cannotChopThisTurn: boolean;
}

export interface TurnState { activeSeat: Seat; phase: Phase; }

/** A structured event-log entry; rendered to display text in the UI (via the theme). */
export type LogEntry =
  | { k: "turn"; seat: Seat }
  | { k: "play"; seat: Seat; card: CardId; target?: Seat }
  | { k: "discard"; seat: Seat; card: CardId }
  | { k: "axeReplaced"; seat: Seat; discarded: CardId }
  | { k: "chop"; seat: Seat; chops: number; broke: boolean; dice: number }
  | { k: "help"; seat: Seat; chops: number; dice: number }
  | { k: "timber"; seat: Seat; tree: TreeId }
  | { k: "react"; seat: Seat; card: CardId; stopped: CardId }
  | { k: "contest"; card: CardId; winner: Seat; winnerRoll: number; loserRoll: number }
  | { k: "longSawPass"; from: Seat; to: Seat }
  | { k: "assist"; by: Seat; target: Seat; landed: boolean }
  | { k: "sighting"; actor: Seat; failed: Seat[] }
  | { k: "order"; order: Seat[] }
  | { k: "win"; seat: Seat };

/** The opening turn-order roll-off, surfaced for a reveal popup at game start. */
export interface OrderReveal {
  order: Seat[];
  rounds: { seat: Seat; roll: number }[][];
}

/** The most recent Hooligan Sighting roll-off, surfaced for a reveal popup. */
export interface SightingReveal {
  actor: Seat;
  rolls: { seat: Seat; roll: number; failed: boolean }[];
}

/** The most recent contest dice-off, surfaced for a reveal popup. */
export interface ContestReveal {
  card: CardId;
  challenger: Seat;
  opponent: Seat;
  challengerRoll: number;
  opponentRoll: number;
  winner: Seat;
}

export interface GameState {
  version: number;
  players: Record<number, PlayerState>;
  seatOrder: Seat[]; // turn order; index into players
  redDeck: CardId[];
  redDiscard: CardId[];
  treeDeck: TreeId[];
  treeDiscard: TreeId[];
  chopStockpile: number; // tokens available (starts 25)
  turn: TurnState;
  lastRoll: number[]; // most recent chop dice faces (UI)
  winner: Seat | null;
  /** Non-null when a reactable card is awaiting reactions/passes before resolving. */
  pendingReaction: PendingReaction | null;
  /** Append-only event log (optional; defaulted to [] by state init and normalize). */
  log?: LogEntry[];
  /** The most recent contest result, for the reveal popup (optional). */
  lastContest?: ContestReveal | null;
  /** The most recent Hooligan Sighting roll-off, for the reveal popup (optional). */
  lastSighting?: SightingReveal | null;
  /** The opening turn-order roll-off, for the reveal popup at game start (optional). */
  orderReveal?: OrderReveal | null;
}

export type Action =
  | { type: "squareUp" }
  | { type: "draw" }
  | { type: "playCard"; card: CardId; target?: Seat; swap?: { mine: number; theirs: number }; takeBasket?: boolean; stealItem?: CardId }
  | { type: "discardCard"; card: CardId }
  | { type: "chop" }
  | { type: "longSaw" }
  | { type: "manageHelp" }
  | { type: "endTurn" }
  | { type: "react"; seat: Seat; card: CardId }
  | { type: "passReaction"; seat: Seat };

export type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

export const WIN_SCORE = 21;
export const STARTING_HAND = 3;
export const CHOP_STOCKPILE = 25;
export const BASE_CHOP_DICE = 3;
