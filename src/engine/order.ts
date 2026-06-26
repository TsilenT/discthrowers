import type { Rng } from "./rng";

export interface OrderRoll {
  seat: number;
  roll: number;
}

/**
 * Opening roll-off ("First Logger"): every seat rolls a single die and the turn order
 * runs highest → lowest. Ties re-roll only within the tied group (recursively), so a
 * tie-break never reorders seats that weren't tied. Every roll is recorded in `rounds`
 * (index 0 is the opening round; later rounds contain only the seats that were tied).
 */
export function rollTurnOrder(seats: number[], rng: Rng): { order: number[]; rounds: OrderRoll[][] } {
  const rounds: OrderRoll[][] = [];
  const order = resolve(seats, rng, rounds);
  return { order, rounds };
}

function resolve(seats: number[], rng: Rng, rounds: OrderRoll[][]): number[] {
  const d6 = () => 1 + rng.nextInt(6);
  const rolls: OrderRoll[] = seats.map((seat) => ({ seat, roll: d6() }));
  rounds.push(rolls);
  const byRoll = new Map<number, number[]>();
  for (const r of rolls) byRoll.set(r.roll, [...(byRoll.get(r.roll) ?? []), r.seat]);
  const order: number[] = [];
  for (const roll of [...byRoll.keys()].sort((a, b) => b - a)) { // highest first
    const group = byRoll.get(roll)!;
    if (group.length === 1) order.push(group[0]!);
    else order.push(...resolve(group, rng, rounds)); // tie-break: permutes only this group
  }
  return order;
}
