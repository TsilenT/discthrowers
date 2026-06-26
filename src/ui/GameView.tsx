import { useEffect, useRef, useState } from "react";
import { useGame } from "../state/GameProvider";
import { treeStats, isAxe } from "../engine";
import { getHandler } from "../engine/cards/registry";
import { cardCategory, baseChopDice } from "../engine/cards/catalog";
import { cardDiceModifier } from "../engine/dice";
import { stoppersFor } from "../engine/reactions";
import { getTheme, DEFAULT_THEME } from "../content";
import { Dice, PipDie } from "./Dice";
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

type PlayabilityResult = { mode: "self" | "target" | "none"; legalTargets: Seat[] };

function playability(cardId: string, actorSeat: Seat, state: GameState, seatOrder: Seat[]): PlayabilityResult {
  const handler = getHandler(cardId);
  if (handler.isPlayable({ state, actorSeat, rng: dummyRng })) return { mode: "self", legalTargets: [] };
  const legalTargets: Seat[] = [];
  for (const seat of seatOrder) {
    if (seat === actorSeat) continue;
    if (handler.isPlayable({ state, actorSeat, target: seat, rng: dummyRng } as CardContext)) legalTargets.push(seat);
  }
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

function noOpAction(state: GameState): Action | null {
  const { turn, players } = state;
  const p = players[turn.activeSeat];
  if (!p) return null;
  switch (turn.phase) {
    case "squareUp":   return p.standingTree !== null ? { type: "squareUp" } : null;
    case "chop":       return (p.axe === null || p.standingTree === null || p.cannotChopThisTurn || p.axeSetAside) ? { type: "chop" } : null;
    case "longSaw":    return p.help.includes("long-saw-and-partner") ? null : { type: "longSaw" };
    case "manageHelp": return p.help.every((c) => c === "long-saw-and-partner") ? { type: "manageHelp" } : null;
    default:           return null;
  }
}

export function GameView({ theme: themeProp }: { theme?: ThemeContent }) {
  const { state, dispatch, mySeat } = useGame();
  const { players, seatOrder, turn, lastRoll, winner } = state;
  const pending = state.pendingReaction;
  const theme: ThemeContent = themeProp ?? getTheme(DEFAULT_THEME);

  const [error, setError] = useState<string | null>(null);
  const [targetingCard, setTargetingCard] = useState<string | null>(null);
  const [tab, setTab] = useState<"hand" | "log">("hand");
  const [dismissedContest, setDismissedContest] = useState<string>("");
  const [scoreDetail, setScoreDetail] = useState<Seat | null>(null);

  const act = async (action: Action) => {
    setError(null);
    setTargetingCard(null);
    const result = await dispatch(action);
    if (!result.ok) setError(result.error);
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
  const logText = (e: LogEntry): string => {
    switch (e.k) {
      case "turn": return `▶ ${name(e.seat)}’s turn`;
      case "play": return `${name(e.seat)} played ${theme.card(e.card).name}${e.target !== undefined ? ` on ${name(e.target)}` : ""}`;
      case "discard": return `${name(e.seat)} discarded ${theme.card(e.card).name}`;
      case "chop": return `${name(e.seat)} threw — ${e.chops} landed (${e.dice} dice)${e.broke ? ", driver broke!" : ""}`;
      case "help": return `${name(e.seat)}’s helpers threw — ${e.chops} landed (${e.dice} dice)`;
      case "timber": return `🪣 ${name(e.seat)} sank ${theme.tree(e.tree).name}`;
      case "react": return `${name(e.seat)} countered ${theme.card(e.stopped).name} with ${theme.card(e.card).name}`;
      case "contest": return `${theme.card(e.card).name}: ${name(e.winner)} won the roll-off (${e.winnerRoll} vs ${e.loserRoll})`;
      case "longSawPass": return `↪ ${theme.card("long-saw-and-partner").name} passed from ${name(e.from)} to ${name(e.to)}`;
      case "assist": return `🤲 ${name(e.by)}’s ${theme.card("give-me-a-hand").name} on ${name(e.target)}’s throw — ${e.landed ? "landed a throw" : "whiffed"}`;
      case "win": return `🏆 ${name(e.seat)} wins!`;
    }
  };

  const contest = state.lastContest ?? null;
  const contestKey = contest ? JSON.stringify(contest) : "";
  const showContest = contest !== null && contestKey !== dismissedContest;

  return (
    <div className="game">
      {/* ---- Top: brand + animated dice --------------------------------- */}
      <header className="topbar">
        <div className="brand">🥏 Disc Throwers</div>
        <Dice roll={lastRoll} />
      </header>

      {error && <div className="toast toast-error" role="alert">{error}<button onClick={() => setError(null)} aria-label="Dismiss">✕</button></div>}

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
                className={`player ${isActive ? "is-active" : ""} ${isMe ? "is-me" : ""}`}
                role="button" tabIndex={0} title="Tap for details"
                onClick={() => setScoreDetail(seat)}
                onKeyDown={(e) => { if (e.key === "Enter") setScoreDetail(seat); }}>
                <div className="player-top">
                  <span className="player-name">{p.name}{isMe ? " (you)" : ""}</span>
                  <span className="player-score-num">{playerScore(p)}</span>
                </div>
                <div className="bar" title={td ? `${td.name} — ${tree!.chops}/${td.chopTarget}` : "no basket"}>
                  <div className="bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="basket-meta muted">{td ? `${tree!.chops}/${td.chopTarget} throws` : "no basket"}</div>
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
                    <li key={key} className={`card cat-${categoryLabel(cardId).split("/")[0]} ${info?.mode === "none" ? "card-dim" : ""}`}>
                      <div className="card-name">{d.name}</div>
                      <div className="card-cat">{categoryLabel(cardId)}</div>
                      {d.rulesText && <div className="card-text">{d.rulesText}</div>}
                      {canPlayNow && (
                        <div className="card-actions">
                          {info?.mode === "self" && (
                            <button className="btn btn-primary btn-sm" onClick={() => void act({ type: "playCard", card: cardId })}>
                              {isAxe(cardId) ? "Equip" : "Play"}
                            </button>
                          )}
                          {info?.mode === "target" && !targeting && (
                            <button className="btn btn-primary btn-sm" onClick={() => setTargetingCard(key)}>Play ▸</button>
                          )}
                          {info?.mode === "target" && targeting && (
                            <div className="targets">
                              <span className="muted">on:</span>
                              {info.legalTargets.map((t) => (
                                <button key={t} className="btn btn-sm" onClick={() => void act({ type: "playCard", card: cardId, target: t })}>
                                  {players[t]?.name ?? `Seat ${t}`}
                                </button>
                              ))}
                              <button className="btn btn-ghost btn-sm" onClick={() => setTargetingCard(null)}>✕</button>
                            </div>
                          )}
                          {info?.mode === "none" && <span className="muted card-na">can’t play now</span>}
                          <button className="btn btn-ghost btn-sm" disabled={mustPlay}
                            title={mustPlay ? "You must play a card if you can" : undefined}
                            onClick={() => void act({ type: "discardCard", card: cardId })}>Discard</button>
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
            <div className="ab-reaction">
              <div className="ab-status">
                <span className="ab-title">⚡ {players[pending.actorSeat]?.name} played {theme.card(pending.card).name}{pending.target !== undefined && ` on ${players[pending.target]?.name}`}</span>
                {reactionSeat !== null
                  ? <span className="ab-hint">{hotseat ? `${players[reactionSeat]?.name}: counter it or let it happen?` : "Counter it or let it happen?"}</span>
                  : <span className="ab-hint">Waiting on {pending.eligibleReactors.filter((s) => !pending.passed.includes(s)).map((s) => players[s]?.name).join(", ") || "resolution"}…</span>}
              </div>
              {reactionSeat !== null && (
                <div className="ab-actions">
                  {players[reactionSeat]!.hand.filter((c) => stoppersFor(pending.card).includes(c)).map((cardId, idx) => (
                    <button key={`${cardId}-${idx}`} className="btn btn-primary" onClick={() => void act({ type: "react", seat: reactionSeat, card: cardId })}>
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
                <PipDie value={contest.challengerRoll} outcome={contest.winner === contest.challenger ? "hit" : "low"} />
              </div>
              <div className="contest-vs">vs</div>
              <div className={`contest-side ${contest.winner === contest.opponent ? "won" : ""}`}>
                <div className="contest-name">{name(contest.opponent)}</div>
                <PipDie value={contest.opponentRoll} outcome={contest.winner === contest.opponent ? "hit" : "low"} />
              </div>
            </div>
            <p className="contest-result">🏆 {name(contest.winner)} wins the roll-off</p>
            <button className="btn btn-primary btn-lg" onClick={() => setDismissedContest(contestKey)}>Continue</button>
          </div>
        </div>
      )}

      {/* ---- Player detail popup ---------------------------------------- */}
      {scoreDetail !== null && players[scoreDetail] && (() => {
        const dp = players[scoreDetail]!;
        const dtree = dp.standingTree ? theme.tree(dp.standingTree.treeId) : null;
        const names = (ids: string[]) => ids.length ? ids.map((id) => theme.card(id).name).join(", ") : "none";
        const fmtMod = (m: number) => `${m >= 0 ? "+" : ""}${m}`;
        const mods = dp.plusMinus.length
          ? dp.plusMinus.map((id) => `${theme.card(id).name} (${fmtMod(cardDiceModifier(id))})`).join(", ")
          : "none";
        const driver = dp.axe ? `${theme.card(dp.axe).name} (${baseChopDice(dp.axe)} dice)` : "none";
        const gearOnly = dp.equipment.filter((id) => GEAR_ICON[id]);
        const generic = dp.equipment.filter((id) => !GEAR_ICON[id]);
        return (
          <div className="overlay" role="dialog" onClick={() => setScoreDetail(null)}>
            <div className="score-card" onClick={(e) => e.stopPropagation()}>
              <h3>{dp.name}{!hotseat && mySeat === scoreDetail ? " (you)" : ""}</h3>
              <dl className="detail">
                <dt>Driver</dt><dd>{driver}</dd>
                <dt>Basket</dt><dd>{dtree ? `${dtree.name} — ${dp.standingTree!.chops}/${dtree.chopTarget} throws` : "none"}</dd>
                <dt>Gear</dt><dd>{names(gearOnly)}</dd>
                <dt>Modifiers</dt><dd>{mods}</dd>
                <dt>Generic</dt><dd>{names(generic)}</dd>
                <dt>Helpers</dt><dd>{names(dp.help)}</dd>
              </dl>
              <h4 className="detail-h">Points</h4>
              <ul className="score-list">
                {dp.scoredTrees.map((tid, i) => (
                  <li key={`t${i}`}><span>{theme.tree(tid).name}</span><span className="score-pts">+{theme.tree(tid).treeScore}</span></li>
                ))}
                {dp.speedClimbPoints > 0 && (
                  <li><span>Speed Putt bonus</span><span className="score-pts">+{dp.speedClimbPoints}</span></li>
                )}
                {dp.scoredTrees.length === 0 && dp.speedClimbPoints === 0 && <li className="muted">No points yet.</li>}
              </ul>
              <p className="score-total">Total: <strong>{playerScore(dp)}</strong> / 21</p>
              <button className="btn btn-primary" onClick={() => setScoreDetail(null)}>Close</button>
            </div>
          </div>
        );
      })()}

      {/* ---- Win overlay ------------------------------------------------ */}
      {winner !== null && (
        <div className="overlay" role="alert">
          <div className="win-card">
            <div className="win-emoji">🏆</div>
            <h2>{players[winner]?.name ?? `Seat ${winner}`} wins!</h2>
            <button className="btn btn-primary btn-lg" onClick={() => { location.hash = "#/"; }}>Back to start</button>
          </div>
        </div>
      )}
    </div>
  );
}
