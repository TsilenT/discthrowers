import { describe, it, expect } from "vitest";
import { apply } from "../../src/engine/apply";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";

const seats = [{ uid: "u0", name: "Ann" }, { uid: "u1", name: "Bob" }];
const ok = (r: ReturnType<typeof apply>) => { if (!r.ok) throw new Error(r.error); return r.state; };

describe("apply: scoring cards can win during the play phase", () => {
  it("Paul Bunyan fells all trees and detects a win", () => {
    let s = createInitialGame(seats, mulberry32(1));
    s = ok(apply(s, { type: "squareUp" }, mulberry32(2)));
    s = ok(apply(s, { type: "draw" }, mulberry32(3)));
    // Rig: active player one tree away from winning, holding Paul Bunyan.
    s.players[0]!.hand = ["paul-bunyan"];
    s.players[0]!.speedClimbPoints = 17;
    s.players[0]!.standingTree = { treeId: "tree-red-oak", chops: 0 }; // score 7 -> 24
    s = ok(apply(s, { type: "playCard", card: "paul-bunyan" }, mulberry32(4)));
    expect(s.winner).toBe(0);
    expect(s.turn.phase).toBe("gameOver");
  });
});

describe("apply: squareUp & draw", () => {
  it("squareUp draws a standing tree then moves to draw phase", () => {
    const g = createInitialGame(seats, mulberry32(1));
    const s = ok(apply(g, { type: "squareUp" }, mulberry32(2)));
    expect(s.players[0]!.standingTree).not.toBeNull();
    expect(s.turn.phase).toBe("draw");
    expect(s.version).toBe(1);
  });
  it("draw adds a card to hand and moves to play phase", () => {
    let s = ok(apply(createInitialGame(seats, mulberry32(1)), { type: "squareUp" }, mulberry32(2)));
    const before = s.players[0]!.hand.length;
    s = ok(apply(s, { type: "draw" }, mulberry32(3)));
    expect(s.players[0]!.hand.length).toBe(before + 1);
    expect(s.turn.phase).toBe("play");
  });
  it("rejects an action in the wrong phase", () => {
    const g = createInitialGame(seats, mulberry32(1));
    const r = apply(g, { type: "draw" }, mulberry32(2));
    expect(r.ok).toBe(false);
  });
});

describe("apply: play & discard", () => {
  const toPlay = (s: ReturnType<typeof createInitialGame>) => ok(apply(ok(apply(s, { type: "squareUp" }, mulberry32(2))), { type: "draw" }, mulberry32(3)));
  it("playing an axe equips it and moves to chop", () => {
    let s = toPlay(createInitialGame(seats, mulberry32(1)));
    // give the active player a known axe in hand
    s.players[0]!.hand = ["carpenters-axe"];
    s = ok(apply(s, { type: "playCard", card: "carpenters-axe" }, mulberry32(4)));
    expect(s.players[0]!.axe).toBe("carpenters-axe");
    expect(s.turn.phase).toBe("chop");
  });
  it("discarding a card moves to chop (only allowed when no card is playable)", () => {
    let s = toPlay(createInitialGame(seats, mulberry32(1)));
    // Give the active player only cards that have no valid play (axe-break needs a target
    // with a non-titanium axe; no opponent has an axe here, so it's unplayable).
    // This tests that discardCard succeeds when mandatory-play check passes.
    s.players[0]!.hand = ["axe-break"];
    s.players[1]!.axe = null; // ensure no legal target for axe-break
    s = ok(apply(s, { type: "discardCard", card: "axe-break" }, mulberry32(4)));
    expect(s.redDiscard).toContain("axe-break");
    expect(s.turn.phase).toBe("chop");
  });
});

describe("apply: chop & turn end", () => {
  function atChop(handAxe = "carpenters-axe") {
    let s = createInitialGame(seats, mulberry32(1));
    s = ok(apply(s, { type: "squareUp" }, mulberry32(2)));
    s = ok(apply(s, { type: "draw" }, mulberry32(3)));
    s.players[0]!.hand = [handAxe];
    s = ok(apply(s, { type: "playCard", card: handAxe }, mulberry32(4)));
    return s;
  }
  it("chop rolls dice and may add chops, then -> longSaw", () => {
    let s = atChop();
    s = ok(apply(s, { type: "chop" }, mulberry32(10)));
    expect(s.turn.phase).toBe("longSaw");
    expect(s.lastRoll.length).toBe(3);
    expect(s.players[0]!.standingTree!.chops).toBeGreaterThanOrEqual(0);
  });
  it("chop -> longSaw -> manageHelp -> end, endTurn advances to next seat at squareUp", () => {
    let s = atChop();
    s = ok(apply(s, { type: "chop" }, mulberry32(10)));
    s = ok(apply(s, { type: "longSaw" }, mulberry32(13)));
    expect(s.turn.phase).toBe("manageHelp");
    s = ok(apply(s, { type: "manageHelp" }, mulberry32(11)));
    expect(s.turn.phase).toBe("end");
    s = ok(apply(s, { type: "endTurn" }, mulberry32(12)));
    expect(s.turn.activeSeat).toBe(1);
    expect(s.turn.phase).toBe("squareUp");
  });
  it("endTurn skips seat 1 when skipNextTurn is set and clears the flag", () => {
    // 2-player game: seat 0's turn, seat 1 has skipNextTurn = true.
    // After endTurn, active seat should wrap back to 0 (1 was skipped), and
    // seat 1's skipNextTurn should be cleared.
    let s = atChop();
    s = ok(apply(s, { type: "chop" }, mulberry32(10)));
    s = ok(apply(s, { type: "longSaw" }, mulberry32(13)));
    s = ok(apply(s, { type: "manageHelp" }, mulberry32(11)));
    // seat 0 is active and in "end" phase; flag seat 1 to be skipped
    s.players[1]!.skipNextTurn = true;
    s = ok(apply(s, { type: "endTurn" }, mulberry32(12)));
    // seat 1 was skipped so the turn wraps back to seat 0
    expect(s.turn.activeSeat).toBe(0);
    // flag must be cleared
    expect(s.players[1]!.skipNextTurn).toBe(false);
  });
  it("felling a tree to 21 points sets winner", () => {
    let s = atChop();
    // rig: one chop from target, tree worth 4, player needs 1 more to hit 21
    s.players[0]!.standingTree = { treeId: "tree-norway-pine", chops: 3 }; // target 4, score 4
    s.players[0]!.scoredTrees = [];
    s.players[0]!.speedClimbPoints = 17; // 17 + 4 = 21
    // mulberry32(1) rolls [4, 1, 4] -> 2 chops -> tree felled (3+2>=4)
    s = ok(apply(s, { type: "chop" }, mulberry32(1)));
    expect(s.winner).toBe(0);
    expect(s.players[0]!.scoredTrees).toContain("tree-norway-pine");
  });
  it("Plus/Minus card is consumed from plusMinus after a chop roll", () => {
    let s = atChop();
    // plant a plus-minus card (axe-slip: -1 die, scope next-roll)
    s.players[0]!.plusMinus = ["axe-slip"];
    s = ok(apply(s, { type: "chop" }, mulberry32(10)));
    expect(s.players[0]!.plusMinus).toEqual([]);
    expect(s.redDiscard).toContain("axe-slip");
  });
});
