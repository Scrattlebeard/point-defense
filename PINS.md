## ⚠ Law·Delegation is BROKEN (0/11) — the biggest open thing in the repo
- *(Gate authority suspended 2026-07-26 by ADR-0017 — advisory, not blocking. That is a
  statement about the gate, NOT about this finding: parked-unkillable is real, playtest
  cannot see it, and it stays at full severity.)*
- **State, 2026-07-26 after ADR-0015:** removing in-run XP took the gate from ×1.259 /
  6-11 parked deaths to **×1.000 / 0-11** — the do-nothing run reaches wave 49 at 100% HP
  and cannot be killed. Landed deliberately (Daniel: *"we can always revert"*); prod is
  blocked by `scripts/promote` until it is green.
- **The mechanism is NOT established** and that is the first job. Excluded by probe: the
  opening draft (`OPENING_LEVELS = 1` leaves it equally broken). The tidy story — power
  tied to wave number tracks difficulty, so a passive player can never fall behind —
  contradicts ADR-0015's other finding that geared runs got *weaker*. **Measure before
  designing:** instrument a parked run's level/HP/wave against a robot run under the old
  and new grant, and find where they diverge. Do not skip to a fix.
- **Cheapest candidate fix if the mechanism turns out to be "levels no longer lag bad
  play":** make the wave grant conditional on participation rather than on the clock — but
  that is a reward-for-aggression mechanic, which is a design decision, not a patch.
- **Where:** `src/core/state.js` `waveCleared`/`grantLevels`, `scripts/conductor.mjs`,
  `adr/0015` "What the gate caught", README banner.

## The older, smaller version of the same gap — the telegraphed guard
- **State, 2026-07-26 (ADR-0013), corrected same day:** `BOSS_AUTO_RESIST` is gone at
  Daniel's call, and with it the only *mechanic* making a boss undelegatable. The gate
  dipped to ×1.000 and is now back to **×1.259, parked deaths 6/11 — green, prod
  unblocked** (three identical sets; the earlier red banner was stale, nobody had re-run
  it after the boss-HP tuning landed). **Not urgent, still wanted:** the law is currently
  held up by bosses simply having enough HP to kill a parked run, which a future HP tweak
  can undo without anyone noticing.
- **The replacement, already argued and not yet built:** an **episodic, telegraphed guard**.
  The boss raises its guard on a cycle — visible, reusing the `guard` scalar and the
  telegraph vocabulary that already exist — and during that window delegated damage is weak
  while aim / hold / swipe get through. Same law, but it becomes an event that demands a
  response instead of a constant nobody learns about, which is what Law·Bosses asks for. It
  composes with the interruptible charge rather than sitting underneath it.
- **Design questions to settle first, none of them expensive:** how long the window is and
  how often; whether it should be a *separate* move or a property every boss carries (a
  property is more reliable for the law, a move is more characterful and the roster is
  already full — that tension is the real decision); and what it looks like, given
  **gold is now crowded** — `guard` breathes, the charge stagger spins, and a third gold
  thing would be a smudge.
- **Why not bundled into the removal:** Daniel asked for the removal on its own, and shipping
  an unratified design beside it would be the "decide it in code" move ADR-0013 exists to
  reject.
- **Where:** `enemies.js` runBossMove (the cycle), `config.js` BOSS_MOVES or a boss-wide
  constant, `render.js` (the tell), `core.md` "Boss signature moves", `scripts/conductor.mjs`
  to re-measure.

# Pins

Deferred work and mid-session asides. Rules live in CLAUDE.md ("Pins") — short version: written immediately when they surface, self-contained enough to be picked up cold, candidates not commitments, deleted on resolution (git history is the archive).

## The two-track progression split (Daniel's idea, parked with the passives)
- **What:** wave completion grants a **weapon upgrade**; a revived experience track grants
  **passive boosts**. Two currencies buying two different *kinds* of thing.
- **Why it's the best idea on the table:** it is the only proposal that gives XP a job it
  can't be replaced at. ADR-0015 removed in-run XP precisely because it was a costume for
  wave progress — under this split it stops being one, because the two tracks pay out in
  non-substitutable currencies and can legitimately run at different rates.
- **Why not now (his own objection, 2026-07-26):** *"probably too clever too, especially
  since we don't have many interesting passives yet."* The passive pool is a handful of stat
  bumps, so the XP track would unlock almost nothing — structure without content. Build the
  passives first; the split is worth nothing until there is something worth drafting.
- **Where:** `src/core/state.js` `waveCleared` / `grantLevels` (ADR-0015 isolated the grant
  in one function, so a second track is a small change, not a rewrite), `src/core/config.js`
  (the passive pool), `adr/0015` Alternatives §1.
- **Prerequisite, and it is the real work:** enough interesting passives to fill a draft.
  That is a content problem, not a systems one.

## Tempest lost its edge and got nothing back
- **What:** Tempest carried `xpMult: 1.1` — 10% faster levelling — as its "fragile,
  brilliant" differentiator. ADR-0015 removed in-run XP and the multiplier died with it.
  Tempest is now just 80 HP with a free Tesla.
- **Why it matters:** it is a *tech-unlocked* tower, so a player spends shards to unlock a
  tower whose identity is now "the squishy one". That is a downgrade someone paid for.
- **Options, none costed yet:** a `startLevelAdd` (discrete, reuses Head Start's machinery,
  but a one-off jump is a poor stand-in for a rate); a faster wave-clear grant on some
  cadence; or lean the other way and give it something that isn't progression at all —
  cooldown, crit, or a second free auto.
- **Deliberately not reinvented inside ADR-0015:** that change was a removal, and bundling
  an unratified tower buff into it is the "decide it in code" move ADR-0013 exists to reject.
- **Where:** `src/core/config.js` TOWERS (tempest), `src/core/core.md` tower table,
  `adr/0015` Consequences.

## Mind has no ring-1 node and may want a re-theme
- **What:** the Mind sector has now been thinned twice — the Salvage income line retired
  2026-07-25, the Quick Study xp line 2026-07-26 (ADR-0015). It is down to three nodes
  (Head Start, Running Start, War Chest) and its ring-1 slot is empty, so its lane in the
  lattice view starts at ring 2 and reads sparse.
- **Why it's worth doing:** nothing asserts against an empty ring (checked), so this is
  cosmetic *today* — but a sector whose theme was "learn faster" has lost the thing it was
  about. Either give it a new theme with a ring-1 root, or fold its three survivors into
  Hull/Arms and drop the sector (the Salvage precedent was to delete a sector once it fell
  to one node; three is above that line, so this is a judgement call, not a rule).
- **Where:** `src/core/config.js` LATTICE + `SECTORS`, `src/core/core.md` branch table,
  `src/app/lattice.js` (layout is data-driven — no code change needed), ADR-0005.

## ⚠ CALIBRATE IS MEASURING THE ROBOT'S HANDICAP — fix the instrument before the curve
- **What:** the calibrate robot only sets an aim point. It cannot hold and cannot swipe — so
  Lance Beam, Force Wall, Flamethrower and Force Blades do nothing in its hands. But
  `levelChoices` still *offers* them and the robot picks **at random**, so it regularly
  drafts weapons it can never fire and burns the pick.
- **Measured 2026-07-26, and it is not small:** filtering hold/swipe weapons out of the
  robot's choices moves the fresh-run median from **4 to 5** at 200 trials — i.e. **the
  out-of-band reading was substantially the instrument, not the difficulty.** Daniel the
  same day, on a fresh no-lattice account, got **past wave 10** and named Lance Beam as
  *"an early-game lifesaver"* — the single best early tool is one the robot cannot hold.
