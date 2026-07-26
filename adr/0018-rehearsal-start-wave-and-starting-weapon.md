# ADR-0018 — Rehearsal: start wave and starting weapon

**Status:** ACCEPTED (2026-07-26). Adds two run parameters and a menu surface for them.
Consistent with ADR-0016 (level = wave) and ADR-0007 ("bolt is the default weapon, not a
guaranteed gun — a loadout may skip it"), which this is the first thing to actually exercise.

## Context

Daniel: *"let's build two playtest features that will eventually be added to the lattice —
select start wave (and, by extension, player level) and select starting weapon."*

The need is immediate and it is the one named in ADR-0017: **most weapons have not had a
balance pass**, and the current cost of feeling one is a full run from wave 1 hoping the
draft offers it. Testing the Flamethrower at wave 20 today means playing twenty waves and
getting lucky. That is why the arsenal is unfinished — the feedback loop is minutes long and
partly random.

"Eventually added to the lattice" is the load-bearing half of the request. These are not
cheats bolted on beside the game; they are **unbuilt lattice nodes being used early**. So
the shape they take now has to be the shape a node would fill later, or we build them twice.

## Decision

**Two run parameters, one options object, one menu panel.**

`newRun(meta, towerId, { startWave, startWeapon })` — a third argument that defaults to the
normal run in every field, so every existing call site is unchanged.

- **`startWave: W`** — the run opens on wave *W* at **level W**, with *W−1* picks banked.
  Level follows wave because ADR-0016 made that the curve; banking the picks rather than
  auto-assigning them means the player **drafts the build they want to test**, which is the
  entire point. The wave director starts at `W−1` and increments into `W` on its first tick,
  so no spawn logic changes.
- **`startWeapon: id`** — replaces **bolt** in the tower's starting loadout, at the level the
  tower gave bolt. Bastion + Flamethrower opens with Flamethrower II; Lance + Flamethrower
  opens with Flamethrower I *and* Beam I, because Lance's identity is its beam and only its
  bolt is being swapped. The weapon is added to the level-up pool so it can be levelled.

**Tech locks are ignored on purpose.** A rehearsal can start with a weapon the account has
not unlocked, because the weapons most in need of a pass are exactly the ones behind locks.
The lattice node this becomes will respect locks; the playtest surface must not.

## A rehearsal run pays nothing and records nothing

**`rehearsal: true` on the run state. No shards, no `best`, no score row, no achievements.**

Without this the feature is a meta-progression exploit and a records-polluter in one: open at
wave 25, die immediately, collect the shard payout for a wave-25 death, and set a `best` you
never earned. Law·No-meta-accel says nothing purchasable may accelerate meta-progression, and
a free wave-25 payout is worse than purchasable — it is free.

So the rule is blunt and total: **a run that used either parameter is invisible to the meta.**
It plays, it dies, it teaches you something about the Flamethrower, and it leaves no trace.
The game-over screen says so plainly rather than silently paying zero.

## How it graduates

The menu panel is scaffolding; the parameters are not. When these become lattice nodes:

- **Start wave** becomes a node granting `startWaveAdd`, capped — "begin at wave 3" is a real
  meta-progression reward and an obvious Mind-sector candidate now that the sector has lost
  its theme (pinned separately). `effectsOf` gains one key; `newRun` already takes the
  parameter.
- **Starting weapon** becomes a node granting a choice among *unlocked* weapons — the
  loadout-identity surface GDD §7 already wants and ADR-0011 alternative 2 named as
  "tower loadout diversity, deferred, not rejected".
- At that point the rehearsal panel either disappears or becomes the node's UI, and
  **`rehearsal: true` stops being set** — a lattice-granted head start is earned, so it pays
  and records normally. That flag is the only part designed to be deleted.

## Alternatives considered

1. **Query-string hatches (`?wave=20&weapon=flame`).** Cheaper, and the repo already has
   `?autostart`, `?turbo`, `?gear`. Rejected as the primary surface: playtesting happens on a
   phone, where typing a query string is miserable and re-typing it after every death is
   worse. The parameters are readable from the URL anyway as a side effect, for smoke tests.
2. **Auto-assign the banked levels** (pick for the player, weight toward the chosen weapon).
   Faster to start a rehearsal, and wrong: the reason to start at wave 20 is usually to test a
   *specific* build, and a random build is what we already have.
3. **Let rehearsal runs pay reduced shards.** Rejected — any non-zero rate is a rate to
   optimise, and the honest version of "this run doesn't count" is zero.
4. **Hide the panel behind a build flag so it cannot ship.** Rejected for now: prod has never
   been promoted, dev is where the game is played, and a flag would mean Daniel cannot reach
   the feature on his phone, which is the entire use case. Revisit before the first prod
   promotion — pinned.

## Consequences

- **`newRun`'s third argument is the seam.** Nothing else in the sim knows a rehearsal is
  happening; the wave director reads `S.wave` as it always did.
- The first real exercise of ADR-0007's "a loadout may skip bolt" — which was written as a
  possibility and has never been true in a shipped run until now.
- **Records and shards need one guard each, and they are the risky part of this change** —
  a missed guard is silent and only shows up as a corrupted `best` weeks later. Tested
  directly rather than by inspection.
