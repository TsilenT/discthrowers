import { useState } from "react";
import { createInitialGame, cryptoRng, apply, mulberry32 } from "../engine";
import { THEMES } from "../content";
import type { Store } from "../state/store";

const DEFAULT_NAMES = [
  "Player 1", "Player 2", "Player 3", "Player 4",
  "Player 5", "Player 6", "Player 7", "Player 8",
];

export function StartScreen({ onStart, onCreateOnline, themeId, onThemeChange }: {
  onStart: (store: Store) => void;
  onCreateOnline?: (() => void) | undefined;
  themeId?: string;
  onThemeChange?: (id: string) => void;
}) {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);

  const start = () => {
    const seats = Array.from({ length: count }, (_, i) => ({
      uid: `hotseat-${i}`,
      name: names[i]!.trim() || DEFAULT_NAMES[i]!,
    }));
    const rng = cryptoRng();
    let _state = createInitialGame(seats, rng);
    const listeners = new Set<() => void>();
    const store: Store = {
      getState: () => _state,
      subscribe: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
      dispatch: (action) => {
        const seed = Math.floor(Math.random() * 0xffffffff);
        const result = apply(_state, action, mulberry32(seed));
        if (result.ok) { _state = result.state; listeners.forEach((l) => l()); }
        return result.ok ? { ok: true } : { ok: false, error: result.error };
      },
    };
    onStart(store);
  };

  return (
    <div className="start-screen">
      <h1>Disc Throwers</h1>

      {/* Theme toggle */}
      {onThemeChange && (
        <div className="theme-toggle">
          <label><strong>Theme: </strong></label>
          {Object.values(THEMES).map((t) => (
            <label key={t.id} style={{ marginRight: "0.75rem" }}>
              <input
                type="radio"
                name="theme"
                value={t.id}
                checked={(themeId ?? "discgolf") === t.id}
                onChange={() => onThemeChange(t.id)}
              />{" "}
              {t.label}
            </label>
          ))}
        </div>
      )}

      <label>Players:{" "}
        <select aria-label="Player count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {Array.from({ length: 7 }, (_, i) => i + 2).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="player-row">
          <input aria-label={`Player ${i + 1} name`} value={names[i]}
            onChange={(e) => setNames((ns) => ns.map((n, j) => (j === i ? e.target.value : n)))} />
        </div>
      ))}
      <button onClick={start}>Start hotseat game</button>
      {onCreateOnline && <button onClick={onCreateOnline}>New online game</button>}
    </div>
  );
}
