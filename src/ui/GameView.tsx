import { useEffect, useRef, useState } from "react";
import { useGame } from "../state/GameProvider";
import { treeStats, isAxe } from "../engine";
import { getHandler } from "../engine/cards/registry";
import { cardCategory, baseChopDice, manageHelpDice } from "../engine/cards/catalog";
import { cardDiceModifier } from "../engine/dice";
import { stoppersFor } from "../engine/reactions";
import { getTheme, DEFAULT_THEME } from "../content";
import { Dice, RollingDie } from "./Dice";
import type { ThemeContent } from "../content";
import type { CardContext } from "../engine/cards/ctx";
import type { GameState, PlayerState, Action, Seat, Phase, LogEntry } from "../engine/types";
import type { Rng } from "../engine/rng";

function playerScore(p: PlayerState): number {
  let total = p.speedClimbPoints;
  for (const treeId of p.scoredTrees) total += treeStats(treeId).treeScore;
  return total;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dummyRng: Rng = { nextFloat: () => 0, nextInt: () => 0, shuffle: (a: any[]) => a };

type PlayabilityResult = { mode: "self" | "target" | "axe" | "none"; legalTargets: Seat[]; canEquipSelf?: boolean };

function playability(cardId: string, actorSeat: Seat, state: GameState, seatOrder: Seat[]): PlayabilityResult {
  const handler = getHandler(cardId);
  const oppTargets = (): Seat[] => seatOrder.filter(
    (seat) => seat !== actorSeat && handler.isPlayable({ state, actorSeat, target: seat, rng: dummyRng } as CardContext),
  );
  // Discs: separate "Equip" (self) from "Play" (opponents only).
  if (isAxe(cardId)) {
    const canEquipSelf = handler.isPlayable({ state, actorSeat, rng: dummyRng });
    const legalTargets = oppTargets();
    if (!canEquipSelf && legalTargets.length === 0) return { mode: "none", legalTargets: [] };
    return { mode: "axe", canEquipSelf, legalTargets };
  }
  if (handler.isPlayable({ state, actorSeat, rng: dummyRng })) return { mode: "self", legalTargets: [] };
  const legalTargets = oppTargets();
  return legalTargets.length > 0 ? { mode: "target", legalTargets } : { mode: "none", legalTargets: [] };
}

const PHASE_INFO: Record<Phase, { title: string; hint: string; action?: string }> = {
  squareUp:   { title: "Tee up",        hint: "Set up the basket you'll be throwing at this turn.", action: "Tee up" },
  draw:       { title: "Draw a card",   hint: "Draw a card into your hand.", action: "Draw a card" },
  play:       { title: "Play a card",   hint: "Play a card from your hand — you must, if you can — or discard one." },
  chop:       { title: "Throw!",        hint: "Roll the dice. Each 4, 5 or 6 lands a throw on your basket.", action: "🎯 Throw!" },
  longSaw:    { title: "Tandem throw",  hint: "Roll with your partner (your driver is sidelined).", action: "🪚 Tandem throw" },
  manageHelp: { title: "Helpers throw", hint: "Roll the dice for your helper cards.", action: "Roll helpers" },
  end:        { title: "End turn",      hint: "Pass play to the next disc golfer.", action: "End turn" },
  gameOver:   { title: "Game over",     hint: "" },
};

function categoryLabel(id: string): string {
  try { return cardCategory(id).replace("-", "/"); } catch { return "card"; }
}

/** Compact icons for non-axe gear shown on the player strip. */
const GEAR_ICON: Record<string, string> = { gloves: "🧤", boots: "👟" };

/** Cards that open their own multi-step chooser instead of the generic target picker. */
function hasChooser(cardId: string): boolean {
  return cardId === "switch-tags" || cardId === "sasquatch-mating-season" || cardId === "steal-equipment";
}

function noOpAction(state: GameState): Action | null {
  const { turn, players } = state;
  const p = players[turn.activeSeat];
  if (!p) return null;
  switch (turn.phase) {
    case "squareUp":   return p.standingTree !== null ? { type: "squareUp" } : null;
    case "chop":       return (p.axe === null || p.standingTree === null || p.cannotChopThisTurn || p.axeSetAside) ? { type: "chop" } : null;
    case "longSaw":    return p.help.includes("long-saw-and-partner") ? null : { type: "longSaw" };
    case "manageHelp": return (p.standingTree === null || p.help.every((c) => c === "long-saw-and-partner")) ? { type: "manageHelp" } : null;
    default:           return null;
  }
}

export function GameView({ theme: themeProp }: { theme?: ThemeContent }) {
  const { state, dispatch, mySeat } = useGame();
  const { players, seatOrder, turn, lastRoll, winner } = state;
  const pending = state.pendingReaction;
  const theme: ThemeContent = themeProp ?? getTheme(DEFAULT_THEME);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [targetingCard, setTargetingCard] = useState<string | null>(null);
  const [tab, setTab] = useState<"hand" | "log">("hand");
  const [dismissedContest, setDismissedContest] = useState<string>("");
  const [dismissedSighting, setDismissedSighting] = useState<string>("");
  const [dismissedOrder, setDismissedOrder] = useState(false);
  const [scoreDetail, setScoreDetail] = useState<Seat | null>(null);
  const [inspectCard, setInspectCard] = useState<string | null>(null); // full-card inspector inside the detail popup
  const [swapUI, setSwapUI] = useState<{ mine: number; targetSeat: Seat | null; theirs: number } | null>(null);
  const [standoffUI, setStandoffUI] = useState<{ targetSeat: Seat | null; take: boolean } | null>(null);
  const [stealUI, setStealUI] = useState<{ targetSeat: Seat | null; item: string | null } | null>(null);
  const [winDismissed, setWinDismissed] = useState(false); // hide win overlay to look around at players/log
  // Juice: transient visual effects
  const [chains, setChains] = useState<{ seat: Seat; v: number } | null>(null);   // "I HEARD CHAINS!" burst
  const [breakSeat, setBreakSeat] = useState<{ seat: Seat; v: number } | null>(null); // driver-break shake
  const [scorePops, setScorePops] = useState<Record<number, { delta: number; v: number }>>({});
  const [exiting, setExiting] = useState<string | null>(null);                    // card play/discard exit motion

  const act = async (action: Action) => {
    setError(null);
    setTargetingCard(null);
    const result = await dispatch(action);
    if (!result.ok) setError(result.error);
  };
  // Play/discard with a brief exit animation on the card.
  const playMotion = (cardKey: string, action: Action) => {
    setExiting(cardKey);
    window.setTimeout(() => { setExiting(null); void act(action); }, 160);
  };

  const hotseat = mySeat === null;
  const activeName = players[turn.activeSeat]?.name ?? `Seat ${turn.activeSeat}`;
  const phase = PHASE_INFO[turn.phase];
  const canTakeTurn = pending === null && winner === null && (hotseat || turn.activeSeat === mySeat);

  // Keep the active player scrolled into view in the horizontal strip.
  const activeCardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    try { activeCardRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }
    catch { /* scrollIntoView unsupported (e.g. jsdom) — non-critical */ }
  }, [turn.activeSeat]);

  // Auto-advance phases the controlling player would just click through with no effect.
  const autoRef = useRef<string>("");
  useEffect(() => {
    if (!canTakeTurn) return;
    const auto = noOpAction(state);
    if (!auto) return;
    const key = `${state.version}:${turn.phase}`;
    if (autoRef.current === key) return;
    autoRef.current = key;
    void dispatch(auto);
  }, [state, canTakeTurn, turn.phase, dispatch]);

  const reactionSeat: Seat | null =
    pending === null ? null
      : hotseat ? (pending.eligibleReactors.find((s) => !pending.passed.includes(s)) ?? null)
      : (mySeat !== null && pending.eligibleReactors.includes(mySeat) && !pending.passed.includes(mySeat) ? mySeat : null);

  const handSeat: Seat | null = hotseat ? (pending !== null ? reactionSeat : turn.activeSeat) : mySeat;
  const handPlayer = handSeat !== null ? players[handSeat] : undefined;
  const canPlayNow = canTakeTurn && turn.phase === "play";
  // Mandatory-play rule: if any card in hand is playable, discarding is illegal → gray it out.
  const mustPlay = canPlayNow && !!handPlayer &&
    handPlayer.hand.some((c) => playability(c, turn.activeSeat, state, seatOrder).mode !== "none");

  const name = (seat: Seat) => players[seat]?.name ?? `Seat ${seat}`;
  // Gear Grab: everything a target player owns that can be swiped (driver + gear).
  const stealItemsOf = (seat: Seat): string[] => {
    const pl = players[seat];
    if (!pl) return [];
    return [...(pl.axe !== null ? [pl.axe] : []), ...pl.equipment];
  };
  const logText = (e: LogEntry): string => {
    switch (e.k) {
      case "turn": return `▶ ${name(e.seat)}’s turn`;
      case "play": return `${name(e.seat)} played ${theme.card(e.card).name}${e.target !== undefined ? ` on ${name(e.target)}` : ""}`;
      case "discard": return `${name(e.seat)} discarded ${theme.card(e.card).name}`;
      case "axeReplaced": return `${name(e.seat)} discarded ${theme.card(e.discarded).name} (replaced driver)`;
      case "chop": return `${name(e.seat)} threw — ${e.chops} landed (${e.dice} dice)${e.broke ? ", driver broke!" : ""}`;
      case "help": return `${name(e.seat)}’s helpers threw — ${e.chops} landed (${e.dice} dice)`;
      case "timber": return `🪣 ${name(e.seat)} sank ${theme.tree(e.tree).name}`;
      case "react": return `${name(e.seat)} countered ${theme.card(e.stopped).name} with ${theme.card(e.card).name}`;
      case "contest": return `${theme.card(e.card).name}: ${name(e.winner)} won the roll-off (${e.winnerRoll} vs ${e.loserRoll})`;
      case "longSawPass": return `↪ ${theme.card("long-saw-and-partner").name} passed from ${name(e.from)} to ${name(e.to)}`;
      case "assist": return `🤲 ${name(e.by)}’s ${theme.card("give-me-a-hand").name} on ${name(e.target)}’s throw — ${e.landed ? "landed a throw" : "whiffed"}`;
      case "sighting": { const f = e.failed ?? []; return `👀 ${theme.card("sasquatch-sighting").name} — ${f.length ? `${f.map(name).join(", ")} lose${f.length === 1 ? "s" : ""} a turn` : "everyone dodged it"}`; }
      case "order": return `🎲 Turn order: ${(e.order ?? []).map(name).join(" → ")}`;
      case "win": return `🏆 ${name(e.seat)} wins!`;
    }
  };

  // Watch the log + scores for new events → drive transient juice (dispute, chains, break, score pop).
  const seenLogLen = useRef<number | null>(null);
  const prevScores = useRef<Record<number, number> | null>(null);
  useEffect(() => {
    const log = state.log ?? [];
    const curScores: Record<number, number> = {};
    for (const s of seatOrder) curScores[s] = playerScore(players[s]!);
    if (seenLogLen.current === null) { // skip history on mount
      seenLogLen.current = log.length;
      prevScores.current = curScores;
      return;
    }
    if (log.length > seenLogLen.current) {
      const fresh = log.slice(seenLogLen.current);
      const last = <K extends LogEntry["k"]>(k: K) => [...fresh].reverse().find((e) => e.k === k);
      const r = last("react");
      if (r && r.k === "react") setNotice(`⚡ ${name(r.seat)} disputed ${theme.card(r.stopped).name} with ${theme.card(r.card).name}`);
      const t = last("timber");
      if (t && t.k === "timber") setChains({ seat: t.seat, v: state.version });
      const b = [...fresh].reverse().find((e) => e.k === "chop" && e.broke);
      if (b && b.k === "chop") setBreakSeat({ seat: b.seat, v: state.version });
    }
    seenLogLen.current = log.length;
    // Score pops: any seat whose total went up
    if (prevScores.current) {
      const pops: Record<number, { delta: number; v: number }> = {};
      for (const s of seatOrder) { const d = curScores[s]! - (prevScores.current[s] ?? 0); if (d > 0) pops[s] = { delta: d, v: state.version }; }
      if (Object.keys(pops).length) setScorePops(pops);
    }
    prevScores.current = curScores;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.version]);
  useEffect(() => { if (notice === null) return; const id = setTimeout(() => setNotice(null), 5000); return () => clearTimeout(id); }, [notice]);
  useEffect(() => { if (!chains) return; const id = setTimeout(() => setChains(null), 1600); return () => clearTimeout(id); }, [chains]);
  useEffect(() => { if (!breakSeat) return; const id = setTimeout(() => setBreakSeat(null), 700); return () => clearTimeout(id); }, [breakSeat]);
  useEffect(() => { if (!Object.keys(scorePops).length) return; const id = setTimeout(() => setScorePops({}), 1300); return () => clearTimeout(id); }, [scorePops]);

  const contest = state.lastContest ?? null;
  const contestKey = contest ? JSON.stringify(contest) : "";
  const showContest = contest !== null && contestKey !== dismissedContest;

  const sighting = state.lastSighting ?? null;
  const sightingKey = sighting ? JSON.stringify(sighting) : "";
  const showSighting = sighting !== null && !showContest && sightingKey !== dismissedSighting;

  const orderReveal = state.orderReveal ?? null;
  const showOrder = orderReveal !== null && !dismissedOrder && !showContest && !showSighting;

  return (
    <div className="game">
      {/* ---- Top: brand + animated dice --------------------------------- */}
      <header className="topbar">
        <div className="brand">🥏 Disc Throwers</div>
        <Dice roll={lastRoll} />
      </header>

      {error && <div className="toast toast-error" role="alert">{error}<button onClick={() => setError(null)} aria-label="Dismiss">✕</button></div>}
      {notice && (
        <div className="overlay" role="alert" onClick={() => setNotice(null)}>
          <div className="notice-card" onClick={(e) => e.stopPropagation()}>
            <div className="notice-emoji">⚡</div>
            <p>{notice}</p>
            <button className="btn btn-primary" onClick={() => setNotice(null)}>OK</button>
          </div>
        </div>
      )}

      {/* ---- Course: fixed-height horizontal strip of players ----------- */}
      <section className="board">
        <div className="players">
          {seatOrder.map((seat) => {
            const p = players[seat];
            if (!p) return null;
            const isActive = turn.activeSeat === seat;
            const isMe = !hotseat && mySeat === seat;
            const tree = p.standingTree;
            const td = tree ? theme.tree(tree.treeId) : null;
            const pct = td ? Math.min(100, Math.round((tree!.chops / td.chopTarget) * 100)) : 0;
            const ups = p.plusMinus.filter((id) => cardDiceModifier(id) > 0).length;
            const downs = p.plusMinus.filter((id) => cardDiceModifier(id) < 0).length;
            const gear = p.equipment.filter((id) => GEAR_ICON[id]);
            const generic = p.equipment.filter((id) => !GEAR_ICON[id]); // e.g. Disc Assist
            return (
              <div key={seat} ref={isActive ? activeCardRef : undefined}
                className={`player ${isActive ? "is-active" : ""} ${isMe ? "is-me" : ""} ${chains?.seat === seat ? "flash-chains" : ""} ${breakSeat?.seat === seat ? "flash-break" : ""}`}
                role="button" tabIndex={0} title="Tap for details"
                onClick={() => { setInspectCard(null); setScoreDetail(seat); }}
                onKeyDown={(e) => { if (e.key === "Enter") { setInspectCard(null); setScoreDetail(seat); } }}>
                <div className="player-top">
                  <span className="player-name">{p.name}{isMe ? " (you)" : ""}</span>
                  <span className={`player-score-num ${scorePops[seat] ? "score-pop" : ""}`}>
                    {playerScore(p)}
                    {scorePops[seat] && <span key={scorePops[seat]!.v} className="score-float">+{scorePops[seat]!.delta}</span>}
                  </span>
                </div>
                <div className="bar" title={td ? `${td.name} — ${tree!.chops}/${td.chopTarget}` : "no basket"}>
                  <div className="bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="basket-meta muted">{td ? `${tree!.chops}/${td.chopTarget} throws · ${td.treeScore} pts` : "no basket"}</div>
                <div className={`driver ${p.axe ? "" : "driver-off"}`} title="driver">
                  🥏 {p.axe ? theme.card(p.axe).name : "no driver"}
                </div>
                <div className="icons">
                  {gear.map((id, i) => <span key={`g${i}`} className="ic" title={theme.card(id).name}>{GEAR_ICON[id]}</span>)}
                  {ups > 0 && <span className="ic" title="power-ups">⚡{ups}</span>}
                  {downs > 0 && <span className="ic" title="power-downs">🔻{downs}</span>}
                  {generic.length > 0 && <span className="ic" title={generic.map((id) => theme.card(id).name).join(", ")}>🤲{generic.length}</span>}
                  {p.help.length > 0 && <span className="ic" title="helpers">🤝{p.help.length}</span>}
                  {p.skipNextTurn && <span className="ic" title="loses next turn">💤</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Tabbed panel: Hand | Log ----------------------------------- */}
      <section className="panel">
        <div className="tabs">
          <button className={`tab ${tab === "hand" ? "tab-on" : ""}`} onClick={() => setTab("hand")}>
            {hotseat && handPlayer ? `${handPlayer.name}’s hand` : "Hand"}{handPlayer ? ` (${handPlayer.hand.length})` : ""}
            {canPlayNow && <span className="dot" />}
          </button>
          <button className={`tab ${tab === "log" ? "tab-on" : ""}`} onClick={() => setTab("log")}>Log</button>
        </div>

        {tab === "hand" ? (
          <div className="panel-body">
            {!handPlayer ? (
              <p className="muted">No hand to show.</p>
            ) : handPlayer.hand.length === 0 ? (
              <p className="muted">No cards in hand.</p>
            ) : (
              <ul className="cards">
                {handPlayer.hand.map((cardId, idx) => {
                  const d = theme.card(cardId);
                  const key = `${cardId}-${idx}`;
                  const info = canPlayNow ? playability(cardId, turn.activeSeat, state, seatOrder) : null;
                  const targeting = targetingCard === key;
                  return (
                    <li key={key} className={`card cat-${categoryLabel(cardId).split("/")[0]} ${info?.mode === "none" ? "card-dim" : ""} ${exiting === key ? "card-exit" : ""}`}>
                      <div className="card-name">{d.name}</div>
                      <div className="card-cat">{categoryLabel(cardId)}</div>
                      {d.rulesText && <div className="card-text">{d.rulesText}</div>}
                      {canPlayNow && (
                        <div className="card-actions">
                          {/* Discs: Equip (self) leftmost, then Play ▸ to an opponent. */}
                          {info?.mode === "axe" && info.canEquipSelf && (
                            <button className="btn btn-primary btn-sm" onClick={() => playMotion(key, { type: "playCard", card: cardId })}>Equip</button>
                          )}
                          {info?.mode === "self" && (
                            <button className="btn btn-primary btn-sm" onClick={() => playMotion(key, { type: "playCard", card: cardId })}>Play</button>
                          )}
                          {/* Cards with an extra choice open their own chooser. */}
                          {cardId === "switch-tags" && info?.mode === "target" && (
                            <button className="btn btn-primary btn-sm"
                              onClick={() => setSwapUI({ mine: 0, targetSeat: info.legalTargets[0] ?? null, theirs: 0 })}>Swap ▸</button>
                          )}
                          {cardId === "sasquatch-mating-season" && info?.mode === "target" && (
                            <button className="btn btn-primary btn-sm"
                              onClick={() => setStandoffUI({ targetSeat: info.legalTargets[0] ?? null, take: false })}>Standoff ▸</button>
                          )}
                          {cardId === "steal-equipment" && info?.mode === "target" && (
                            <button className="btn btn-primary btn-sm"
                              onClick={() => {
                                const t = info.legalTargets[0] ?? null;
                                const items = t !== null ? stealItemsOf(t) : [];
                                setStealUI({ targetSeat: t, item: items[0] ?? null });
                              }}>Grab ▸</button>
                          )}
                          {!hasChooser(cardId) && (info?.mode === "target" || info?.mode === "axe") && info.legalTargets.length > 0 && !targeting && (
                            <button className="btn btn-sm" onClick={() => setTargetingCard(key)}>Play ▸</button>
                          )}
                          {!hasChooser(cardId) && (info?.mode === "target" || info?.mode === "axe") && info.legalTargets.length > 0 && targeting && (
                            <div className="targets">
                              <span className="muted">on:</span>
                              {info.legalTargets.map((t) => (
                                <button key={t} className="btn btn-sm" onClick={() => playMotion(key, { type: "playCard", card: cardId, target: t })}>
                                  {players[t]?.name ?? `Seat ${t}`}
                                </button>
                              ))}
                              <button className="btn btn-ghost btn-sm" onClick={() => setTargetingCard(null)}>✕</button>
                            </div>
                          )}
                          {info?.mode === "none" && <span className="muted card-na">can’t play now</span>}
                          <button className={`btn btn-sm ${mustPlay ? "btn-ghost" : "btn-primary"}`} disabled={mustPlay}
                            title={mustPlay ? "You must play a card if you can" : undefined}
                            onClick={() => playMotion(key, { type: "discardCard", card: cardId })}>Discard</button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <div className="panel-body">
            {(state.log ?? []).length === 0 ? (
              <p className="muted">No events yet.</p>
            ) : (
              <ul className="log">
                {[...(state.log ?? [])].slice().reverse().map((e, i) => (
                  <li key={i} className={`log-${e.k}`}>{logText(e)}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ---- Floating action bar (bottom) ------------------------------- */}
      <div className="actionbar">
        <div className="actionbar-inner">
          {pending !== null ? (
            <div className={`ab-reaction ${reactionSeat !== null ? "urgent" : ""}`}>
              <div className="ab-status">
                <span className="ab-title">⚡ {players[pending.actorSeat]?.name} played {theme.card(pending.card).name}{pending.target !== undefined && ` on ${players[pending.target]?.name}`}</span>
                {reactionSeat !== null
                  ? <span className="ab-hint">{theme.card(pending.card).rulesText} {hotseat ? `— ${players[reactionSeat]?.name}, counter it?` : "— counter it?"}</span>
                  : <span className="ab-hint">Waiting on {pending.eligibleReactors.filter((s) => !pending.passed.includes(s)).map((s) => players[s]?.name).join(", ") || "resolution"}…</span>}
              </div>
              {reactionSeat !== null && (
                <div className="ab-actions">
                  {players[reactionSeat]!.hand.filter((c) => stoppersFor(pending.card).includes(c)).map((cardId, idx) => (
                    <button key={`${cardId}-${idx}`} className="btn btn-primary" title={theme.card(cardId).rulesText}
                      onClick={() => void act({ type: "react", seat: reactionSeat, card: cardId })}>
                      Counter · {theme.card(cardId).name}
                    </button>
                  ))}
                  <button className="btn btn-ghost" onClick={() => void act({ type: "passReaction", seat: reactionSeat })}>Let it happen</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="ab-status">
                {winner !== null ? (
                  <span className="ab-title">Game over</span>
                ) : hotseat || turn.activeSeat === mySeat ? (
                  <>
                    <span className="ab-title">{hotseat ? `${activeName}’s turn` : "Your turn"} — {phase.title}</span>
                    <span className="ab-hint">{phase.hint}</span>
                  </>
                ) : (
                  <>
                    <span className="ab-title">Waiting for {activeName}</span>
                    <span className="ab-hint">{phase.title} · not your turn yet</span>
                  </>
                )}
              </div>
              <div className="ab-actions">
                {canTakeTurn && phase.action && (
                  <button className="btn btn-primary btn-lg" onClick={() => void act({ type: turn.phase === "end" ? "endTurn" : turn.phase } as Action)}>
                    {phase.action}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- Contest reveal popup --------------------------------------- */}
      {showContest && contest && (
        <div className="overlay" role="alert">
          <div className="contest-card">
            <h3>{theme.card(contest.card).name}</h3>
            <p className="muted">Roll-off</p>
            <div className="contest-rolls">
              <div className={`contest-side ${contest.winner === contest.challenger ? "won" : ""}`}>
                <div className="contest-name">{name(contest.challenger)}</div>
                <RollingDie value={contest.challengerRoll} outcome={contest.winner === contest.challenger ? "hit" : "low"} />
              </div>
              <div className="contest-vs">vs</div>
              <div className={`contest-side ${contest.winner === contest.opponent ? "won" : ""}`}>
                <div className="contest-name">{name(contest.opponent)}</div>
                <RollingDie value={contest.opponentRoll} outcome={contest.winner === contest.opponent ? "hit" : "low"} />
              </div>
            </div>
            <p className="contest-result">🏆 {name(contest.winner)} wins the roll-off</p>
            <button className="btn btn-primary btn-lg" onClick={() => setDismissedContest(contestKey)}>Continue</button>
          </div>
        </div>
      )}

      {/* ---- Hooligan Sighting roll-off popup --------------------------- */}
      {showSighting && sighting && (
        <div className="overlay" role="alert">
          <div className="contest-card">
            <h3>{theme.card("sasquatch-sighting").name}</h3>
            <p className="muted">{name(sighting.actor)} spooked the course — everyone else rolls (1–3 loses a turn)</p>
            <div className="contest-rolls">
              {sighting.rolls.map((r) => (
                <div key={r.seat} className={`contest-side ${r.failed ? "" : "won"}`}>
                  <div className="contest-name">{name(r.seat)}</div>
                  <RollingDie value={r.roll} outcome={r.failed ? "low" : "hit"} />
                  <div className="muted">{r.failed ? "loses turn" : "safe"}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-lg" onClick={() => setDismissedSighting(sightingKey)}>Continue</button>
          </div>
        </div>
      )}

      {/* ---- Opening turn-order roll-off popup -------------------------- */}
      {showOrder && orderReveal && (
        <div className="overlay" role="alert">
          <div className="contest-card">
            <h3>First Logger roll-off</h3>
            <p className="muted">Highest roll goes first (ties reroll)</p>
            {orderReveal.rounds.map((round, ri) => (
              <div key={ri} className="contest-rolls">
                {round.map((r) => (
                  <div key={r.seat} className={`contest-side ${r.seat === orderReveal.order[0] ? "won" : ""}`}>
                    <div className="contest-name">{name(r.seat)}{r.seat === orderReveal.order[0] ? " 🥇" : ""}</div>
                    <RollingDie value={r.roll} outcome={r.seat === orderReveal.order[0] ? "win" : null} />
                  </div>
                ))}
              </div>
            ))}
            <p className="contest-result">▶ {orderReveal.order.map(name).join(" → ")}</p>
            <button className="btn btn-primary btn-lg" onClick={() => setDismissedOrder(true)}>Let’s throw!</button>
          </div>
        </div>
      )}

      {/* ---- Score Card Swap chooser ------------------------------------ */}
      {swapUI && (() => {
        const meSeat = turn.activeSeat;
        const myTrees = players[meSeat]?.scoredTrees ?? [];
        const opps = seatOrder.filter((s) => s !== meSeat && (players[s]?.scoredTrees.length ?? 0) > 0);
        return (
          <div className="overlay" role="dialog" onClick={() => setSwapUI(null)}>
            <div className="score-card" onClick={(e) => e.stopPropagation()}>
              <h3>{theme.card("switch-tags").name}</h3>
              <p className="muted">Give one of your holes, take one of theirs.</p>
              <div className="swap-label">Your hole to give</div>
              <div className="swap-opts">
                {myTrees.map((tid, i) => (
                  <button key={i} className={`btn btn-sm ${swapUI.mine === i ? "swap-sel" : ""}`}
                    onClick={() => setSwapUI({ ...swapUI, mine: i })}>
                    {theme.tree(tid).name} (+{theme.tree(tid).treeScore})
                  </button>
                ))}
              </div>
              <div className="swap-label">Take from</div>
              {opps.map((seat) => (
                <div key={seat} className="swap-opp">
                  <div className="muted">{name(seat)}</div>
                  <div className="swap-opts">
                    {players[seat]!.scoredTrees.map((tid, i) => (
                      <button key={i} className={`btn btn-sm ${swapUI.targetSeat === seat && swapUI.theirs === i ? "swap-sel" : ""}`}
                        onClick={() => setSwapUI({ ...swapUI, targetSeat: seat, theirs: i })}>
                        {theme.tree(tid).name} (+{theme.tree(tid).treeScore})
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="swap-actions">
                <button className="btn btn-primary" disabled={swapUI.targetSeat === null}
                  onClick={() => { void act({ type: "playCard", card: "switch-tags", target: swapUI.targetSeat!, swap: { mine: swapUI.mine, theirs: swapUI.theirs } }); setSwapUI(null); }}>
                  Swap
                </button>
                <button className="btn btn-ghost" onClick={() => setSwapUI(null)}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---- Hooligan Standoff chooser ---------------------------------- */}
      {standoffUI && (() => {
        const opps = seatOrder.filter((s) => s !== turn.activeSeat);
        const tgt = standoffUI.targetSeat;
        const tgtBasket = tgt !== null && players[tgt]?.standingTree ? theme.tree(players[tgt]!.standingTree!.treeId) : null;
        return (
          <div className="overlay" role="dialog" onClick={() => setStandoffUI(null)}>
            <div className="score-card" onClick={(e) => e.stopPropagation()}>
              <h3>{theme.card("sasquatch-mating-season").name}</h3>
              <p className="muted">They lose their next turn. You may also claim their basket.</p>
              <div className="swap-label">Whose turn to skip</div>
              <div className="swap-opts">
                {opps.map((seat) => (
                  <button key={seat} className={`btn btn-sm ${standoffUI.targetSeat === seat ? "swap-sel" : ""}`}
                    onClick={() => setStandoffUI({ ...standoffUI, targetSeat: seat, take: false })}>
                    {name(seat)}
                  </button>
                ))}
              </div>
              <div className="swap-label">Take their basket?</div>
              {tgtBasket ? (
                <button className={`btn btn-sm ${standoffUI.take ? "swap-sel" : ""}`}
                  onClick={() => setStandoffUI({ ...standoffUI, take: !standoffUI.take })}>
                  {standoffUI.take ? "✓ " : ""}Claim {tgtBasket.name} ({players[tgt!]!.standingTree!.chops}/{tgtBasket.chopTarget})
                </button>
              ) : <p className="muted">They have no basket to take.</p>}
              <div className="swap-actions">
                <button className="btn btn-primary" disabled={standoffUI.targetSeat === null}
                  onClick={() => { void act({ type: "playCard", card: "sasquatch-mating-season", target: standoffUI.targetSeat!, takeBasket: standoffUI.take }); setStandoffUI(null); }}>
                  Play
                </button>
                <button className="btn btn-ghost" onClick={() => setStandoffUI(null)}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {stealUI && (() => {
        const opps = seatOrder.filter((s) => s !== turn.activeSeat && stealItemsOf(s).length > 0);
        const tgt = stealUI.targetSeat;
        const items = tgt !== null ? stealItemsOf(tgt) : [];
        return (
          <div className="overlay" role="dialog" onClick={() => setStealUI(null)}>
            <div className="score-card" onClick={(e) => e.stopPropagation()}>
              <h3>{theme.card("steal-equipment").name}</h3>
              <p className="muted">Swipe one piece of gear (driver counts) from another player.</p>
              <div className="swap-label">Take from</div>
              <div className="swap-opts">
                {opps.map((seat) => (
                  <button key={seat} className={`btn btn-sm ${stealUI.targetSeat === seat ? "swap-sel" : ""}`}
                    onClick={() => setStealUI({ targetSeat: seat, item: stealItemsOf(seat)[0] ?? null })}>
                    {name(seat)}
                  </button>
                ))}
              </div>
              <div className="swap-label">Which item</div>
              <div className="swap-opts">
                {items.map((cid, i) => (
                  <button key={`${cid}-${i}`} className={`btn btn-sm ${stealUI.item === cid ? "swap-sel" : ""}`}
                    onClick={() => setStealUI({ ...stealUI, item: cid })}>
                    {stealUI.item === cid ? "✓ " : ""}{theme.card(cid).name}
                  </button>
                ))}
              </div>
              <div className="swap-actions">
                <button className="btn btn-primary" disabled={stealUI.targetSeat === null || stealUI.item === null}
                  onClick={() => { void act({ type: "playCard", card: "steal-equipment", target: stealUI.targetSeat!, stealItem: stealUI.item! }); setStealUI(null); }}>
                  Grab
                </button>
                <button className="btn btn-ghost" onClick={() => setStealUI(null)}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---- Player detail popup (tappable card pills + inline inspector) -- */}
      {scoreDetail !== null && players[scoreDetail] && (() => {
        const dp = players[scoreDetail]!;
        const dtree = dp.standingTree ? theme.tree(dp.standingTree.treeId) : null;
        const closeDetail = () => { setScoreDetail(null); setInspectCard(null); };
        // All cards in front of this player, in a sensible order.
        const tableau = [...(dp.axe ? [dp.axe] : []), ...dp.equipment, ...dp.plusMinus, ...dp.help];
        const cardStat = (id: string): string => {
          const m = cardDiceModifier(id), bc = baseChopDice(id), mh = manageHelpDice(id);
          if (bc) return `${bc} dice`;
          if (mh) return `${mh} dice`;
          if (m) return `${m > 0 ? "+" : ""}${m} dice`;
          return "";
        };
        const inspected = inspectCard;
        return (
          <div className="overlay" role="dialog" onClick={closeDetail}>
            <div className="score-card" onClick={(e) => e.stopPropagation()}>
              <h3>{dp.name}{!hotseat && mySeat === scoreDetail ? " (you)" : ""}</h3>
              <p className="detail-sub">
                <strong>{playerScore(dp)}</strong> / 21
                {dtree ? <> · 🪣 {dtree.name} ({dp.standingTree!.chops}/{dtree.chopTarget})</> : <> · no basket</>}
              </p>

              {(dp.skipNextTurn || dp.axeSetAside || dp.cannotChopThisTurn) && (
                <div className="statuses">
                  {dp.skipNextTurn && <span className="status-pill">💤 Loses their next turn</span>}
                  {dp.axeSetAside && <span className="status-pill">🪚 Driver sidelined (Tandem Throwers)</span>}
                  {dp.cannotChopThisTurn && <span className="status-pill">🚫 Can’t throw this turn</span>}
                </div>
              )}

              <div className="swap-label">In play <span className="muted">(tap a card for details)</span></div>
              {tableau.length === 0 ? (
                <p className="muted">No cards in play.</p>
              ) : (
                <div className="pills">
                  {tableau.map((id, i) => (
                    <button key={`${id}-${i}`} className={`pill cat-${categoryLabel(id).split("/")[0]} ${inspected === id ? "sel" : ""}`}
                      onClick={() => setInspectCard(inspected === id ? null : id)}>
                      {theme.card(id).name}
                    </button>
                  ))}
                </div>
              )}
              {inspected && (
                <div className="card-inspect">
                  <div className="ci-head"><strong>{theme.card(inspected).name}</strong>
                    <span className="muted">{categoryLabel(inspected)}{cardStat(inspected) ? ` · ${cardStat(inspected)}` : ""}</span>
                  </div>
                  <p>{theme.card(inspected).rulesText || "—"}</p>
                </div>
              )}

              <div className="swap-label">Points</div>
              <ul className="score-list">
                {dp.scoredTrees.map((tid, i) => (
                  <li key={`t${i}`}><span>{theme.tree(tid).name}</span><span className="score-pts">+{theme.tree(tid).treeScore}</span></li>
                ))}
                {dp.speedClimbPoints > 0 && (
                  <li><span>Speed Putt bonus</span><span className="score-pts">+{dp.speedClimbPoints}</span></li>
                )}
                {dp.scoredTrees.length === 0 && dp.speedClimbPoints === 0 && <li className="muted">No points yet.</li>}
              </ul>
              <button className="btn btn-primary" onClick={closeDetail}>Close</button>
            </div>
          </div>
        );
      })()}

      {/* ---- "I HEARD CHAINS!" basket-sunk burst ------------------------ */}
      {chains && <div key={chains.v} className="chains-burst" aria-hidden="true">I HEARD CHAINS!</div>}

      {/* ---- Win overlay ------------------------------------------------ */}
      {winner !== null && !winDismissed && (() => {
        const standings = [...seatOrder].sort((a, b) => playerScore(players[b]!) - playerScore(players[a]!));
        return (
          <div className="overlay" role="alert">
            <div className="win-card">
              <div className="win-emoji">🏆</div>
              <h2>{players[winner]?.name ?? `Seat ${winner}`} wins!</h2>
              <ol className="win-standings">
                {standings.map((seat, i) => (
                  <li key={seat} className={seat === winner ? "is-winner" : undefined}>
                    <span className="rank">{i + 1}</span>
                    <span className="who">{name(seat)}</span>
                    <span className="pts">{playerScore(players[seat]!)} pts</span>
                  </li>
                ))}
              </ol>
              <div className="win-actions">
                <button className="btn btn-lg" onClick={() => setWinDismissed(true)}>Look around</button>
                <button className="btn btn-primary btn-lg" onClick={() => { location.hash = "#/"; }}>Back to start</button>
              </div>
            </div>
          </div>
        );
      })()}
      {winner !== null && winDismissed && (
        <button className="results-pill" onClick={() => setWinDismissed(false)}>🏆 Results</button>
      )}
    </div>
  );
}
