import { describe, it, expect } from "vitest";
import { apply } from "../../src/engine/apply";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";

const seats = [{ uid: "u0", name: "Ann" }, { uid: "u1", name: "Bob" }];
const ok = (r: ReturnType<typeof apply>) => { if (!r.ok) throw new Error(r.error); return r.state; };

describe("one-shot reveals are cleared when the turn ends", () => {
  it("clears lastContest, lastSighting and orderReveal on endTurn (so they don't re-pop after refresh)", () => {
    let s = createInitialGame(seats, mulberry32(1));
    s.turn.phase = "end";
    s.lastContest = { card: "axe-throw", challenger: 0, opponent: 1, challengerRoll: 6, opponentRoll: 2, winner: 0 };
    s.lastSighting = { actor: 0, rolls: [{ seat: 1, roll: 2, failed: true }] };
    s.orderReveal = { order: [0, 1], rounds: [[{ seat: 0, roll: 5 }, { seat: 1, roll: 3 }]] };
    s = ok(apply(s, { type: "endTurn" }, mulberry32(2)));
    expect(s.lastContest).toBeNull();
    expect(s.lastSighting).toBeNull();
    expect(s.orderReveal).toBeNull();
  });
});
