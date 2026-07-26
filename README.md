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
TEST_SEED=7 npm test  # same suite on a different random stream (see below)

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
dev — capped at each weapon's max) · `&form=bolt:fan` wears a form (maxes its base
weapon first; forms are otherwise only reachable by a full run) · `&sparks` enables the ambient grid sparks
in-battle (menu has them by default — app.md "Grid sparks") · **`?cards`** opens the level-up screen showing one of every card type at once (new
weapon · upgrade · form · passive) — form cards otherwise need a maxed base weapon and an
unlocked-but-unworn form, so the markup is hard to reach by playing ·
`?pause` opens the pause
panel on a furnished run · `?over` and `?records` photograph the death payout and the
high-score/achievement screens (all three are click-gated in play; all are in-memory only and
never touch the save) · `?bestiary` opens a fully-revealed bestiary,
in-memory only · `?lattice&shards=N` opens the Lattice with a faked balance
(in-memory only — node states photographable) · **`?specimen`** lays stacked-variant
specimens out on a *frozen* field so the highlight grammar can be photographed —
bare `?specimen` gives every single and every pair, `=triples` every three-way stack,
`=armored+regen,swift+volatile` explicit combos, `&kind=dart|elite|…` picks the
silhouette (default `dart`, the smallest and so the worst case for ring crowding).
`=charge` stages the **interruptible boss wind-up** — five points across the fill range plus
one staggered boss, since the live window is ~1.1s once every 7s and a screenshot of a real
fight essentially never lands inside it. `=siege` stages the **strike telegraph** instead: one besieger per phase of the 0.9s
cadence plus one caught mid-blow, frozen at the rim — the tell is a ~0.25s window, so
a live screenshot almost always lands in the quiet part of the cycle. These are the
tools the legibility checks use; eyeballing a live wave-40 fight is how the channel
collisions got shipped in the first place. Magnify it with the
dpr profile trick above (`devPixelsPerPx = 3`).

**Test determinism.** Most of the sim runs on bare `Math.random` (spawn bearings,
crit rolls, variant rolls, weapon jitter), so every test that drives the sim used to
inherit that — those tests were not deterministic, they were *comfortably inside
their margins*, which is a weaker property that decays every time balance moves. One
of them (a form neutrality check carrying ~20% crit noise) failed about one run in
seven and was only caught by running the suite twenty times after an unrelated
landing. Sim rigs now call `seedRandom()` from `test/seed.mjs`, so a thin-margin test
fails *every* time instead of *sometimes* — you find out at the keyboard rather than
in CI next week. **The cost, stated plainly:** a fixed seed also removes the
incidental coverage that random variation gave. `TEST_SEED=<n> npm test` buys it back
deliberately — sweep it after balance changes. Swept 1–8 and 11–30 at landing: clean.

Balance tooling: `node scripts/calibrate.mjs [trials]` runs fresh no-tech robot
runs to death and checks the median against the onboarding band (ADR-0003
guardrail: re-run before landing early-difficulty or player-power changes; exits
non-zero when out of band).

Delegation tooling: `node scripts/conductor.mjs [pairs]` is the **conductor
gate** (GDD §3 Law·Delegation; ADR-0006/0007 consequences): same-seed pairs of
40-sim-minute headless runs on the strongest slot-budget-legal delegation build
(`--scan` re-derives it) — one with the aim parked at t=0 and never touched, one
with the 0.2s-retargeting robot. Two ratchets, both required, raised on
re-measure and never quietly lowered: **hands buy ≥ 1.12× survival time**
(median `robot.time / parked.time`), and **the parked run must die ≥ 2 times per
set** — "autos are deliberately insufficient alone" as a number; this second
clause is what catches a future weapon quietly re-automating the game. Measured
2026-07-25 over three 11-pair sets: survival ratio 1.176 / 1.204 / 1.194, parked
deaths 11/11 in every set (pre-cap baseline: parked survived to wave 58 at 100%
HP — the do-nothing run could not die at all). Deterministic given the code
(every rng call seeded), so a trip always means the sim changed. Wired into the
prod gate beside calibrate.

