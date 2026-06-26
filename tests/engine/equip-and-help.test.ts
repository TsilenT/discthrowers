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

describe("Dull Axe can be equipped on an opponent", () => {
  it("equips Dull Axe on the target and discards their old axe", () => {
    let s = toPlay();
    s.players[0]!.hand = ["dull-axe"];
    s.players[1]!.axe = "carpenters-axe";
    s = ok(apply(s, { type: "playCard", card: "dull-axe", target: 1 }, mulberry32(4)));
    expect(s.players[1]!.axe).toBe("dull-axe");
    expect(s.redDiscard).toContain("carpenters-axe");
    expect(s.players[0]!.axe).toBeNull();
    expect(s.turn.phase).toBe("chop");
  });

  it("no-doubles: can't play Dull Axe on someone who already has one", () => {
    const s = toPlay();
    s.players[0]!.hand = ["dull-axe"];
    s.players[1]!.axe = "dull-axe";
    expect(apply(s, { type: "playCard", card: "dull-axe", target: 1 }, mulberry32(4)).ok).toBe(false);
  });

  it("a normal axe still equips on yourself", () => {
    let s = toPlay();
    s.players[0]!.hand = ["carpenters-axe"];
    s = ok(apply(s, { type: "playCard", card: "carpenters-axe" }, mulberry32(4)));
    expect(s.players[0]!.axe).toBe("carpenters-axe");
  });
});

describe("Helper dice are surfaced via lastRoll", () => {
  it("manageHelp with Babe sets lastRoll to the rolled dice", () => {
    let s = createInitialGame(seats, mulberry32(1));
    s.turn.phase = "manageHelp";
    s.players[0]!.help = ["babe"];
    s.players[0]!.standingTree = { treeId: "tree-red-oak", chops: 0 };
    s = ok(apply(s, { type: "manageHelp" }, mulberry32(5)));
    expect(s.lastRoll.length).toBe(2); // Babe rolls two dice
    expect(s.turn.phase).toBe("end");
  });
});
