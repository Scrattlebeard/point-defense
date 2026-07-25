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

## Siege pile-up feel — the telegraph landed, the death shape still needs thumbs
- **What (landed 2026-07-25):** besiegers now telegraph. `e.sieging` and `e.strike` are
  explicit sim state (the shell owns the fact, the view reads it), and a **collapsing red
  dashed ring** tightens onto an attacker through the last ~0.28s of its cadence before it
  pops. Verified on the new `?specimen=siege` plate: with six identical shapes on the rim
  you can now tell which one is about to hit you, which was impossible before.
- **Design note worth keeping:** the first attempt drew a spur pointing *at the Point* —
  semantically right ("this thing is stabbing you"), visually wrong, because it lands in the
  busiest pixels on screen (tower glow, hp arc, the other besiegers). Brightening the
  attacker's outline was also rejected: white-and-thick already means "this took damage".
  The channel had to be one nothing else uses — red, dashed, transient, around the shape.
- **What remains, and it needs thumbs not a sim:** the *pile-up feel*. A surrounded tower
  takes N x dmg / 0.9s sustained instead of N one-shot hits — does death read as a siege
  lost, or as an abrupt melt? Related and still open: the measured death shape is a median
  40s bleed of which only ~6s is the drowning; the level-up heal cut invoicing 34s -> 19s
  but did not fix it, and this telegraph is the *attribution* half of the same problem.
  Whether attribution alone makes a chip death feel earned is exactly the thing a sim
  cannot answer.
- **Where:** `src/app/enemies.js` (sieging/strike state), `render.js` (the ring),
  `core.md` Enemies, app.md "A besieger telegraphs its strike", `test/siege.test.mjs`,
  `?specimen=siege`.
## Lattice layout: probably back to radial web (GDD session, 2026-07-24)
- **What:** Daniel, during GDD vision talk: "tech tree should probably go back to radial web." The radial defense-grid metaphor is part of the visual language (radiation from the Point); ADR-0005 moved the lattice to horizontal rectilinear, trading metaphor for scroll ergonomics.
- **Why:** The GDD-level visual language (radials, Tron/cyber geometry) outranks screen ergonomics if a workable radial rendering exists.
- **Where:** `src/app/lattice.js`, ADR-0005 (supersede via new ADR if done); GDD visual-language section once it exists.
- **Context:** "Probably" — a candidate, not a commitment. Revisit against whatever made 0005 abandon radial (check the ADR's alternatives before re-deciding).

## The retired sector's slot is open — leading candidate: the deck sector
- **What (landed 2026-07-25):** the Salvage income line (`salv1`-`salv4`, `goldrush`,
  `quartermaster` — 1255◆ for x2.35 shard income) is **retired** for breaking
  Law·No-meta-accel, and with only War Chest left the band was a visibly empty lane, so
  the **Salvage sector was removed** from `SECTORS` too and War Chest moved to Mind (it
  already cross-linked there). Retired ids **refund their shards once at load**
  (`RETIRED_NODES` + `tech.js refundRetired`) — respecs are free, so a retirement must
  never cost the player their investment.
- **What remains:** the game is down to six sectors and the lattice is 64 nodes. A seventh
  band is cheap to re-add when one earns a theme. **Leading candidate: the deck sector** —
  nodes whose whole job is `unlockGeneric`, i.e. authoring what card types exist. That
  directly serves GDD section 6's organizing principle (still only 16 of 64 nodes author
  anything) and needs no new mechanism, because the `techLock`/`unlockGeneric` seam already
  exists. It would also give the meta layer a lane that is about *decks* rather than stats,
  which is the distinction the GDD keeps drawing and the lattice keeps blurring.
- **Why not tonight:** picking card types is content design, and the honest version wants
  the GDD's Builds/Meta chapters (or Daniel) to say what a "deck" node should feel like.
  Inventing five card types at 9am on my own authority is exactly the "content ahead of the
  Route's order" the Route warns about.
- **Where:** `src/core/config.js` SECTORS + LATTICE + GENERICS, `tech.js`, `core.md` "The
  Lattice", `test/tech.test.mjs` (the band-order literal is duplicated there ON PURPOSE so
  a sector change lands as a reviewed diff), `test/economy.test.mjs`.
