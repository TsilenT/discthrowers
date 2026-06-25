import { useState } from "react";
import { useGame } from "../state/GameProvider";
import { treeStats, isAxe } from "../engine";
import { getHandler } from "../engine/cards/registry";
import { cardCategory } from "../engine/cards/catalog";
import { stoppersFor } from "../engine/reactions";
import { getTheme, DEFAULT_THEME } from "../content";
import type { ThemeContent } from "../content";
import type { CardContext } from "../engine/cards/ctx";
import type { GameState, PlayerState, Action, Seat, Phase } from "../engine/types";
import type { Rng } from "../engine/rng";

function playerScore(p: PlayerState): number {
  let total = p.speedClimbPoints;
  for (const treeId of p.scoredTrees) total += treeStats(treeId).treeScore;
  return total;
}

/** Dummy rng for isPlayable checks in the UI (isPlayable never calls rng). */
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

/** Friendly, disc-golf-flavoured guidance for each phase. */
const PHASE_INFO: Record<Phase, { title: string; hint: string; action?: string }> = {
  squareUp:   { title: "Tee up",        hint: "Set up the basket you'll be throwing at this turn.", action: "Tee up" },
  draw:       { title: "Draw a card",   hint: "Draw a card into your hand.", action: "Draw a card" },
  play:       { title: "Play a card",   hint: "Play a card from your hand — you must, if you can — or discard one." },
  chop:       { title: "Throw!",        hint: "Roll the dice. Each 4, 5 or 6 lands a throw on your basket.", action: "🎯 Throw!" },
  manageHelp: { title: "Helpers throw", hint: "Roll the dice for any helper cards you have in play.", action: "Roll helpers" },
  end:        { title: "End turn",      hint: "Wrap up and pass play to the next disc golfer.", action: "End turn" },
  gameOver:   { title: "Game over",     hint: "" },
};

function categoryLabel(id: string): string {
  try { return cardCategory(id).replace("-", "/"); } catch { return "card"; }
}

