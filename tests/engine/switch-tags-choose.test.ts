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

describe("Score Card Swap swaps the chosen holes", () => {
  it("swaps the selected indices, not just the first of each", () => {
    let s = toPlay();
    s.players[0]!.hand = ["switch-tags"];
    s.players[0]!.scoredTrees = ["tree-norway-pine", "tree-red-oak"];
    s.players[1]!.scoredTrees = ["tree-mighty-oak", "tree-cottonwood"];
    // give my index 1 (red-oak), take their index 0 (mighty-oak)
    s = ok(apply(s, { type: "playCard", card: "switch-tags", target: 1, swap: { mine: 1, theirs: 0 } }, mulberry32(4)));
    expect(s.players[0]!.scoredTrees).toEqual(["tree-norway-pine", "tree-mighty-oak"]);
    expect(s.players[1]!.scoredTrees).toEqual(["tree-red-oak", "tree-cottonwood"]);
  });

  it("defaults to the first of each when no choice is given", () => {
    let s = toPlay();
    s.players[0]!.hand = ["switch-tags"];
    s.players[0]!.scoredTrees = ["tree-norway-pine"];
    s.players[1]!.scoredTrees = ["tree-mighty-oak"];
    s = ok(apply(s, { type: "playCard", card: "switch-tags", target: 1 }, mulberry32(4)));
    expect(s.players[0]!.scoredTrees).toEqual(["tree-mighty-oak"]);
    expect(s.players[1]!.scoredTrees).toEqual(["tree-norway-pine"]);
  });
});