> **⚠ THE CONDUCTOR GATE IS KNOWINGLY RED (2026-07-26, ADR-0013).** Hands buy
> **×1.000** against a ≥1.12 band; the parked-deaths clause still passes (3/11).
> **You did not break this.** `BOSS_AUTO_RESIST` — a permanent, invisible 50% tax on
> delegated damage — was the only thing enforcing Law·Delegation at the boss, and it
> was removed deliberately: a hidden multiplier corrupts every measurement taken
> through it, so no other balance lever could be trusted while it existed. The law is
> now visibly unenforced instead of invisibly upheld, which is the safer of the two.
> `scripts/promote` will refuse prod until it is green again — that is the gate
> working. The replacement is an **episodic, telegraphed boss guard**; see ADR-0013
> and PINS.

The gate scores **survival time, not wave reached** (ADR-0010). Wave-reached is
rate-sensitive — a Force Wall halves the rate waves arrive at with no survival
cost, so good play posts a *lower* wave number — and it is quantized to 5,
because deaths land on boss waves (63 of 63 measured deaths at wave 30/35/40/45).
The old `hands ≥ 3 waves` band therefore sat below one quantum of its own metric.
Δwave is still printed, ungated, labelled with its resolution. **Known coverage
gap:** the robot only *aims*, so the gate proves one of Law·Delegation's three
input dimensions; hold and swipe are unmeasured. The metric no longer inverts if
the robot is taught them, which is what makes that work possible.

Boss tooling: `node scripts/bosstime.mjs` reports how long a boss is **alive during
a real wave**, on the build a player actually holds at that depth (natural
level-ups), for both a fresh account and a full lattice. This is the instrument that
keeps `referenceDps` honest — that constant is *fitted* to measurement, so it rots
whenever weapons change, and this makes it rot loudly. Deliberately **not** in CI: a
useful reading takes minutes, and a gate slow enough to skip is worse than none.
Current: fresh account **104s** median over waves ≥15 against a `BOSS_TTK_TARGET` of
100s; full lattice 20s. See ADR-0012 for why the target is 100 and not the intended
60.

