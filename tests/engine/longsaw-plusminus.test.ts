import { describe, it, expect } from "vitest";
import { apply } from "../../src/engine/apply";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";

const seats = [{ uid: "u0", name: "Ann" }, { uid: "u1", name: "Bob" }];
const ok = (r: ReturnType<typeof apply>) => { if (!r.ok) throw new Error(r.error); return r.state; };

describe("Long Saw & Partner scales with Plus/Minus (e.g. Disc Throw-Off +2)", () => {
  it("rolls base 5 + modifiers and consumes the modifier", () => {
    let s = createInitialGame(seats, mulberry32(1));
    s.turn.phase = "longSaw";
    s.players[0]!.help = ["long-saw-and-partner"];
    s.players[0]!.plusMinus = ["axe-throw"];           // Disc Throw-Off winner: +2 dice
    s.players[0]!.standingTree = { treeId: "tree-mighty-oak", chops: 0 }; // target 9 — can't fell on 7 dice
    s = ok(apply(s, { type: "longSaw" }, mulberry32(5)));
    expect(s.lastRoll.length).toBe(7);                 // 5 + 2
    expect(s.players[0]!.plusMinus).toEqual([]);       // consumed like a chopping roll
  });

  it("plain Long Saw rolls exactly 5 dice with no modifiers", () => {
    let s = createInitialGame(seats, mulberry32(1));
    s.turn.phase = "longSaw";
    s.players[0]!.help = ["long-saw-and-partner"];
    s.players[0]!.standingTree = { treeId: "tree-mighty-oak", chops: 0 };
    s = ok(apply(s, { type: "longSaw" }, mulberry32(6)));
    expect(s.lastRoll.length).toBe(5);
  });
});
