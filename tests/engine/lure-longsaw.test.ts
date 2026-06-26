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

describe("Luring Long Saw & Partner moves the axe-set-aside state", () => {
  it("the giver regains their axe and the new holder's axe is sidelined", () => {
    let s = toPlay();
    s.players[0]!.hand = ["lure-help"];
    s.players[0]!.axe = "carpenters-axe";
    s.players[1]!.help = ["long-saw-and-partner"];
    s.players[1]!.axeSetAside = true;
    s = ok(apply(s, { type: "playCard", card: "lure-help", target: 1 }, mulberry32(4)));
    expect(s.players[0]!.help).toContain("long-saw-and-partner");
    expect(s.players[1]!.help).not.toContain("long-saw-and-partner");
    expect(s.players[0]!.axeSetAside).toBe(true);  // actor now sidelined
    expect(s.players[1]!.axeSetAside).toBe(false); // giver's axe usable again
  });
});
