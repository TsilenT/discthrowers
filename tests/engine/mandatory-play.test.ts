/**
 * Task 8: mandatory-play tests
 *
 * Tests for the wired-up registry in apply.ts:
 * - anyPlayable helper (tested indirectly via discardCard rejection)
 * - playCard through handler (non-axe routes through registry)
 * - discardCard blocked when a playable card is held
 * - discardCard allowed when no playable cards
 */
import { describe, it, expect } from "vitest";
import { apply } from "../../src/engine/apply";
import { mulberry32 } from "../../src/engine/rng";
import type { GameState, PlayerState } from "../../src/engine/types";

/** Minimal player state builder */
function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    uid: "u", name: "n", hand: [], axe: null, equipment: [], plusMinus: [],
    help: [], standingTree: null, scoredTrees: [], speedClimbPoints: 0,
    skipNextTurn: false, redrawTo: 1, axeSetAside: false, giveMeAHand: [], cannotChopThisTurn: false, ...over,
  };
}

/** Minimal game state in play phase */
function gameInPlay(overrides: {
  seat0Hand?: string[];
  seat1Hand?: string[];
  seat0Axe?: string | null;
  seat1Axe?: string | null;
  seat0Equipment?: string[];
  seat1Equipment?: string[];
  seat0PlusMinus?: string[];
  seat1PlusMinus?: string[];
  seat0Help?: string[];
  seat1Help?: string[];
  redDiscard?: string[];
  redDeck?: string[];
} = {}): GameState {
  const p0 = player({
    uid: "u0", name: "Ann",
    hand: overrides.seat0Hand ?? [],
    axe: overrides.seat0Axe !== undefined ? overrides.seat0Axe : null,
    equipment: overrides.seat0Equipment ?? [],
    plusMinus: overrides.seat0PlusMinus ?? [],
    help: overrides.seat0Help ?? [],
    standingTree: { treeId: "tree-norway-pine", chops: 0 },
  });
  const p1 = player({
    uid: "u1", name: "Bob",
    hand: overrides.seat1Hand ?? [],
    axe: overrides.seat1Axe !== undefined ? overrides.seat1Axe : null,
    equipment: overrides.seat1Equipment ?? [],
    plusMinus: overrides.seat1PlusMinus ?? [],
    help: overrides.seat1Help ?? [],
    standingTree: { treeId: "tree-elm", chops: 0 },
  });
  return {
    version: 1,
    players: { 0: p0, 1: p1 },
    seatOrder: [0, 1],
    redDeck: overrides.redDeck ?? [],
    redDiscard: overrides.redDiscard ?? [],
    treeDeck: [],
    treeDiscard: [],
    chopStockpile: 20,
    turn: { activeSeat: 0, phase: "play" },
    lastRoll: [],
    winner: null, pendingReaction: null,
  };
}

const rng = mulberry32(42);

describe("apply: discardCard is blocked when a playable card is held", () => {
  it("rejects discard when hand contains a flapjacks (self-target, always playable)", () => {
    const s = gameInPlay({ seat0Hand: ["flapjacks"] });
    const r = apply(s, { type: "discardCard", card: "flapjacks" }, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/must play/i);
    }
  });

  it("allows discard when no card in hand is playable", () => {
    // forest-fire has a deferred/no-target issue? Actually forest-fire IS playable (isPlayable -> true).
    // We need a card that is genuinely unplayable. Use axe-break: needs target with a non-titanium axe.
    // Seat 1 has no axe, so axe-break is not playable.
    const s = gameInPlay({ seat0Hand: ["axe-break"], seat1Axe: null });
    const r = apply(s, { type: "discardCard", card: "axe-break" }, rng);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.redDiscard).toContain("axe-break");
      expect(r.state.turn.phase).toBe("chop");
    }
  });

  it("allows discard when hand is empty (vacuously no playable cards) -- but hand must have the card", () => {
    // This tests the edge: if hand somehow is empty, discarding fails for "card not in hand"
    // So test: discard allowed when the ONLY card is unplayable (beavers with no trees in any opponent)
    // beavers needs opponent with a standingTree; give seat1 no tree
    const s = gameInPlay({
      seat0Hand: ["beavers"],
      seat1Axe: null,
    });
    // Seat1 does have a standingTree (set in gameInPlay), so beavers IS playable.
    // Let's override seat1 to have no standingTree
    s.players[1]!.standingTree = null;
    const r = apply(s, { type: "discardCard", card: "beavers" }, rng);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.turn.phase).toBe("chop");
    }
  });
});

