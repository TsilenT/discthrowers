import type { CardHandler } from "../registry";
import type { CardContext } from "../ctx";
import { skipTurn, wipeAllHelp } from "../primitives";

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
      const rolls: { seat: number; roll: number; failed: boolean }[] = [];
      const failed: number[] = [];
      for (const seat of s.seatOrder) {
        if (seat === ctx.actorSeat) continue;
        const roll = ctx.rng.nextInt(6) + 1;
        const isFail = roll <= 3;
        rolls.push({ seat, roll, failed: isFail });
        if (isFail) { skipTurn(s, seat); failed.push(seat); }
      }
      s.lastSighting = { actor: ctx.actorSeat, rolls };
      (s.log ??= []).push({ k: "sighting", actor: ctx.actorSeat, failed });
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
      // Optionally take the target's standing basket (its chops come with it). If you
      // take it and already had a basket, your old one is discarded (chops returned).
      const actor = s.players[ctx.actorSeat]!;
      const target = s.players[targetSeat]!;
      if (ctx.takeBasket && target.standingTree !== null) {
        if (actor.standingTree !== null) {
          s.chopStockpile += actor.standingTree.chops;
          s.treeDiscard.push(actor.standingTree.treeId);
        }
        actor.standingTree = target.standingTree;
        target.standingTree = null;
      }
    },
  },
};
