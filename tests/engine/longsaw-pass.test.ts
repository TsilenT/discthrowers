import { describe, it, expect } from "vitest";
import { apply } from "../../src/engine/apply";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";

const seats = [{ uid: "u0", name: "Ann" }, { uid: "u1", name: "Bob" }];
const ok = (r: ReturnType<typeof apply>) => { if (!r.ok) throw new Error(r.error); return r.state; };

describe("longSaw phase rolls only Long Saw's own dice", () => {
  it("a co-held Babe is not rolled here, and pass-right uses only the 5 saw dice", () => {
    // seed 11 → long-saw's 5 dice = [4,4,4,4,6] (0 breaks → no pass). Babe must stay for manageHelp.
    let s = createInitialGame(seats, mulberry32(1));
    s.turn.phase = "longSaw";
    s.players[0]!.help = ["babe", "long-saw-and-partner"];
    s.players[0]!.axeSetAside = true;
    s.players[0]!.standingTree = { treeId: "tree-mighty-oak", chops: 0 }; // target 9 — won't fell
    s = ok(apply(s, { type: "longSaw" }, mulberry32(11)));
    expect(s.lastRoll.length).toBe(5);                       // only the saw rolled, not Babe's 2
    expect(s.players[0]!.help).toContain("long-saw-and-partner"); // 0 breaks → stays
    expect(s.players[0]!.help).toContain("babe");            // Babe untouched (rolls in manageHelp)
    expect(s.turn.phase).toBe("manageHelp");
  });

  it("passes right when 4+ of its own dice are breaks/misses (seed 4 → [6,2,2,1,2])", () => {
    let s = createInitialGame(seats, mulberry32(1));
    s.turn.phase = "longSaw";
    s.players[0]!.help = ["long-saw-and-partner"];
    s.players[0]!.axeSetAside = true;
    s.players[0]!.standingTree = { treeId: "tree-mighty-oak", chops: 0 };
    s = ok(apply(s, { type: "longSaw" }, mulberry32(4)));
    expect(s.players[1]!.help).toContain("long-saw-and-partner");
    expect(s.players[1]!.axeSetAside).toBe(true);
    expect(s.players[0]!.axeSetAside).toBe(false);
  });
});
