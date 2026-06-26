import { describe, it, expect } from "vitest";
import { normalizeState } from "../src/net/normalize";
import type { GameState } from "../src/engine/types";

// RTDB drops empty arrays even when nested inside objects. normalizeState must
// rehydrate them so the UI doesn't crash reading `.length` / `.includes`.
describe("normalizeState rehydrates dropped nested arrays", () => {
  it("defaults a sighting log entry's missing `failed` and pendingReaction `passed`", () => {
    // Simulate what comes back from RTDB: empty arrays omitted.
    const raw = {
      version: 1, players: {}, seatOrder: [0, 1],
      redDeck: [], redDiscard: [], treeDeck: [], treeDiscard: [],
      chopStockpile: 25, turn: { activeSeat: 0, phase: "play" },
      winner: null,
      pendingReaction: { card: "sasquatch-rampage", actorSeat: 0, eligibleReactors: [1] }, // passed dropped
      log: [{ k: "sighting", actor: 0 }], // failed dropped (nobody failed)
    } as unknown as GameState;

    const s = normalizeState(raw)!;
    expect(s.pendingReaction!.passed).toEqual([]);
    const entry = s.log![0]!;
    expect(entry.k === "sighting" && entry.failed).toEqual([]);
    expect(s.lastRoll).toEqual([]); // top-level still defaulted too
  });
});
