import { describe, it, expect } from "vitest";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";

const seats = [
  { uid: "u0", name: "Ann" },
  { uid: "u1", name: "Bob" },
];

describe("createInitialGame", () => {
  it("deals 3 cards to each player and sets first seat to squareUp", () => {
    const g = createInitialGame(seats, mulberry32(1));
    expect(Object.keys(g.players).length).toBe(2);
    expect(g.players[0]!.hand.length).toBe(3);
    expect(g.players[1]!.hand.length).toBe(3);
    expect(g.turn.phase).toBe("squareUp");
    expect(g.seatOrder).toEqual([0, 1]);
    expect(g.redDeck.length).toBe(125 - 6);
    expect(g.treeDeck.length).toBe(35);
    expect(g.chopStockpile).toBe(25);
    expect(g.winner).toBeNull();
    expect(g.version).toBe(0);
  });
});
