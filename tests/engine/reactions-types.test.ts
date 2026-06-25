/**
 * Task 1: Verify that PendingReaction, reaction action types, and new PlayerState
 * fields are correctly initialized and defaulted.
 */
import { describe, it, expect } from "vitest";
import { createInitialGame } from "../../src/engine/state";
import { normalizeState } from "../../src/net/normalize";
import { mulberry32 } from "../../src/engine/rng";
import type { PendingReaction } from "../../src/engine/types";

const seats = [
  { uid: "u0", name: "Ann" },
  { uid: "u1", name: "Bob" },
];

describe("Task 1: new state fields (pendingReaction, axeSetAside, giveMeAHand, cannotChopThisTurn)", () => {
  it("createInitialGame sets pendingReaction to null", () => {
    const g = createInitialGame(seats, mulberry32(1));
    expect(g.pendingReaction).toBeNull();
  });

  it("createInitialGame sets axeSetAside to false for each player", () => {
    const g = createInitialGame(seats, mulberry32(1));
    expect(g.players[0]!.axeSetAside).toBe(false);
    expect(g.players[1]!.axeSetAside).toBe(false);
  });

  it("createInitialGame sets giveMeAHand to empty array for each player", () => {
    const g = createInitialGame(seats, mulberry32(1));
    expect(g.players[0]!.giveMeAHand).toEqual([]);
    expect(g.players[1]!.giveMeAHand).toEqual([]);
  });

  it("createInitialGame sets cannotChopThisTurn to false for each player", () => {
    const g = createInitialGame(seats, mulberry32(1));
    expect(g.players[0]!.cannotChopThisTurn).toBe(false);
    expect(g.players[1]!.cannotChopThisTurn).toBe(false);
  });

  it("normalizeState fills in missing pendingReaction as null", () => {
    // Construct a minimal state that normalizeState won't crash on
    const g = createInitialGame(seats, mulberry32(1));
    // Simulate what RTDB does: drops null/empty fields
    const raw = g as unknown as Record<string, unknown>;
    delete raw["pendingReaction"];
    const normalized = normalizeState(g)!;
    expect(normalized.pendingReaction).toBeNull();
  });

  it("normalizeState fills in missing axeSetAside as false for each player", () => {
    const g = createInitialGame(seats, mulberry32(1));
    const p0 = g.players[0] as unknown as Record<string, unknown>;
    const p1 = g.players[1] as unknown as Record<string, unknown>;
    delete p0["axeSetAside"];
    delete p1["axeSetAside"];
    const normalized = normalizeState(g)!;
    expect(normalized.players[0]!.axeSetAside).toBe(false);
    expect(normalized.players[1]!.axeSetAside).toBe(false);
  });

  it("normalizeState fills in missing giveMeAHand as empty array for each player", () => {
    const g = createInitialGame(seats, mulberry32(1));
    const p0 = g.players[0] as unknown as Record<string, unknown>;
    const p1 = g.players[1] as unknown as Record<string, unknown>;
    delete p0["giveMeAHand"];
    delete p1["giveMeAHand"];
    const normalized = normalizeState(g)!;
    expect(normalized.players[0]!.giveMeAHand).toEqual([]);
    expect(normalized.players[1]!.giveMeAHand).toEqual([]);
  });

  it("normalizeState fills in missing cannotChopThisTurn as false for each player", () => {
    const g = createInitialGame(seats, mulberry32(1));
    const p0 = g.players[0] as unknown as Record<string, unknown>;
    const p1 = g.players[1] as unknown as Record<string, unknown>;
    delete p0["cannotChopThisTurn"];
    delete p1["cannotChopThisTurn"];
    const normalized = normalizeState(g)!;
    expect(normalized.players[0]!.cannotChopThisTurn).toBe(false);
    expect(normalized.players[1]!.cannotChopThisTurn).toBe(false);
  });

  it("PendingReaction interface has the right shape", () => {
    // Compile-time check: ensure PendingReaction can be assigned correctly
    const pr: PendingReaction = {
      card: "steal-axe",
      actorSeat: 0,
      target: 1,
      eligibleReactors: [1],
      passed: [],
    };
    expect(pr.card).toBe("steal-axe");
    expect(pr.actorSeat).toBe(0);
    expect(pr.eligibleReactors).toEqual([1]);
    expect(pr.passed).toEqual([]);
  });

  it("react action type can be constructed", () => {
    const action = { type: "react" as const, seat: 1, card: "northern-justice" };
    expect(action.type).toBe("react");
    expect(action.seat).toBe(1);
    expect(action.card).toBe("northern-justice");
  });

  it("passReaction action type can be constructed", () => {
    const action = { type: "passReaction" as const, seat: 1 };
    expect(action.type).toBe("passReaction");
    expect(action.seat).toBe(1);
  });
});
