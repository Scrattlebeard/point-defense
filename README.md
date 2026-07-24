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
photographed — keep N ≲ 15: besiegers grind the undefended tower down, so long
warps photograph the death screen) · `&gear=frost:4,orbit:2` grants weapon levels after autostart (visual
dev — capped at each weapon's max) · `&sparks` enables the ambient grid sparks
in-battle (menu has them by default — app.md "Grid sparks") · `?bestiary` opens a fully-revealed bestiary,
in-memory only · `?lattice&shards=N` opens the Lattice with a faked balance
(in-memory only — node states photographable).

Balance tooling: `node scripts/calibrate.mjs [trials]` runs fresh no-tech robot
runs to death and checks the median against the onboarding band (ADR-0003
guardrail: re-run before landing early-difficulty or player-power changes; exits
non-zero when out of band).

## Deployment (GitHub Pages — canonical)

The phone-playable build is **GitHub Pages**, one site with three **release
channels** (a repo gets exactly one Pages site, so channels are subpaths
deployed from branches — not separate repos):

| channel | URL | branch | role & gates |
|---------|-----|--------|--------------|
| prod | `https://scrattlebeard.github.io/point-defense/` | `prod` | **human-verified releases** — moves only via `scripts/promote`, after playtesting on dev. Gated (tests + calibrate band) as a backstop against non-loop pushes |
| beta | `…/point-defense/beta/` | `beta` | release candidate — promoted via `scripts/promote beta`; prod gates. Idle until a real release flow exists |
| gdd  | `…/point-defense/gdd/`  | `dev`  | **the living GDD** (`gdd/index.html`) — served from dev head so it tracks main; failure warns, never blocks |
| dev  | `…/point-defense/dev/`  | `dev`  | **the default target**: tracks `main` — every land is pushed as `main main:dev`, so day-to-day work is playtested here first. May be force-pushed with out-of-band experiments (the band-gate escape hatch). Build-only in CI: `main` is already loop-gated before it gets here |

- **Ship loop (dev-first, decided 2026-07-24):** loop green → land → `git push
  origin main main:dev` → playtest on the dev URL → `scripts/promote` when it's
  earned prod. The loop's gates verify the sim; the promote step verifies the
  *feel* — the calibrate robot green-lit a tech tree whose nodes were
  unclickable for two days, which is exactly the class of bug only thumbs catch.
- `.github/workflows/pages.yml` deploys on any push to `prod`/`dev`/`beta`
  (`main` maps to no channel — its content reaches Pages via the `main:dev`
  push). A Pages deploy replaces the whole site, so every run assembles **all**
  channels from their branch heads. Failure isolation: a prod-channel failure
  blocks the deploy outright; a dev/beta failure emits a warning and deploys
  without that channel (its subpath 404s until fixed) — a broken experiment on
  `dev` must never block redeploying prod.
- *Repo-external config (recorded because it lives outside git):* the
  `github-pages` **environment branch policy** must allowlist `prod`, `dev`
  AND `beta` — GitHub's default is main-only, which rejects channel-triggered
  deploys with "not allowed to deploy due to environment protection rules"
  (bit on first deploy, 2026-07-24; fixed via
  `gh api -X POST repos/…/environments/github-pages/deployment-branch-policies -f name=dev`).
- **Channels share the browser origin**, so the save key is channel-scoped
  (`meta.js` appends `.dev`/`.beta` from the path) — a dev playtest can never
  read or overwrite the real save.
- Prod gate detail: a red test blocks the deploy — the pipeline enforces the
  ship loop, not convention — and so does an out-of-band calibrate (ADR-0003
  guardrail: fresh-run median death wave in [5,10]), making the onboarding band
  unskippable rather than a remember-to-run tool. 32 trials (vs the local
  default 12)
  because the robot is genuinely random and a flaky gate stops being enforced —
  and because the whole sweep costs ~1s, flake resistance is nearly free; a
  persistent boundary-flake means the band or the trial count needs an explicit
  decision, not a re-run-until-green.
- Pages serves `dist/index.html` — the **full standalone document**, so the game owns
  its `<head>` (viewport meta, `user-scalable=no`) with no wrapper between the
  browser and the canvas. This is why Pages is canonical: the Claude Artifact viewer
  wraps `dist/artifact.html` in its own skeleton + mobile chrome — an opaque layer we
  can't inspect or control. (Correction 2026-07-23: the mobile upper-left-quadrant bug
  originally blamed on the viewer was OURS — canvas replaced-element sizing, fixed in
  `styles.css` `#field`. The viewer's real strike is the cursor-desync plus being
  undebuggable from here; the wrongly-convicted bug is not part of the case.)
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
- **localStorage key `pointdefense.gdd.comments.v1`** — GDD inline review comments
  (browser-local; exportable as anchored markdown from the GDD page's comment bar).
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
| `gdd/index.html` | **The Game Design Document** — the experience spec, top of the `.md` tier (GDD > README/core.md). Living HTML, cross-linked |
| `src/core/` | Pure domain core — see `src/core/core.md` |
| `src/app/`  | Browser shell: loop, rendering, input, UI, audio — see `src/app/app.md` |
| `test/`     | node:test suites over `src/core` (the enforceable spec) |
| `scripts/build.mjs` | esbuild bundling to single-file `dist/` outputs |
| `adr/`      | Architectural decision records |
| `PINS.md`   | Deferred work and asides |