export function GameView({ theme: themeProp }: { theme?: ThemeContent }) {
  const { state, dispatch, mySeat } = useGame();
  const { players, seatOrder, turn, lastRoll, winner, pendingReaction } = state;
  const theme: ThemeContent = themeProp ?? getTheme(DEFAULT_THEME);

  const [error, setError] = useState<string | null>(null);
  const [targetingCard, setTargetingCard] = useState<string | null>(null);

  const act = async (action: Action) => {
    setError(null);
    setTargetingCard(null);
    const result = await dispatch(action);
    if (!result.ok) setError(result.error);
  };

  const isMyTurn = mySeat !== null && turn.activeSeat === mySeat;
  const activeName = players[turn.activeSeat]?.name ?? `Seat ${turn.activeSeat}`;
  const phase = PHASE_INFO[turn.phase];

  const isMyReactionTurn =
    mySeat !== null && pendingReaction !== null &&
    pendingReaction.eligibleReactors.includes(mySeat) && !pendingReaction.passed.includes(mySeat);

  const me = mySeat !== null ? players[mySeat] : undefined;
  const canPlayNow = isMyTurn && turn.phase === "play" && pendingReaction === null && winner === null;

  return (
    <div className="game">
      {/* ---- Top turn bar ------------------------------------------------ */}
      <header className="turnbar">
        <div className="turnbar-brand">🥏 Disc Throwers</div>
        <div className="turnbar-status">
          {winner !== null ? (
            <span className="turnbar-title">Game over</span>
          ) : pendingReaction !== null ? (
            <span className="turnbar-title">⚡ Reaction window</span>
          ) : isMyTurn ? (
            <>
              <span className="turnbar-title">Your turn — {phase.title}</span>
              <span className="turnbar-hint">{phase.hint}</span>
            </>
          ) : (
            <>
              <span className="turnbar-title">Waiting for {activeName}</span>
              <span className="turnbar-hint">{phase.title} · it’s not your turn yet</span>
            </>
          )}
        </div>
        <div className="turnbar-action">
          {isMyTurn && winner === null && pendingReaction === null && phase.action && (
            <button className="btn btn-primary btn-lg"
              onClick={() => void act({ type: turn.phase === "end" ? "endTurn" : turn.phase } as Action)}>
              {phase.action}
            </button>
          )}
        </div>
      </header>

      {error && <div className="toast toast-error" role="alert">{error}<button onClick={() => setError(null)} aria-label="Dismiss">✕</button></div>}

      {/* ---- Reaction window --------------------------------------------- */}
      {pendingReaction !== null && (
        <section className="reaction" role="region" aria-label="Reaction window">
          <p className="reaction-headline">
            <strong>{players[pendingReaction.actorSeat]?.name ?? `Seat ${pendingReaction.actorSeat}`}</strong>{" "}
            played <strong>{theme.card(pendingReaction.card).name}</strong>
            {pendingReaction.target !== undefined && <> on <strong>{players[pendingReaction.target]?.name}</strong></>}.
          </p>
          {isMyReactionTurn && mySeat !== null ? (
            <div className="reaction-actions">
              {players[mySeat]!.hand.filter((c) => stoppersFor(pendingReaction.card).includes(c)).map((cardId, idx) => (
                <button key={`${cardId}-${idx}`} className="btn btn-primary"
                  onClick={() => void act({ type: "react", seat: mySeat, card: cardId })}>
                  Counter with {theme.card(cardId).name}
                </button>
              ))}
              <button className="btn btn-ghost" onClick={() => void act({ type: "passReaction", seat: mySeat })}>Let it happen</button>
            </div>
          ) : (
            <p className="reaction-waiting">
              Waiting on{" "}
              {pendingReaction.eligibleReactors.filter((s) => !pendingReaction.passed.includes(s))
                .map((s) => players[s]?.name ?? `Seat ${s}`).join(", ") || "resolution"}…
            </p>
          )}
        </section>
      )}

      {/* ---- Your hand --------------------------------------------------- */}
      {me && (
        <section className="hand-panel">
          <h2 className="section-title">
            Your hand <span className="muted">({me.hand.length})</span>
            {canPlayNow && <span className="badge badge-go">play or discard a card</span>}
          </h2>
          {me.hand.length === 0 ? (
            <p className="muted">No cards in hand.</p>
          ) : (
            <ul className="cards">
              {me.hand.map((cardId, idx) => {
                const d = theme.card(cardId);
                const key = `${cardId}-${idx}`;
                const info = canPlayNow ? playability(cardId, mySeat!, state, seatOrder) : null;
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
                        <button className="btn btn-ghost btn-sm" onClick={() => void act({ type: "discardCard", card: cardId })}>Discard</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {lastRoll.length > 0 && (
            <p className="lastroll">Last roll: {lastRoll.map((d, i) => <span key={i} className={`die ${d >= 4 ? "hit" : d === 3 ? "miss" : "low"}`}>{d}</span>)}</p>
          )}
        </section>
      )}

      {/* ---- Players board ----------------------------------------------- */}
      <section className="board">
        <h2 className="section-title">Course</h2>
        <div className="players">
          {seatOrder.map((seat) => {
            const p = players[seat];
            if (!p) return null;
            const isMe = mySeat === seat;
            const isActive = turn.activeSeat === seat;
            const tree = p.standingTree;
            const td = tree ? theme.tree(tree.treeId) : null;
            const pct = td ? Math.min(100, Math.round((tree!.chops / td.chopTarget) * 100)) : 0;
            return (
              <div key={seat} className={`player ${isActive ? "is-active" : ""} ${isMe ? "is-me" : ""}`}>
                <div className="player-top">
                  <span className="player-name">{p.name}{isMe && <span className="tag">you</span>}{isActive && <span className="tag tag-turn">turn</span>}</span>
                  <span className="player-score">{playerScore(p)}<small> / 21</small></span>
                </div>
                {td ? (
                  <div className="basket">
                    <div className="basket-head"><span>{td.name}</span><span className="muted">{tree!.chops}/{td.chopTarget} · {td.treeScore} pts</span></div>
                    <div className="bar"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
                  </div>
                ) : <div className="basket muted">no basket set</div>}
                <div className="chips">
                  <span className="chip chip-driver">{p.axe ? theme.card(p.axe).name : "no driver"}</span>
                  {p.scoredTrees.length > 0 && <span className="chip">✓ {p.scoredTrees.length} sunk</span>}
                  {p.skipNextTurn && <span className="chip chip-warn">skips next</span>}
                  {p.equipment.map((id, i) => <span key={`e${i}`} className="chip">{theme.card(id).name}</span>)}
                  {p.plusMinus.map((id, i) => <span key={`m${i}`} className="chip chip-mod">{theme.card(id).name}</span>)}
                  {p.help.map((id, i) => <span key={`h${i}`} className="chip chip-help">{theme.card(id).name}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Win overlay ------------------------------------------------- */}
      {winner !== null && (
        <div className="win-overlay" role="alert">
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
