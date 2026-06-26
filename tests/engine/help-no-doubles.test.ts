import { describe, it, expect } from "vitest";
import { getHandler } from "../../src/engine/cards/registry";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";
import type { CardContext } from "../../src/engine/cards/ctx";

const ctxFor = () => {
  const state = createInitialGame([{ uid: "u0", name: "Ann" }, { uid: "u1", name: "Bob" }], mulberry32(1));
  return { state, actorSeat: 0, rng: mulberry32(2) } as CardContext;
};

describe("Help cards — no doubles", () => {
  it("a help card is playable when you don't already have it, and not when you do", () => {
    const ctx = ctxFor();
    expect(getHandler("apprentice").isPlayable(ctx)).toBe(true);
    ctx.state.players[0]!.help = ["apprentice"];
    expect(getHandler("apprentice").isPlayable(ctx)).toBe(false);
    // a different help card is still playable
    expect(getHandler("babe").isPlayable(ctx)).toBe(true);
  });
});
