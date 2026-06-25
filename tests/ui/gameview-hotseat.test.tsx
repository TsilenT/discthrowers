// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { GameProvider } from "../../src/state/GameProvider";
import { GameView } from "../../src/ui/GameView";
import { createInitialGame, mulberry32, apply } from "../../src/engine";
import type { Store } from "../../src/state/store";
import type { GameState, Action } from "../../src/engine/types";

afterEach(cleanup);

/** Build a hotseat store like StartScreen does (no seat() → pass-and-play). */
function hotseatStore(): Store {
  let s: GameState = createInitialGame(
    [{ uid: "h0", name: "Ann" }, { uid: "h1", name: "Bob" }],
    mulberry32(1),
  );
  const listeners = new Set<() => void>();
  return {
    getState: () => s,
    subscribe: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    dispatch: (a: Action) => {
      const r = apply(s, a, mulberry32(2));
      if (r.ok) { s = r.state; listeners.forEach((l) => l()); }
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    },
    // no seat() → hotseat
  };
}

describe("GameView hotseat (pass-and-play)", () => {
  it("shows the active player's name and a turn action button", () => {
    render(<GameProvider store={hotseatStore()}><GameView /></GameProvider>);
    // Active player's turn is surfaced in the turn bar...
    expect(screen.getByText(/Ann.s turn/)).toBeInTheDocument();
    // ...and the primary action for the squareUp phase is clickable.
    expect(screen.getByRole("button", { name: "Tee up" })).toBeInTheDocument();
  });
});
