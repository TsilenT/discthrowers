/**
 * Task 5: Integration tests for Give Me a Hand.
 *
 * give-me-a-hand persists in the actor's equipment (acting as a persistent tableau).
 * It records on the TARGET player's giveMeAHand array.
 * On the TARGET's next chop, the first die is "hijacked": if 4/5/6 → chop goes to
 * the BY-player's standing tree. The hijacked die still counts in the target's break tally.
 * After the chop, giveMeAHand entries are cleared and the give-me-a-hand card is
 * discarded from the by-player's equipment to redDiscard.
 */
import { describe, it, expect } from "vitest";
import { getHandler } from "../../src/engine/cards/registry";
import type { CardContext } from "../../src/engine/cards/ctx";
import type { GameState, PlayerState } from "../../src/engine/types";
import { apply } from "../../src/engine/apply";
import { mulberry32 } from "../../src/engine/rng";

function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    uid: "u", name: "n", hand: [], axe: "carpenters-axe", equipment: [], plusMinus: [],
    help: [], standingTree: null, scoredTrees: [], speedClimbPoints: 0,
    skipNextTurn: false, redrawTo: 1, axeSetAside: false, giveMeAHand: [], cannotChopThisTurn: false,
    ...over,
  };
}

function game(players: Record<number, PlayerState>, extra: Partial<GameState> = {}): GameState {
  return {
    version: 0, players, seatOrder: Object.keys(players).map(Number),
    redDeck: [], redDiscard: [], treeDeck: [], treeDiscard: [],
    chopStockpile: 25,
    turn: { activeSeat: 0, phase: "play" },
    lastRoll: [], winner: null, pendingReaction: null,
    ...extra,
  };
}

function ctx(state: GameState, actorSeat: number, target?: number): CardContext {
  const rng = { nextFloat: () => 0, nextInt: () => 0, shuffle: <T>(a: T[]) => a };
  return target === undefined ? { state, actorSeat, rng } : { state, actorSeat, target, rng };
}

const ok = (r: ReturnType<typeof apply>) => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

// ── handler unit tests ─────────────────────────────────────────────────────────

describe("give-me-a-hand handler", () => {
  it("isPlayable: true when opponent target is given", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("give-me-a-hand").isPlayable(ctx(g, 0, 1))).toBe(true);
  });

  it("isPlayable: false when no target", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("give-me-a-hand").isPlayable(ctx(g, 0))).toBe(false);
  });

  it("isPlayable: false when targeting self", () => {
    const g = game({ 0: player(), 1: player() });
    expect(getHandler("give-me-a-hand").isPlayable(ctx(g, 0, 0))).toBe(false);
  });

  it("play: records bySeat entry on TARGET's giveMeAHand", () => {
    const g = game({ 0: player(), 1: player() });
    getHandler("give-me-a-hand").play(ctx(g, 0, 1));
    expect(g.players[1]!.giveMeAHand).toEqual([{ bySeat: 0 }]);
  });

  it("play: actor gets card into equipment (persists)", () => {
    const g = game({ 0: player(), 1: player() });
    getHandler("give-me-a-hand").play(ctx(g, 0, 1));
    expect(g.players[0]!.equipment).toContain("give-me-a-hand");
  });
});

// ── apply-level: playCard persists give-me-a-hand ─────────────────────────────

describe("give-me-a-hand via playCard", () => {
  it("playing give-me-a-hand keeps card in actor's equipment and does NOT discard it", () => {
    const s = ok(apply(game({
      0: player({ hand: ["give-me-a-hand"] }),
      1: player(),
    }), { type: "playCard", card: "give-me-a-hand", target: 1 }, mulberry32(1)));
    // Card stays in actor's equipment, NOT in redDiscard
    expect(s.players[0]!.equipment).toContain("give-me-a-hand");
    expect(s.redDiscard).not.toContain("give-me-a-hand");
    // Target has the entry
    expect(s.players[1]!.giveMeAHand).toEqual([{ bySeat: 0 }]);
    expect(s.turn.phase).toBe("chop");
  });
});

// ── apply-level: chop hijack mechanic ─────────────────────────────────────────

