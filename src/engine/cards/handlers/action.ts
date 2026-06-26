import type { CardHandler } from "../registry";
import type { CardContext } from "../ctx";
import { destroyStandingTree, discardTableauCard, skipTurn } from "../primitives";

export const actionHandlers: Record<string, CardHandler> = {
  /** Axe Break: discard target's axe. Not playable on Titanium Axe. */
  "axe-break": {
    isPlayable(ctx: CardContext): boolean {
      if (ctx.target === undefined) return false;
      const targetP = ctx.state.players[ctx.target];
      if (!targetP || targetP.axe === null) return false;
      // Titanium Axe is immune
      if (targetP.axe === "titanium-axe") return false;
      return true;
    },
    play(ctx: CardContext): void {
      const targetP = ctx.state.players[ctx.target!]!;
      ctx.state.redDiscard.push(targetP.axe!);
      targetP.axe = null;
    },
  },

  /** Beavers: destroy one target's standing tree (no score). */
  "beavers": {
    isPlayable(ctx: CardContext): boolean {
      if (ctx.target === undefined) return false;
      const targetP = ctx.state.players[ctx.target];
      return !!targetP && targetP.standingTree !== null;
    },
    play(ctx: CardContext): void {
      destroyStandingTree(ctx.state, ctx.target!);
    },
  },

  /** Forest Fire: destroy all standing trees (no score). */
  "forest-fire": {
    isPlayable(_ctx: CardContext): boolean {
      return true;
    },
    play(ctx: CardContext): void {
      for (const seat of ctx.state.seatOrder) {
        destroyStandingTree(ctx.state, seat);
      }
    },
  },

  /** Steal Axe: take target's axe; if actor had one, discard it. */
  "steal-axe": {
    isPlayable(ctx: CardContext): boolean {
      if (ctx.target === undefined) return false;
      const targetP = ctx.state.players[ctx.target];
      return !!targetP && targetP.axe !== null;
    },
    play(ctx: CardContext): void {
      const s = ctx.state;
      const actor = s.players[ctx.actorSeat]!;
      const targetP = s.players[ctx.target!]!;
      const stolenAxe = targetP.axe!;
      targetP.axe = null;
      if (actor.axe !== null) {
        s.redDiscard.push(actor.axe);
      }
      actor.axe = stolenAxe;
    },
  },

  /**
   * Steal Equipment: take an Equipment card from the target. An Axe IS an Equipment
   * card, so this can steal the axe too (preferred when present, since Steal Axe is a
   * separate card and the axe is the impactful grab). Otherwise take the first gear.
   * No doubles / one-axe-at-a-time: discard the actor's existing copy/axe as needed.
   */
  "steal-equipment": {
    isPlayable(ctx: CardContext): boolean {
      if (ctx.target === undefined) return false;
      const targetP = ctx.state.players[ctx.target];
      return !!targetP && (targetP.axe !== null || targetP.equipment.length > 0);
    },
    play(ctx: CardContext): void {
      const s = ctx.state;
      const actor = s.players[ctx.actorSeat]!;
      const targetP = s.players[ctx.target!]!;
      if (targetP.axe !== null) {
        // Steal the axe — one axe at a time: discard the actor's current axe first.
        const stolen = targetP.axe;
        targetP.axe = null;
        if (actor.axe !== null) s.redDiscard.push(actor.axe);
        actor.axe = stolen;
        return;
      }
      // Otherwise take the first non-axe gear.
      const stolen = targetP.equipment.shift()!;
      const existingIdx = actor.equipment.indexOf(stolen);
      if (existingIdx !== -1) { actor.equipment.splice(existingIdx, 1); s.redDiscard.push(stolen); } // no doubles
      actor.equipment.push(stolen);
    },
  },

  /** Tree Hugger: target loses their next turn. */
  "tree-hugger": {
    isPlayable(ctx: CardContext): boolean {
      if (ctx.target === undefined) return false;
      if (ctx.target === ctx.actorSeat) return false;
      return !!ctx.state.players[ctx.target];
    },
    play(ctx: CardContext): void {
      skipTurn(ctx.state, ctx.target!);
    },
  },

  /** Lure Help: move a non-Babe help card from target to actor. Cannot take Babe. */
  "lure-help": {
    isPlayable(ctx: CardContext): boolean {
      if (ctx.target === undefined) return false;
      const targetP = ctx.state.players[ctx.target];
      if (!targetP) return false;
      // Target must have at least one non-Babe help card
      return targetP.help.some((h) => h !== "babe");
    },
    play(ctx: CardContext): void {
      const actor = ctx.state.players[ctx.actorSeat]!;
      const targetP = ctx.state.players[ctx.target!]!;
      // Take first non-Babe help card
      const idx = targetP.help.findIndex((h) => h !== "babe");
      if (idx !== -1) {
        const card = targetP.help.splice(idx, 1)[0]!;
        actor.help.push(card);
        // Long Saw & Partner sidelines its holder's axe — move that state with the card.
        if (card === "long-saw-and-partner") {
          targetP.axeSetAside = false;
          actor.axeSetAside = true;
        }
      }
    },
  },

  /** Babe Biscuit: move Babe from another player or from discard to actor. */
  "babe-biscuit": {
    isPlayable(ctx: CardContext): boolean {
      const s = ctx.state;
      const actor = s.players[ctx.actorSeat]!;
      // Actor can't already have Babe
      if (actor.help.includes("babe")) return false;
      // Check if Babe is available: in another player's help or in redDiscard
      for (const [seatKey, p] of Object.entries(s.players)) {
        if (Number(seatKey) === ctx.actorSeat) continue;
        if (p.help.includes("babe")) return true;
      }
      return s.redDiscard.includes("babe");
    },
    play(ctx: CardContext): void {
      const s = ctx.state;
      const actor = s.players[ctx.actorSeat]!;
      // Prefer taking from another player first
      for (const [seatKey, p] of Object.entries(s.players)) {
        if (Number(seatKey) === ctx.actorSeat) continue;
        const idx = p.help.indexOf("babe");
        if (idx !== -1) {
          p.help.splice(idx, 1);
          actor.help.push("babe");
          return;
        }
      }
      // Else take from discard
      const discardIdx = s.redDiscard.indexOf("babe");
      if (discardIdx !== -1) {
        s.redDiscard.splice(discardIdx, 1);
        actor.help.push("babe");
      }
    },
  },

  /**
   * Switch Tags: swap the first scored tree of actor and target.
   * Speed Climb points are NOT trees and are never touched.
   * Reactable by paperwork (handled upstream in the reaction flow).
   */
  "switch-tags": {
    isPlayable(ctx: CardContext): boolean {
      if (ctx.target === undefined) return false;
      if (ctx.target === ctx.actorSeat) return false;
      const actor = ctx.state.players[ctx.actorSeat];
      const targetP = ctx.state.players[ctx.target];
      if (!actor || !targetP) return false;
      return actor.scoredTrees.length >= 1 && targetP.scoredTrees.length >= 1;
    },
    play(ctx: CardContext): void {
      const actor = ctx.state.players[ctx.actorSeat]!;
      const targetP = ctx.state.players[ctx.target!]!;
      // Swap the first scored tree of each player
      const actorFirst = actor.scoredTrees[0]!;
      const targetFirst = targetP.scoredTrees[0]!;
      actor.scoredTrees[0] = targetFirst;
      targetP.scoredTrees[0] = actorFirst;
    },
  },

  /**
   * Give Me a Hand: persists in the actor's equipment (as a persistent tableau card).
   * Records a { bySeat: actorSeat } entry on the TARGET player's giveMeAHand array.
   *
   * Persistence approach: the handler places the card into actor.equipment instead of
   * returning it to the hand or letting it auto-discard. The resolve path in apply.ts
   * special-cases "give-me-a-hand" to skip auto-discard after play() runs.
   *
   * Consumed on the target's next chop: the hijack mechanic in apply.ts chop case
   * removes the entry and discards the card from the by-player's equipment.
   */
  "give-me-a-hand": {
    isPlayable(ctx: CardContext): boolean {
      if (ctx.target === undefined) return false;
      if (ctx.target === ctx.actorSeat) return false;
      return !!ctx.state.players[ctx.target];
    },
    play(ctx: CardContext): void {
      const actor = ctx.state.players[ctx.actorSeat]!;
      const targetP = ctx.state.players[ctx.target!]!;
      // Record on the target that the actor has Give Me a Hand pointed at them
      targetP.giveMeAHand.push({ bySeat: ctx.actorSeat });
      // Persist the card in the actor's equipment (NOT auto-discarded)
      actor.equipment.push("give-me-a-hand");
    },
  },
};
