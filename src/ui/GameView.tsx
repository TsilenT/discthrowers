import { useState } from "react";
import { useGame } from "../state/GameProvider";
import { treeStats, isAxe } from "../engine";
import { getHandler } from "../engine/cards/registry";
import { cardCategory } from "../engine/cards/catalog";
import { stoppersFor } from "../engine/reactions";
import { getTheme, DEFAULT_THEME } from "../content";
import type { ThemeContent } from "../content";
import type { CardContext } from "../engine/cards/ctx";
import type { GameState, PlayerState, Action, Seat } from "../engine/types";
import type { Rng } from "../engine/rng";

function playerScore(p: PlayerState): number {
  let total = p.speedClimbPoints;
  for (const treeId of p.scoredTrees) {
    total += treeStats(treeId).treeScore;
  }
  return total;
}

/** Dummy rng for isPlayable checks in the UI (isPlayable never calls rng). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dummyRng: Rng = { nextFloat: () => 0, nextInt: () => 0, shuffle: (a: any[]) => a };

type PlayabilityResult = { mode: "self" | "target" | "none"; legalTargets: Seat[] };

/**
 * Determines how a card in hand can be played:
 * - "self"   → playable with no target; show a single "Play" button
 * - "target" → NOT playable without a target but playable with some opponent; show per-seat buttons
 * - "none"   → not playable at all (deferred or blocked)
 */
function playability(
  cardId: string,
  actorSeat: Seat,
  state: GameState,
  seatOrder: Seat[],
): PlayabilityResult {
  const handler = getHandler(cardId);
  const ctxBase: CardContext = { state, actorSeat, rng: dummyRng };

  if (handler.isPlayable(ctxBase)) {
    return { mode: "self", legalTargets: [] };
  }

  // Check if any opponent seat makes it playable
  const legalTargets: Seat[] = [];
  for (const seat of seatOrder) {
    if (seat === actorSeat) continue;
    const ctx: CardContext = { state, actorSeat, target: seat, rng: dummyRng };
    if (handler.isPlayable(ctx)) {
      legalTargets.push(seat);
    }
  }

  if (legalTargets.length > 0) {
    return { mode: "target", legalTargets };
  }

  return { mode: "none", legalTargets: [] };
}

