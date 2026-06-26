import { resolveChop, rollDice } from "./chop";
import { cardCategory, redCard, treeStats } from "./cards/catalog";
import { getHandler } from "./cards/registry";
import { reactionHandlers } from "./cards/handlers/reaction";
import type { CardContext } from "./cards/ctx";
import { collectChopDice, consumePlusMinusAfterRoll, plusMinusTotal } from "./dice";
import type { Rng } from "./rng";
import { isReactable, eligibleReactors, stoppersFor } from "./reactions";
import { WIN_SCORE, type Action, type ApplyResult, type CardId, type GameState, type LogEntry, type PlayerState, type Seat } from "./types";

const clone = (s: GameState): GameState => structuredClone(s);
const fail = (error: string): ApplyResult => ({ ok: false, error });

function active(s: GameState) { return s.players[s.turn.activeSeat]!; }

/** Append an event-log entry, capping the log so it can't grow unbounded. */
function pushLog(s: GameState, entry: LogEntry): void {
  const log = (s.log ??= []);
  log.push(entry);
  if (log.length > 80) s.log = log.slice(-80);
}

function scoreOf(p: { scoredTrees: string[]; speedClimbPoints: number }): number {
  let total = p.speedClimbPoints;
  for (const t of p.scoredTrees) total += treeStats(t).treeScore;
  return total;
}

/**
 * Returns true if any card in the given seat's hand has a handler whose isPlayable returns true.
 * For targeted cards, iterates all OTHER seats as candidate targets.
 * For self/no-target cards, tests with no target.
 * Axe cards are always playable (axe handler returns true).
 */
function anyPlayable(state: GameState, seat: Seat, rng: Rng): boolean {
  const p = state.players[seat]!;
  for (const card of p.hand) {
    const handler = getHandler(card);
    // Build a base context with no target to test self/no-target cards
    const ctxNoTarget: CardContext = { state, actorSeat: seat, rng };
    if (handler.isPlayable(ctxNoTarget)) return true;
    // For targeted cards, iterate all other seats
    for (const otherSeat of state.seatOrder) {
      if (otherSeat === seat) continue;
      const ctxWithTarget: CardContext = { state, actorSeat: seat, target: otherSeat, rng };
      if (handler.isPlayable(ctxWithTarget)) return true;
    }
  }
  return false;
}

/**
 * Check if the active player's standing tree has reached its chop target.
 * If so, fell it (score + return chops + discard tree) and check for a win.
 * Returns true if a win was set (caller should return immediately).
 */
function checkFellAndWin(s: GameState, seat: number): boolean {
  const p = s.players[seat] as PlayerState;
  const tree = p.standingTree;
  if (!tree) return false;
  const { chopTarget } = treeStats(tree.treeId);
  if (tree.chops < chopTarget) return false;
  s.chopStockpile += tree.chops;
  s.treeDiscard.push(tree.treeId);
  p.scoredTrees.push(tree.treeId);
  pushLog(s, { k: "timber", seat, tree: tree.treeId });
  p.standingTree = null;
  if (scoreOf(p) >= WIN_SCORE) {
    s.winner = seat;
    s.turn.phase = "gameOver";
    pushLog(s, { k: "win", seat });
    return true;
  }
  return false;
}

/**
 * Scan all seats for a winner after a card scores trees for arbitrary players
 * (e.g. Paul Bunyan fells and scores every standing tree). On ties the highest
 * total wins; remaining ties resolve to the lowest seat for now (the axe-throwing
 * contest tiebreak from the rules is deferred). Returns true if a winner was set.
 */
function checkAnyWin(s: GameState): boolean {
  let best: Seat | null = null;
  let bestScore = WIN_SCORE - 1;
  for (const seat of s.seatOrder) {
    const sc = scoreOf(s.players[seat]!);
    if (sc >= WIN_SCORE && sc > bestScore) { bestScore = sc; best = seat; }
  }
  if (best !== null) { s.winner = best; s.turn.phase = "gameOver"; pushLog(s, { k: "win", seat: best }); return true; }
  return false;
}

/**
 * DRY helper: resolve a played non-axe card's effect and handle post-play state.
 * Used by both the immediate play path (playCard when not reactable) and the
 * deferred path (passReaction when all reactors pass).
 *
 * Assumes:
 * - `card` has already been removed from the actor's hand
 * - `ctx` is built with the correct actorSeat/target/rng
 *
 * Mutates s. Does NOT bump version (caller does that).
 * Returns true if the game was won (caller should return early).
 */
