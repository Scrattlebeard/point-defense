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

# visual smoke (headless screenshots — firefox works on this box; the chromium
# flatpak cannot run headless):
firefox --headless --screenshot .smoke/menu.png --window-size=430,900 "file://$PWD/dist/index.html"
firefox --headless --screenshot .smoke/battle.png --window-size=430,900 "file://$PWD/dist/index.html?autostart&turbo"

# phone-shaped smoke (simulated dpr 2 — catches CSS-vs-backing-store sizing bugs;
# use ?autostart: the menu is DOM and renders fine even when the canvas doesn't):
mkdir -p /tmp/ffdpr2 && echo 'user_pref("layout.css.devPixelsPerPx", "2");' > /tmp/ffdpr2/user.js
firefox --headless --profile /tmp/ffdpr2 --screenshot .smoke/dpr2.png --window-size=430,900 "file://$PWD/dist/index.html?autostart&warp=10"
```

Dev hatches (query params on any build): `?autostart` skips the menu ·
`&turbo` pre-simulates ~40s with a robot aimer (auto-picks level-ups) ·
`&warp=N` pre-simulates exactly N seconds with *no* aimer (enemies survive to be
photographed) · `&gear=frost:4,orbit:2` grants weapon levels after autostart (visual
dev — capped at each weapon's max) · `&sparks` enables the ambient grid sparks
in-battle (menu has them by default — app.md "Grid sparks") · `?bestiary` opens a fully-revealed bestiary,
in-memory only.

## Deployment (GitHub Pages — canonical)

The phone-playable build is **GitHub Pages** at
`https://scrattlebeard.github.io/point-defense/`.

- `.github/workflows/pages.yml` deploys on every push to `main`: `npm ci` →
  `npm test` → `npm run build` → publish `dist/`. A red test blocks the deploy —
  the pipeline enforces the ship loop, not convention.
- Pages serves `dist/index.html` — the **full standalone document**, so the game owns
  its `<head>` (viewport meta, `user-scalable=no`) with no wrapper between the
  browser and the canvas. This is why Pages is canonical: the Claude Artifact viewer
  wraps `dist/artifact.html` in its own skeleton + mobile chrome, which caused
  unfixable-from-here mobile misbehaviour (2026-07-23) — same class as the
  cursor-desync the viewer caused a day earlier.
- Ship loop: `npm test` green → commit+push. (Build + deploy happen in CI;
  `npm run build` locally only for smoke-testing `dist/`.)

### Claude Artifact (legacy, secondary)

The original artifact lives at
`https://claude.ai/code/artifact/eb569c08-45a9-45b8-9b71-4d948272e336`. Not updated
by default — republish only on explicit request. If republishing: use
`dist/artifact.html`, favicon 🎯 (keep stable), short kebab label, and — from any
conversation other than the 2026-07-23 original — pass the URL above as the `url`
parameter, or a new URL is silently minted and the old link goes stale.

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
   force wall, hold = channeled beam — unlocked in-run via level-ups, so the gesture
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