describe("give-me-a-hand: chop hijack", () => {
  /**
   * Scenario: seat 0 played give-me-a-hand on seat 1.
   * seat 1 is now chopping. seed 4 → dice=[6,2,2]
   *   - First die: 6 → hijacked chop for seat 0's tree
   *   - Die still counts for break tally: [6,2,2] → 2 breaks, no axe break
   *   - Target (seat 1) scores: dice[1..] [2,2] → 0 chops
   * After chop: seat 0's giveMeAHand card removed from equipment → redDiscard
   */
  it("first die 4+ hijacks chop to by-player's tree (seed 4 → first die=6)", () => {
    const initState: GameState = {
      version: 0,
      players: {
        // Seat 0 (by-player): has give-me-a-hand in equipment, has a standing tree
        0: player({ equipment: ["give-me-a-hand"], standingTree: { treeId: "tree-norway-pine", chops: 0 } }),
        // Seat 1 (target): has the giveMeAHand entry pointing to seat 0
        1: player({ axe: "carpenters-axe", standingTree: { treeId: "tree-red-oak", chops: 0 }, giveMeAHand: [{ bySeat: 0 }] }),
      },
      seatOrder: [0, 1],
      redDeck: [], redDiscard: [], treeDeck: [], treeDiscard: [],
      chopStockpile: 25,
      turn: { activeSeat: 1, phase: "chop" },
      lastRoll: [], winner: null, pendingReaction: null,
    };
    const s = ok(apply(initState, { type: "chop" }, mulberry32(4)));
    // By-player (seat 0) got 1 chop on their tree (die=6 was hijacked)
    expect(s.players[0]!.standingTree!.chops).toBe(1);
    // Target (seat 1): dice [6,2,2]; remaining dice for target = [2,2] → 0 chops
    // (The first die 6 was hijacked, so it doesn't add to the target's chops)
    expect(s.players[1]!.standingTree!.chops).toBe(0);
    // Axe intact: 2 breaks (2,2 out of [6,2,2]) → not 3, no break
    expect(s.players[1]!.axe).toBe("carpenters-axe");
    // Cleanup: giveMeAHand cleared on target
    expect(s.players[1]!.giveMeAHand).toEqual([]);
    // give-me-a-hand card discarded from by-player's equipment
    expect(s.players[0]!.equipment).not.toContain("give-me-a-hand");
    expect(s.redDiscard).toContain("give-me-a-hand");
    expect(s.turn.phase).toBe("manageHelp");
  });

  it("first die < 4 → no hijack chop (seed 9 → first die=2)", () => {
    // seed 9: dice=[2,6,1] for 3-die chop
    // first die=2 (<4) → no chop for by-player
    // target's dice [2,6,1]: 1 chop (die=6), 2 breaks (2,1) → no axe break
    // After: give-me-a-hand cleaned up anyway
    // Let's verify seed 9's output
    // mulberry32(9): nextInt(6)+1 -> need to compute
    // We'll use a manual rng to force first die = 3 (miss)
    const diceSequence = [3, 6, 4]; // first die=3 (miss), others = 6,4
    let callCount = 0;
    const riggedRng = {
      nextFloat: () => 0,
      nextInt: (_m: number) => {
        const die = diceSequence[callCount++]! - 1;
        return die; // returns die-1 because rollDice does nextInt(6)+1
      },
      shuffle: <T>(a: T[]) => a,
    };
    const initState: GameState = {
      version: 0,
      players: {
        0: player({ equipment: ["give-me-a-hand"], standingTree: { treeId: "tree-norway-pine", chops: 0 } }),
        1: player({ axe: "carpenters-axe", standingTree: { treeId: "tree-red-oak", chops: 0 }, giveMeAHand: [{ bySeat: 0 }] }),
      },
      seatOrder: [0, 1],
      redDeck: [], redDiscard: [], treeDeck: [], treeDiscard: [],
      chopStockpile: 25,
      turn: { activeSeat: 1, phase: "chop" },
      lastRoll: [], winner: null, pendingReaction: null,
    };
    const s = ok(apply(initState, { type: "chop" }, riggedRng));
    // By-player: no chop (first die was 3 = miss)
    expect(s.players[0]!.standingTree!.chops).toBe(0);
    // Target: dice [3,6,4] → 2 chops (6,4); 0 breaks → no axe break
    // All 3 dice count for target's chop score (first die miss → 0 contribution from first die)
    // Wait: hijack only happens if first die is 4/5/6. Since it's 3, no hijack.
    // Target scores: [3,6,4] → dice 6 and 4 both chop → 2 chops
    expect(s.players[1]!.standingTree!.chops).toBe(2);
    // Cleanup still happens
    expect(s.players[1]!.giveMeAHand).toEqual([]);
    expect(s.players[0]!.equipment).not.toContain("give-me-a-hand");
    expect(s.redDiscard).toContain("give-me-a-hand");
  });

  it("hijacked die STILL counts toward target's break tally (seed 4: [6,2,2] → 2 breaks, no break)", () => {
    // seed 4: [6,2,2] → 2 breaks (2,2) from remaining, but we verify axe intact
    // Also the 6 itself is not a break die. Total break dice: 2 (not 3) → axe intact.
    const initState: GameState = {
      version: 0,
      players: {
        0: player({ equipment: ["give-me-a-hand"], standingTree: { treeId: "tree-norway-pine", chops: 0 } }),
        1: player({ axe: "carpenters-axe", standingTree: { treeId: "tree-red-oak", chops: 0 }, giveMeAHand: [{ bySeat: 0 }] }),
      },
      seatOrder: [0, 1],
      redDeck: [], redDiscard: [], treeDeck: [], treeDiscard: [],
      chopStockpile: 25,
      turn: { activeSeat: 1, phase: "chop" },
      lastRoll: [], winner: null, pendingReaction: null,
    };
    const s = ok(apply(initState, { type: "chop" }, mulberry32(4)));
    // Axe intact: all 3 dice [6,2,2] count for break tally → 2 breaks, not 3 → no axe break
    expect(s.players[1]!.axe).toBe("carpenters-axe");
  });

  it("hijacked die causes axe break when all 3 dice count toward 3+ breaks/misses", () => {
    // Rig dice as [2, 1, 1] → first die=2 (hijacked, <4, no chop for by-player)
    // But all 3 count for break tally: [2,1,1] → 3 breaks → axe breaks
    const diceSequence = [2, 1, 1];
    let callCount = 0;
    const riggedRng = {
      nextFloat: () => 0,
      nextInt: (_m: number) => diceSequence[callCount++]! - 1,
      shuffle: <T>(a: T[]) => a,
    };
    const initState: GameState = {
      version: 0,
      players: {
        0: player({ equipment: ["give-me-a-hand"], standingTree: null }),
        1: player({ axe: "carpenters-axe", standingTree: { treeId: "tree-red-oak", chops: 0 }, giveMeAHand: [{ bySeat: 0 }] }),
      },
      seatOrder: [0, 1],
      redDeck: [], redDiscard: [], treeDeck: [], treeDiscard: [],
      chopStockpile: 25,
      turn: { activeSeat: 1, phase: "chop" },
      lastRoll: [], winner: null, pendingReaction: null,
    };
    const s = ok(apply(initState, { type: "chop" }, riggedRng));
    // Axe broken (3 breaks from [2,1,1])
    expect(s.players[1]!.axe).toBeNull();
    expect(s.redDiscard).toContain("carpenters-axe");
  });

  it("hijack can trigger by-player win when chop fells their tree", () => {
    // By-player needs 1 more chop to win (tree at chopTarget-1).
    // First die = 4+ → 1 chop goes to by-player's tree → fells it → win!
    // by-player: tree-norway-pine (chopTarget=4, treeScore=4), chops=3, scoredTrees=[12 + 4 = 16 pts already]
    // Wait, need by-player to already have enough to win upon felling:
    // norway-pine = 4pts. by-player needs 21pts. Let them have 17pts already + felling gives 4 = 21.
    // 17pts: tree-silver-maple(8)+tree-red-oak(7)+tree-river-birch(5-3=?)... Let's use a simpler approach:
    // by-player has scored trees worth 17: e.g. [tree-silver-maple(8), tree-cottonwood(6x2=12)] wait...
    // cottonwood=6pts. silver-maple=8pts. 8+6+3(from somewhere)...
    // Let's just use: scoredTrees giving 17pts = [tree-american-elm(8), tree-red-oak(7), tree-norway-pine(4)-2=?
    // Actually: 8+7+2 doesn't work cleanly. Let's use 8+7=15 and a remaining pine=4 → no, 15+4=19.
    // Try: tree-mighty-oak(12)+tree-cottonwood(6)=18. Then felling tree-norway-pine(4)=22 → still over 21.
    // Wait we just need >=21: 18+4=22 >= 21 → win!
    const diceSequence = [5, 1, 1]; // first die=5 (hijacked chop for by-player)
    let callCount = 0;
    const riggedRng = {
      nextFloat: () => 0,
      nextInt: (_m: number) => diceSequence[callCount++]! - 1,
      shuffle: <T>(a: T[]) => a,
    };
    const initState: GameState = {
      version: 0,
      players: {
        // By-player: 18 pts scored, needs 1 more chop on norway-pine to score 4 more → 22 >= 21 → WIN
        0: player({
          equipment: ["give-me-a-hand"],
          scoredTrees: ["tree-mighty-oak", "tree-cottonwood"],  // 12+6=18 pts
          standingTree: { treeId: "tree-norway-pine", chops: 3 }, // chopTarget=4, needs 1 more
        }),
        // Target (seat 1): has the entry
        1: player({ axe: "carpenters-axe", standingTree: { treeId: "tree-red-oak", chops: 0 }, giveMeAHand: [{ bySeat: 0 }] }),
      },
      seatOrder: [0, 1],
      redDeck: [], redDiscard: [], treeDeck: [], treeDiscard: [],
      chopStockpile: 25,
      turn: { activeSeat: 1, phase: "chop" },
      lastRoll: [], winner: null, pendingReaction: null,
    };
    const s = ok(apply(initState, { type: "chop" }, riggedRng));
    // By-player wins!
    expect(s.winner).toBe(0);
    expect(s.turn.phase).toBe("gameOver");
  });
});
