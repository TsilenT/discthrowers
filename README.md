# Disc Throwers

An asynchronous, online, multiplayer card game — **Disc Golf & Hooligans**. Race
your fellow disc golfers to sink baskets, sabotage their throws, and survive the
hooligans roaming the course. First to 21 points wins.

Built as a serverless web app: a pure, deterministic game engine plus Firebase
Realtime Database for turn-validated, claim-a-seat async play. Theme-neutral
engine with a swappable content layer (the shipped theme is Disc Golf).

## Stack

- **React 19 + Vite + TypeScript** (strict)
- **Firebase Realtime Database** (serverless; all authority in the engine + security rules)
- **Vitest** for the test suite

## Architecture

- `src/engine/` — pure reducer `apply(state, action, rng) => state`, no I/O. Turn
  machine (square up → draw → play → chop → manage help → end), seeded RNG, deck
  building, and scoring. Fully unit-tested.
- `src/engine/cards/` — a hybrid card-effect framework: shared mutation
  **primitives** plus a per-card **registry**. Covers equipment, dice modifiers,
  help cards, "hooligan" cards, actions, an async **reaction window** (out-of-turn
  cancels), and dice-off **contests**.
- `src/net/` — Firebase config, anonymous auth, a transactional RTDB backend with
  optimistic-concurrency commits, and the lobby/seat-claim flow.
- `src/state/` — a networked store that commits engine results inside a DB
  transaction (fresh per-dispatch seed, replayed on retry).
- `src/content/` — display layer mapping engine ids → human-readable names / rules
  text. The theme is swappable; Disc Golf ships by default.
- `database.rules.json` — security rules: only the active seat writes game state,
  with a narrow out-of-turn exception while a reaction is pending.

## Develop

```bash
npm install
npm run dev         # local dev server
npm run test:run    # unit suite (300+ tests)
npm run typecheck
npm run build       # production build to dist/
```

## Firebase configuration

The app needs a Firebase project (Realtime Database + Anonymous Auth). Copy
`.env.example` to `.env` and fill in your project's web config:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

These values are public by design — security lives in `database.rules.json`.
Deploy the rules with `npm run rules:deploy` (requires the Firebase CLI and
`firebase login`).

## Deploy (GitHub Pages)

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds the site and
publishes it to GitHub Pages on every push to `main`. Add your Firebase web
config as repository secrets (`VITE_FIREBASE_API_KEY`, etc.) so they're baked
into the build, and enable Pages with **Source: GitHub Actions** in the repo
settings.

## License

Code in this repository is the author's own work. The game's rules/mechanics are
implemented from scratch; the shipped theme, names, and text are original.
