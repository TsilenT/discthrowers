import { describe, it, expect } from "vitest";
import { apply } from "../../src/engine/apply";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";

const seats = [{ uid: "u0", name: "Ann" }, { uid: "u1", name: "Bob" }];
const ok = (r: ReturnType<typeof apply>) => { if (!r.ok) throw new Error(r.error); return r.state; };

describe("Long Saw pass-right counts only its own dice", () => {
  it("does NOT pass when only the combined helper dice reach 4 breaks", () => {
    // seed 6 (loop order babe then long-saw): babe=[4,1] (1 break), long-saw=[4,2,4,1,1] (3 breaks).
    // Combined = 4 breaks (would pass if helper dice counted); Long Saw alone = 3 → must stay.
    let s = createInitialGame(seats, mulberry32(1));
    s.turn.phase = "manageHelp";
    s.players[0]!.help = ["babe", "long-saw-and-partner"];
    s.players[0]!.axeSetAside = true;
    s.players[0]!.standingTree = { treeId: "tree-mighty-oak", chops: 0 }; // target 9 — won't fell
    s = ok(apply(s, { type: "manageHelp" }, mulberry32(6)));
    expect(s.players[0]!.help).toContain("long-saw-and-partner"); // stayed
    expect(s.players[0]!.axeSetAside).toBe(true);
    expect(s.players[1]!.help).not.toContain("long-saw-and-partner");
  });
});