- **So: do NOT tune the early curve yet.** The previous version of this pin said to pay for
  the day's four difficulty changes with an `enemyHpMult` pass. That would have been tuning
  the game to fit a broken ruler.
- **Priority lowered 2026-07-26 (ADR-0017):** the gate no longer blocks anything, so this is
  no longer urgent — it is a prerequisite for *re-arming* the gates, which happens when the
  arsenal settles. Daniel: *"most of our weapons still require a proper pass."* Do that
  first; the ruler only needs to be right when we start trusting it again.
- **The decision to make first, and it wants an ADR because it moves a gate:** should the
  robot (a) skip weapons it cannot operate, (b) learn to hold and swipe, or (c) stay
  handicapped on purpose, with the band re-derived to mean "a player who only aims"? (a) is
  a five-line change and is what was measured above. (b) is most faithful and most work —
  and note the conductor's robot has the same blind spot, which matters for the delegation
  break. (c) is defensible but must be *written down*, because right now the handicap is
  accidental, not chosen.
- **Whatever wins, past calibrate numbers are not comparable across the change** — the band
  [5,10] was derived against the handicapped robot. Re-derive it in the same ADR.
- **Where:** `scripts/calibrate.mjs` (the `levelChoices` pick at ~:39), `scripts/conductor.mjs`
  (same blind spot, ~:107), `src/core/config.js` WEAPONS `input` field is the filter key,
  README "Delegation tooling" + the calibrate band note, `adr/0003` guardrail 4.
- **Working spike exists:** `/tmp/calib_usable.mjs` (disposable) — calibrate with a
  `w.input === 'hold' || w.input === 'swipe'` filter on the robot's choices.

