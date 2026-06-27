import { describe, it, expect } from "vitest";
import { apply } from "../../src/engine/apply";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";

const seats = [{ uid: "u0", name: "Ann" }, { uid: "u1", name: "Bob" }, { uid: "u2", name: "Cy" }];
const ok = (r: ReturnType<typeof apply>) => { if (!r.ok) throw new Error(r.error); return r.state; };

describe("Hooligan Sighting records a roll-off reveal and logs who failed", () => {
  it("rolls for every other player and logs the ones who lose a turn", () => {
    let s = createInitialGame(seats, mulberry32(1));
    s = ok(apply(s, { type: "squareUp" }, mulberry32(2)));
    s = ok(apply(s, { type: "draw" }, mulberry32(3)));
    s.players[0]!.hand = ["sasquatch-sighting"];
    s = ok(apply(s, { type: "playCard", card: "sasquatch-sighting" }, mulberry32(7)));

    const reveal = s.lastSighting!;
    expect(reveal.actor).toBe(0);
    expect(reveal.rolls.map((r) => r.seat).sort()).toEqual([1, 2]); // every other player
    for (const r of reveal.rolls) {
      expect(r.failed).toBe(r.roll <= 3);                       // 1-3 fail
      expect(s.players[r.seat]!.skipTurns).toBe(r.failed ? 1 : 0);   // failers lose a turn
    }
    const failedSeats = reveal.rolls.filter((r) => r.failed).map((r) => r.seat);
    const logEntry = (s.log ?? []).find((e) => e.k === "sighting");
    expect(logEntry?.k).toBe("sighting");
    if (logEntry?.k === "sighting") {
      expect(logEntry.failed.slice().sort()).toEqual(failedSeats.slice().sort());
    }
  });
});
