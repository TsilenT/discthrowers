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

describe("Steal Equipment works on axes", () => {
  it("steals the target's axe (and discards the actor's old axe — one at a time)", () => {
    let s = toPlay();
    s.players[0]!.hand = ["steal-equipment"];
    s.players[0]!.axe = "chopping-axe";
    s.players[1]!.axe = "titanium-axe";
    s.players[1]!.equipment = []; // only an axe to take
    s = ok(apply(s, { type: "playCard", card: "steal-equipment", target: 1 }, mulberry32(4)));
    expect(s.players[0]!.axe).toBe("titanium-axe");
    expect(s.players[1]!.axe).toBeNull();
    expect(s.redDiscard).toContain("chopping-axe"); // old axe discarded
  });

  it("logs the discarded driver when one gets replaced", () => {
    let s = toPlay();
    s.players[0]!.hand = ["steal-equipment"];
    s.players[0]!.axe = "chopping-axe";
    s.players[1]!.axe = "titanium-axe";
    s.players[1]!.equipment = [];
    s = ok(apply(s, { type: "playCard", card: "steal-equipment", target: 1 }, mulberry32(4)));
    const replaced = (s.log ?? []).find((e) => e.k === "axeReplaced");
    expect(replaced).toEqual({ k: "axeReplaced", seat: 0, discarded: "chopping-axe" });
  });

  it("takes the chosen gear, leaving the axe and other gear behind", () => {
    let s = toPlay();
    s.players[0]!.hand = ["steal-equipment"];
    s.players[0]!.equipment = [];
    s.players[1]!.axe = "titanium-axe";
    s.players[1]!.equipment = ["boots", "gloves"];
    s = ok(apply(s, { type: "playCard", card: "steal-equipment", target: 1, stealItem: "gloves" }, mulberry32(4)));
    expect(s.players[0]!.equipment).toContain("gloves");
    expect(s.players[1]!.equipment).toEqual(["boots"]); // gloves taken, boots remain
    expect(s.players[1]!.axe).toBe("titanium-axe");     // driver untouched
    expect(s.players[0]!.axe).toBeNull();
  });

  it("takes the chosen driver even when the target also has gear", () => {
    let s = toPlay();
    s.players[0]!.hand = ["steal-equipment"];
    s.players[0]!.axe = null;
    s.players[1]!.axe = "carpenters-axe";
    s.players[1]!.equipment = ["boots"];
    s = ok(apply(s, { type: "playCard", card: "steal-equipment", target: 1, stealItem: "carpenters-axe" }, mulberry32(4)));
    expect(s.players[0]!.axe).toBe("carpenters-axe");
    expect(s.players[1]!.axe).toBeNull();
    expect(s.players[1]!.equipment).toEqual(["boots"]); // gear left behind
  });

  it("is playable when the target only has an axe", () => {
    const s = toPlay();
    s.players[0]!.hand = ["steal-equipment"];
    s.players[1]!.axe = "carpenters-axe";
    s.players[1]!.equipment = [];
    // mandatory-play would reject a discard here because steal-equipment is now playable
    expect(apply(s, { type: "discardCard", card: "steal-equipment" }, mulberry32(4)).ok).toBe(false);
  });
});
