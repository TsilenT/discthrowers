import { describe, it, expect } from "vitest";
import { apply } from "../../src/engine/apply";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";

const seats = [{ uid: "u0", name: "Ann" }, { uid: "u1", name: "Bob" }];
const ok = (r: ReturnType<typeof apply>) => { if (!r.ok) throw new Error(r.error); return r.state; };

function toPlay() {
  let s = createInitialGame(seats, mulberry32(1));
  s = ok(apply(s, { type: "squareUp" }, mulberry32(2)));
  s = ok(apply(s, { type: "draw" }, mulberry32(3)));
  return s; // play phase, seat 0 active
}

describe("Sore Fingers (Blisters) no-doubles", () => {
  it("can't be applied to a player who already has it", () => {
    const s = toPlay();
    s.players[0]!.hand = ["blisters"];
    s.players[1]!.plusMinus = ["blisters"];
    expect(apply(s, { type: "playCard", card: "blisters", target: 1 }, mulberry32(4)).ok).toBe(false);
  });

  it("applies once to a player who doesn't have it", () => {
    let s = toPlay();
    s.players[0]!.hand = ["blisters"];
    s.players[1]!.plusMinus = [];
    s = ok(apply(s, { type: "playCard", card: "blisters", target: 1 }, mulberry32(4)));
    expect(s.players[1]!.plusMinus.filter((c) => c === "blisters").length).toBe(1);
  });
});
