import { describe, it, expect } from "vitest";
import { rollTurnOrder } from "../../src/engine/order";
import { createInitialGame } from "../../src/engine/state";
import { mulberry32 } from "../../src/engine/rng";

describe("rollTurnOrder", () => {
  it("returns a permutation of the seats, highest opening roll first", () => {
    const { order, rounds } = rollTurnOrder([0, 1, 2, 3], mulberry32(5));
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect(rounds[0]!.length).toBe(4);
    const r0 = new Map(rounds[0]!.map((x) => [x.seat, x.roll]));
    const maxRoll = Math.max(...rounds[0]!.map((x) => x.roll));
    expect(r0.get(order[0]!)).toBe(maxRoll); // whoever goes first had the top opening roll
  });

  it("is deterministic for a given seed", () => {
    expect(rollTurnOrder([0, 1, 2], mulberry32(9)).order).toEqual(rollTurnOrder([0, 1, 2], mulberry32(9)).order);
  });
});

describe("createInitialGame roll-off", () => {
  const seats = [{ uid: "u0", name: "Ann" }, { uid: "u1", name: "Bob" }, { uid: "u2", name: "Cy" }];

  it("with rollOff: orders turns by the roll, records the reveal + log, active = first", () => {
    const g = createInitialGame(seats, mulberry32(3), { rollOff: true });
    expect([...g.seatOrder].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(g.turn.activeSeat).toBe(g.seatOrder[0]);
    expect(g.orderReveal!.order).toEqual(g.seatOrder);
    expect((g.log ?? []).some((e) => e.k === "order")).toBe(true);
  });

  it("without rollOff: natural seat order (for deterministic tests)", () => {
    const g = createInitialGame(seats, mulberry32(3));
    expect(g.seatOrder).toEqual([0, 1, 2]);
    expect(g.orderReveal).toBeNull();
  });
});
