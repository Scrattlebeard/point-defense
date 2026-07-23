# point-defense

A tower-defense roguelite for touch screens. You are **the Point** — a lone tower at the
center of the screen; every geometric shape on the field wants to reach it. You disagree,
using tap / swipe / hold gestures that start as manual weapons and graduate into an
auto-firing arsenal (Vampire-Survivors-style in-run upgrades). Runs end in death; death
pays out **shards**; shards buy permanent progress in a **tech tree** — stat nodes, new
weapons for the in-run pool, and new starting towers. Pure HTML/JS/Canvas, no runtime
dependencies, playable in any modern browser (phone-first).

## Quickstart

```sh
# install (dev tooling only — the game itself has zero runtime deps):
npm install

# test:
npm test              # = node --test test/

# run (ES modules require http, file:// won't do):
npm run dev           # = python3 -m http.server 8123, then open http://localhost:8123/

# build single-file bundles into dist/:
npm run build         # = node scripts/build.mjs
#   dist/index.html     — standalone single file (open anywhere, share, host)
#   dist/artifact.html  — same, minus the outer html skeleton (Claude Artifact publishing)

# visual smoke (headless screenshots; ?autostart skips menu, &turbo pre-simulates ~40s):
firefox --headless --screenshot .smoke/menu.png --window-size=430,900 "file://$PWD/dist/index.html"
firefox --headless --screenshot .smoke/battle.png --window-size=430,900 "file://$PWD/dist/index.html?autostart&turbo"
```

## Public seams

- **`index.html`** — the game, playable from a dev server.
- **`dist/index.html`** — the game, single self-contained file. The shipping artifact.
- **localStorage key `pointdefense.meta.v1`** — persistent meta-progression (shards,
  tech-tree purchases, best wave, settings). Versioned; bumping the key is a save wipe
  and must be an ADR-level decision.
- **`src/core/*`** — pure, DOM-free domain modules, importable from node for tests.

## Design pillars (the .md-level truths of the game)

1. **Gestures are weapon classes — and the pointer is the aim.** The bolt (every tower
   has it) auto-fires toward the standing aim point: the live cursor on desktop, the
   last touch position on mobile. Aim lines show the volley directions. Swipe =
   shockwave, hold = channeled beam — unlocked in-run via level-ups, so the gesture
   vocabulary teaches itself. Every tap and swipe also updates the aim — no gesture is
   ever a dead input. *(v1 fired bolts per tap; replaced after the 2026-07-23 playtest
   because spam-clicking out-damaged every auto weapon.)*
2. **Skill is aim, power is auto.** Auto weapons (orbitals, nova, seekers, tesla, frost,
   turrets) are the level-up economy; the bolt's max level adds a second, self-targeting
   volley. Attention early, idle power fantasy late — the Vampire Survivors curve.
3. **Variants are read at a glance.** Enemy difficulty variations are *color/highlight
   grammar* on the same base shapes — outline = armor, white-hot glow = speed, pulsing
   core = volatile, green ring = regenerating, rotating ring = shielded. Shape says
   *what it is*, highlight says *what's special about it*. No new silhouettes needed.
4. **Death is the shop trip.** Every run pays shards scaled by distance reached. The tech
   tree converts them into permanent stats, weapon-pool unlocks, and towers with distinct
   starting loadouts. Losing must always buy something.
5. **Pure core, impure shell.** All decision logic (balance curves, wave composition,
   gesture classification, tech tree, run-state math) lives in `src/core/` — pure,
   deterministic (rng injected), node-testable. Canvas, DOM, audio, input events and the
   frame loop live in `src/app/` and contain no game *decisions*, only execution.

## Map

| Path | What lives there |
|------|------------------|
| `src/core/` | Pure domain core — see `src/core/core.md` |
| `src/app/`  | Browser shell: loop, rendering, input, UI, audio — see `src/app/app.md` |
| `test/`     | node:test suites over `src/core` (the enforceable spec) |
| `scripts/build.mjs` | esbuild bundling to single-file `dist/` outputs |
| `adr/`      | Architectural decision records |
| `PINS.md`   | Deferred work and asides |
