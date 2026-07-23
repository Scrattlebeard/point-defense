# Pins

Deferred work and mid-session asides. Rules live in CLAUDE.md ("Pins") — short version: written immediately when they surface, self-contained enough to be picked up cold, candidates not commitments, deleted on resolution (git history is the archive).

## Adopt worktree discipline from here on
- **What:** Future sessions work via `scripts/worktree <name>` + `scripts/land`, per CLAUDE.md "Branches and worktrees" — stop committing directly on master.
- **Why:** The first two sessions (overnight build + playtest day, 2026-07-22/23) deliberately worked master: solo bootstrap, then a rapid interactive loop with Daniel ratifying every step in real time — the isolation the rule exists for had no second writer to isolate from. That justification expires now that the repo is established.
- **Where:** process only; no files.
- **Context:** 24 commits on master to date, all green at land time. Nothing to untangle — just switch discipline at next session start.

## Balance pass, round 2
- **What:** Continue tuning against human play. Round 1 (2026-07-23, Daniel's first session) landed: bolt reworked to auto-fire-at-aim (spam-clicking dominated), frost slow capped at 45%, orbital knockback 60→35 (frost+orbit held enemies in place), nova/frost visuals disambiguated.
- **Why:** Deep-wave pacing, tech-tree cost curve, and beam-overheat feel are still only sim-bot-verified.
- **Where:** `src/core/balance.js`, `src/core/config.js`; spec intent in `src/core/core.md`.
- **Context:** Daniel is the playtester. Open questions: does the new bolt cadence (0.34−0.02L s) feel right vs the old spam ceiling? Is the L6 twin-volley worth reaching for? Tech costs vs actual shard income at waves 8+?

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