describe("apply: playCard routes through handler for non-axe cards", () => {
  it("playing flapjacks adds it to player plusMinus and advances to chop phase", () => {
    const s = gameInPlay({ seat0Hand: ["flapjacks"] });
    const r = apply(s, { type: "playCard", card: "flapjacks" }, rng);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.turn.phase).toBe("chop");
      expect(r.state.players[0]!.plusMinus).toContain("flapjacks");
      expect(r.state.players[0]!.hand).not.toContain("flapjacks");
      // flapjacks is a plus-minus card; handler places it in plusMinus, so it should NOT be in redDiscard
      expect(r.state.redDiscard).not.toContain("flapjacks");
      expect(r.state.version).toBeGreaterThan(s.version);
    }
  });

  it("playing a sasquatch/action card (forest-fire) discards the played card to redDiscard", () => {
    const s = gameInPlay({ seat0Hand: ["forest-fire"] });
    const r = apply(s, { type: "playCard", card: "forest-fire" }, rng);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.turn.phase).toBe("chop");
      expect(r.state.redDiscard).toContain("forest-fire");
      expect(r.state.players[0]!.hand).not.toContain("forest-fire");
    }
  });

  it("playing a help card (apprentice) adds it to help array and does NOT add to redDiscard", () => {
    const s = gameInPlay({ seat0Hand: ["apprentice"] });
    const r = apply(s, { type: "playCard", card: "apprentice" }, rng);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.players[0]!.help).toContain("apprentice");
      expect(r.state.redDiscard).not.toContain("apprentice");
      expect(r.state.turn.phase).toBe("chop");
    }
  });

  it("playing an equipment card (boots) adds it to equipment and does NOT add to redDiscard", () => {
    const s = gameInPlay({ seat0Hand: ["boots"] });
    const r = apply(s, { type: "playCard", card: "boots" }, rng);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.players[0]!.equipment).toContain("boots");
      expect(r.state.redDiscard).not.toContain("boots");
      expect(r.state.turn.phase).toBe("chop");
    }
  });

  it("playing a targeted card with no valid target (axe-break when opponent has no axe) is rejected", () => {
    // seat 1 has no axe -> axe-break isPlayable returns false
    const s = gameInPlay({ seat0Hand: ["axe-break"], seat1Axe: null });
    const r = apply(s, { type: "playCard", card: "axe-break", target: 1 }, rng);
    expect(r.ok).toBe(false);
  });

  it("playing a targeted card on a valid target (axe-break when opponent has an axe) succeeds", () => {
    const s = gameInPlay({ seat0Hand: ["axe-break"], seat1Axe: "carpenters-axe" });
    const r = apply(s, { type: "playCard", card: "axe-break", target: 1 }, rng);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.players[1]!.axe).toBeNull();
      expect(r.state.redDiscard).toContain("axe-break");
      expect(r.state.turn.phase).toBe("chop");
    }
  });

  it("playing a card whose isPlayable returns false is rejected", () => {
    // beavers needs a target with a standing tree; give seat1 no tree
    const s = gameInPlay({ seat0Hand: ["beavers"] });
    s.players[1]!.standingTree = null;
    // No valid target for beavers
    const r = apply(s, { type: "playCard", card: "beavers", target: 1 }, rng);
    expect(r.ok).toBe(false);
  });
});

describe("apply: anyPlayable considers targeted cards correctly", () => {
  it("discard is blocked when hand contains a targeted card with at least one valid target", () => {
    // axe-break is playable if any opponent has a non-titanium axe
    const s = gameInPlay({ seat0Hand: ["axe-break"], seat1Axe: "carpenters-axe" });
    const r = apply(s, { type: "discardCard", card: "axe-break" }, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/must play/i);
    }
  });

  it("discard is allowed when targeted card has no valid target anywhere", () => {
    // axe-break: seat1 has no axe -> not playable; nothing else in hand
    const s = gameInPlay({ seat0Hand: ["axe-break"], seat1Axe: null });
    const r = apply(s, { type: "discardCard", card: "axe-break" }, rng);
    expect(r.ok).toBe(true);
  });
});
