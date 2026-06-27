import { describe, it, expect } from "vitest";
import { apply } from "../../src/engine/apply";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";

const seats = [{ uid: "u0", name: "Ann" }, { uid: "u1", name: "Bob" }];
const ok = (r: ReturnType<typeof apply>) => { if (!r.ok) throw new Error(r.error); return r.state; };

describe("helpers skip when there's no basket", () => {
  it("manageHelp with helpers but no standing basket rolls nothing and advances to end", () => {
    let s = createInitialGame(seats, mulberry32(1));
    s.turn.phase = "manageHelp";
    s.players[0]!.help = ["babe", "apprentice"];
    s.players[0]!.standingTree = null;
    s = ok(apply(s, { type: "manageHelp" }, mulberry32(2)));
    expect(s.turn.phase).toBe("end");
    expect(s.lastRoll).toEqual([]);                         // no roll happened
    expect((s.log ?? []).some((e) => e.k === "help")).toBe(false);
  });
});
