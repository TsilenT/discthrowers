import { describe, it, expect } from "vitest";
import { buildRedDeck, buildTreeDeck } from "../../src/engine/deck";
import { mulberry32 } from "../../src/engine/rng";

describe("deck", () => {
  it("expands red counts to 125 cards", () => {
    expect(buildRedDeck(mulberry32(1)).length).toBe(125);
  });
  it("expands tree counts to 35 cards", () => {
    expect(buildTreeDeck(mulberry32(1)).length).toBe(35);
  });
  it("same seed -> same order", () => {
    expect(buildRedDeck(mulberry32(9))).toEqual(buildRedDeck(mulberry32(9)));
  });
  it("includes the right number of a known card", () => {
    const deck = buildRedDeck(mulberry32(1));
    expect(deck.filter((c) => c === "carpenters-axe").length).toBe(5);
  });
});