## Bolt capstone — two things to feel for next playtest
- **What:** ADR-0014 moved the auto stream from L3 to L6. Both open questions are playtest
  questions, not spreadsheet ones — deliberately not tuned further (Daniel, 2026-07-26:
  *"we're still very early, we don't need to be super heavy-handed about the balance
  impact yet"*).
- **(a)** L5→L6 is now a ×3.7 emission step — not *new* power (L6 is unchanged) but newly
  concentrated into one purchase. Does maxing bolt feel like a milestone or a light switch?
- **(b)** Fresh-run calibrate fell 7 → 5, in band but on its floor (three sweeps at 5, two
  baselines at 7 — a real move, not instrument noise). If fresh humans now wall at the
  wave-5 boss, fix the **early curve** (`enemyHpMult`, `BOSS_TTK_FIRST`), not the ladder.
- **Where:** `src/core/config.js` bolt `stats`, `src/core/core.md` bolt row, `adr/0014`.

## Balance pass, round 2
- **What:** Continue tuning against human play. Round 1 (2026-07-23, Daniel's first session) landed: bolt reworked to auto-fire-at-aim (spam-clicking dominated), frost slow capped at 45%, orbital knockback 60→35 (frost+orbit held enemies in place), nova/frost visuals disambiguated.
- **Why:** Deep-wave pacing, tech-tree cost curve, and beam-overheat feel are still only sim-bot-verified.
- **Where:** `src/core/balance.js`, `src/core/config.js`; spec intent in `src/core/core.md`.
- **Context:** Daniel + second playtester (2026-07-23) are the balance authority. Round 2.5 (second-playtester feedback, same day) reshaped bolt again: aimed bolt is always single/true, extras are auto-aimed (L3/L5/L6 = +1/+2/+4) — the twin-volley question is obsolete; new question is whether the auto pack makes bolt *too* much of a fire-and-forget carry at L6 (old L6 ~6 spread bolts with misses vs new 5 near-guaranteed hits). Round 3 (2026-07-24) steepened the onboarding curve — fresh-run robot death median wave 14 → 9 (method + numbers in core.md `enemyHpMult` note; the spike is 5 minutes to rebuild from the sim.test harness: run-to-death loop, report wave/lvl/time over ~10 trials). **Open:** does a fresh *human* run now die at the wave-5 or wave-10 boss as intended, and does it feel like a wall or like a cheap shot? Also still open: deep-wave pacing for tech-loaded veterans (curve now converges w~35 but budget runs ~10% under at 40), tech-tree cost curve vs shard income, beam cadence now that overheat is legible (heat gauge with re-arm notch shipped — if beam still "feels wonky" after that, the problem is mechanics, not display).

## PWA: installable, and the fullscreen toggle — what is left is a phone check
- **What (landed 2026-07-25):** `manifest.webmanifest` + `icon-192/512.png` ship beside
  `dist/index.html`, so the game installs to a home screen and runs `display: standalone` —
  which kills the URL bar, worth more screen than any orientation trick. An in-menu
  **FULLSCREEN** toggle covers the not-installed case, and hides itself where the API does
  not exist (iOS Safari) rather than offering a dead button. `orientation` is deliberately
  `"any"`: the arena is radially symmetric and portrait one-thumb play is a feature, so
  rotation stays the player's choice — pinned by test so a future "helpful" edit cannot
  quietly force landscape.
- **Deliberately NOT done:** no service worker. The game is one file with no runtime deps,
  so offline caching buys nothing worth the complexity, and a stale cached build is a real
  cost on a project that ships several times a night.
- **The fullscreen and haptics buttons shipped DEAD, fixed 2026-07-25 (Daniel's first
  playtest: "Full screen button does nothing").** Both were wired to `H.onFullscreen` /
  `H.onHaptics` hooks that `main.js` never defined — a `TypeError` on every click. The
  original claim here, *"verified only in headless Firefox, where the button correctly
  appears"*, is exactly the error: **a button appearing is not a button working**, and
  the screenshot could only ever see the former. Now pinned by `test/uihooks.test.mjs`
  (every `H.<name>()` in `ui.js` must have a key in the object `main.js` passes) — see
  app.md "The hook seam is a contract".
- **What remains, and it needs a phone:** nobody has installed it. Unverified by anything
  here: whether the icon reads at home-screen size against a real wallpaper, whether
  `standalone` actually reclaims the URL bar on Daniel's device, and — still true even
  after the fix — whether `requestFullscreen` actually engages on Android Chrome. The
  seam is now proven; the *browser behaviour* cannot be, because headless has no user
  gesture to grant. That one is a thumb, not a test.
- **Where:** `manifest.webmanifest`, `assets/app-icon.svg` (+ `app-icon.md` for the
  regeneration recipe), `scripts/build.mjs` (emits the extra files), `.github/workflows/
  pages.yml` (each channel copies them — `dist/` is no longer a single file), `src/app/ui.js`
  + `main.js` (the toggle), README "Deployment".
- **Context / trap for the next person:** `firefox --headless --screenshot` on a bare SVG
  **crops** rather than scales, so rendering the 512 source at 192 gives a corner of the
  artwork. The recipe in `app-icon.md` wraps the SVG in a sized HTML page; `test/pwa.test.mjs`
  reads PNG headers so a mis-rendered icon fails loudly instead of shipping.
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

## MEASURED: bolt does half of a maxed build's damage — the concentration problem
- **What:** per-weapon damage shares in a maxed budget-legal build (bolt/orbit/nova/frost/
  tesla/turret). Re-measured 2026-07-26 on a **seeded** harness, 4 × 15 min, which is the
  instrument to reuse — the original 2026-07-25 numbers were unseeded:
  **bolt 48.7% · orbit 30.8% · nova 13.7% · turret 3.7% · tesla 3.0%** (frost 0% is correct
  — it is a slow, not a damage source).
- **The orbit half of this pin is CLOSED.** It read 0% when written; the 2026-07-25 radius
  push took it to ~36% and ADR-0020 re-shaped it to 30.8%. Orbitals are no longer dead
  weight, and the story of why is in ADR-0020, not here.
- **What remains, and it is the bigger half:** *two* weapons do 80% of the work, and the
  four others split a fifth of it between them. ADR-0006's slot budget exists to force
  identity through scarcity, but if tesla and the turrets contribute 3% each, the choice of
  what fills those slots barely matters. That is the focus law's *build* half failing
  quietly while its *attention* half (the conductor gate) passes.
- **Caveat, stated because it bounds the number:** the robot retargets every 0.2s, so bolt —
  the always-on aimed weapon — is at its theoretical best. **~49% is an upper bound**; a
  human aiming worse would shift share to the autos.
- **Second caveat, learned 2026-07-26:** the harness gives the tower 1e9 HP so a run lasts
  long enough to measure, which lets shapes pile up around the Point and flatters contact
  and aura weapons. Trustworthy for *before/after on the same build*, not as absolute truth.
- **Where:** `S.dmgBy` (core.md Run state) is the instrument; re-run the sweep after any
  weapon change. Next suspects: `tesla` and `turret` rows in `src/core/config.js`.
- **Context / not decided:** whether the fix for bolt is nerfing it, buffing the tail, or
  accepting that the default gun carries and the rest are utility. That is a design call
  about what the six slots are *for*, and ADR-0006 deliberately deferred weapon purposes
  ("taxonomy now, purposes after a playtest under the cap").

## Frost's slow cap may be re-openable now that the orbital shove is smaller
- **What:** frost's max slow was cut from 62% to 45% after the 2026-07-23 playtest, for one
  named reason: *"max slow + orbital knockback held enemies in place indefinitely."* ADR-0020
  dropped that shove from 45 to 30. The specific interaction that bought the cap is now
  roughly a third weaker, so the cap may be paying for a problem that no longer exists.
- **Why it's worth doing:** frost is the only pure-control auto in the starting pool and its
  identity is being the thing that buys time. 45% is a mild version of that identity, and it
  was set defensively rather than because 45 was measured to be right.
- **Why not now:** it is a *different* weapon's balance, changed in the same session as an
  orbit overhaul would make both unattributable — and the lock-in it guards against is a
  playtest finding, so re-opening it wants a playtest, not a harness run.
- **Where:** `WEAPONS.frost.stats` in `src/core/config.js`; the frost row in `core.md`
  carries the 62%→45% note and the reason. Re-check by playing frost 5 + orbit 5 together
  and watching whether shapes park.
## The conductor's robot only aims — hold and swipe hands are unproven
- **What:** teach `scripts/conductor.mjs`'s robot to *hold* a channel and *swipe* a gesture,
  so the gate proves Law·Delegation across all three input dimensions instead of one.
- **Why now, and why it was impossible before:** ADR-0010 replaced the gate's wave-delta with
  a survival-time ratio precisely so this could be done. Under the old metric, a robot that
  used walls well would have posted a *lower* wave number and driven "hands are worth N waves"
  **down** — the instrument inverted on exactly the play it was meant to reward. That trap is
  gone; the metric now moves the right way. What remains is honest work rather than a
  contradiction.
- **The design question to settle first (this is the real content of the pin):** what does a
  *fair* hold/swipe robot do? Holding a channel permanently flatters hold weapons (the Armory
  census records this bias explicitly), and a swipe robot that walls on every cooldown is not
  a player either. The parked/robot pairing needs a policy that is defensible as "hands, used
  reasonably" — otherwise the gate measures the policy rather than the law. Candidate:
  a fixed attention budget (N actions per second, spent on whichever hand-weapon is off
  cooldown), which is closer to what the law actually claims — attention is the scarce thing.
- **Where:** `scripts/conductor.mjs` `runOnce` (the robot branch), `README.md` delegation
  tooling, GDD §3 status line, ADR-0010 Consequences (which names this as the open gap).
  `scoreConductor` needs no change — that is the point of extracting it.
- **Context:** the swipe rig from the 2026-07-25 census is the starting code (see that
  landing's commit); the wall measurement inside the Armory pin is the evidence that a
  swiping robot behaves very differently from an aiming one.

## The achievement set predates a week of new systems
- **What:** 14 achievements, and **none** of them reference anything built this week —
  no form worn, no stacked modifier survived, no epithet boss felled, nothing about the
  slot budget. Verified by grep over `config.js: ACHIEVEMENTS`. They still describe the
  game as it was before ADR-0006.
- **Why it matters:** GDD section 6 calls the post-grind afterlife "challenge achievements
  and build-chasing", so achievements are meant to be a *pointer at the interesting parts*.
  Right now they point exclusively at depth and volume (reach wave N, N lifetime kills),
  which is the least interesting axis the game has, and they are the first thing a player
  reads on the Records screen.
- **Candidates, not decided:** wear a form · survive a triple-stacked wave · fell a
  recirculated noble wearing its epithet · win a run with an empty gun slot (which would
  also advertise ADR-0007's gunless chassis as a legitimate identity) · max a weapon and
  its form.
- **Why not tonight:** each one is a design claim about what deserves celebrating, and
  picking six at 3am is how a game ends up rewarding whatever the last contributor happened
  to build. Also: several depend on gaps that are still open (the gun-lockout route decides
  whether "empty gun slot" is even reachable).
- **Where:** `src/core/config.js` ACHIEVEMENTS (pure predicates over `(meta, finalRunState)`,
  so a run-scoped one needs the S argument), `core.md` Records.
- **Context:** cheap to add — the predicate list is the single home and `evalAchievements`
  needs no change. The cost is entirely in choosing well.

## Canvas announcements collide with overlay titles
- **What:** the lingering on-field announcement (wave banner, "DEFEND THE POINT", debut
  banners — 15s each per app.md) is canvas-drawn at top-left and shows through the
  translucent level-up and pause overlays, colliding with their centred titles. Visible in
  `?cards` and `?pause` plates: "DEFEND THE POINT" overlaps "LEVEL UP".
- **Why it is worth a look:** level-ups are frequent and banners are long-lived, so the
  overlap is the normal case rather than a corner. Seeing the field through the overlay is a
  deliberate choice; two texts fighting for the same pixels probably is not.
- **Where:** `styles.css` overlay backdrop, or `render.js` could skip announcements while an
  overlay is up (`G.mode !== 'play'`), or `fx.js` could park them lower.
- **Context:** cosmetic and a matter of taste, which is why it is pinned rather than fixed —
  it may read fine in motion with the real backdrop. Judge it from the two plates.

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
## Better sound design (haptics half landed 2026-07-25)
- **What (landed):** `navigator.vibrate` on three events only — `hurt`, `boss`, `gameover`
  (`config.js: HAPTICS`, executed by `audio.js: haptic()`). Rate-limited to one buzz per
  120ms, its own `meta.haptics` setting, and the menu button hides itself entirely on
  hardware with no motor rather than offering a control that does nothing.
- **What remains:** the **richer synth** — noise bursts for explosions, filter sweeps. The
  audio is still the original one-shot square sweeps, and GDD section 8 still lists that half
  as unbuilt.
- **Why it was not done tonight:** sound is the one thing in this project I cannot verify at
  all. Every other claim this week was checked by measurement or screenshot; a synth tweak
  can only be checked by ear, and shipping audio I have never heard is exactly the kind of
  unverified confidence the rest of the work has been avoiding. It wants Daniel at a
  keyboard, or at minimum a listen before landing.
- **Where:** `src/app/audio.js` (the `P` pattern table and `sweep`), `core.md` if the event
  vocabulary changes, GDD section 8.
- **Context / open judgement calls on the haptics that DID land:** the three chosen events
  and their patterns (18ms chip, 45/70/45 boss, 220ms death) are first-draft feel, unverified
  by any hand — nobody has held the phone. The scarcity *rule* is the load-bearing part and
  should survive; the specific millisecond values are tuning.
## Boss signature moves: two built, five deliberately unbuilt
- **What (landed 2026-07-25):** `BOSS_MOVES` in config.js keyed by boss NAME, executed by
  `runBossMove` in enemies.js (decisions in core, execution in shell). **Sir Cumference:
  adds** — shakes 2 darts from his sides every ~6s, which is GDD section 3's canonical
  ninety seconds verbatim. **The Obtuse One: surge** — +60% speed below 35% hp, so chip
  damage without commitment becomes the worst option. Moves fire from **wave 10**, leaving
  the wave-5 noble a clean ram.
- **Two more built 2026-07-25, from Daniel's first playtest.** He fought waves 30 and 35 —
  `bossIdx` 5 and 6, **Marquis de Sides** and **The Final Vertex** — and reported *"felt a
  bit underwhelming to have a single boss attack racing against their hp bar."* The reason
  was structural, not tuning: **both bosses he met were the ram-only ones**, the two names
  furthest down this list. **sunder** (Marquis, sheds 4 shards at 55% and is guarded until
  they are cleared) displaces attention in *space*; **bulwark** (Final Vertex, plants and
  hardens for 3s every 9s, stationary while planted) displaces it in *time*. Shared
  mechanism: `e.guard`, a 0–1 damage scalar, plus a gold ring so it is legible.
- **What remains:** three names still differ only by HP — Lord Rhombus, Grandmaster Hexley,
  Polygothra. Each wants ONE move posing a distinct
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

## The Armory balance pass — now with the census it always wanted
- **What:** every weapon's real damage share, measured 2026-07-25 with the new ledger. Each
  weapon paired with a maxed bolt in the same control build, 3x 15-minute robot runs, crit
  off. Share is "of the pair", so the rows are comparable to each other:

  | | | | |
  |---|---|---|---|
  | Seekers 35.5% | Beam 30.2% | Mortar 21.7% | Nova 20.0% |
  | Orbitals 18.3% | Flame 15.6% | Tesla 10.4% | Turrets 9.8% |
  | Cascade 8.6% | Catapult 8.3% | Boomerang 7.9% | Meteor 5.7% |
  | Scattergun 5.3% | Howitzer 4.5% | **Mines 1.1%** | **Caltrops 0.4%** |
  | *Wall n/a* | *Blades n/a* | *Frost 0% (correct)* | |

- **THREE CAVEATS, and the table is misleading without them:**
  1. **Wall and Blades were UNMEASURED, not weak — now measured (2026-07-25).** No robot in
     this project had ever swiped, so an entire input category was invisible to every
     instrument. Teaching one to swipe: **Blades 17.2%** of damage — a solid contributor
     that read as 0%. **Wall: see the note below, because its result nearly became a false
     finding.**
  2. Hold weapons are measured with a channel held permanently, which flatters them against a
     human who must also aim.
  3. Frost's 0% is correct — it is a slow, not a damage source.
- **The real findings:**
  - **Mines and Caltrops: diagnosed 2026-07-25, and my own hypothesis was wrong.** I guessed
    the orbit story (seeded outside where shapes die). Measured, the seed ring is
    120px-to-half-the-field, which *overlaps* the 120-240px band where 83% of deaths happen.
    Not a placement-vs-deaths mismatch. What the numbers actually say:
    - **Mines are capable but never triggered.** Against a crowd standing in the band they
      do **287 dmg/s**; in a real run they sit at **5.8 of cap 6** for the whole run — a
      count that high means they are not being consumed. Contribution: ~4 dmg/s.
    - **Caltrops are being judged by the wrong metric, and that is partly my census's
      fault.** They deal 21 damage and a 45% slow: they are a *control* tool like frost,
      so ranking them by damage understates them the way it correctly reports frost at 0%.
      But they also sit at **25.7 of cap 27**, so the *slow* is not landing either — which
      is the finding that survives the metric problem.
  - **Tested one fix, and rejected it for not being good enough:** seeding mines toward a
    bearing a live shape is actually on (instead of uniform random) **doubles** their damage
    (6385 → 11766 per run) and does increase consumption. It still leaves them at ~1% of a
    run. Orbit's fix took it 0% → 19%; this does not clear that bar, so it was measured and
    NOT landed — a change that doubles a negligible number invites the belief that the
    problem is solved. The measurement is recorded here so the next attempt starts from it.
  - **The real question is what these two are FOR.** ADR-0006 deliberately deferred weapon
    purposes ("taxonomy now, purposes after a playtest under the cap"). Mines that are never
    stepped on and caltrops that never slow anything are not a tuning problem; they are two
    weapons whose job has not been decided. **Decide the job, then tune to it** — and note
    that a control weapon needs a control metric, not this damage census.
  - **MEASURED 2026-07-25: bolt's fire rate is a weak lever on bolt's dominance.** Daniel's
  first playtest — *"bolt is noticeably very strong - maybe reduce firing rate slightly"* —
  so the lever was measured before being pulled. Maxed budget-legal build, level-ups
  deliberately unspent so the build stays fixed, crit off, 5×15-min runs:

  | bolt `cd` base | L6 cadence | bolt share | calibrate median |
  |---|---|---|---|
  | 0.34 (was) | 0.22s | **58.7%** | 8 |
  | **0.38 (shipped)** | **0.26s** | **57.5%** | **8** |
  | 0.42 | 0.30s | 53.5% | 10 (top of band) |

  A **36% cadence nerf buys 5 percentage points.** Kills the bolt no longer takes are
  absorbed by the autos, so total damage is roughly conserved and only the split moves.
  0.38 shipped because Daniel asked for "slightly" and it costs nothing in the onboarding
  band; **but it is close to theatre on the share, and he should know that before assuming
  the problem is addressed.** (The 0.42 row's median *rising* to 10 under a nerf is
  backwards and is almost certainly noise at 24 trials — range was 4–20 — not a finding.)
- **Where bolt's dominance actually lives: the L5/L6 emission collapse.** ADR-0006 Decision
  8 moved the fan out of the ladder and folded its *emission* into a single bolt (58 = 2×29,
  99 = 3×33). Power-neutral against the old bolt in total emission, **not** in concentration:
  all of it now lands on one shape instead of spreading across a fan. That is the real
  source of "very strong", and the honest levers are (a) make the collapse deliberately
  less than power-neutral — an actual nerf to max bolt, which ADR-0006 would need amending
  to justify, or (b) push some of the collapsed emission back into the Fan form, so the
  spread is something you *choose* rather than something max bolt gets for free. Neither is
  a tuning tweak; both are design calls for Daniel. **Do not keep shaving cadence** — the
  table above shows where that road ends.
- **Scattergun (5.3%) and Howitzer (4.5%) are the weakest non-dead weapons** — and they are
    *guns*, the category bolt already locks out. So the gun-lockout fix has a second half
    nobody had noticed: even once a rival gun can be drafted, it would be a weak replacement
    for a bolt doing 55-70%.
- **The Force Wall, and a metric trap worth more than the number.** Swiping walls made runs
  reach **wave 13 instead of 25** in the same 900 seconds, monotonically worse the more walls
  were placed. That reads as "the wall is actively harmful" — and it is wrong. **Nobody died
  in any configuration: 0 deaths out of 3, in every policy including the baseline.** The wall
  does not shorten runs, it *slows the clock*: it roughly halves the rate waves arrive at, at
  no survival cost. That is time purchased at the largest scale measured here, and it is
  exactly GDD section 4's "seconds purchased and setups created — not DPS". Two metrics had
  it wrong in opposite directions: the damage census said 0% (unmeasured), and wave-reached
  said harmful.
- **This was a live caveat on the conductor gate — RESOLVED 2026-07-25 by ADR-0010.** The
  gate scored hands by *wave reached*, which is rate-sensitive: a player who uses walls well
  posts a LOWER wave number while being no worse off. It now scores the median survival-time
  ratio, which moves in the correct direction for time-purchasing play. (Re-measuring also
  turned up a second defect the wall finding had not: wave-reached is **quantized to 5**,
  because deaths land on boss waves — 63 of 63 measured deaths at wave 30/35/40/45 — so the
  old `≥ 3 waves` band sat below one quantum of its own metric. See the ADR.)
- **Where:** `src/core/config.js` weapon stats; re-run the census after any change (the script
  shape is in this landing's commit; `S.dmgBy` is the instrument).
- **Context:** this is the data the pin asked for when ten weapons shipped "sim-verified
  only". It does not replace human hands — it says *where to point them*.
## [phase 4] Forms: the mechanism landed, twelve forms and mastery did not
- **What (landed 2026-07-25):** forms are real. `FORMS` in config.js, `S.forms` (active) and
  `S.formPool` (unlocked) in run state, form cards in `levelChoices`, and bolt wears its form
  in the executor. **Burst is the pilot** and is no longer a weapon at all — it stopped
  costing a slot, which is what revived it: measured, the Repeater was offered in **0%** of
  60 mature-account runs as a slot-costing weapon and **45%** as a form.
- **The rule that makes forms enforceable:** *a form regroups a weapon's output in time; it
  does not change the output.* Burst fires the same volleys as a salvo-then-beat, with the
  pause sized so the cycle is exactly `salvo` x the base cadence — power-neutral **by
  construction**, so it cannot drift when bolt is rebalanced later. Pinned by
  `test/forms.test.mjs` (neutrality within a few percent, AND that the rhythm actually
  changed, so a "form" cannot be a no-op).
- **What remains:**
  1. **Twelve more forms** (ADR-0006 Decision 7 names them all: Fan, Double, Autoloader,
     Dragonsbreath, Fork, Pulse, Lance, Backdraft, Cluster, Spikewall, Repulsor, Cyclone).
     Each needs a *re-timing or re-shaping* that passes the neutrality test — that constraint
     is the interesting design work, not a formality.
  2. **Mastery XP as the unlock** (ADR-0003 stage 2). Forms currently come off lattice nodes,
     which is the honest interim; the ADR wants use-earned per-weapon progression.
  3. ~~Bolt's ladder re-cut~~ **DONE 2026-07-25** — fan volleys left the ladder and became the
     **Fan** form; the ladder gained **ricochet** (L5 one kick, L6 two). They compose, which
     was the point. Two forms now exist, one redistributing in time and one in space, which is
     what forced the neutrality rule to generalise from "regroups in time" to "redistributes".
- **Where:** `config.js` FORMS, `state.js` (formPool/forms/levelChoices/applyChoice),
  `tech.js` unlockForm, `weapons/aim.js` updateBolt, `ui.js` form card, `core.md` "Forms".
- **Art errata (small, noted not fixed):** `assets/icons/bolt.svg` draws a **three-way fan**,
  which is now the Fan *form's* identity rather than the base weapon's — the base is a single
  ricocheting bolt. The icons come from the Design project (provenance in
  `assets/icons/icons.md`), so redrawing is Daniel's call, not a thing to improvise at 1am. A
  `fan.svg` was authored for the new form and is deliberately close in spirit.
- **Context / verification state:** the in-fight **weapons bar** with a worn form is verified
  by screenshot (`?autostart&form=bolt:fan`, added for exactly this). The **level-up card** and
  the **pause stats panel** are still unverified by eye — both need a click no headless shot can
  make — though all three now render from the same tested `loadout(S)` query, so the risk is
  markup rather than logic. Worth a look on the first playtest that maxes bolt.
## [phase 3] The rim dead zone — the diagnosis was WRONG, and the data says so
- **Correction (2026-07-25, from the new damage ledger).** This pin spent days telling the
  next person to fix orbit by **contracting** its band toward the rim, or by pushing besiegers
  **out** to meet it. Measured, both would have made things worse, because the premise was
  wrong: the problem was never that orbit could not reach shapes *holding the rim*. It was
  that **nothing gets that deep at all**. Death-radius distribution at wave 35+: zero deaths
  inside 120px, and 83% between 120 and 240px. The inner field is empty because shapes die
  where the shooting is.
- **And it was not weakness.** Against a stationary crowd standing in its band orbit does
  **616 dmg/s**, next to nova's 672. It was starved of *exposure*, not damage — a thin band
  behind the killing zone, crossed briefly.
- **Fixed by moving the ring OUT, not in:** 96/104/112 for L1-3 (unchanged, so the onboarding
  band is untouched — every early widening pushed the median to the top edge), then 168 at L4
  and 218 at L5. Orbit went **0% → 19%** of a maxed build's damage, and bolt's dominance fell
  **69% → 55%**. Both gates hold.
- **Partly undone on purpose, 2026-07-26 (ADR-0020) — read that before re-deriving any of
  this.** The ring is now a constant 138 at every level. The exposure finding above still
  stands and is still the best data in this pin; what changed is that the *other* half of the
  trade got named. A ring far out harvests the zone the rest of the build is already killing
  in, and it walks the blades out of the frost aura — Daniel called the second half a "huge
  nerf" from the seat, and chose the pairing over the harvest. Measured cost of that choice:
  orbit 35.9% → 30.8% of a full maxed build. The 120–240px death distribution is exactly why
  138 (inner edge 125) is the low end of viable and not lower.
- **What remains here:** besiegers genuinely holding the rim are still unreachable by orbit,
  mines and caltrops — but that is now known to be a **rare** case rather than the main one,
  so it should be priced accordingly before anyone spends a mechanic on it. The
  siege-readability telegraph already covers the *legibility* half.
- **Standing lesson:** this pin was written from a plausible mechanism and read as fact for
  days. The ledger existed for one hour before it overturned it. **Prefer a measurement to a
  mechanism, especially a mechanism that sounds right.**
## [phase 3] The content drip: the front is still bunched, the back is answered
- **What (resolved half, 2026-07-25):** the drip no longer ends at 23. Variant stacking
  lands at wave 40 with its own introduction beat — **"MODIFIERS ARE COMPOUNDING"**,
  carrying the actual stacked specimen as its icon — alongside boss epithets at the same
  wave. Waves 24-39 are now deliberately empty of *new pieces*: the content there is
  combination, not vocabulary, which is GDD section 5's doctrine rather than a gap in it.
  That position is written into `core.md` Introductions so it reads as a decision.
- **RESOLVED 2026-07-25:** the front bunching is fixed — swift moved 6→7, so no three
  consecutive waves carry a beat (pinned by `test/drip.test.mjs`, which will catch a future
  content addition re-bunching them). Measured: the minimal change keeps the onboarding
  median at 8–9 with the baseline's tight spread. **The prettier option lost on
  measurement** — also moving tank to 3 and splitter to 9 would have given a beat every
  other wave and filled the empty wave 3, but it widened the median spread to 9/9/5/9 and
  dropped the death floor to wave 3, because early tanks make runs bimodal. A wider spread
  is a band gate that flakes at both edges.
- **RESOLVED 2026-07-25:** debut waves were **stochastic** — swift's nominal wave-6 debut
  fired that wave in 53% of runs (re-measured over 4000 waves; it was ~45% when first audited
  and drifted when cost-weighted composition added bodies — an inherited number expires when
  the system under it changes). Now `composeWave` marks one non-boss spawn per debut wave to
  carry the variant, wearing it alone. All five debuts measured at **100%**.
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

## The guns are reachable now — and that exposes the balance question behind the door
- **RESOLVED 2026-07-25 by ADR-0011** (Daniel: *"let's just allow 2 guns for now to unlock
  them. We'll deal with other towers and stuff later"*). `SLOT_BUDGET.gun` 1 → 2, and
  `levelChoices` now counts per category instead of tracking a single held slot. Measured,
  same 60-run mature-account census before and after:

  | | Scattergun | Howitzer | distinct weapons offered | slots full by level |
  |---|---|---|---|---|
  | gun: 1 | **0%** | **0%** | 17 of 20 | 7 |
  | gun: 2 | **57%** offered / 28% taken | **62%** / 23% | 19 of 20 | 7 |

  *(These are this spike's numbers end to end. The earlier "10.8 of 21 distinct / level 8.6"
  figures came from a different picker policy and must not be mixed with this row — the
  before/after above is internally consistent, which is the only property that matters here.)*
- **What it exposed, which is the actual open work:** the Armory census puts Scattergun at
  **5.3%** and Howitzer at **4.5%** of a pair's damage — the two weakest non-dead weapons —
  against a bolt doing 55–70%. They were never balanced because they were never reachable.
  Now a player can take one, and taking one costs an auto slot. **Do not tune them blind:**
  the census script is the instrument, and the question is what a second gun is *for*
  (burst? crowd? a bolt alternative rather than a supplement?) before any number moves.
- **Untouched on purpose, still open:** all six slots still fill by level ~7 of ~37, so the
  build is decided in the first ninety seconds and the remaining ~30 level-ups can only
  upgrade what luck handed you. ADR-0011 explicitly does not address this; the routes are
  a pre-run weapon-priority surface (GDD §7) or a **replacement/swap card**, the only one
  that lets a build change its mind mid-run.
- **Also still open, and now cheaper:** tower loadout diversity — a chassis that opens with a
  Howitzer is a legible identity (ADR-0006 Decision 4). Deferred by Daniel, not rejected, and
  it composes with the ceiling of 2 rather than competing with it.
- **Where:** `config.js` SLOT_BUDGET + TOWERS, `state.js` levelChoices, `core.md` "The slot
  budget", `test/taxonomy.test.mjs` (the ceiling test was LOOSENED — called out in its own
  comment), ADR-0011.

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
## Boss moves: the roster is complete — what needs thumbs now is the wave-20 step

**Landed 2026-07-25 (Daniel's call: "boss moves should start at 10").** All seven nobles
carry a signature move now: `charge` (Lord Rhombus, wave 10), `study` (Grandmaster Hexley,
20), `devour` (Polygothra, 25), joining adds/surge/sunder/bulwark. Deliberately no two
repeat a dilemma — the axes are space, time, commitment, distance, rhythm and target
priority. Details and the measurement trail: `core.md` "Boss signature moves".

**Correcting the pin this replaces, because it was wrong in a way worth keeping.** It
claimed `game.js` gated moves on roster *recirculation*, so the first move in the game
fired at wave 40. False — the gate has read `S.wave >= 10` since the moves landed, and
`bossmoves.test` has pinned the wave-5 ram since the same commit. The real cause of Daniel
seeing nothing at wave 10 was duller: **three of seven names had no move at all, and they
sat at indices 1, 3 and 4 — waves 10, 20 and 25.** The observation was exactly right; the
mechanism behind it was invented from a plausible-sounding read of one line. Same species
as the rim-dead-zone pin. *Prefer a measurement to a mechanism, including about your own
code.*

**What actually needs thumbs (a sim cannot rule on any of these):**
1. **The wave-20 step.** Hexley stops hands-off runs dead at floor 0.4 (7 of 11) and barely
   at 0.55 (1 of 11). 0.55 shipped because killability outranks pressure — but whether wave
   20 now *feels* like a wall to a human is unmeasured. Watch a fresh-account run through it.
2. **Does anyone discover `study`?** Its whole dilemma is "stop shooting it for two seconds",
   which is counter-intuitive and has **no telegraph at all** — the guard ring exists
   (`e.guard` draws gold) but nothing says *why* it hardened. If playtesters never work it
   out, the move is a stealth tax and needs a tell, not a tune.
3. **Is `charge` readable on a phone?** The 1.1s wind-up is the entire move. It currently
   reuses `sfx('shield')` and a stop — no dedicated visual. If the wind-up is missed the
   charge is a dice roll, which is the exact thing its design forbids.
- **Where:** `config.js` BOSS_MOVES, `enemies.js` runBossMove, `render.js` (no move-specific
  art exists yet), `core.md` "Boss signature moves", `test/bossmoves.test.mjs`.

## The conductor's robot never rotates targets — so it cannot see `study`-shaped design
- **What:** the gate's robot retargets to *nearest* every 0.2s and otherwise pours damage
  continuously into whatever it picks. Against Grandmaster Hexley that is the worst possible
  play, so the gate reads **lower** with study than without it (×1.176 vs ×1.412) even though
  the move exists to reward a skill the robot does not have.
- **Why it matters beyond this one boss:** it is a concrete, measured instance of the
  README's "the robot is a weak veteran" caveat, and it bounds what the conductor can ever
  certify. Any future mechanic whose answer is *withhold damage* — bait-and-punish, overkill
  waste, damage-reflect — will read as a regression on the only instrument this project has.
- **Candidate:** teach the robot to drop a target that has hardened (it can read `e.guard`),
  which is the smallest possible step toward the "fixed attention budget" policy the
  hold/swipe-robot pin already argues for. Do it there, not separately.
- **Where:** `scripts/conductor.mjs` `runOnce` robot branch; folds into the hold/swipe pin
  above rather than being a second project.

## calibrate's 32-trial gate cannot distinguish changes it is asked to gate
- **What:** measured 2026-07-25 while checking whether `charge` moved the onboarding band.
  Repeated 32-trial runs on **unchanged** code returned medians of 8, 9, 10 — the band is
  [5,10], so a no-op change can read at the band's upper bound. At 200 trials both arms
  (with and without the new wave-10 move) sat steady at 7–8 and were indistinguishable.
- **Why it matters:** CI runs 32 trials and hard-fails the deploy on an out-of-band median.
  The README already reasons that 32 was chosen over the local 12 because "a flaky gate stops
  being enforced" — the number just is not big enough. A sweep costs ~1s, so this is nearly
  free to fix; 200 trials took a few seconds.
- **Also:** any past finding of the form "median moved 8 → 9, so the change mattered" taken
  from a single 32-trial run is inside this noise and should be re-measured before being
  believed. Several such readings exist in the 2026-07-25 session log.
- **Where:** `scripts/calibrate.mjs` default, `.github/workflows/pages.yml` (the `32`),
  README "Balance tooling".

## [perf] The device answered: 60fps median, a step at wave 20, and blur is the suspect

**First real capture, 2026-07-25 (Daniel's phone, installed PWA, /dev/?perf, run to wave
45).** The instrument worked and immediately corrected two things — one about the game, one
about the instrument.

**What the game does.** Every reading is an exact multiple of 16.7ms: the panel is 60Hz and
vsync hands out whole frames. `p50 = 16.7` at **every wave from 17 to 45** — the median frame
is a clean 60fps even at wave 45. The signal is in p95:

```
wave 17  p50 16.7  p95 16.8  ents 13     one refresh
wave 18      16.7      16.7       20
wave 19      16.7      17.0       18
wave 20      16.7      33.3       10  <- STEPS, at the FEWEST entities on the table
wave 21      16.7      33.4       19
...
wave 45      16.7      33.5       13
wave 36      33.3      49.9       24  <- a whole wave at 30fps
```

- **The step is at wave 20. Whether it is entity count is now UNKNOWN — the earlier "it is
  not" was withdrawn.** That claim compared wave 19's "18 entities" against wave 20's "10",
  but both are *wave-long means*, and Daniel's follow-up capture showed why that is fatal:
  *"p50 would often go to 33, then drop back down to 16.7 at the end of the level when the
  active enemies had been thinned out."* The aggregate smeared the timing and the count
  together, so neither described the moment frames dropped. **Two aggregates whose peaks are
  invisible cannot support a conclusion about their peaks.** The instrument now reports the
  worst 2s window per wave with a co-timed entity count; re-measure before believing
  anything about cost-versus-count. (Within a wave, Daniel's own observation is direct
  evidence that cost DOES track density — which points back toward, not away from, the
  per-shape blur suspect.)
- **Median performance is fine; the tail is not.** ~5% of frames drop one refresh from wave
  20 on, one whole wave (36) ran at a 30fps median, and a 2199ms hitch appeared in the
  wave-37 session. "Struggling from wave 17" is a true report of the tail, not the median.
  *(The 2199ms figure has since been explained and is NOT a stall: `last` was stamped at
  module load, so the first sampled gap contained all of page setup. No longer sampled.)*

**The suspect, and it is a hypothesis, not a diagnosis.** `render.js` set `shadowBlur`
**per enemy**: 12 for every shape currently flashing from a hit, 14 for every swift one, 22
for the tower. Canvas shadow blur is the most expensive 2D operation on a mobile GPU — each
forces an offscreen blur pass. Measured in the headless harness: **2.5 blurred draws per
frame at wave 14, rising to 7.3 by wave 29.** At a plausible 1–3ms per blurred draw on phone
silicon that alone spans the budget, and it scales with *how many shapes are being hit*
rather than how many exist — which is exactly the shape of the wave-20 step. **Nothing in
this repo can time a GPU, so this cannot be confirmed here.**

> **⚠ The suspect has since been removed — but NOT as a fix, and this pin stays open.**
> ADR-0019 (the emissive grammar, 2026-07-26) rebuilt the hit pop and the swift under-glow
> as halo strokes because that grammar wanted them that way. Consequence: **blur is now set
> at most once per frame, for the tower alone**, pinned by `test/render.test.mjs`.
>
> Read carefully, this makes the pin *harder* to close, not easier. The change was never
> measured against the p95 tail on a device — it is an argument from mechanism — and it
> arrived bundled with ~39% more context calls and more fill-rate, so a device capture now
> measures a *different renderer*, not a clean A/B on blur. **The next `?perf` run on
> Daniel's phone is the experiment**: if the wave-20 step is gone, blur was the cause and
> this closes; if it survives, the suspect was wrong all along and the real cause is still
> at large — which is the more valuable outcome, because it was about to be retired for the
> wrong reason. Compare against the 2026-07-25 table above, and note the field itself has
> moved since (ADR-0014/15/16), so per-wave entity counts are not like-for-like.

**The experiment is built and takes one run:** `?noblur` suppresses every blur in the
renderer. Play the same waves with and without and compare the `drop` column. A test pins
that the hatch removes *all* blurred draws and the default keeps them — a hatch that quietly
does nothing would send back a null result and retire a live suspect for the wrong reason.

**If it is confirmed**, the fix is a design question, not a tuning one, because the glow is
load-bearing in two named channels: app.md's *"the hit pop is a stroke + glow"* and the swift
variant's white-hot highlight (README pillar 3). Candidate routes, none costed: pre-render
the glow once into an offscreen sprite and blit it; drop blur for a brighter/thicker stroke
and check the pop still reads on the `?specimen` plate; or cap blurred draws per frame,
which is the ugliest because it makes legibility load-dependent.

**And what it corrected about my own instrument, which is the more embarrassing half.** The
first version defined "over budget" as *longer than 16.67ms*. Against vsync that counts float
noise: it reported **72–94% of frames over budget while the phone held a clean 60fps**, and
painted the entire table red. That is precisely the failure I had written a test against —
"an instrument that argues with the person holding the phone" — guarded in the wrong
direction. `drop` is now *longer than 1.5× the median*, refresh-rate agnostic, with the
60fps case pinned as a regression test. A second column, `work`, now reports what our own
code spent inside the frame: **the gap says whether we dropped a frame, work says how much
headroom is left, and once vsync-locked the gap alone cannot tell those apart.** The original
design timed only the gap and I wrote a paragraph justifying it — right about detection,
wrong about diagnosis.

## The charge interrupt may now be TOO easy to break, and the instrument cannot tell
- **State after 2026-07-26:** tell **3.3s** (tripled, Daniel: *"the charge-up is too quick,
  there's very little time to react if you're not already on the boss"*), `interruptFrac`
  **0.105** (tripled with it, to hold the demanded damage-per-second constant).
- **Tripling both is NOT neutral, and that is the finding.** Holding damage-per-second
  constant does not hold *difficulty* constant, because the autos' passive contribution
  scales with the length of the window. Measured across 8 fresh-account runs:

  | | ignores the tell | reacts to it |
  |---|---|---|
  | before (tell 1.1, frac 0.035, auto-resist ON) | 27% | 70% |
  | **now (tell 3.3, frac 0.105, no auto-resist)** | **42%** | **57%** |

  The skill gap has nearly closed: a player who never looks at the boss breaks the charge
  **42%** of the time by accident. Two compounding causes — the tripled window gives autos
  3× as long to accumulate, and removing `BOSS_AUTO_RESIST` (ADR-0013) doubled what they
  contribute. Both were right calls; the interaction was not anticipated.
- **The instrument has run out of resolution, and the tell is unmistakable.** Sweeping the
  threshold higher, at `frac 0.22` the "reacts" arm scored **worse** than the "ignores" arm
  (9% vs 14%). That is impossible, so it is noise: ~37 wind-ups per arm is too few, and the
  proxy is weak anyway — the robot merely re-aims, where a human seeing a 3.3s dial fill
  would dump everything into the boss. **Do not tune `interruptFrac` against this rig.**
  Either give it far more runs and a robot that commits (drops trash entirely, uses hold
  weapons on the boss), or accept that this one is a thumbs question.
- **So the shipped value is Daniel's instruction taken literally**, not a tuned number, and
  it is flagged rather than sold as balanced. If 42% passive feels like the charge no longer
  exists, the lever is `interruptFrac` upward — the sweep above is the starting point, with
  its own unreliability stated.
- **Still open from the previous round:** a gold-on-gold collision I introduced — the stagger
  draws three short *spinning* gold arcs, `guard` draws a steady *breathing* gold double-ring.
  Distinct on the `?specimen=charge` plate, untested in a fight where a Marquis could be
  guarded and staggered in the same second. And whether wave 10 now feels right at all.
- **Where:** `config.js` BOSS_MOVES['LORD RHOMBUS'], `enemies.js` runBossMove + damageEnemy,
  `render.js` the dial, `core.md` / `app.md`, `?specimen=charge`.

## The 60s boss target is 40s away, and the gap is not tuning

**ADR-0012 landed 2026-07-25.** Boss HP is sized in seconds now, the boss enters at 33% of
its wave's spawn queue instead of last, and `BOSS_AUTO_RESIST = 0.5` makes undelegatability
a mechanism rather than a side effect of the health bar. Fresh-account boss events went from
a **142s median (19→212s) to 104s (14→134s)**.

**Daniel asked for 60s. It ships at 100s, and the difference is measured, not conceded.**
Swept against the conductor (band ≥1.12): **60s → ×1.109, fails. 90s → ×1.125, passes by
0.4% and was refused as a coin-flip margin. 100s → ×1.227, holds. 120s → ×3.046.**

**Why, and this is the finding worth carrying:** below ~90s the do-nothing run stops dying,
because **Law·Delegation is currently enforced almost entirely by boss health bars.** Nothing
else in the game reliably kills a hands-off run. `BOSS_AUTO_RESIST` was added to attack this
directly and it half-works: it restores parked *deaths* (4–5 of 7) but not the *ratio*
(×1.086–1.109), because the conductor's parked arm still carries an aimed bolt, so the gate
measures **aim accuracy**, not hands-vs-autos.

**Three routes to 60s, in ascending order of honesty:**
1. **Lower the conductor band.** Fastest, and Daniel's to take — but weakening a gate to fit
   a change is how laws rot, so it was refused as an assistant decision, not as an option.
2. **Teach the conductor's robot to hold and swipe** (already its own pin). If "hands" means
   only aim, the gate under-measures every non-aim mechanism, `BOSS_AUTO_RESIST` included.
   This may move the number without any design change at all — cheapest real answer.
3. **Build undelegatable pressure that is not a boss.** ADR-0008 already named the successor
   lever and it is still unbuilt: **modifiers, regen especially** — autos deal chip damage,
   and partial damage on a regenerating elite is wasted damage. This is the route that makes
   60s *correct* rather than *permitted*.

**Where:** `balance.js` BOSS_TTK_TARGET / referenceDps / BOSS_AUTO_RESIST / BOSS_ENTRY,
`scripts/bosstime.mjs` (the instrument), `core.md` Balance formulas, ADR-0012.

## The fresh-vs-geared spread means no single boss curve serves both
- **Measured 2026-07-25** alongside ADR-0012. Boss alive-time, same wave, same code:
  **fresh account 104s median (waves ≥15); full lattice 20s.** A ~5× spread in player dps
  between a new save and a fully-invested one.
- **Why it matters:** a 60s design target cannot be true for both. Targeting the fresh
  account (what ADR-0012 does) leaves veterans with 20s bosses — not a 60s event either, and
  arguably Law·Bosses failing quietly at the top end. Targeting veterans would give a fresh
  account ~300s bosses, which is unplayable.
- **This is a LATTICE question, not a boss question.** ADR-0003 already records the economy
  curve as provisional. The honest framing: how much raw damage *should* the meta layer sell?
  Every point of it widens this spread and makes any single balance target less meaningful.
  A lattice that sold utility, unlocks and options rather than multipliers would not have
  this problem — which is also GDD §6's own stated principle ("the account changes what cards
  *exist*, not just how big they are"), currently honoured by 16 of 70 nodes.
- **Where:** `config.js` LATTICE, ADR-0003, `scripts/bosstime.mjs` shows both arms side by side.
- **Do not** fix this by tuning boss HP — that is the lever that was just taken away from
  this job for exactly this reason.

## Bosses are HP sponges, and the force wall can shove them — FOUND BY THUMB, 2026-07-25

Daniel, after the wave-45 run: *"I'd died to hp sponge bosses much earlier if I couldn't
cheese them by spawning force walls inside them to push them back."*

**Two findings in one sentence, and they are not the same problem.**

**1. Bosses take too long — RESOLVED 2026-07-25 by ADR-0012** (fresh-account median 142s →
104s; see the 60s-target pin above for what remains). Original entry kept because the
reasoning is still the clearest statement of why: Building the
signature-move killability test the same day, a **full-HP armored wave-40 boss under
continuously focused fire from a maxed six-weapon build took 195 seconds to kill** — over
three minutes, with no tech tree. That number was collected to calibrate a guard floor and
was not read as a finding at the time; Daniel arrived at the same conclusion from the other
side, playing. Two independent lines is enough to treat it as real.

This is a Law·Bosses problem, not a tuning one: *a boss is a focus-forcer*, and a
focus-forcer that outlasts the player's attention span is an HP number wearing a dilemma's
clothes. The signature moves shipped today make each fight *different*; they do not make it
*shorter*. Note the tension before touching anything — ADR-0008 derived `BOSS_HP_SHARE = 0.31`
from the conductor gate and recorded a hard ceiling in the other direction (**the wave
director will not advance while the boss lives, so an over-tanky boss freezes the run**).
Lowering the share is therefore a gate-affecting change and wants its own ADR, not a nudge.
The `?perf`-adjacent instrument for this already exists: the time-to-kill ratio rig in
`test/bossmoves.test.mjs`.

**2. The force wall can be spawned *inside* a boss to push it back, indefinitely.** The wall
anchors at the gesture's start and shoves contacting shapes along its tower-away normal, so
placing one *on* a boss converts the wall from a barrier into a repulsor. Repeatedly.

**Do not reflexively call this a bug.** GDD §4 says the wall's job is *"seconds purchased and
setups created — not DPS"*, and pushing a boss back is the purest possible form of that. The
Armory census already measured walls buying time at the largest scale in the game (halving
the rate waves arrive at, at zero survival cost). The real question is whether it is a
*skill expression* or a *dominant strategy that trivialises the one threat designed to be
undelegatable* — and Daniel's own framing ("cheese", "I'd have died much earlier") says it is
currently the latter. **A tool that makes the focus-forcer optional defeats Law·Bosses**, and
the delegation gate cannot see it: the conductor's robot has never swiped (already pinned).

**DIAGNOSED, 2026-07-25 — the mechanism is confirmed and it is one line.** Every other
knockback in the game goes through `applyKnock` (`enemies.js:147`), which divides the impulse
by `enemyMass(e.age) * (e.boss ? BOSS_KNOCK_RESIST : 1)` — **bosses resist knockback ×6**.
The force wall does not use `applyKnock`: `swipe.js:60` writes `e.x`/`e.y` directly, dividing
by `enemyMass(e.age)` alone. **So a boss takes the wall's shove at six times the strength it
takes every other push in the game.**

**But this is a DESIGN call, not a tier violation, and that distinction is why it is not
already fixed.** `core.md`'s force-wall row documents the push as `(100+25L)÷mass` — no boss
term — so the spec and the code agree; only the *analogy with every other knockback source*
is broken. There is also precedent for deliberate bypass: the boss ram's own recoil skips
`BOSS_KNOCK_RESIST` on purpose, and that is written down. So the wall's exemption could be
intentional-but-unrecorded or simply never considered, and the difference is Daniel's to
declare. **It also directly affects how he is currently playing** — it is what kept the
wave-45 run alive — so it must not be nerfed unilaterally.

Candidate directions, none decided:
- **Route the wall push through `applyKnock`** — one line, restores the ×6 analogy, and makes
  every knockback in the game obey one rule. Almost certainly the largest single balance
  change available right now: it removes the answer to the sponge problem while the sponge
  problem is still open, so it should probably not land *before* (1).
- Keep the shove but make a wall placed *on top of* a shape spawn disabled until it clears —
  targets the "spawn it inside them" move specifically rather than the wall-vs-boss matchup.
- Leave it and make it legible as intended play. If a wall is the sanctioned answer to a
  boss, Law·Bosses is satisfied by a *swipe* rather than by aim — which is still hands, and
  the conductor gate has never measured swipe (already pinned).

**Where:** `src/app/weapons/swipe.js` (wall placement + push), `enemies.js applyKnock` /
`BOSS_KNOCK_RESIST`, `core.md` force wall row + "Boss signature moves", GDD §4, ADR-0008 for
the HP share. **First move is diagnostic, not design:** find out whether boss knockback
resistance is being applied to the wall's push at all.
