import { useEffect, useRef, useState } from "react";
import type { LobbyBackend, LobbyView } from "../net/lobby";
import { MAX_SLOTS } from "../net/lobby";

const NAME_KEY = "discthrowers:name";

export function Lobby({ id, backend, onEnterGame }: {
  id: string;
  backend: LobbyBackend;
  onEnterGame: (id: string) => void;
}) {
  const [view, setView] = useState<LobbyView | null>(null);
  const [name, setName] = useState(() => {
    try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const entered = useRef(false);

  useEffect(() => backend.subscribe(setView), [backend]);

  const status = view?.meta?.status;
  useEffect(() => {
    if (status === "active" && !entered.current) {
      entered.current = true;
      onEnterGame(id);
    }
  }, [status, id, onEnterGame]);

  if (!view) return <div className="start-screen"><h1>Loading lobby…</h1></div>;
  if (!view.meta) {
    return (
      <div className="start-screen">
        <h1>Game not found</h1>
        <button onClick={() => { location.hash = "#/"; }}>Back to start</button>
      </div>
    );
  }
  if (view.meta.status === "active") return <div className="start-screen"><h1>Starting…</h1></div>;

  const { meta, roster, myUid } = view;
  const isHost = meta.host === myUid;
  const slots = Array.from({ length: MAX_SLOTS }, (_, i) => roster[i] ?? null);
  const mySlot = slots.findIndex((s) => s?.uid === myUid);
  const claimedCount = slots.filter(Boolean).length;
  const freeSlot = slots.findIndex((s) => s === null);

  const run = (fn: () => Promise<void>, friendly: string) => {
    setBusy(true); setError(null);
    void fn().catch(() => setError(friendly)).finally(() => setBusy(false));
  };

  const formName = name !== "" ? name : (mySlot >= 0 ? slots[mySlot]!.name : "");

  const join = () => {
    const n = formName.trim();
    if (n === "") return;
    try { localStorage.setItem(NAME_KEY, n); } catch { /* non-fatal */ }
    const slot = mySlot >= 0 ? mySlot : freeSlot;
    if (slot < 0) return;
    run(() => backend.claim(slot, n), "That seat was just taken — try again.");
  };

  const shareUrl = `${location.origin}${location.pathname}#/g/${id}`;
  const copy = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* user dismissed the share sheet */ }
  };

  return (
    <div className="start-screen lobby">
      <h1>Game lobby</h1>
      <p className="lobby-code">Game code: <strong>{id}</strong></p>
      <button onClick={() => { void copy(); }}>{copied ? "Copied!" : "Copy invite link"}</button>

      <ul className="lobby-slots">
        {slots.map((s, i) => (
          <li key={i}>
            {s ? (
              <>
                <span className="lobby-name">
                  {s.name}
                  {s.uid === meta.host && <span className="host-crown" aria-label="host"> ♟</span>}
                  {s.uid === myUid && <span className="you"> (you)</span>}
                </span>
                {s.uid === myUid && (
                  <button disabled={busy} onClick={() => run(() => backend.leave(i), "Could not leave the seat.")}>
                    Leave
                  </button>
                )}
                {isHost && s.uid !== myUid && (
                  <button disabled={busy} aria-label={`Remove ${s.name}`}
                    onClick={() => run(() => backend.kick(i), "Could not remove the player.")}>
                    ✕
                  </button>
                )}
              </>
            ) : (
              <span className="lobby-open">Open seat</span>
            )}
          </li>
        ))}
      </ul>

      {(mySlot >= 0 || freeSlot >= 0) && (
        <div className="lobby-join">
          <input aria-label="Your name" placeholder="Your name" maxLength={24}
            value={formName} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary" disabled={busy || formName.trim() === ""} onClick={join}>
            {mySlot >= 0 ? "Update seat" : "Join game"}
          </button>
        </div>
      )}

      {error && <p role="alert">{error}</p>}
      <button className="btn-primary" disabled={busy || claimedCount < 2}
        onClick={() => run(() => backend.start(), "Could not start the game.")}>
        {claimedCount < 2 ? `Start game (${claimedCount}/2 min)` : "Start game"}
      </button>
    </div>
  );
}
