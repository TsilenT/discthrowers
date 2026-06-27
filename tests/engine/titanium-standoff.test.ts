import { describe, it, expect } from "vitest";
import { apply } from "../../src/engine/apply";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";
import type { Rng } from "../../src/engine/rng";

const seats = [{ uid: "u0", name: "Ann" }, { uid: "u1", name: "Bob" }];
const ok = (r: ReturnType<typeof apply>) => { if (!r.ok) throw new Error(r.error); return r.state; };
// All dice come up 1 → guaranteed break results.
const allOnes: Rng = { nextFloat: () => 0, nextInt: () => 0, shuffle: <T>(a: T[]) => a };

function toPlay() {
  let s = createInitialGame(seats, mulberry32(1));
  s = ok(apply(s, { type: "squareUp" }, mulberry32(2)));
  s = ok(apply(s, { type: "draw" }, mulberry32(3)));
  return s; // play phase, seat 0 active
}

describe("Pro-Stamped (Titanium) disc can't be cracked by a bad throw", () => {
  it("survives 4 break dice; a normal disc breaks", () => {
    let s = createInitialGame(seats, mulberry32(1));
    s.turn.phase = "chop";
    s.players[0]!.axe = "titanium-axe";
    s.players[0]!.standingTree = { treeId: "tree-mighty-oak", chops: 0 };
    s = ok(apply(s, { type: "chop" }, allOnes));
    expect(s.players[0]!.axe).toBe("titanium-axe"); // unbroken

    let s2 = createInitialGame(seats, mulberry32(1));
    s2.turn.phase = "chop";
    s2.players[0]!.axe = "carpenters-axe";
    s2.players[0]!.standingTree = { treeId: "tree-mighty-oak", chops: 0 };
    s2 = ok(apply(s2, { type: "chop" }, allOnes));
    expect(s2.players[0]!.axe).toBeNull(); // a normal disc cracks
  });
});

describe("Hooligan Standoff take-basket option", () => {
  it("takes the target's basket when chosen", () => {
    let s = toPlay();
    s.players[0]!.hand = ["sasquatch-mating-season"];
    s.players[0]!.standingTree = null;
    s.players[1]!.standingTree = { treeId: "tree-red-oak", chops: 3 };
    s = ok(apply(s, { type: "playCard", card: "sasquatch-mating-season", target: 1, takeBasket: true }, mulberry32(4)));
    expect(s.players[0]!.standingTree).toEqual({ treeId: "tree-red-oak", chops: 3 });
    expect(s.players[1]!.standingTree).toBeNull();
    expect(s.players[1]!.skipNextTurn).toBe(true);
  });

  it("leaves the basket when not chosen (just skips their turn)", () => {
    let s = toPlay();
    s.players[0]!.hand = ["sasquatch-mating-season"];
    s.players[1]!.standingTree = { treeId: "tree-red-oak", chops: 3 };
    s = ok(apply(s, { type: "playCard", card: "sasquatch-mating-season", target: 1, takeBasket: false }, mulberry32(4)));
    expect(s.players[1]!.standingTree).toEqual({ treeId: "tree-red-oak", chops: 3 });
    expect(s.players[1]!.skipNextTurn).toBe(true);
  });
});
