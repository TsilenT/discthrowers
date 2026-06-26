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

describe("any disc on any player", () => {
  it("equips a Warped Disc (Dull Axe) on yourself", () => {
    let s = toPlay();
    s.players[0]!.hand = ["dull-axe"];
    s = ok(apply(s, { type: "playCard", card: "dull-axe" }, mulberry32(4))); // no target → self
    expect(s.players[0]!.axe).toBe("dull-axe");
  });

  it("plays a normal disc on an opponent (replacing their disc)", () => {
    let s = toPlay();
    s.players[0]!.hand = ["carpenters-axe"];
    s.players[1]!.axe = "titanium-axe";
    s = ok(apply(s, { type: "playCard", card: "carpenters-axe", target: 1 }, mulberry32(4)));
    expect(s.players[1]!.axe).toBe("carpenters-axe");
    expect(s.redDiscard).toContain("titanium-axe");
    expect(s.players[0]!.axe).toBeNull();
  });

  it("no doubles: can't play a disc on a player who already holds that exact disc", () => {
    const s = toPlay();
    s.players[0]!.hand = ["chopping-axe"];
    s.players[1]!.axe = "chopping-axe";
    expect(apply(s, { type: "playCard", card: "chopping-axe", target: 1 }, mulberry32(4)).ok).toBe(false);
  });
});
