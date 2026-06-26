import { describe, it, expect } from "vitest";
import { apply } from "../../src/engine/apply";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";

const seats = [{ uid: "u0", name: "Ann" }, { uid: "u1", name: "Bob" }];
const ok = (r: ReturnType<typeof apply>) => { if (!r.ok) throw new Error(r.error); return r.state; };

describe("temporary buffs when the throw is skipped", () => {
  it("expires this-turn buffs (Flapjacks) but keeps next-roll (Axe Slip) and Blisters", () => {
    let s = createInitialGame(seats, mulberry32(1)); // no roll-off → seat 0 active
    s.turn.phase = "chop";
    s.players[0]!.axe = null;            // no driver → throw is skipped
    s.players[0]!.standingTree = null;
    s.players[0]!.plusMinus = ["flapjacks", "axe-slip", "blisters"];
    s = ok(apply(s, { type: "chop" }, mulberry32(2)));        // skip → longSaw
    s = ok(apply(s, { type: "longSaw" }, mulberry32(3)));     // no long-saw → manageHelp
    s = ok(apply(s, { type: "manageHelp" }, mulberry32(4)));  // no help → end
    s = ok(apply(s, { type: "endTurn" }, mulberry32(5)));
    expect(s.players[0]!.plusMinus).toEqual(["axe-slip", "blisters"]); // next-roll + persistent kept
    expect(s.redDiscard).toContain("flapjacks");                       // this-turn expired
    expect(s.redDiscard).not.toContain("axe-slip");
    expect(s.redDiscard).not.toContain("blisters");
  });
});
