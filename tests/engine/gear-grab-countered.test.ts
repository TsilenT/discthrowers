import { describe, it, expect } from "vitest";
import { apply } from "../../src/engine/apply";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";
import { normalizeState } from "../../src/net/normalize";

const seats = [{ uid: "u0", name: "Ann" }, { uid: "u1", name: "Bob" }];
const ok = (r: ReturnType<typeof apply>) => { if (!r.ok) throw new Error(r.error); return r.state; };

function toPlay() {
  let s = createInitialGame(seats, mulberry32(1));
  s = ok(apply(s, { type: "squareUp" }, mulberry32(2)));
  s = ok(apply(s, { type: "draw" }, mulberry32(3)));
  return s; // play phase, seat 0 active
}

describe("Gear Grab countered by Northern Justice", () => {
  it("cancels the steal, blocks the thief's chop, and survives an RTDB round-trip", () => {
    let s = toPlay();
    s.players[0]!.hand = ["steal-equipment"];
    s.players[1]!.hand = ["northern-justice"];
    s.players[1]!.equipment = ["boots"];
    s.players[1]!.axe = "carpenters-axe";

    // Play Gear Grab with a chosen item; Bob holds Northern Justice → reaction pending.
    s = ok(apply(s, { type: "playCard", card: "steal-equipment", target: 1, stealItem: "boots" }, mulberry32(4)));
    expect(s.pendingReaction).not.toBeNull();
    expect(s.pendingReaction!.stealItem).toBe("boots");

    // Round-trip through RTDB normalize (mimics the networked path).
    s = normalizeState(JSON.parse(JSON.stringify(s)))!;

    // Bob counters.
    s = ok(apply(s, { type: "react", seat: 1, card: "northern-justice" }, mulberry32(5)));
    expect(s.pendingReaction).toBeNull();
    // Steal cancelled — Bob keeps his gear.
    expect(s.players[1]!.equipment).toContain("boots");
    expect(s.players[1]!.axe).toBe("carpenters-axe");
    // Thief is blocked from chopping and we're in the chop phase.
    expect(s.players[0]!.cannotChopThisTurn).toBe(true);
    expect(s.turn.phase).toBe("chop");

    // The auto-skip the UI would issue must not throw and must clear the flag.
    s = ok(apply(s, { type: "chop" }, mulberry32(6)));
    expect(s.players[0]!.cannotChopThisTurn).toBe(false);
    expect(s.turn.phase).toBe("longSaw");
  });
});