- **Open economy question, with the measured table:** the full lattice is now ~47 runs at
  wave 20 / ~71 at wave 15 / ~25 at wave 30 — several hours, not weeks. Retiring salvage
  roughly doubled it (was ~25 runs with salvage bought first). Whether that is the right
  arc is Daniel's call; ADR-0003 already records the curve as provisional. Do **not** inflate
  costs to hit a slogan — decide the target first, then tune to it.
## Haptics + better sound design
- **What:** `navigator.vibrate` on tower hit / boss spawn; richer synth (noise bursts for explosions, filter sweeps).
- **Why:** Phone-first game, big cheap juice win.
- **Where:** `src/app/audio.js`, hooks already exist at every `sfx()` call site.
- **Context:** Synth is deliberately minimal one-shot sweeps now; audio.js isolates all of it.

## Boss signature moves: two built, five deliberately unbuilt
- **What (landed 2026-07-25):** `BOSS_MOVES` in config.js keyed by boss NAME, executed by
  `runBossMove` in enemies.js (decisions in core, execution in shell). **Sir Cumference:
  adds** — shakes 2 darts from his sides every ~6s, which is GDD section 3's canonical
  ninety seconds verbatim. **The Obtuse One: surge** — +60% speed below 35% hp, so chip
  damage without commitment becomes the worst option. Moves fire from **wave 10**, leaving
  the wave-5 noble a clean ram.
- **What remains:** five names still differ only by HP — Lord Rhombus, Grandmaster Hexley,
  Polygothra, Marquis de Sides, The Final Vertex. Each wants ONE move posing a distinct
  focus dilemma; the mechanism is built, so each is now a table entry plus a small branch.
  Candidate directions (not decided): a radial projectile burst (forces walls/positioning
  rather than aim), a shielded phase (forces sustained focus over chip), a slow field that
  punishes standing still, a death-split into two half-bosses.
- **Why not tonight:** five behaviours is content, and content is cheap to add badly. Each
  wants its own balance pass against the conductor, and inventing five dilemmas in one go
  at the end of a night is how you get five variations on "more damage".
- **Where:** `src/core/config.js` BOSS_MOVES, `src/app/enemies.js` runBossMove, `core.md`
  Enemies "Boss signature moves", `test/bossmoves.test.mjs`.
- **Context / watch-list:** adds spawn OUTSIDE the wave budget, like splitter children — so a
  boss with adds inflates real body counts at depth. Sim-verified only (calibrate median 10
  in band, conductor holds); whether "the boss shakes and two darts fly out" reads as a
  dilemma or as noise is a thumbs question.
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
## [phase 3] The content drip: the front is still bunched, the back is answered
- **What (resolved half, 2026-07-25):** the drip no longer ends at 23. Variant stacking
  lands at wave 40 with its own introduction beat — **"MODIFIERS ARE COMPOUNDING"**,
  carrying the actual stacked specimen as its icon — alongside boss epithets at the same
  wave. Waves 24-39 are now deliberately empty of *new pieces*: the content there is
  combination, not vocabulary, which is GDD section 5's doctrine rather than a gap in it.
  That position is written into `core.md` Introductions so it reads as a decision.
- **What remains:** the *front* of the drip is still bunched. Three beats land on waves
  4-5-6 (tank, boss, swift) — squarely where ~45% of fresh runs die — so peak
  content-firehose still coincides with peak difficulty wall. Spreading those is a real
  onboarding improvement and is independent of everything above.
- **Also unresolved:** debut waves are **stochastic, not deterministic**. Swift's nominal
  wave-6 debut only fires that wave in ~45% of runs (1.5% roll x ~39 spawns), so the first
  modifier beat reliably slips to 7-8. The spec states debut waves as if fixed. Either pin
  the first sighting (force the debut variant onto one spawn in its debut wave) or state
  the slip honestly in `core.md`. Pinning it is probably right — a tutorial beat that
  fires "usually" is not a tutorial beat.
- **Where:** `config.js` ENEMIES.minWave + VARIANTS.minWave, `waves.js` rollVariants (for
  a forced first sighting), `core.md` Introductions.
- **Context:** Do NOT invent new species past 23 to fill 24-39 — that is content ahead of
  the Route's order, and stacking already answers the late game.
