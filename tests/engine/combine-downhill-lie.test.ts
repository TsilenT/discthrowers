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

describe("Downhill Lie combines with Tailwind / Slight Tailwind as one play", () => {
  it("plays Downhill Lie + Tailwind together, draws a replacement, and moves to chop", () => {
    let s = toPlay();
    s.players[0]!.hand = ["side-of-bacon", "flapjacks"];
    s.redDeck = ["winded"]; // the single replacement draw
    s = ok(apply(s, { type: "playCard", card: "side-of-bacon", combine: ["flapjacks"] }, mulberry32(4)));
    // Both buffs are now in front of the player
    expect(s.players[0]!.plusMinus).toContain("side-of-bacon");
    expect(s.players[0]!.plusMinus).toContain("flapjacks");
    // Drew one replacement card; turn advanced to the throw
    expect(s.players[0]!.hand).toEqual(["winded"]);
    expect(s.turn.phase).toBe("chop");
  });

  it("can combine with both Tailwind and Slight Tailwind, drawing only one card", () => {
    let s = toPlay();
    s.players[0]!.hand = ["side-of-bacon", "flapjacks", "short-stack"];
    s.redDeck = ["winded", "blisters"];
    s = ok(apply(s, { type: "playCard", card: "side-of-bacon", combine: ["flapjacks", "short-stack"] }, mulberry32(4)));
    expect(s.players[0]!.plusMinus).toEqual(expect.arrayContaining(["side-of-bacon", "flapjacks", "short-stack"]));
    expect(s.players[0]!.hand).toEqual(["winded"]); // exactly one drawn
  });

  it("plays Downhill Lie alone when no partners are chosen", () => {
    let s = toPlay();
    s.players[0]!.hand = ["side-of-bacon", "flapjacks"];
    s = ok(apply(s, { type: "playCard", card: "side-of-bacon" }, mulberry32(4)));
    expect(s.players[0]!.plusMinus).toEqual(["side-of-bacon"]);
    expect(s.players[0]!.hand).toEqual(["flapjacks"]); // tailwind kept, no draw
    expect(s.turn.phase).toBe("chop");
  });

  it("rejects combining onto a non-anchor card", () => {
    const s = toPlay();
    s.players[0]!.hand = ["flapjacks", "side-of-bacon"];
    const r = apply(s, { type: "playCard", card: "flapjacks", combine: ["side-of-bacon"] }, mulberry32(4));
    expect(r.ok).toBe(false);
  });

  it("rejects combining with a card not in hand", () => {
    const s = toPlay();
    s.players[0]!.hand = ["side-of-bacon"];
    const r = apply(s, { type: "playCard", card: "side-of-bacon", combine: ["flapjacks"] }, mulberry32(4));
    expect(r.ok).toBe(false);
  });
});
