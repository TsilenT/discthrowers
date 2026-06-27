/**
 * Task 2: Reaction eligibility + resolution helpers
 */
import { describe, it, expect } from "vitest";
import { stoppersFor, eligibleReactors, isReactable } from "../../src/engine/reactions";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";
import type { PlayerState } from "../../src/engine/types";

const seats = [
  { uid: "u0", name: "Ann" },
  { uid: "u1", name: "Bob" },
  { uid: "u2", name: "Cal" },
];

function makePlayer(over: Partial<PlayerState> = {}): PlayerState {
  return {
    uid: "u", name: "n", hand: [], axe: null, equipment: [], plusMinus: [],
    help: [], standingTree: null, scoredTrees: [], speedClimbPoints: 0,
    skipNextTurn: false, redrawTo: 1, axeSetAside: false, giveMeAHand: [], cannotChopThisTurn: false,
    ...over,
  };
}

// ── stoppersFor ────────────────────────────────────────────────────────────────

describe("stoppersFor", () => {
  it("northern-justice stops steal-axe", () => {
    expect(stoppersFor("steal-axe")).toContain("northern-justice");
  });

  it("northern-justice stops steal-equipment", () => {
    expect(stoppersFor("steal-equipment")).toContain("northern-justice");
  });

  it("debunk stops sasquatch-rampage (category: sasquatch)", () => {
    expect(stoppersFor("sasquatch-rampage")).toContain("debunk");
  });

  it("debunk stops sasquatch-sighting (category: sasquatch)", () => {
    expect(stoppersFor("sasquatch-sighting")).toContain("debunk");
  });

  it("debunk does NOT stop paul-bunyan (it's an action, not a hooligan card)", () => {
    expect(stoppersFor("paul-bunyan")).not.toContain("debunk");
  });

  it("debunk stops that-darn-sasquatch (category: sasquatch)", () => {
    expect(stoppersFor("that-darn-sasquatch")).toContain("debunk");
  });

  it("debunk stops sasquatch-mating-season (category: sasquatch)", () => {
    expect(stoppersFor("sasquatch-mating-season")).toContain("debunk");
  });

  it("paperwork stops tree-hugger", () => {
    expect(stoppersFor("tree-hugger")).toContain("paperwork");
  });

  it("paperwork stops switch-tags", () => {
    expect(stoppersFor("switch-tags")).toContain("paperwork");
  });

  it("axe-break has no stoppers (not reactable)", () => {
    expect(stoppersFor("axe-break")).toEqual([]);
  });

  it("carpenters-axe has no stoppers", () => {
    expect(stoppersFor("carpenters-axe")).toEqual([]);
  });

  it("debunk has no stoppers (reactions can't be reacted to)", () => {
    expect(stoppersFor("debunk")).toEqual([]);
  });
});

// ── isReactable ────────────────────────────────────────────────────────────────

describe("isReactable", () => {
  it("steal-axe is reactable", () => {
    expect(isReactable("steal-axe")).toBe(true);
  });

  it("steal-equipment is reactable", () => {
    expect(isReactable("steal-equipment")).toBe(true);
  });

  it("sasquatch-rampage is reactable", () => {
    expect(isReactable("sasquatch-rampage")).toBe(true);
  });

  it("tree-hugger is reactable", () => {
    expect(isReactable("tree-hugger")).toBe(true);
  });

  it("switch-tags is reactable", () => {
    expect(isReactable("switch-tags")).toBe(true);
  });

  it("axe-break is NOT reactable", () => {
    expect(isReactable("axe-break")).toBe(false);
  });

  it("beavers is NOT reactable", () => {
    expect(isReactable("beavers")).toBe(false);
  });

  it("flapjacks is NOT reactable", () => {
    expect(isReactable("flapjacks")).toBe(false);
  });

  it("carpenters-axe is NOT reactable", () => {
    expect(isReactable("carpenters-axe")).toBe(false);
  });
});

// ── eligibleReactors ──────────────────────────────────────────────────────────

describe("eligibleReactors", () => {
  it("returns seat with northern-justice when steal-axe is played by seat 0", () => {
    const g = createInitialGame(seats, mulberry32(1));
    // Rig: seat 0 is actor, seat 1 holds northern-justice, seat 2 does not
    g.players[0]!.hand = ["steal-axe"];
    g.players[1]!.hand = ["northern-justice"];
    g.players[2]!.hand = ["flapjacks"];
    const result = eligibleReactors(g, 0, "steal-axe");
    expect(result).toContain(1);
    expect(result).not.toContain(0); // actor can't react
    expect(result).not.toContain(2); // doesn't hold a stopper
  });

  it("returns seat with debunk when sasquatch-rampage is played", () => {
    const g = createInitialGame(seats, mulberry32(1));
    g.players[0]!.hand = ["sasquatch-rampage"];
    g.players[1]!.hand = ["debunk"];
    g.players[2]!.hand = ["axe-slip"];
    const result = eligibleReactors(g, 0, "sasquatch-rampage");
    expect(result).toContain(1);
    expect(result).not.toContain(0);
    expect(result).not.toContain(2);
  });

  it("returns multiple seats when more than one hold a stopper", () => {
    const g = createInitialGame(seats, mulberry32(1));
    g.players[0]!.hand = ["sasquatch-rampage"];
    g.players[1]!.hand = ["debunk"];
    g.players[2]!.hand = ["debunk"];
    const result = eligibleReactors(g, 0, "sasquatch-rampage");
    expect(result).toContain(1);
    expect(result).toContain(2);
    expect(result).not.toContain(0);
  });

  it("returns empty array when no other seat holds a stopper", () => {
    const g = createInitialGame(seats, mulberry32(1));
    g.players[0]!.hand = ["steal-axe"];
    g.players[1]!.hand = ["flapjacks"];
    g.players[2]!.hand = ["axe-slip"];
    const result = eligibleReactors(g, 0, "steal-axe");
    expect(result).toEqual([]);
  });

  it("returns empty array for a non-reactable card even if players hold reactions", () => {
    const g = createInitialGame(seats, mulberry32(1));
    g.players[0]!.hand = ["axe-break"];
    g.players[1]!.hand = ["northern-justice"];
    const result = eligibleReactors(g, 0, "axe-break");
    expect(result).toEqual([]);
  });
});
