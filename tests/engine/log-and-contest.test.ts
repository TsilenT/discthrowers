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

describe("event log", () => {
  it("records a play entry when a card is played", () => {
    let s = toPlay();
    s.players[0]!.hand = ["flapjacks"];
    s = ok(apply(s, { type: "playCard", card: "flapjacks" }, mulberry32(4)));
    expect((s.log ?? []).some((e) => e.k === "play" && e.card === "flapjacks")).toBe(true);
  });

  it("records a chop entry with the landed count", () => {
    let s = toPlay();
    s.players[0]!.hand = ["carpenters-axe"];
    s = ok(apply(s, { type: "playCard", card: "carpenters-axe" }, mulberry32(4)));
    s = ok(apply(s, { type: "chop" }, mulberry32(10)));
    expect((s.log ?? []).some((e) => e.k === "chop")).toBe(true);
  });
});

describe("contest reveal", () => {
  it("a contest records lastContest with both rolls and a winner, plus a log entry", () => {
    let s = toPlay();
    s.players[0]!.hand = ["axe-throw"];
    s = ok(apply(s, { type: "playCard", card: "axe-throw", target: 1 }, mulberry32(7)));
    const c = s.lastContest;
    expect(c).not.toBeNull();
    expect(c!.card).toBe("axe-throw");
    expect([0, 1]).toContain(c!.winner);
    expect(c!.challengerRoll).not.toBe(c!.opponentRoll); // ties are rerolled
    expect((s.log ?? []).some((e) => e.k === "contest")).toBe(true);
  });
});
