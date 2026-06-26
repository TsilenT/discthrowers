/**
 * Task 3: Reaction window, pendingReaction, react/passReaction actions.
 *
 * Tests:
 * 1. Playing steal-axe when opponent holds northern-justice → sets pendingReaction, doesn't steal yet
 * 2. react with northern-justice → cancels steal, sets cannotChopThisTurn, reactor draws replacement
 * 3. passReaction → when all pass, steal resolves normally
 * 4. debunk cancels sasquatch-rampage
 * 5. paperwork cancels tree-hugger
 * 6. cannotChopThisTurn: chop skips to manageHelp when set
 */
import { describe, it, expect } from "vitest";
import { apply } from "../../src/engine/apply";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";
import type { GameState } from "../../src/engine/types";

const rng = mulberry32(42);

const seats = [
  { uid: "u0", name: "Ann" },
  { uid: "u1", name: "Bob" },
];

const seats3 = [
  { uid: "u0", name: "Ann" },
  { uid: "u1", name: "Bob" },
  { uid: "u2", name: "Cal" },
];

function ok(r: ReturnType<typeof apply>): GameState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

// ── steal-axe pauses for reaction ────────────────────────────────────────────

describe("playCard: steal-axe sets pendingReaction when reactor available", () => {
  it("sets pendingReaction when opponent holds northern-justice", () => {
    const g = createInitialGame(seats, mulberry32(1));
    // Set up: seat 0 is active and holds steal-axe; seat 1 has an axe and holds northern-justice
    g.turn = { activeSeat: 0, phase: "play" };
    g.players[0]!.hand = ["steal-axe"];
    g.players[1]!.hand = ["northern-justice"];
    g.players[1]!.axe = "carpenters-axe";

    const r = apply(g, { type: "playCard", card: "steal-axe", target: 1 }, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // pendingReaction should be set
    expect(r.state.pendingReaction).not.toBeNull();
    expect(r.state.pendingReaction!.card).toBe("steal-axe");
    expect(r.state.pendingReaction!.actorSeat).toBe(0);
    expect(r.state.pendingReaction!.target).toBe(1);
    expect(r.state.pendingReaction!.eligibleReactors).toContain(1);
    expect(r.state.pendingReaction!.passed).toEqual([]);

    // Phase should stay "play" (the pause signal is pendingReaction !== null)
    expect(r.state.turn.phase).toBe("play");

    // Axe should NOT have been stolen yet
    expect(r.state.players[1]!.axe).toBe("carpenters-axe");
    expect(r.state.players[0]!.axe).toBeNull();

    // steal-axe should have been removed from actor's hand
    expect(r.state.players[0]!.hand).not.toContain("steal-axe");
  });

  it("resolves immediately if no opponent holds a stopper", () => {
    const g = createInitialGame(seats, mulberry32(1));
    g.turn = { activeSeat: 0, phase: "play" };
    g.players[0]!.hand = ["steal-axe"];
    g.players[1]!.hand = ["flapjacks"]; // no stopper
    g.players[1]!.axe = "carpenters-axe";

    const r = apply(g, { type: "playCard", card: "steal-axe", target: 1 }, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // Should resolve immediately — no pendingReaction
    expect(r.state.pendingReaction).toBeNull();
    expect(r.state.turn.phase).toBe("chop");

    // Axe should be stolen
    expect(r.state.players[0]!.axe).toBe("carpenters-axe");
    expect(r.state.players[1]!.axe).toBeNull();
  });
});

// ── react action ──────────────────────────────────────────────────────────────

describe("react action: northern-justice cancels steal-axe", () => {
  function stateWithPendingStealAxe(): GameState {
    const g = createInitialGame(seats, mulberry32(1));
    g.turn = { activeSeat: 0, phase: "play" };
    g.players[0]!.hand = ["steal-axe"];
    g.players[1]!.hand = ["northern-justice"];
    g.players[1]!.axe = "carpenters-axe";
    // Put a card in redDeck for reactor to draw
    g.redDeck = ["flapjacks", "axe-slip", "beavers"];
    const r = apply(g, { type: "playCard", card: "steal-axe", target: 1 }, rng);
    if (!r.ok) throw new Error(r.error);
    return r.state;
  }

  it("react cancels the pending card: axe is not stolen", () => {
    let s = stateWithPendingStealAxe();
    s = ok(apply(s, { type: "react", seat: 1, card: "northern-justice" }, rng));

    // Axe stays with seat 1
    expect(s.players[1]!.axe).toBe("carpenters-axe");
    expect(s.players[0]!.axe).toBeNull();
  });

  it("react discards the cancelled card to redDiscard", () => {
    let s = stateWithPendingStealAxe();
    s = ok(apply(s, { type: "react", seat: 1, card: "northern-justice" }, rng));

    // steal-axe goes to redDiscard (no effect)
    expect(s.redDiscard).toContain("steal-axe");
  });

  it("reactor's northern-justice is discarded and they draw a replacement", () => {
    let s = stateWithPendingStealAxe();
    const deckBefore = s.redDeck.length;
    s = ok(apply(s, { type: "react", seat: 1, card: "northern-justice" }, rng));

    // northern-justice should be discarded
    expect(s.redDiscard).toContain("northern-justice");
    // reactor draws 1 replacement
    expect(s.players[1]!.hand.length).toBe(1); // had 1 (nj), spent it, drew 1
    expect(s.redDeck.length).toBe(deckBefore - 1);
  });

  it("react sets cannotChopThisTurn on the ACTOR (northern-justice side-effect)", () => {
    let s = stateWithPendingStealAxe();
    s = ok(apply(s, { type: "react", seat: 1, card: "northern-justice" }, rng));

    // Northern Justice stops actor from chopping this turn
    expect(s.players[0]!.cannotChopThisTurn).toBe(true);
  });

  it("react clears pendingReaction", () => {
    let s = stateWithPendingStealAxe();
    s = ok(apply(s, { type: "react", seat: 1, card: "northern-justice" }, rng));

    expect(s.pendingReaction).toBeNull();
  });

  it("react advances the ACTOR to chop phase", () => {
    let s = stateWithPendingStealAxe();
    s = ok(apply(s, { type: "react", seat: 1, card: "northern-justice" }, rng));

    expect(s.turn.phase).toBe("chop");
    expect(s.turn.activeSeat).toBe(0); // actor unchanged
  });

  it("react is rejected if seat is not an eligible reactor", () => {
    const s = stateWithPendingStealAxe();
    // seat 0 is the actor, not eligible
    const r = apply(s, { type: "react", seat: 0, card: "northern-justice" }, rng);
    expect(r.ok).toBe(false);
  });

  it("react is rejected if seat doesn't hold the reaction card", () => {
    let s = stateWithPendingStealAxe();
    // Remove northern-justice from seat 1's hand
    s.players[1]!.hand = ["flapjacks"];
    const r = apply(s, { type: "react", seat: 1, card: "northern-justice" }, rng);
    expect(r.ok).toBe(false);
  });

  it("react is rejected if card is not a stopper for the pending card", () => {
    let s = stateWithPendingStealAxe();
    s.players[1]!.hand = ["debunk"]; // debunk doesn't stop steal-axe
    const r = apply(s, { type: "react", seat: 1, card: "debunk" }, rng);
    expect(r.ok).toBe(false);
  });

  it("react is rejected when no pendingReaction exists", () => {
    const g = createInitialGame(seats, mulberry32(1));
    g.turn = { activeSeat: 0, phase: "play" };
    g.players[1]!.hand = ["northern-justice"];
    const r = apply(g, { type: "react", seat: 1, card: "northern-justice" }, rng);
    expect(r.ok).toBe(false);
  });
});

// ── passReaction: all pass → resolve ────────────────────────────────────────

describe("passReaction: when all eligible reactors pass, card resolves", () => {
  function stateWithPendingStealAxe(): GameState {
    const g = createInitialGame(seats, mulberry32(1));
    g.turn = { activeSeat: 0, phase: "play" };
    g.players[0]!.hand = ["steal-axe"];
    g.players[1]!.hand = ["northern-justice"];
    g.players[1]!.axe = "carpenters-axe";
    g.redDeck = ["flapjacks", "axe-slip"];
    const r = apply(g, { type: "playCard", card: "steal-axe", target: 1 }, rng);
    if (!r.ok) throw new Error(r.error);
    return r.state;
  }

  it("passReaction records the pass when only one reactor exists (not yet all passed)", () => {
    const s = stateWithPendingStealAxe();
    // With only seat 1 eligible, one pass means all passed → should resolve immediately
    // (tested in next test, this just verifies the pass action is accepted)
    const r = apply(s, { type: "passReaction", seat: 1 }, rng);
    expect(r.ok).toBe(true);
  });

  it("passReaction resolves steal when only reactor passes", () => {
    let s = stateWithPendingStealAxe();
    s = ok(apply(s, { type: "passReaction", seat: 1 }, rng));

    // Axe should now be stolen
    expect(s.players[0]!.axe).toBe("carpenters-axe");
    expect(s.players[1]!.axe).toBeNull();
  });

  it("passReaction clears pendingReaction when all have passed", () => {
    let s = stateWithPendingStealAxe();
    s = ok(apply(s, { type: "passReaction", seat: 1 }, rng));
    expect(s.pendingReaction).toBeNull();
  });

  it("passReaction advances actor to chop when all have passed", () => {
    let s = stateWithPendingStealAxe();
    s = ok(apply(s, { type: "passReaction", seat: 1 }, rng));
    expect(s.turn.phase).toBe("chop");
    expect(s.turn.activeSeat).toBe(0);
  });

  it("passReaction with multiple reactors: records partial pass without resolving", () => {
    // 3-player game: seat 1 and seat 2 both hold debunk; seat 0 plays sasquatch-rampage
    const g = createInitialGame(seats3, mulberry32(1));
    g.turn = { activeSeat: 0, phase: "play" };
    g.players[0]!.hand = ["sasquatch-rampage"];
    g.players[1]!.hand = ["debunk"];
    g.players[2]!.hand = ["debunk"];
    // Give all players some hand content so they survive the sasquatch wipe if it resolves
    g.players[0]!.hand = ["sasquatch-rampage"];

    // Play sasquatch-rampage → should set pendingReaction
    let s = ok(apply(g, { type: "playCard", card: "sasquatch-rampage" }, rng));
    expect(s.pendingReaction).not.toBeNull();
    expect(s.pendingReaction!.eligibleReactors.length).toBe(2);

    // Seat 1 passes — still has seat 2 left, so NOT resolved
    s = ok(apply(s, { type: "passReaction", seat: 1 }, rng));
    expect(s.pendingReaction).not.toBeNull(); // still pending
    expect(s.pendingReaction!.passed).toContain(1);
    expect(s.turn.phase).toBe("play"); // still paused

    // Seat 2 also passes — all have passed, so resolves
    s = ok(apply(s, { type: "passReaction", seat: 2 }, rng));
    expect(s.pendingReaction).toBeNull();
    expect(s.turn.phase).toBe("chop");
  });

  it("passReaction is rejected when seat already passed", () => {
    const g = createInitialGame(seats3, mulberry32(1));
    g.turn = { activeSeat: 0, phase: "play" };
    g.players[0]!.hand = ["sasquatch-rampage"];
    g.players[1]!.hand = ["debunk"];
    g.players[2]!.hand = ["debunk"];
    let s = ok(apply(g, { type: "playCard", card: "sasquatch-rampage" }, rng));
    s = ok(apply(s, { type: "passReaction", seat: 1 }, rng));
    // Seat 1 tries to pass again
    const r = apply(s, { type: "passReaction", seat: 1 }, rng);
    expect(r.ok).toBe(false);
  });

  it("passReaction is rejected when no pendingReaction exists", () => {
    const g = createInitialGame(seats, mulberry32(1));
    g.turn = { activeSeat: 0, phase: "play" };
    const r = apply(g, { type: "passReaction", seat: 1 }, rng);
    expect(r.ok).toBe(false);
  });

  it("passReaction is rejected when seat is not an eligible reactor", () => {
    const g = createInitialGame(seats, mulberry32(1));
    g.turn = { activeSeat: 0, phase: "play" };
    g.players[0]!.hand = ["steal-axe"];
    g.players[1]!.hand = ["northern-justice"];
    g.players[1]!.axe = "carpenters-axe";
    let s = ok(apply(g, { type: "playCard", card: "steal-axe", target: 1 }, rng));
    // Seat 0 (actor) tries to passReaction
    const r = apply(s, { type: "passReaction", seat: 0 }, rng);
    expect(r.ok).toBe(false);
  });
});

// ── debunk cancels sasquatch-rampage ─────────────────────────────────────────

describe("react: debunk cancels sasquatch-rampage", () => {
  it("debunk react prevents sasquatch effect (hands not wiped)", () => {
    const g = createInitialGame(seats, mulberry32(1));
    g.turn = { activeSeat: 0, phase: "play" };
    g.players[0]!.hand = ["sasquatch-rampage"];
    g.players[1]!.hand = ["debunk", "flapjacks"];
    g.redDeck = ["axe-slip", "axe-break"];

    let s = ok(apply(g, { type: "playCard", card: "sasquatch-rampage" }, rng));
    expect(s.pendingReaction).not.toBeNull();

    s = ok(apply(s, { type: "react", seat: 1, card: "debunk" }, rng));

    // sasquatch-rampage should be discarded with NO effect
    expect(s.redDiscard).toContain("sasquatch-rampage");

    // Seat 1's hand: had ["debunk", "flapjacks"], spent debunk, drew 1 replacement
    // So still has 2 cards: flapjacks + drawn card
    expect(s.players[1]!.hand).toContain("flapjacks");
    expect(s.players[1]!.hand.length).toBe(2);

    // Seat 0's hand should NOT be wiped (effect was cancelled)
    // sasquatch-rampage was already removed from hand when played
    // but the "wipe" effect should NOT have run
    // Seat 0 had only sasquatch-rampage in hand (already removed), so hand is empty now
    // The key thing: seat 1's other cards should be untouched
    expect(s.pendingReaction).toBeNull();
    expect(s.turn.phase).toBe("chop");

    // debunk has no side effects (unlike northern-justice)
    expect(s.players[0]!.cannotChopThisTurn).toBe(false);
  });
});

// ── cannotChopThisTurn: chop skips to manageHelp ────────────────────────────

describe("cannotChopThisTurn: chop phase skips roll", () => {
  it("when cannotChopThisTurn is true, chop advances to manageHelp without rolling", () => {
    const g = createInitialGame(seats, mulberry32(1));
    g.turn = { activeSeat: 0, phase: "chop" };
    g.players[0]!.axe = "carpenters-axe";
    g.players[0]!.standingTree = { treeId: "tree-red-oak", chops: 0 };
    g.players[0]!.cannotChopThisTurn = true;

    const r = apply(g, { type: "chop" }, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // No roll happened (tree chops unchanged at 0)
    expect(r.state.players[0]!.standingTree!.chops).toBe(0);
    // cannotChopThisTurn is cleared
    expect(r.state.players[0]!.cannotChopThisTurn).toBe(false);
    // Chop is skipped → advances to the longSaw phase
    expect(r.state.turn.phase).toBe("longSaw");
  });

  it("cannotChopThisTurn is cleared at endTurn", () => {
    const g = createInitialGame(seats, mulberry32(1));
    g.turn = { activeSeat: 0, phase: "end" };
    g.players[0]!.cannotChopThisTurn = true;

    const r = apply(g, { type: "endTurn" }, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // After endTurn, we're now in seat 1's squareUp; seat 0's cannotChop was cleared
    // (actually cleared on their own endTurn; they already "end"ed)
    expect(r.state.players[0]!.cannotChopThisTurn).toBe(false);
  });
});

// ── passReaction resolves via the same code path as immediate play ────────────

describe("passReaction resolves card using same logic as immediate play", () => {
  it("passReaction resolving steal-axe: steal-axe discarded (not kept in hand)", () => {
    const g = createInitialGame(seats, mulberry32(1));
    g.turn = { activeSeat: 0, phase: "play" };
    g.players[0]!.hand = ["steal-axe"];
    g.players[1]!.hand = ["northern-justice"];
    g.players[1]!.axe = "carpenters-axe";
    g.redDeck = ["flapjacks", "axe-slip"];

    let s = ok(apply(g, { type: "playCard", card: "steal-axe", target: 1 }, rng));
    s = ok(apply(s, { type: "passReaction", seat: 1 }, rng));

    // steal-axe goes to redDiscard
    expect(s.redDiscard).toContain("steal-axe");
  });
});
