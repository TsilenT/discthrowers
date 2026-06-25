import type { CardHandler } from "../registry";
import type { CardContext } from "../ctx";
import { fellStandingTree, skipTurn, wipeAllHelp } from "../primitives";

export const sasquatchHandlers: Record<string, CardHandler> = {
  /** Sasquatch Rampage: wipe help, everyone discards hand, set redrawTo=4 for all. */
  "sasquatch-rampage": {
    isPlayable(_ctx: CardContext): boolean {
      return true;
    },
    play(ctx: CardContext): void {
      const s = ctx.state;
      wipeAllHelp(s);
      for (const p of Object.values(s.players)) {
        // Discard all hand cards
        while (p.hand.length > 0) {
          s.redDiscard.push(p.hand.pop()!);
        }
        // Set redrawTo=4 for all players
        p.redrawTo = 4;
      }
    },
  },

  /** Sasquatch Sighting: wipe help, each other player rolls a die — 1/2/3 -> skipTurn. */
  "sasquatch-sighting": {
    isPlayable(_ctx: CardContext): boolean {
      return true;
    },
    play(ctx: CardContext): void {
      const s = ctx.state;
      wipeAllHelp(s);
      for (const seat of s.seatOrder) {
        if (seat === ctx.actorSeat) continue;
        const roll = ctx.rng.nextInt(6) + 1;
        if (roll <= 3) {
          skipTurn(s, seat);
        }
      }
    },
  },

  /** That Darn Sasquatch: wipe help, discard all equipment AND axes from all players. */
  "that-darn-sasquatch": {
    isPlayable(_ctx: CardContext): boolean {
      return true;
    },
    play(ctx: CardContext): void {
      const s = ctx.state;
      wipeAllHelp(s);
      for (const p of Object.values(s.players)) {
        // Discard axe
        if (p.axe !== null) {
          s.redDiscard.push(p.axe);
          p.axe = null;
        }
        // Discard all non-axe equipment
        while (p.equipment.length > 0) {
          s.redDiscard.push(p.equipment.pop()!);
        }
      }
    },
  },

  /** Sasquatch Mating Season: wipe help, target loses next turn, M2: take target's tree if actor has none. */
  "sasquatch-mating-season": {
    isPlayable(ctx: CardContext): boolean {
      if (ctx.target === undefined) return false;
      if (ctx.target === ctx.actorSeat) return false;
      return !!ctx.state.players[ctx.target];
    },
    play(ctx: CardContext): void {
      const s = ctx.state;
      wipeAllHelp(s);
      const targetSeat = ctx.target!;
      skipTurn(s, targetSeat);
      // M2: Take target's standing tree if actor has none (chops come with it)
      const actor = s.players[ctx.actorSeat]!;
      const target = s.players[targetSeat]!;
      if (actor.standingTree === null && target.standingTree !== null) {
        actor.standingTree = target.standingTree;
        target.standingTree = null;
      }
    },
  },

  /** Paul Bunyan: wipe help, fell and score every standing tree for every player. */
  "paul-bunyan": {
    isPlayable(_ctx: CardContext): boolean {
      return true;
    },
    play(ctx: CardContext): void {
      const s = ctx.state;
      wipeAllHelp(s);
      for (const seat of s.seatOrder) {
        fellStandingTree(s, seat);
      }
    },
  },
};
