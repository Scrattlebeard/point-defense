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