## [phase 4] The lattice authors the draft — the seam exists, 54 nodes still ignore it
- **What (landed 2026-07-25):** `GENERICS` is now a pool with `techLock`, gated by a node's
  `effect.unlockGeneric`, mirroring the `techLock`/`unlockWeapon` contract weapons already
  had. `newRun` freezes the unlocked set into `S.generics`; `levelChoices` draws from it.
  Precision (`prec`) now buys the **crit card** instead of a flat +10%, which is what makes
  GDD section 7's canonical wave-30 draft implementable at all.
- **What remains:** only **16 of 70** lattice nodes author anything; the other 54 are flat
  stats. The seam is wired, the principle is not yet honoured. Converting nodes is now cheap
  and is the highest-value meta work left — each conversion turns "+8% damage forever" into
  "a card type your runs can offer you."
- **Two specific follow-ups:**
  1. `prec2`/`deadeye` are still flat `critChance`. Converting the whole chain would mean
     deciding what escalation looks like — a *stronger* crit card, a second card type
     (crit damage), or **more copies of the same card in the deck** (weight, not power).
     The third is the most interesting and needs `levelChoices` to weight by copies while
     still deduping within one draft; that is real machinery, hence not done tonight.
  2. Deliberate rebalance recorded: a fully-invested crit account now runs **20% base crit
     instead of 30%**, plus whatever cards it draws. Watch it in playtest.
- **Where:** `src/core/config.js` GENERICS + LATTICE, `state.js` newRun/levelChoices/
  applyChoice, `tech.js` effectsOf, `core.md` "Generic cards", `test/draft.test.mjs`.
- **Context:** This is the same seam ADR-0003 stage 2's **form cards** land in — a form card
  is a generic whose unlock is a mastery node rather than a lattice node. Build forms on this,
  do not invent a parallel mechanism.
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

## [phase 4] MEASURED: the slot budget makes every gun but bolt dead content
- **What:** measured 2026-07-25 over 60 mature-account runs (every lattice node owned,
  robot picks). The pin below used to say "watch for this in playtest" — it does not need
  watching, it needs a decision. Numbers:
  - **Guns are offered 0% of the time.** `scatter` 0%, `heavy` 0%, `burst` 0%. Not rare —
    *never*.
  - **All six slots fill by level ~8.6, in 60 runs out of 60**, while runs reach level ~37.
    So the build is decided in roughly the first 90 seconds and the remaining ~28 level-ups
    can only upgrade what luck already handed you.
  - Distinct weapons ever offered as new: **10.8 of 21**.
- **Why the guns are at zero, and it is structural, not luck:** ADR-0006's ceiling says a
  category held by a *different* owned weapon locks its rivals out of the draft
  (test-pinned, correct). **Every one of the four towers starts with bolt.** So the gun slot
  is occupied at t=0 in every run that has ever been played, and Scattergun, Howitzer and
  the Repeater form-pilot can never be drawn by anyone. Two individually-correct decisions
  compose into dead content: ADR-0006 anticipated *dilution*, not *lockout*.
- **The fix is already sanctioned in writing, which is why this is a decision and not a
  bug report.** ADR-0006 Decision 4: *"A chassis that opens with a Howitzer is a legible
  identity, and the gun slot is only interesting if something can occupy it besides bolt."*
  ADR-0007 Decision 1: a tower may open with a different gun, or none. Three candidate
  routes, not mutually exclusive:
  1. **Tower loadout diversity** — give one unlockable tower a different starting gun. The
     tower IS the unlock (core.md Towers), so it needs no lattice change. Cheapest, and it
     converts dead content into tower identity, which is what towers are for.
  2. **Weapon priority** (GDD section 7, the original subject of this pin) — a pre-run
     loadout surface that fixes slot identity so the draft offers *your* gun.
  3. **Let a rival gun be offered as a REPLACEMENT** rather than an addition — a swap card.
     New mechanic, most expensive, but the only one that lets a build change its mind
     mid-run, and it would also loosen the level-8.6 lock-in above.
- **Where:** `config.js` TOWERS (route 1), `state.js` levelChoices (route 3), new pre-run
  surface + `core.md`/GDD section 7 (route 2). The lockout itself is pinned by
  `test/taxonomy.test.mjs` "gun ceiling" — that test is correct and should stay.
- **Context:** I did not pick a route. Re-identifying a tower is design, and the measurement
  is the thing worth handing over; the reproduction is `scratchpad/dilution.mjs`-shaped —
  run mature-account sims, record which weapons are ever OFFERED (not taken).
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