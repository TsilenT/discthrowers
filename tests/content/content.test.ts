import { describe, it, expect } from "vitest";
import { getTheme, DEFAULT_THEME } from "../../src/content";

describe("content layer", () => {
  it("DEFAULT_THEME is discgolf", () => {
    expect(DEFAULT_THEME).toBe("discgolf");
  });

  it("default theme has display data for every red card + chainsaw + every tree", () => {
    const t = getTheme(DEFAULT_THEME);
    expect(t.card("carpenters-axe").name.length).toBeGreaterThan(0);
    expect(t.card("chainsaw").name.length).toBeGreaterThan(0);
    // disc-golf tree name for tree-red-oak
    expect(t.tree("tree-red-oak").name).toBe("Basket 6 — Red Oak Run");
    expect(t.card("flapjacks").rulesText.length).toBeGreaterThan(0);
    expect(t.card("flapjacks").category).toBe("plus-minus");
  });

  it("falls back gracefully for an unknown id", () => {
    expect(getTheme(DEFAULT_THEME).card("nonexistent").name).toBe("nonexistent");
  });

  it("disc-golf theme: carpenters-axe is named Standard Driver", () => {
    const dg = getTheme("discgolf");
    expect(dg.card("carpenters-axe").name).toBe("Standard Driver");
    expect(dg.card("carpenters-axe").category).toBe("equipment");
  });

  it("disc-golf theme: flapjacks category is plus-minus", () => {
    const dg = getTheme("discgolf");
    expect(dg.card("flapjacks").category).toBe("plus-minus");
  });

  it("disc-golf tree stats match engine data (tree-red-oak: chopTarget 6, treeScore 7)", () => {
    const dg = getTheme("discgolf");
    expect(dg.tree("tree-red-oak").chopTarget).toBe(6);
    expect(dg.tree("tree-red-oak").treeScore).toBe(7);
  });
});
