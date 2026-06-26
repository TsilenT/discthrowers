import type { GameState, Action } from "../engine/types";
import type { Rng } from "../engine/rng";
import { apply } from "../engine";
import type { Persistence } from "./persistence";
import type { Store, DispatchResult } from "./store";

/**
 * Local (hotseat / pass-and-play) store. Persists to storage on construction and after
 * every successful action, so a page refresh resumes the in-progress game. No seat() →
 * the device controls whoever's turn it is.
 */
export class GameStore implements Store {
  private state: GameState;
  private listeners = new Set<() => void>();

  constructor(initial: GameState, private persistence: Persistence, private rng: Rng) {
    this.state = initial;
    void this.persistence.save(this.state);
  }

  getState = (): GameState => this.state;

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  dispatch = (action: Action): DispatchResult => {
    const result = apply(this.state, action, this.rng);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    void this.persistence.save(this.state);
    this.listeners.forEach((l) => l());
    return { ok: true };
  };
}