export function GameView({ theme: themeProp }: { theme?: ThemeContent }) {
  const { state, dispatch, mySeat } = useGame();
  const { players, seatOrder, turn, lastRoll, winner, pendingReaction } = state;

  const theme: ThemeContent = themeProp ?? getTheme(DEFAULT_THEME);

  const [error, setError] = useState<string | null>(null);
  const [targetingCard, setTargetingCard] = useState<string | null>(null);

  const act = async (action: Action) => {
    setError(null);
    const result = await dispatch(action);
    if (!result.ok) {
      setError(result.error);
    }
  };

  const isMyTurn = mySeat !== null && turn.activeSeat === mySeat;

  // Reaction window state
  const isMyReactionTurn =
    mySeat !== null &&
    pendingReaction !== null &&
    pendingReaction.eligibleReactors.includes(mySeat) &&
    !pendingReaction.passed.includes(mySeat);
  const isWaitingForReactions =
    pendingReaction !== null && !isMyReactionTurn;

  return (
    <div className="game-view">
      {winner !== null && (
        <div className="win-banner" role="alert">
          <h2>🎉 {players[winner]?.name ?? `Seat ${winner}`} wins!</h2>
          <button onClick={() => { location.hash = "#/"; }}>Back to start</button>
        </div>
      )}

      <div className="game-info">
        <p><strong>Theme:</strong> {theme.label}</p>
        <p><strong>Phase:</strong> {turn.phase} — <strong>Turn:</strong> {players[turn.activeSeat]?.name ?? `Seat ${turn.activeSeat}`}</p>
        {lastRoll.length > 0 && (
          <p><strong>Last roll:</strong> [{lastRoll.join(", ")}]</p>
        )}
        {error && (
          <p className="error" role="alert" style={{ color: "red" }}>{error}</p>
        )}
      </div>

      {/* Reaction window — shown when a reactable card is awaiting resolution */}
      {pendingReaction !== null && (
        <div className="reaction-window" role="region" aria-label="Reaction window">
          {isMyReactionTurn && mySeat !== null ? (
            <div className="reaction-prompt">
              <p>
                <strong>React?</strong>{" "}
                {players[pendingReaction.actorSeat]?.name ?? `Seat ${pendingReaction.actorSeat}`} played{" "}
                <strong>{theme.card(pendingReaction.card).name}</strong>
                {pendingReaction.target !== undefined
                  ? ` targeting ${players[pendingReaction.target]?.name ?? `Seat ${pendingReaction.target}`}`
                  : ""}
              </p>
              <p>Play a reaction card or pass:</p>
              <div className="reaction-actions">
                {/* Render a "React with X" button for each stopper in hand */}
                {(() => {
                  const myPlayer = players[mySeat];
                  if (!myPlayer) return null;
                  const stoppers = stoppersFor(pendingReaction.card);
                  const reactableInHand = myPlayer.hand.filter((c) => stoppers.includes(c));
                  return reactableInHand.map((cardId, idx) => (
                    <button
                      key={`${cardId}-${idx}`}
                      onClick={() => void act({ type: "react", seat: mySeat, card: cardId })}
                    >
                      React with {theme.card(cardId).name}
                    </button>
                  ));
                })()}
                <button onClick={() => void act({ type: "passReaction", seat: mySeat })}>
                  Pass
                </button>
              </div>
            </div>
          ) : (
            <div className="reaction-waiting">
              <p>
                <strong>Waiting for reactions…</strong>{" "}
                {players[pendingReaction.actorSeat]?.name ?? `Seat ${pendingReaction.actorSeat}`} played{" "}
                <strong>{theme.card(pendingReaction.card).name}</strong>
              </p>
              {(() => {
                const stillNeedToAct = pendingReaction.eligibleReactors.filter(
                  (s) => !pendingReaction.passed.includes(s),
                );
                if (stillNeedToAct.length === 0) return null;
                return (
                  <p>
                    Waiting on:{" "}
                    {stillNeedToAct
                      .map((s) => players[s]?.name ?? `Seat ${s}`)
                      .join(", ")}
                  </p>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <div className="players">
        {seatOrder.map((seat) => {
          const p = players[seat];
          if (!p) return null;
          const score = playerScore(p);
          const tree = p.standingTree;
          const treeDisplay = tree ? theme.tree(tree.treeId) : null;
          const isMe = mySeat === seat;
          const isActive = turn.activeSeat === seat;

          return (
            <div key={seat} className={`player-card ${isActive ? "active" : ""} ${isMe ? "mine" : ""}`}>
              <h3>
                {p.name}
                {isMe && <span> (you)</span>}
                {isActive && <span> ▶</span>}
              </h3>
              <p>Score: {score}</p>
              <p>Axe: {p.axe !== null ? theme.card(p.axe).name : "none"}</p>
              {treeDisplay ? (
                <p>
                  Standing tree: {treeDisplay.name}{" "}
                  ({tree!.chops}/{treeDisplay.chopTarget} chops — {treeDisplay.treeScore} pts)
                </p>
              ) : (
                <p>No standing tree</p>
              )}
              {p.scoredTrees.length > 0 && (
                <p>
                  Scored trees:{" "}
                  {p.scoredTrees.map((tid) => theme.tree(tid).name).join(", ")}
                </p>
              )}

              {/* Tableaus */}
              {p.equipment.length > 0 && (
                <p>Equipment: {p.equipment.map((id) => theme.card(id).name).join(", ")}</p>
              )}
              {p.plusMinus.length > 0 && (
                <p>Plus/Minus: {p.plusMinus.map((id) => theme.card(id).name).join(", ")}</p>
              )}
              {p.help.length > 0 && (
                <p>Help: {p.help.map((id) => theme.card(id).name).join(", ")}</p>
              )}

              {/* Only show hand for your own seat */}
              {isMe && (
                <div className="hand">
                  <strong>Your hand ({p.hand.length} cards):</strong>
                  {p.hand.length === 0 ? (
                    <p>No cards</p>
                  ) : (
                    <ul>
                      {p.hand.map((cardId, idx) => {
                        const cat = (() => { try { return cardCategory(cardId); } catch { return null; } })();
                        // During a reaction window, hide normal play/discard controls
                        const canPlayNormally = isMyTurn && turn.phase === "play" && pendingReaction === null;
                        const pInfo = canPlayNormally
                          ? playability(cardId, seat, state, seatOrder)
                          : null;
                        const isTargeting = targetingCard === `${cardId}-${idx}`;
                        const display = theme.card(cardId);

                        return (
                          <li key={`${cardId}-${idx}`}>
                            <span
                              title={display.rulesText || (cat ?? undefined)}
                            >
                              {display.name}
                            </span>
                            {canPlayNormally && (
                              <>
                                {pInfo?.mode === "self" && (
                                  <button onClick={() => {
                                    setTargetingCard(null);
                                    void act({ type: "playCard", card: cardId });
                                  }}>
                                    {isAxe(cardId) ? "Play (equip)" : "Play"}
                                  </button>
                                )}
                                {pInfo?.mode === "target" && !isTargeting && (
                                  <button onClick={() => setTargetingCard(`${cardId}-${idx}`)}>
                                    Play (pick target)
                                  </button>
                                )}
                                {pInfo?.mode === "target" && isTargeting && (
                                  <span>
                                    {" → Target: "}
                                    {pInfo.legalTargets.map((targetSeat) => (
                                      <button
                                        key={targetSeat}
                                        onClick={() => {
                                          setTargetingCard(null);
                                          void act({ type: "playCard", card: cardId, target: targetSeat });
                                        }}
                                      >
                                        {players[targetSeat]?.name ?? `Seat ${targetSeat}`}
                                      </button>
                                    ))}
                                    <button onClick={() => setTargetingCard(null)}>Cancel</button>
                                  </span>
                                )}
                                {pInfo?.mode === "none" && (
                                  <span style={{ color: "gray" }}> (not playable)</span>
                                )}
                                <button onClick={() => {
                                  setTargetingCard(null);
                                  void act({ type: "discardCard", card: cardId });
                                }}>
                                  Discard
                                </button>
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons — only when it's your turn AND no reaction window is open */}
      {isMyTurn && winner === null && pendingReaction === null && (
        <div className="actions">
          {turn.phase === "squareUp" && (
            <button className="btn-primary" onClick={() => act({ type: "squareUp" })}>
              Square Up
            </button>
          )}
          {turn.phase === "draw" && (
            <button className="btn-primary" onClick={() => act({ type: "draw" })}>
              Draw
            </button>
          )}
          {turn.phase === "play" && (
            <p className="phase-hint">Choose a card to play or discard above.</p>
          )}
          {turn.phase === "chop" && (
            <button className="btn-primary" onClick={() => act({ type: "chop" })}>
              Chop
            </button>
          )}
          {turn.phase === "manageHelp" && (
            <button className="btn-primary" onClick={() => act({ type: "manageHelp" })}>
              Manage Help
            </button>
          )}
          {turn.phase === "end" && (
            <button className="btn-primary" onClick={() => act({ type: "endTurn" })}>
              End Turn
            </button>
          )}
        </div>
      )}
    </div>
  );
}
