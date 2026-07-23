# Pins

Deferred work and mid-session asides. Rules live in CLAUDE.md ("Pins") — short version: written immediately when they surface, self-contained enough to be picked up cold, candidates not commitments, deleted on resolution (git history is the archive).

## Balance pass after first real play session
- **What:** Tune curves/costs against actual human play (overnight tuning is sim-bot-verified only: the node sim in `test/sim.test.mjs` plays competently but not like a person).
- **Why:** First-run pacing (wave 5–8, ~20–40 shards) is a spec *intent*, not yet a verified fact; shockwave/beam feel is untested on real thumbs.
- **Where:** `src/core/balance.js`, `src/core/config.js` costs; spec intent in `src/core/core.md` ("Tuning intent").
- **Context:** Daniel is the playtester. Watch: is wave 1 boring with only tap-bolt? Is the tech tree's first purchase reachable in 1–2 runs? Does beam overheat feel fair on mobile?

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

## Offer meta "reset save" affordance
- **What:** A small "reset progress" in the menu (double-confirm), plus meta schema-version migration note.
- **Why:** Public seam `pointdefense.meta.v1` is a save; there's no way to wipe it in-game.
- **Where:** `src/app/ui.js` menu, `src/app/meta.js`.
- **Context:** Key bump = save wipe = ADR-level per README; an explicit reset avoids ever needing that for testing.
