import { ref, get, set, update, onValue } from "firebase/database";
import { createInitialGame, cryptoRng, type SeatInfo } from "../engine";
import { database, ensureSignedIn } from "./firebase";
import type { GameMeta, SeatLink } from "./types";

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function randomId(len: number): string {
  const buf = new Uint32Array(len);
  globalThis.crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += ID_ALPHABET[buf[i]! % ID_ALPHABET.length];
  return out;
}

export const MAX_SLOTS = 8;

export interface LobbySeat {
  uid: string;
  name: string;
}

export interface LobbyView {
  meta: GameMeta | null;
  roster: Record<number, LobbySeat>;
  myUid: string;
}

/** Lobby operations behind an interface so the Lobby screen can be tested with a fake. */
export interface LobbyBackend {
  subscribe(cb: (v: LobbyView) => void): () => void;
  claim(slot: number, name: string): Promise<void>;
  leave(slot: number): Promise<void>;
  kick(slot: number): Promise<void>;
  setMode(mode: GameMeta["mode"]): Promise<void>;
  /** Freezes the roster, creates the game state, flips status to active. */
  start(): Promise<void>;
}

/**
 * Given a sparse lobby roster (keyed by lobby slot, which may be non-contiguous),
 * returns the claimed seats ordered by ascending slot, packed into a contiguous
 * 0-based array suitable for use as engine seat indices.
 *
 * Example: roster {0: A, 2: B, 5: C} → [A, B, C]  (engine indices 0, 1, 2)
 */
export function assignSeats(roster: Record<number, { uid: string; name: string }>): { uid: string; name: string }[] {
  return Object.keys(roster)
    .map(Number)
    .sort((a, b) => a - b)
    .map((slot) => ({ uid: roster[slot]!.uid, name: roster[slot]!.name }));
}

/** One-tap create: writes meta and returns the new game id; the host joins via the lobby. */
export async function createLobby(): Promise<string> {
  const uid = await ensureSignedIn();
  const id = randomId(6);
  const meta: GameMeta = { createdAt: Date.now(), host: uid, status: "lobby", mode: "beginner" };
  await set(ref(database(), `games/${id}/meta`), meta);
  return id;
}

export async function getMeta(id: string): Promise<GameMeta | null> {
  await ensureSignedIn();
  const snap = await get(ref(database(), `games/${id}/meta`));
  return snap.val() as GameMeta | null;
}

const claimsKey = (id: string) => `discthrowers:claims:${id}`;

function linksFromClaims(id: string, claims: Record<string, string>): SeatLink[] {
  const base = `${location.origin}${location.pathname}`;
  return Object.keys(claims).map(Number).sort((a, b) => a - b)
    .map((seat) => ({ seat, url: `${base}#/g/${id}/claim/${seat}/${claims[seat]!}` }));
}

function saveRescueLinks(id: string, links: SeatLink[]): void {
  try { localStorage.setItem(claimsKey(id), JSON.stringify(links)); } catch { /* non-fatal */ }
}

/** Rescue links cached on this device, if they have already been loaded or minted. */
export function hostRescueLinks(id: string): SeatLink[] | null {
  try {
    const raw = localStorage.getItem(claimsKey(id));
    return raw ? (JSON.parse(raw) as SeatLink[]) : null;
  } catch {
    return null;
  }
}

/** Loads recovery links from the shared game record so any player can recover any seat. */
export async function loadRescueLinks(id: string): Promise<SeatLink[] | null> {
  const cached = hostRescueLinks(id);
  if (cached !== null) return cached;
  await ensureSignedIn();
  const snap = await get(ref(database(), `games/${id}/_claims`));
  const claims = snap.val() as Record<string, string> | null;
  if (claims === null) return null;
  const links = linksFromClaims(id, claims);
  saveRescueLinks(id, links);
  return links;
}

export function makeLobbyBackend(id: string): LobbyBackend {
  const gameRef = ref(database(), `games/${id}`);
  return {
    subscribe(cb) {
      let meta: GameMeta | null = null;
      let roster: Record<number, LobbySeat> = {};
      let myUid = "";
      let metaSeen = false;
      const emit = () => { if (metaSeen && myUid) cb({ meta, roster, myUid }); };
      let unsubMeta = () => {};
      let unsubLobby = () => {};
      void ensureSignedIn().then((uid) => {
        myUid = uid;
        unsubMeta = onValue(ref(database(), `games/${id}/meta`), (s) => {
          meta = s.val() as GameMeta | null;
          metaSeen = true;
          emit();
        });
        unsubLobby = onValue(ref(database(), `games/${id}/lobby`), (s) => {
          roster = (s.val() ?? {}) as Record<number, LobbySeat>;
          emit();
        });
      });
      return () => { unsubMeta(); unsubLobby(); };
    },
    async claim(slot, name) {
      const uid = await ensureSignedIn();
      await set(ref(database(), `games/${id}/lobby/${slot}`), { uid, name });
    },
    async leave(slot) {
      await set(ref(database(), `games/${id}/lobby/${slot}`), null);
    },
    async kick(slot) {
      await set(ref(database(), `games/${id}/lobby/${slot}`), null);
    },
    async setMode(mode) {
      await set(ref(database(), `games/${id}/meta/mode`), mode);
    },
    async start() {
      await ensureSignedIn();
      const [metaSnap, lobbySnap] = await Promise.all([
        get(ref(database(), `games/${id}/meta`)),
        get(ref(database(), `games/${id}/lobby`)),
      ]);

      // Guard: only start once — prevent double-start races.
      const meta = metaSnap.val() as GameMeta | null;
      if (meta?.status !== "lobby") throw new Error("Game already started");

      const slots = (lobbySnap.val() ?? {}) as Record<number, LobbySeat>;

      // Map non-contiguous lobby slots to contiguous engine indices 0..n-1 (in
      // ascending slot order), so seats/{i} and players[i] share the same index.
      const seats: SeatInfo[] = assignSeats(slots);
      const state = createInitialGame(seats, cryptoRng(), { rollOff: true });
      const tokens = seats.map(() => randomId(16));

      // One atomic multi-path update: roster freeze, rescue tokens, state, status flip.
      // Use engine index i (not the original lobby slot) as the key for seats and _claims.
      const updates: Record<string, unknown> = { state, "meta/status": "active" };
      seats.forEach(({ uid }, i) => {
        updates[`seats/${i}`] = { uid };
        updates[`_claims/${i}`] = tokens[i];
      });
      await update(gameRef, updates);

      // Build rescue links keyed by engine index so claimSeat(id, i, token) works.
      const links = linksFromClaims(
        id,
        Object.fromEntries(seats.map((_, i) => [i, tokens[i]!]))
      );
      saveRescueLinks(id, links);
    },
  };
}