Performance tooling: `node scripts/perf.mjs [maxWave]` is the **JS-cost gate**. It
runs a seeded headless game against a stub 2D context and times `updateGame` +
`renderFrame` per frame, bucketed by wave, then fails if the worst wave's JS
exceeds **25% of a 16.67ms frame**. It gates a *share of a frame*, never a
millisecond count — absolute times depend on whichever machine CI got, and an
absolute threshold beside a moving target is this codebase's most repeated defect.
Wave 0 is discarded as JIT warm-up (measured 0.082ms at *zero* entities, three
times wave 22's cost with 38 of them). Wired into the prod gate beside calibrate
and conductor, existence-checked like the others.

**What it can and cannot see, stated up front because the distinction is the whole
point.** A stub canvas draws nothing, so this bounds **our JavaScript** and is
blind to **rasterisation** — which is where a canvas game on a phone actually
spends its budget. Two measurements from 2026-07-25 bracket it:

| what | where | cost per frame | entities |
|------|-------|----------------|----------|
| our JS (sim + draw path) | node, stub canvas | **0.02–0.04 ms** (0.2% of budget) | 14–38 |
| a real rendered frame | headless Firefox, desktop | **p50 2.0 ms · p95 3–4 ms** | 1–7 |

So rasterisation costs roughly **a hundred times** our own code, and it is already
12–24% of a frame on a *desktop* with an almost-empty field. **A green perf gate
therefore says nothing about whether the game is playable** — it says our loops did
not regress. The playability question is answered by `?perf` on a real device.

**`?noblur` — the A/B switch for the current suspect.** Suppresses every
`shadowBlur` in the renderer. Canvas shadow blur is the most expensive 2D
operation on a mobile GPU (each forces an offscreen blur pass), and this renderer
applies it *per enemy*: every shape flashing from a hit, plus every swift one.
Measured **2.5 blurred draws per frame at wave 14 rising to 7.3 by wave 29** — the
right shape to explain the observed p95 step, and unmeasurable here because
nothing in this repo can time a GPU. Run the same waves with and without it and
compare the `drop` column. Pinned by a test asserting the hatch removes *all*
blurred draws and the default keeps them: a hatch that quietly does nothing would
send back a null result and retire a live suspect for the wrong reason.

**`?perf` — the on-device instrument.** A canvas-drawn overlay (canvas, not DOM, so
it survives a fullscreen PWA *and* lands in a headless screenshot) showing live
p50/p95/max and a per-wave table: **p50, p95, drop%, work, ents**. **p95 is the
headline, not the mean:** a run that draws 90% of frames in 6ms and 10% in 40ms
averages "fine" and feels broken — judder is a tail property. Off by default and
free when off; `G.perf` stays null and the sampler is never called.

Two columns, because either alone is half an instrument:

- **p50 / p95 / drop** are the **gap between `requestAnimationFrame` callbacks** —
  what the player actually got. Compositing happens after we return, so timing
  only our own work would report a comfortable number while the phone stutters.
- **work** is the wall time our `updateGame + renderFrame` consumed *inside* the
  frame (sampled before the HUD draws itself — an instrument must not bill the
  player for its own overlay). This is the headroom reading, and it exists because
  the gap is **vsync-quantized**: once locked, "we spent 3ms and waited" and "we
  spent 16ms and just made it" are the same number.

**Each row is the worst ~2s window of its wave, not the wave average.** A wave
ramps — spawns arrive, the field fills, the player clears it — and Daniel's second
capture named the consequence: *"p50 would often go to 33, then drop back down to
16.7 at the end of the level when the active enemies had been thinned out."* An
average over that reports neither half. Worse, it smears **both axes at once**: the
first capture appeared to show the wave-20 step happening at the fewest entities on
the table, which read as evidence that cost was not entity-driven — but those counts
were wave-long means too, so the comparison was invalid. The entity count is now the
mean **inside the same window** as the timing, co-timed, so the row is internally
consistent and the cost-versus-count question can actually be asked.

**The startup frame is not sampled.** `last` is stamped at module load, so the first
rAF gap spans page setup (and any pre-sim) and reports a multi-second "hitch" no
player experienced — the 2199ms `max` in the first phone capture was exactly this.

**`drop` is relative to the refresh interval, never to an absolute budget.** The first phone
capture returned p50 = 16.7 at every wave from 17 to 45 and p95 of exactly 16.8 /
33.4 / 50.0 — one, two and three refresh intervals on a 60Hz panel. The original
"longer than 16.67ms" definition therefore counted float noise and reported
**72–94% of frames over budget for a game holding a clean 60fps**, painting the
whole table red. `drop` now means *longer than 1.5× one refresh interval*, which is
refresh-rate agnostic and reads correctly on a 90 or 120Hz screen too. The interval
is estimated **session-wide** (p05 of all frames), not from the sample being scored:
a window in which every frame is 33.3ms has a median of 33.3 and would grade itself
flawless, and those are precisely the windows the peak-window table selects for.

*In a `?turbo`/`?warp` pre-sim there is no vsync, so the samples are raw draw costs
and `drop` is meaningless — the HUD prints `-` and says so, rather than colouring a
table with a number that does not apply.*

*Combined with `?turbo`/`?warp=N`, `?perf` also draws and times every pre-simulated
frame, so the load event fires with a populated table — the only way to read a
real-rasteriser cost curve out of a headless screenshot, which otherwise catches
about three frames of startup. That path measures draw cost, not frame rate: there
is no vsync or compositing in a pre-sim loop.*

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
- **The workflow lives on one branch and runs against four heads — so it may
  name nothing an older head lacks.** Every run assembles all channels from their
  branch heads, and the workflow file comes from the *pushed* branch, so the prod
  job routinely checks out a commit older than the workflow driving it. Anything
  the workflow names — a gate script, a build artifact — may therefore be absent.
  Every such reference is wrapped in an existence check and **skipped loudly** (a
  GitHub `::notice::`), never silently. Two classes exist today, both learned the
  hard way on 2026-07-24/25:
  - **Gate scripts.** Wiring the conductor gate in broke `scripts/conductor.mjs`
    resolution on prod's older head; because a prod failure blocks the deploy
    outright, the dev channel rode down with it for **20 consecutive runs / 11
    hours**. Skipping is not a loosening: a gate is a property of the commit it
    guards, and prod's commit was gated by whatever existed when
    `scripts/promote` shipped it. Hard-fail semantics mean **adding any new gate
    retroactively bricks the whole site** until prod is promoted.
  - **Build artifacts.** The PWA manifest and icons postdate prod's
    `scripts/build.mjs`, so copying them unconditionally failed the *next* run
    after the gate fix — same bug, different noun. `dist/index.html` is the only
    artifact every head is guaranteed to produce; everything else is optional.
  Pinned by `test/deploy.test.mjs`. **When adding anything to this workflow, ask
  whether prod's head has it** — the answer is usually no, because prod is
  promoted rarely and by hand.
- **Push ≠ deploy.** `git push origin main:dev` succeeding says nothing about
  whether the site updated; the run can fail afterwards for reasons that have
  nothing to do with the push. Verify with `gh run list` — the 11-hour outage
  above was invisible precisely because every push reported success.
- **Installable (2026-07-25).** `manifest.webmanifest` + `icon-192/512.png` ship
  alongside `dist/index.html`, so the game can be added to a home screen and run in
  `display: standalone` — which kills the URL bar, and on a phone that is worth more
  screen than any orientation trick. `orientation` is deliberately **`"any"`**: the
  arena is radially symmetric and portrait one-thumb play is a feature, so rotation
  stays the player's choice (decided 2026-07-23). No service worker — the game is one
  file with no runtime deps, so offline caching buys nothing worth the complexity, and
  a stale cached build is a real cost. `dist/` is therefore no longer a single file;
  the Pages workflow copies the whole directory per channel.
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

1. **Gestures are weapon classes — and the pointer is the aim.** Bolt is the **default
   weapon**, not a guaranteed one *(ADR-0006, corrected by ADR-0007: a tower may open with
   a different gun, or with no gun at all — the gun slot may sit empty)*. Guns auto-fire
   toward the standing aim point: the
   live cursor on desktop, the last touch position on mobile. Aim lines show the volley
   directions. Swipe = force wall, hold = channeled beam — unlocked in-run via level-ups,
   so the gesture vocabulary teaches itself. Every tap and swipe also updates the aim — no
   gesture is ever a dead input. *(v1 fired bolts per tap; replaced after the 2026-07-23
   playtest because spam-clicking out-damaged every auto weapon.)*
2. **Skill is prioritization; power is delegation.** Auto weapons are the level-up economy
   and absorb the *bottom* of the kill chain — never the player's attention. Autos are
   **deliberately insufficient alone**: what they buy is not rest, it is the freedom to
   spend every second of focus on the decisions that matter. The veteran is a conductor,
   hands busy every few seconds, all of it high-leverage. Build scarcity (ADR-0006's slot
   budget) and threats that cannot be delegated are what keep this true. **This pillar binds
   the default chassis:** a tower may be designed to break it outright (ADR-0007), provided
   the break is named on the pillar and reads as an identity the player chose.
   *(Rewritten 2026-07-25. This pillar previously read "attention early, idle power fantasy
   late — the Vampire Survivors curve," which GDD §3 contradicts and outranks. Taken
   seriously, the old pillar produced a measurable result: a full-gear run with the aim
   parked and never touched again reached wave 58 at full HP. Hands were worth one wave.)*
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
| `gdd/` | **The Game Design Document** (`index.html`; `comments.js` = the inline-review layer) — the experience spec, top of the `.md` tier (GDD > README/core.md). Living HTML, cross-linked |
| `src/core/` | Pure domain core — see `src/core/core.md` |
| `src/app/`  | Browser shell: loop, rendering, input, UI, audio — see `src/app/app.md` |
| `test/`     | node:test suites over `src/core` (the enforceable spec) |
| `scripts/build.mjs` | esbuild bundling to single-file `dist/` outputs |
| `adr/`      | Architectural decision records |
| `PINS.md`   | Deferred work and asides |
