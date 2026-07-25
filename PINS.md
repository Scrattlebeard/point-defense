# Pins

Deferred work and mid-session asides. Rules live in CLAUDE.md ("Pins") — short version: written immediately when they surface, self-contained enough to be picked up cold, candidates not commitments, deleted on resolution (git history is the archive).

## Balance pass, round 2
- **What:** Continue tuning against human play. Round 1 (2026-07-23, Daniel's first session) landed: bolt reworked to auto-fire-at-aim (spam-clicking dominated), frost slow capped at 45%, orbital knockback 60→35 (frost+orbit held enemies in place), nova/frost visuals disambiguated.
- **Why:** Deep-wave pacing, tech-tree cost curve, and beam-overheat feel are still only sim-bot-verified.
- **Where:** `src/core/balance.js`, `src/core/config.js`; spec intent in `src/core/core.md`.
- **Context:** Daniel + second playtester (2026-07-23) are the balance authority. Round 2.5 (second-playtester feedback, same day) reshaped bolt again: aimed bolt is always single/true, extras are auto-aimed (L3/L5/L6 = +1/+2/+4) — the twin-volley question is obsolete; new question is whether the auto pack makes bolt *too* much of a fire-and-forget carry at L6 (old L6 ~6 spread bolts with misses vs new 5 near-guaranteed hits). Round 3 (2026-07-24) steepened the onboarding curve — fresh-run robot death median wave 14 → 9 (method + numbers in core.md `enemyHpMult` note; the spike is 5 minutes to rebuild from the sim.test harness: run-to-death loop, report wave/lvl/time over ~10 trials). **Open:** does a fresh *human* run now die at the wave-5 or wave-10 boss as intended, and does it feel like a wall or like a cheap shot? Also still open: deep-wave pacing for tech-loaded veterans (curve now converges w~35 but budget runs ~10% under at 40), tech-tree cost curve vs shard income, beam cadence now that overheat is legible (heat gauge with re-arm notch shipped — if beam still "feels wonky" after that, the problem is mechanics, not display).

## PWA-ify: manifest + fullscreen button (the honest route to orientation control)
- **What:** Web app manifest (installable to home screen, standalone display, icon) + an
  in-menu fullscreen toggle. Optionally `"orientation"` in the manifest and
  `screen.orientation.lock()` behind the fullscreen gesture on Android.
- **Why:** True landscape-forcing is impossible on the mobile web (iOS Safari has no
  orientation lock at all; Android allows it only in fullscreen from a user gesture) —
  a manifest is the only legitimate lever, and it also kills the URL bar, which is worth
  more screen than any orientation trick. Decision 2026-07-23: do NOT force landscape —
  the game is radially symmetric, portrait one-thumb play is a feature; orientation
  stays player's choice.
- **Where:** new `manifest.webmanifest` + link tag (build script must inline-or-emit it —
  Pages can serve a second file, so no inlining contortions needed), `src/app/ui.js`
  (menu button), README Deployment.
- **Context:** Deploy is GitHub Pages since 2026-07-23, so multi-file output is fine.
  Icon could reuse the 🎯 motif; service worker/offline explicitly out of scope until wanted.

## Mastery progression (ADR-0003, ACCEPTED — stage 1 SHIPPED 2026-07-24)
- **What:** Full design: `adr/0003-mastery-progression.md` — that file is the truth.
  **Stage 1 (mega-lattice) shipped**: 57-node radial web (6 sectors × 5 rings,
  reqMode:'any' cross-links), Mines + Mortar, superlinear payout,
  `scripts/calibrate` (in band post-change: median 10, range 5–16).
- **Remaining:** Stage 2 = weapon mastery (use-earned XP per job-matched metric,
  per-weapon trees, behavior-changing aspects — XP shown post-game + mastery
  screens only, switching free). Stage 3 = tower identity paths. Decisions all
  recorded in the ADR; each stage is one overnight, independently shippable.
  Design reference for stage 2: the design project's `templates/tech-tree`
  (per-weapon tabs, multi-rank nodes, perk toggles, respec — see ADR-0005 Notes).
- **Context:** Economy curve is explicitly provisional — Daniel plays, we re-cut.
  Deep-merge + meta schema version owed when stage 2 adds nested meta fields.

## Co-op multiplayer (second-playtester request; the biggest fork since birth)
- **What:** Two-player co-op. Design direction (Daniel's, 2026-07-24, over the wife's
  "two points to defend"): **one Point, two separate weapon loadouts** — separate
  level-up picks, separately-colored fire; ownership without forking the geometry.
  Two Points recorded as considered-and-rejected-for-now: it forks enemy targeting,
  defeat conditions, every radial weapon's anchor, and the spawn-geometry invariant.
- **Why:** She wants to play *with* him, not after him. Also the first feature that
  tests whether the pure-sim architecture pays rent beyond testing.
- **Plan (sequenced, cheapest falsification first):**
  1. **Couch spike, zero networking:** `?coop` hatch — two simultaneous pointers on
     one screen (input layer already tracks multi-touch), pointer A = loadout 1,
     pointer B = loadout 2, shared XP, alternating picks. If it's not fun on one
     screen, stop; netcode can't rescue a design.
  2. **View extraction:** pure `renderView(S)` → flat serializable draw-state (S
     holds Sets + object refs, can't ship raw). Useful solo too (replays, debugging).
  3. **Netplay, host-authoritative:** host phone runs the sim; guest sends inputs
     (aim/gestures normalized to arena fractions), receives ~20Hz snapshots with
     interpolation. **No lockstep determinism** — that's the hell version; the sim
     already runs headless (sim.test.mjs), a remote player is just a second input
     source. WebRTC DataChannel; signaling via PeerJS free cloud broker (host gets
     room code, guest types it); fallback = ~100-line stateless Cloudflare Worker
     (free tier). Works phone+phone AND desktop+desktop on the same LAN (browsers
     mask local IPs behind mDNS `.local` candidates — fine on home networks, can
     need STUN fallback where multicast is blocked). Target scenario is same-WiFi;
     internet play is a non-goal until proven wanted. Bandwidth at entity cap
     ~100KB/s — trivial on LAN.
- **Where:** promotes to an ADR before implementation (this pin is the draft's
  skeleton). Touches `src/app/input.js`, `main.js`, new `net.js`; core sim stays
  untouched by design.
- **Context:** GitHub Pages hosting stays static throughout — no server of ours at
  any step. Discussed 2026-07-24 (chat); Daniel: "put a pin in it."

## Siege strike readability (follow-up to the 2026-07-24 besiege rework)
- **What:** Besiegers (core.md Enemies) currently strike with only a small particle
  burst + the generic tower shake/flash — consider a telegraph (wind-up lunge, or a
  strike flash on the attacker) so "who is hurting me" reads at a glance when several
  shapes hold the rim. Also playtest the pile-up feel: a surrounded tower now takes
  N×dmg/0.9s sustained instead of N one-shot hits — does death read as a siege lost
  or as an abrupt melt?
- **Why:** Kamikaze deaths were self-announcing (attacker vanished); a static besieger
  is easy to misread as harmless. Damage attribution is a legibility pillar elsewhere
  (flame's watch-list entry, same file).
- **Where:** `src/app/enemies.js` contact branch, `render.js` if a lunge/telegraph is
  drawn; spec in `core.md` Enemies.
- **Context:** Landed sim-verified only (calibrate in band, median 8). Daniel +
  playtester are the feel authority — first dev-channel playtest decides.

## Lattice layout: probably back to radial web (GDD session, 2026-07-24)
- **What:** Daniel, during GDD vision talk: "tech tree should probably go back to radial web." The radial defense-grid metaphor is part of the visual language (radiation from the Point); ADR-0005 moved the lattice to horizontal rectilinear, trading metaphor for scroll ergonomics.
- **Why:** The GDD-level visual language (radials, Tron/cyber geometry) outranks screen ergonomics if a workable radial rendering exists.
- **Where:** `src/app/lattice.js`, ADR-0005 (supersede via new ADR if done); GDD visual-language section once it exists.
- **Context:** "Probably" — a candidate, not a commitment. Revisit against whatever made 0005 abandon radial (check the ADR's alternatives before re-deciding).

## Salvage sector violates the new no-meta-acceleration rule (GDD session, 2026-07-24)
- **What:** GDD rule ratified: **no upgrades that speed up meta-progression** (no +shards, no meta-exp boosters) — managing the in-run-power-vs-rewards tradeoff is not fun (Daniel). The entire Salvage income line (salv1–4, goldrush, quartermaster's salvage half) violates it and must be redesigned; the sector needs a new theme (its non-income nodes — warchest etc. — can stay).
- **Why:** Two laws convict it: the ratified rule, plus the focus law (income nodes are an optimizer's no-brainer first-buy — never a real choice). Corollary rule: QoL unlocks are milestone-granted by total investment (e.g. third hold weapon → hold-priority auto-unlocks), never explicit purchases.
- **Where:** `src/core/config.js` LATTICE Salvage sector, `tech.js` effectsOf salvageAdd, `state.js` payout, `core.md` + ADR-0003 (supersede note), state tests pinning salvage.
- **Context:** Save-compat: owned salvage nodes need a migration story (free respec makes this easy — refund on load). Redesign is open; do it when the GDD Builds/Meta chapters land.
- **Audited 2026-07-25 — the numbers, and a second conviction.** Six nodes, all `salvageAdd`: `salv1` 15◆ · `salv2` 40 · `salv3` 100 · `salv4` 250 · `goldrush` 600 · `quartermaster` 250. Full line = **1255◆ for ×2.35 shard income**, paying for itself in ~2 wave-20 runs. It is also what breaks the cost-curve claim: the whole 70-node lattice costs **~22 wave-20 runs ≈ 4 hours** with salvage bought first, ~49 runs without — against `core.md` and ADR-0003 both promising "weeks of play." Deleting the line is half the cost-curve fix on its own. Pin correction: `quartermaster` has no "salvage half" — it is 100% income. (xp nodes are clean: `xpAdd` reaches `S.xpMult` only, never `payout` — legal per the law's own parenthetical.)

## Haptics + better sound design
- **What:** `navigator.vibrate` on tower hit / boss spawn; richer synth (noise bursts for explosions, filter sweeps).
- **Why:** Phone-first game, big cheap juice win.
- **Where:** `src/app/audio.js`, hooks already exist at every `sfx()` call site.
- **Context:** Synth is deliberately minimal one-shot sweeps now; audio.js isolates all of it.

## Boss behaviors beyond the ram
- **What:** Give later bosses (name list in `config.js: BOSS_NAMES`) one signature move each — e.g. spawn minions, radial dart burst, speed surge at low hp.
- **Why:** Every 5th wave currently differs only in hp scale; names deserve behaviors.
- **Where:** `src/app/enemies.js` (boss branch), spec first in `src/core/core.md` Enemies.
- **Context:** Keep decisions in core (a `BOSS_MOVES` table), execution in shell, per pillar 5.

## Weapon icons: remaining consumers (level-up cards + weapons bar shipped 2026-07-24)
- **What:** Icons now flow via generated `src/app/icons.js` (regen:
  `scripts/icons.mjs`; source `assets/icons/`, provenance in its icons.md).
  Wired: level-up cards, in-game weapons bar. Still unwired: pause stats panel
  rows, Lattice node detail card, mastery screens (ADR-0003 stage 2).
- **Why:** Same scannability argument, lower urgency — pause and Lattice are
  read at leisure, not mid-fight.
- **Where:** `src/app/ui.js` statsHTML, `lattice.js` node card; spec in `app.md`.
- **Context:** `WEAPON_ICONS[id]` is the seam; contract test `test/icons.test.mjs`.

## The Armory: human-hands balance pass (ADR-0004 shipped 2026-07-24 overnight)
- **What:** All ten new weapons (scatter/burst/heavy/boomer · flame/meteor/blades ·
  catapult/caltrop/cascade) are sim-verified only — numbers in `config.js` are
  first-draft tuning. Also provisional: Armory/Arsenal node costs, and the whole
  gesture-slot *feel* (does locking beam out after picking flame read as a choice
  or a trap?).
- **Re-cut by ADR-0006 (2026-07-25):** the ten survive almost intact, but two move —
  `boomer` becomes an **auto** (its output doesn't scale with aim), and `burst` is demoted
  from a base to a **form of bolt**, becoming the pilot for the whole form system. The
  gesture-slot feel question is superseded by the slot *budget* question: does ≤6 total
  with ≤1 gun/hold/swipe read as identity or as a cage? That is the first thing to watch
  in the next playtest.
- **Why:** Daniel + playtester are the balance authority; the calibrate band only
  guards the fresh-run curve (all ten are tech-locked, so onboarding is untouched —
  verified in band, median 10, 2026-07-24).
- **Where:** `src/core/config.js` weapon stats; specs in `core.md`; ADR-0004.
- **Context / watch-list from the builder:** boomerang turn range is a fixed
  ~484px (speed²/2·decel) regardless of screen — may feel short on desktop
  ultrawide, long on phone; catapult targets a random living shape (may read as
  aimless — candidate: bias toward the densest bearing); cascade cd 5.5s is
  deliberately long (the weapon is a timing play), may frustrate before it
  clicks; flame burn numbers are suppressed (fire flicker is the feedback) —
  check that damage still feels attributable.

---
*The pins below came out of the 2026-07-25 prototype-vs-GDD audit. They are the mechanical
breadcrumbs for GDD §11's Route; the phase tags say where each one belongs in the order.
Numbers are measured (headless spikes over the real sim), not estimated.*

## [phase 4] Burst rides as an interim auto — make it a true form of bolt
- **What:** ADR-0006 demoted `burst` (Repeater) from base to a form of bolt. Interim
  state (2026-07-25, taxonomy landing): `category: 'auto'`, `formOf: 'bolt'` — offered
  in the draft only once bolt is maxed (the "card you draw at max level", ADR-0006
  Alt-4), but it still **costs one of the six slots** and fires *alongside* bolt rather
  than replacing bolt's rhythm. A true form costs no slot and swaps the base's cadence.
- **Why:** Category `gun` was impossible interim (bolt holds the ≤1-gun ceiling, so a
  gun-burst could never be offered); `auto` is the honest approximation and is recorded
  as such in core.md "Aim-input ordnance". The gate already pilots the mastery flavor.
- **Where:** `config.js` burst entry (`formOf`), `state.js` levelChoices form gate,
  `core.md` Aim-input ordnance, `test/taxonomy.test.mjs` burst-gate test; the real form
  system is ADR-0003 stage 2 + ADR-0006 Decision 6/8.
- **Context:** When forms land, burst stops being a separate weapon: it becomes bolt's
  alternate rhythm, the slot cost disappears, and the levelChoices `formOf` gate + this
  interim classification are deleted.

## [phase 3] The rim dead zone — re-measured 2026-07-25, and the pin was partly wrong
- **What:** Orbit, mines and caltrops deal **literally zero** damage to a shape holding the
  rim, at every level. Re-measured 2026-07-25 against a grunt parked at the rim for 12s:
  orbit 0, mine 0, caltrop 0 — while every *targeting* auto works fine there (nova 72-280,
  tesla 114-470, turret 156-1680, seek 60-1400, mortar 176-1000). The gap is specific to
  the **positional** autos: a grunt besieges at 36px from centre, orbit's ring is 96-128px,
  and mines/caltrops seed no closer than 120px.
- **Correction to the original pin:** it listed **frost** as a fourth dead-zone weapon. That
  is wrong in a way worth keeping. Frost's aura is 126-230px and *does* cover the rim — the
  zero is because slowing a shape that has already stopped is meaningless. That is inherent,
  not geometric, and no radius change fixes it. The pin also called GDD §3's narration
  ("the frost aura and orbitals slow their progress when they approach the Point") false;
  for frost it is **true** — it describes the approach, which frost does slow. Only the
  orbital half of that sentence is unmet.
- **Why it is still not fixed, and this is the interesting part:** the pin framed this as the
  mechanism behind the invoicing-death problem. Measured, the bigger lever was elsewhere —
  the missing level-up heal (GDD §2's named mechanism) cut median invoicing from 34s to 19s
  on its own, and cost the delegation law nothing. The rim fix, by contrast, **gives autos
  more power**: it fixes Law·Death-shape while pushing the conductor number down (ADR-0008
  Alt 3). Sequence it as its own change, measured alone against `scripts/conductor.mjs`.
- **Where:** `src/app/weapons/auto.js` (orbit radius/hit test), `src/app/enemies.js` siege
  standoff (`e.r + TOWER_R`), `src/core/config.js` orbit ring + mine/caltrop seed ring,
  `core.md` Enemies + Weapons.
- **Context:** Two candidate fixes remain, and the second is still the more interesting:
  contract the orbit band to cover the rim, **or** push the siege standoff *out* to the
  orbit band so the ring becomes the literal wall the horde piles against (the picture GDD
  §8 wants). Note the second changes a strong image — shapes would no longer touch the
  tower — so it is a feel call for Daniel, not a tuning one. Also note orbit's radius was
  pushed *out* deliberately in 2026-07-24 as a nerf; contracting it undoes a considered
  decision and should say so. Companion: the siege-readability pin (damage attribution is
  the other half of why a chip death reads as bookkeeping).
## [phase 3] The content drip stops at wave 23
- **What:** Introductions land at waves 1,2,4,5,6,8,11,14,17,21,23 and then **nothing, ever**.
  Three beats bunch into waves 4-5-6 (tank, boss, swift) — squarely on the wave where ~45% of
  fresh runs die — and there is a 4-wave gap at 17→21.
- **Why:** GDD §9 says "roughly one new shape or modifier every 2–3 waves, stretching past
  wave 20." Satisfied on the letter (23 > 20), violated in spirit by the other 77 waves of a
  run the GDD aims at wave 50–100. Peak content-firehose currently coincides with peak
  difficulty wall.
- **Where:** `config.js` ENEMIES.minWave + VARIANTS.minWave, `core.md` Introductions.
- **Context:** New species/modifiers past 23 are phase-3 content and shouldn't be invented to
  fill the gap — variant *stacking* is the intended late-run "new thing." Also note the debut
  waves are stochastic, not deterministic: swift's nominal wave-6 debut only fires that wave
  in ~45% of runs (1.5% roll × ~39 spawns), so the first beat reliably slips to 7–8. Spec
  states them as if fixed; either pin the first sighting or record the slip.

## [phase 4] The generic card pool is hard-coded — it should be lattice-authored
- **What:** `GENERICS` is a fixed 4-entry object (`config.js:173`) and `state.js:88` pushes
  all four into every draft unconditionally. Nothing in the lattice can add, remove or modify
  a generic card. Make it a pool with unlock gates the way weapons already are —
  `{id, effect, req: nodeId?}` plus a filter in `levelChoices`.
- **Why:** This is GDD §6's organizing principle — *"the account authors the draft"* — and
  today **15 of 70 lattice nodes (21%)** do anything of the kind; the other 55 are flat
  stats. The GDD's canonical wave-30 draft is literally not implementable: it offers a crit
  card that "joined the pool when we unlocked crits," while `prec`/`prec2`/`deadeye` are
  permanent passives folded into `S.critChance` at run start. One seam fixes both, and it is
  the same seam ADR-0003 stage 2's form cards land in.
- **Where:** `src/core/config.js` GENERICS, `src/core/state.js` levelChoices, `tech.js`
  effectsOf (crit moves from passive to pool-unlock), `core.md` Generic cards, ADR-0003.
- **Context:** Cheapest high-leverage change in the meta layer — small diff, and it converts
  the GDD's top-line meta principle from aspiration to mechanism. Do it before adding more
  lattice nodes, or every node added is one more flat stat.

## [phase 4] The mature-tree start reaches level 3, against a spec asking for ~20
- **What:** `startLevelAdd` exists on exactly two nodes (`head` 45◆, `head2` 250◆, +1 each),
  so a fully-invested veteran starts at **level 3 with 2 banked picks**. There is no
  wave-skip mechanism at all — `S.wave` starts at 0 for everyone.
- **Why:** GDD §7 wants "enough total investment lets a veteran start at ~level 20 / wave 20,
  clicking through banked picks," and GDD §9 leans on it hard: "veterans exit the onboarding
  waves entirely" is what lets onboarding pacing stay uncompromised. Neither holds.
- **Where:** `config.js` LATTICE (Mind sector), `tech.js` effectsOf, `state.js` newRun,
  `game.js` wave init, `core.md` Run state.
- **Context:** The wave-skip is the harder half and needs a decision: does a veteran skip
  waves 1–20 outright (and forfeit their shards/XP), or fast-forward them? Also interacts
  with Law·QoL-milestone — this is arguably the flagship milestone grant rather than a
  purchase, which would mean retiring `head`/`head2` as buyable nodes.

## [phase 4] Pool dilution: weapon priority moves from TENTATIVE to urgent
- **What:** GDD §7's weapon-priority mechanic — deterministic slot resolution, so when a
  hold-weapon offer appears it is *your* flamethrower. Zero code surface today.
- **Why:** ADR-0006's six-slot budget against ~20 unlocked weapons means the specific weapon
  a build wants may simply never be offered. The cap does not create the problem, it reveals
  it — build identity dies to draw luck exactly when scarcity is supposed to be creating it.
  GDD: "randomness survives in tempo, dies in identity."
- **Where:** new pre-run loadout surface (`src/app/ui.js` + meta), `state.js` levelChoices,
  `core.md`, GDD §7 (badge moves off TENTATIVE when the shape firms up).
- **Context:** Watch for this in the first post-cap playtest — if a capped run feels like
  hoping rather than choosing, this is why, and it jumps the queue.

## [phase 3] Stacked legibility on a real phone (the plate says yes; thumbs haven't)
- **What:** Variant stacking shipped 2026-07-25 with an annulus allocator (outer channels
  claim successive slots) and an armored contrast fix (a dark backing stroke — it was the
  faintest channel on the plate, and the costliest to misread at x2.5 hp). Verified with the
  new `?specimen` hatch at 3x magnification: every single, every pair, every three-way stack,
  on both the smallest silhouette (dart) and a large one (elite). **The shape channel
  survives** — a triple-stacked dart still reads as a triangle, which was the load-bearing
  worry.
- **Why it is still open:** the plate is frozen, magnified and uncluttered. A wave-45 fight
  is none of those. What is NOT verified: stacked shapes in motion, overlapping each other,
  behind flame licks and nova rings, at 1x on a phone in daylight.
- **Where:** `?specimen` (README dev hatches), `src/app/render.js` variant branches,
  app.md "Stacked highlights".
- **Context:** Cheap to check — `?specimen&kind=dart` on the dev channel from a phone, then
  a real run past wave 40. If a channel drowns, the annulus allocator is the place to widen
  slots and the armored backing-stroke trick generalises to any channel that needs contrast.