import { describe, it, expect } from "vitest";
import { RED_CARDS, TREE_CARDS, cardCategory, treeStats, isAxe } from "../../src/engine/cards/catalog";

describe("catalog", () => {
  it("loads 40 distinct red cards totalling 125", () => {
    expect(RED_CARDS.length).toBe(40);
    expect(RED_CARDS.reduce((s, c) => s + c.count, 0)).toBe(125);
  });
  it("loads 7 tree species totalling 35", () => {
    expect(TREE_CARDS.length).toBe(7);
    expect(TREE_CARDS.reduce((s, t) => s + t.count, 0)).toBe(35);
  });
  it("classifies categories and axes", () => {
    expect(cardCategory("carpenters-axe")).toBe("equipment");
    expect(isAxe("carpenters-axe")).toBe(true);
    expect(isAxe("boots")).toBe(false);
  });
  it("reads tree stats", () => {
    expect(treeStats("tree-red-oak")).toEqual({ chopTarget: 6, treeScore: 7 });
  });
});