function resolvePlayedCard(s: GameState, card: CardId, actorSeat: Seat, target: Seat | undefined, rng: Rng): boolean {
  const ctx: CardContext = target !== undefined
    ? { state: s, actorSeat, target, rng }
    : { state: s, actorSeat, rng };
  const handler = getHandler(card);
  handler.play(ctx);
  // Determine post-play card placement:
  // equipment/plus-minus/help/contest handlers place the card themselves
  // sasquatch/action handlers do NOT keep the card; discard to redDiscard
  const cat = cardCategory(card);
  if (cat === "sasquatch" || cat === "action") {
    // give-me-a-hand persists in the actor's equipment (placed there by its handler).
    // Skipping auto-discard for this card keeps it in the tableau until consumed on the
    // target's next chop.
    if (card !== "give-me-a-hand") {
      s.redDiscard.push(card);
    }
  }
  // contest: handler fully controls placement (may become plusMinus, axe, attached reminder, etc.)
  // reaction: only played via the react action, not here
  return checkAnyWin(s);
}

export function apply(state: GameState, action: Action, rng: Rng): ApplyResult {
  if (state.winner !== null) return fail("Game is over");
  const s = clone(state);
  const p = active(s);
  switch (action.type) {
    case "squareUp": {
      if (s.turn.phase !== "squareUp") return fail("Not the square-up phase");
      if (p.standingTree === null) {
        if (s.treeDeck.length === 0) { s.treeDeck = rng.shuffle(s.treeDiscard); s.treeDiscard = []; }
        const treeId = s.treeDeck.shift();
        if (treeId) p.standingTree = { treeId, chops: 0 };
      }
      s.turn.phase = "draw";
      s.version++;
      return { ok: true, state: s };
    }
    case "draw": {
      if (s.turn.phase !== "draw") return fail("Not the draw phase");
      const redrawTo = p.redrawTo ?? 1;
      // Normal: draw at least 1; after Rampage redrawTo=4 means draw until hand has 4
      const targetHandSize = Math.max(p.hand.length + 1, redrawTo);
      while (p.hand.length < targetHandSize) {
        if (s.redDeck.length === 0) {
          if (s.redDiscard.length === 0) break; // no cards available
          s.redDeck = rng.shuffle(s.redDiscard); s.redDiscard = [];
        }
        const card = s.redDeck.shift();
        if (card) p.hand.push(card);
      }
      p.redrawTo = 1; // reset after drawing
      s.turn.phase = "play";
      s.version++;
      return { ok: true, state: s };
    }
    case "playCard": {
      if (s.turn.phase !== "play") return fail("Not the play phase");
      const idx = p.hand.indexOf(action.card);
      if (idx === -1) return fail("Card not in hand");
      const card = action.card;
      // All cards (including axes) route through the handler registry so targeting,
      // "one axe at a time", and "no doubles" are enforced consistently.
      const activeSeat = s.turn.activeSeat;
      const ctx: CardContext = action.target !== undefined
        ? { state: s, actorSeat: activeSeat, target: action.target, rng }
        : { state: s, actorSeat: activeSeat, rng };
      const handler = getHandler(card);
      if (!handler.isPlayable(ctx)) return fail("That card is not playable in this situation");
      // Remove card from hand
      p.hand.splice(idx, 1);
      pushLog(s, action.target !== undefined
        ? { k: "play", seat: activeSeat, card, target: action.target }
        : { k: "play", seat: activeSeat, card });

      // Check if the card is reactable and there are eligible reactors
      const reactors = isReactable(card) ? eligibleReactors(s, activeSeat, card) : [];
      if (reactors.length > 0) {
        // Pause for reactions: set pendingReaction, stay in play phase
        const pending = {
          card,
          actorSeat: activeSeat,
          eligibleReactors: reactors,
          passed: [] as number[],
        };
        if (action.target !== undefined) {
          (pending as typeof pending & { target: number }).target = action.target;
        }
        s.pendingReaction = pending;
        s.version++;
        return { ok: true, state: s };
      }

      // No reactors — resolve immediately
      if (resolvePlayedCard(s, card, activeSeat, action.target, rng)) {
        s.version++;
        return { ok: true, state: s };
      }
      s.turn.phase = "chop";
      s.version++;
      return { ok: true, state: s };
    }
    case "discardCard": {
      if (s.turn.phase !== "play") return fail("Not the play phase");
      const idx = p.hand.indexOf(action.card);
      if (idx === -1) return fail("Card not in hand");
      // Mandatory-play rule: reject discard if any card in hand is playable
      if (anyPlayable(s, s.turn.activeSeat, rng)) {
        return fail("You must play a card if you can.");
      }
      p.hand.splice(idx, 1);
      s.redDiscard.push(action.card);
      pushLog(s, { k: "discard", seat: s.turn.activeSeat, card: action.card });
      s.turn.phase = "chop";
      s.version++;
      return { ok: true, state: s };
    }
    case "react": {
      // Validate: pendingReaction must exist
      const pr = s.pendingReaction;
      if (!pr) return fail("No pending reaction to respond to");
      // Validate: seat must be in eligibleReactors
      if (!pr.eligibleReactors.includes(action.seat)) return fail("Seat is not an eligible reactor");
      // Validate: seat must not have already passed
      if (pr.passed.includes(action.seat)) return fail("Seat has already passed");
      // Validate: the reactor must hold the card in their hand
      const reactor = s.players[action.seat]!;
      if (!reactor.hand.includes(action.card)) return fail("Reactor does not hold that card");
      // Validate: the card must be a stopper for the pending card
      if (!stoppersFor(pr.card).includes(action.card)) return fail("Card does not stop the pending card");

      // Cancel the pending card: discard it to redDiscard (no effect)
      s.redDiscard.push(pr.card);
      pushLog(s, { k: "react", seat: action.seat, card: action.card, stopped: pr.card });

      // Apply the reaction handler's side effect if any (e.g. northern-justice)
      const rh = reactionHandlers[action.card];
      if (rh?.onCancel) {
        rh.onCancel(s, pr.actorSeat);
      }

      // Reactor discards their reaction card and draws a replacement
      const cardIdx = reactor.hand.indexOf(action.card);
      reactor.hand.splice(cardIdx, 1);
      s.redDiscard.push(action.card);
      // Draw a replacement card
      if (s.redDeck.length === 0 && s.redDiscard.length > 1) {
        // Reshuffle discard (but keep the just-discarded cards available in the new deck)
        // Note: redDiscard already has the reactor's card; we draw from what's remaining
        // To avoid drawing the card just discarded, reshuffle everything
        s.redDeck = rng.shuffle([...s.redDiscard]);
        s.redDiscard = [];
      }
      if (s.redDeck.length > 0) {
        const drawn = s.redDeck.shift()!;
        reactor.hand.push(drawn);
      }

      // Clear pendingReaction and advance actor to chop
      s.pendingReaction = null;
      s.turn.phase = "chop";
      // activeSeat stays as the actor (the person who played the card)
      s.version++;
      return { ok: true, state: s };
    }
    case "passReaction": {
      // Validate: pendingReaction must exist
      const pr = s.pendingReaction;
      if (!pr) return fail("No pending reaction to pass");
      // Validate: seat must be in eligibleReactors
      if (!pr.eligibleReactors.includes(action.seat)) return fail("Seat is not an eligible reactor");
      // Validate: seat must not have already passed
      if (pr.passed.includes(action.seat)) return fail("Seat has already passed");

      // Record the pass
      pr.passed.push(action.seat);

      // Check if all eligible reactors have now passed
      const allPassed = pr.eligibleReactors.every((seat) => pr.passed.includes(seat));
      if (allPassed) {
        // Resolve the pending card normally (same code path as immediate play)
        const pendingCard = pr.card;
        const actorSeat = pr.actorSeat;
        const target = pr.target;
        s.pendingReaction = null;
        if (resolvePlayedCard(s, pendingCard, actorSeat, target, rng)) {
          s.version++;
          return { ok: true, state: s };
        }
        s.turn.phase = "chop";
      }
      // else: still waiting for other reactors, stay in play phase with pendingReaction set

      s.version++;
      return { ok: true, state: s };
    }
    case "chop": {
      if (s.turn.phase !== "chop") return fail("Not the chop phase");
      // Skip roll if: Northern Justice blocked this chop, OR Long Saw & Partner set axe aside,
      // OR no axe/no standing tree.
      if (p.cannotChopThisTurn || p.axeSetAside) {
        p.cannotChopThisTurn = false;
        s.turn.phase = "longSaw";
        s.version++;
        return { ok: true, state: s };
      }
      if (p.axe === null || p.standingTree === null) { s.turn.phase = "longSaw"; s.version++; return { ok: true, state: s }; }
      const n = collectChopDice(p);
      const dice = rollDice(n, rng);
      s.lastRoll = dice;

      // ── Give Me a Hand: hijack the first die ────────────────────────────────
      // For each giveMeAHand entry on this player, the first die of the roll is
      // "hijacked": if it's 4/5/6, add 1 chop to the BY-player's standing tree
      // (clamped to stockpile; check fell+win for that player). The hijacked die
      // STILL counts toward the target's break tally. The remaining dice score
      // normally for the target.
      //
      // M3 deterministic: one entry per play of give-me-a-hand; multiple entries
      // would consume the same first die — in practice there's usually only one.
      // We process the first entry only (it hijacks die[0]).
      let hijackedDieIdx = -1;
      if (p.giveMeAHand.length > 0 && dice.length > 0) {
        const entry = p.giveMeAHand[0]!;
        const hijackedDie = dice[0]!;
        hijackedDieIdx = 0;
        if (hijackedDie >= 4) {
          // Score 1 chop for the by-player's standing tree
          const byPlayer = s.players[entry.bySeat];
          if (byPlayer?.standingTree) {
            const gained = Math.min(1, s.chopStockpile);
            byPlayer.standingTree.chops += gained;
            s.chopStockpile -= gained;
            if (checkFellAndWin(s, entry.bySeat)) {
              // by-player won; clean up give-me-a-hand before returning
              p.giveMeAHand = [];
              const eqIdx = byPlayer.equipment.indexOf("give-me-a-hand");
              if (eqIdx !== -1) { byPlayer.equipment.splice(eqIdx, 1); s.redDiscard.push("give-me-a-hand"); }
              s.version++;
              return { ok: true, state: s };
            }
          }
        }
        // Cleanup: clear giveMeAHand entries and discard the card from by-player's equipment
        p.giveMeAHand = [];
        const byPlayer2 = s.players[entry.bySeat];
        if (byPlayer2) {
          const eqIdx = byPlayer2.equipment.indexOf("give-me-a-hand");
          if (eqIdx !== -1) { byPlayer2.equipment.splice(eqIdx, 1); s.redDiscard.push("give-me-a-hand"); }
        }
      }

      // ── Normal chop resolution ───────────────────────────────────────────────
      // All dice (including the hijacked one) count for the break tally.
      // The hijacked die does NOT count toward the TARGET's chop score if it was
      // 4/5/6 (it was credited to the by-player). If it was <4, it scores normally
      // for the target (miss or break count, not a chop).
      const { chops: rawChops, axeBreaks } = resolveChop(dice);
      // Subtract hijacked die's chop contribution from the target's score
      let targetChops = rawChops;
      if (hijackedDieIdx === 0 && dice[0]! >= 4) {
        targetChops = Math.max(0, rawChops - 1); // hijacked die's chop goes to by-player
      }
      const tree = p.standingTree;
      const gained = Math.min(targetChops, s.chopStockpile);
      tree.chops += gained;
      s.chopStockpile -= gained;
      consumePlusMinusAfterRoll(s, s.turn.activeSeat);
      if (checkFellAndWin(s, s.turn.activeSeat)) { s.version++; return { ok: true, state: s }; }
      const broke = axeBreaks && p.axe !== null;
      if (broke) { s.redDiscard.push(p.axe!); p.axe = null; }
      pushLog(s, { k: "chop", seat: s.turn.activeSeat, chops: gained, broke });
      s.turn.phase = "longSaw";
      s.version++;
      return { ok: true, state: s };
    }
    case "longSaw": {
      if (s.turn.phase !== "longSaw") return fail("Not the long-saw phase");
      const seat = s.turn.activeSeat;
      const hp = s.players[seat]!;
      // Long Saw & Partner is your chopping substitute: it rolls here (its own phase,
      // right after the chop), separate from the helper rolls (Apprentice/Babe).
      if (hp.help.includes("long-saw-and-partner")) {
        const base = (redCard("long-saw-and-partner").effect["manageHelpDice"] as number | undefined) ?? 5;
        // "Counts like a chopping roll for Plus/Minus cards" — scales then consumes them.
        const numDice = Math.max(0, base + plusMinusTotal(hp));
        const dice = rollDice(numDice, rng);
        s.lastRoll = dice;
        let chops = 0;
        for (const d of dice) { if (d >= 4) chops++; }
        const gained = hp.standingTree ? Math.min(chops, s.chopStockpile) : 0;
        if (gained > 0 && hp.standingTree) { hp.standingTree.chops += gained; s.chopStockpile -= gained; }
        consumePlusMinusAfterRoll(s, seat);
        pushLog(s, { k: "chop", seat, chops: gained, broke: false });
        if (checkFellAndWin(s, seat)) { s.version++; return { ok: true, state: s }; }
        // Pass right if 4+ of ITS OWN dice are breaks/misses.
        if (dice.filter((d) => d <= 3).length >= 4) {
          const idx = hp.help.indexOf("long-saw-and-partner");
          if (idx !== -1) hp.help.splice(idx, 1);
          hp.axeSetAside = false;
          const nextSeat = s.seatOrder[(s.seatOrder.indexOf(seat) + 1) % s.seatOrder.length]!;
          s.players[nextSeat]!.help.push("long-saw-and-partner");
          s.players[nextSeat]!.axeSetAside = true;
          pushLog(s, { k: "longSawPass", from: seat, to: nextSeat });
        }
      }
      s.turn.phase = "manageHelp";
      s.version++;
      return { ok: true, state: s };
    }
    case "manageHelp": {
      if (s.turn.phase !== "manageHelp") return fail("Not the manage-help phase");
      const seat = s.turn.activeSeat;
      const hp = s.players[seat]!;
      const helpDice: number[] = []; // surfaced via lastRoll so the UI shows helper rolls
      let helpChops = 0;
      for (const helpCard of hp.help) {
        // Long Saw & Partner rolls in its own (longSaw) phase, not here.
        if (helpCard === "long-saw-and-partner") continue;
        const numDice = (redCard(helpCard).effect["manageHelpDice"] as number | undefined) ?? 0;
        if (numDice <= 0) continue;
        const dice = rollDice(numDice, rng);
        helpDice.push(...dice);
        s.lastRoll = [...helpDice];
        let chops = 0;
        for (const d of dice) { if (d >= 4) chops++; }
        if (chops > 0 && hp.standingTree) {
          const gained = Math.min(chops, s.chopStockpile);
          hp.standingTree.chops += gained;
          s.chopStockpile -= gained;
          helpChops += gained;
          if (checkFellAndWin(s, seat)) { s.version++; return { ok: true, state: s }; }
        }
      }
      if (helpDice.length > 0) pushLog(s, { k: "help", seat, chops: helpChops });
      s.turn.phase = "end";
      s.version++;
      return { ok: true, state: s };
    }
    case "endTurn": {
      if (s.turn.phase !== "end") return fail("Not the end phase");
      // Clear cannotChopThisTurn on the current player before advancing
      p.cannotChopThisTurn = false;
      const order = s.seatOrder;
      let i = order.indexOf(s.turn.activeSeat);
      // Advance through seatOrder, skipping seats whose skipNextTurn is set.
      // When a seat is skipped its flag is cleared so it participates next round.
      // The loop is bounded by order.length to guarantee termination even if all
      // seats are flagged (in that degenerate case we wrap back to the current seat).
      for (let skipped = 0; skipped < order.length; skipped++) {
        i = (i + 1) % order.length;
        const candidate = s.players[order[i]!]!;
        if (candidate.skipNextTurn) {
          candidate.skipNextTurn = false; // clear flag; keep advancing
        } else {
          break; // found the next active seat
        }
      }
      s.turn = { activeSeat: order[i]!, phase: "squareUp" };
      s.lastRoll = []; // clear the previous turn's dice so the strip reflects the current turn
      pushLog(s, { k: "turn", seat: order[i]! });
      s.version++;
      return { ok: true, state: s };
    }
    default:
      return fail(`Unhandled action in phase ${s.turn.phase}`);
  }
}
