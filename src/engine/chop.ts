export interface ChopResult { chops: number; axeBreaks: boolean; }

export function resolveChop(dice: number[]): ChopResult {
  let chops = 0, lowCount = 0;
  for (const d of dice) {
    if (d >= 4) chops++;
    else if (d <= 2) lowCount++;
    // d === 3 -> miss, nothing
  }
  return { chops, axeBreaks: lowCount >= 3 };
}

export function rollDice(n: number, rng: { nextInt(m: number): number }): number[] {
  const out: number[] = [];
  for (let i = 0; i < Math.max(0, n); i++) out.push(rng.nextInt(6) + 1);
  return out;
}
