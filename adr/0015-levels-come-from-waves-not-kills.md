# ADR-0015 — Levels come from waves, not kills

**Status:** ⚠ **DRAFT — BUILT, NOT LANDED (2026-07-26).** The implementation is complete
and the suite is green, but the conductor gate breaks catastrophically (see "What the gate
caught", below) and the central measurement in this ADR has a scope error. Do not land
without Daniel's call on the fork it exposes.

**Was:** ACCEPTED (2026-07-26). Removes the in-run XP economy entirely. Amends the
causal model in ADR-0008 ("bodies are XP"); retires the `xpAdd` lattice line that
ADR-0003's stat-node family and GDD §5's Law·No-meta-accel parenthetical existed to bless.
Does **not** touch ADR-0003 stage 2 *mastery* XP, which is a different, still-unbuilt system.

## Context

Daniel asked what we'd lose by dropping in-run experience and granting a level on wave
completion. The honest answer required measuring first, and the measurement reframed the
question.

**The XP economy already grants exactly one level per wave.** Forty fresh robot runs,
levels gained during each wave:

| wave | 2 | 3 | 4 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|
| mean | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| min–max | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 | 1–1 |

Min equals max. Wave 1 pays 3 (the onboarding burst); boss waves smear ±0.4 across the
boundary because a besieging boss dies after the wave ticks over. Otherwise it is *exactly*
one, every run, at every depth.

It cannot be otherwise, and that is structural rather than lucky:

- XP has **one** source — `addXp(S, e.xp)` on the player-kill path in `killEnemy`.
- Enemies that reach the Point **besiege** rather than despawn (`enemies.js` `hitTower`,
  the 0.9s strike cadence). Nothing ever leaves the field carrying its XP.
- So a wave contains a fixed pot and the player always collects all of it. There is no
  play that banks more, and none that banks less.

**The XP bar is a wave-progress bar wearing a costume.** Every mechanism attached to it —
thresholds, the quadratic curve, five variant multipliers, a tower multiplier, six lattice
nodes — is arithmetic that cannot change the answer.

## ⚠ What the gate caught — read before believing the section above

Two findings, both after the implementation was green, both against this ADR:

**1. The headline measurement is scoped wrong.** The table above is 40 runs on a **fresh
account**, where the six `xpAdd` nodes are unowned and the XP knob is off. Re-run on a
**full lattice** (+70% XP), levels arrive at ~1.5/wave early — 2,1,2,1,2,1 — settling to
1.00 by wave 6, leaving a geared account **~3 levels permanently ahead** of a fresh one at
the same wave. So in-run XP was **not** a costume for wave progress: it was the
meta-progression's level-rate knob, and this ADR measured the one account where that knob
does nothing. "No play banks more, and none banks less" is false as written — no *play*
does, but the lattice did.

**2. Law·Delegation breaks completely.** Conductor after the change: **parked deaths 0/11**
(was 6/11), **hands ×1.000** (was ×1.259), and the do-nothing run reaches **wave 49 at 100%
HP** in every pair. A run with the aim parked at t=0 and never touched has become
unkillable. This is the con raised before the work started — "it removes the last in-run
reward for killing things yourself" — arriving worse than predicted.

**The mechanism is NOT established.** Probed and excluded: the opening draft (setting
`OPENING_LEVELS` to 1 leaves the gate equally broken). The obvious structural story — tying
power to wave number makes player power track difficulty automatically, so a passive player
can never fall behind the curve — is plausible but *cuts against* finding 1, which says the
change made geared runs weaker, not stronger. Recorded as unexplained rather than dressed
in a tidy cause; today has already produced two elegant explanations that a control run
killed.

## Decision

**Delete the in-run XP economy. Levels are granted by the wave director.**

- **Three levels at run start** (before the first shape spawns), then **one per wave
  cleared**, granted in `waveCleared()`.
- `xp`, `xpNext`, `xpForLevel`, `addXp`, `S.xpMult`, per-enemy `xp`, variant `xpMult` and
  tower `xpMult` are removed outright.
- `LEVELUP_HEAL` (10% max HP per level) moves from `addXp` to the grant. It is unchanged in
  size and still pays per banked level.
- The six `xpAdd` lattice nodes — `study1..4`, `enlighten`, `scholarsoldier`, 1105◆ of
  investment — are **retired with refunds**, exactly as the Salvage income line was on
  2026-07-25. `head` and `warchest` are re-parented off the dead spine.

This reproduces the measured curve exactly: level at the start of wave *N* is *N+2*, before
and after.

## Why the opening three move to run start rather than wave-1 clear

Wave-1 clear is the tidier rule and it is the wrong one. It would delay the first
build choice from ~5 seconds into the run to ~35, and a phone roguelite's opening agency is
not a place to spend 30 seconds of nothing. Granting at run start also **reuses the existing
`fx.startLevel` path** that Head Start already drives, so it is less code, not more.

Consequence: Head Start's card says "start at level 2 with a free pick" and must be reworded
to "one level higher again" — it now stacks on 4 rather than 1.

## The doom clock — a spec claim that measurement refutes

`core.md` and GDD §7 both assert that heals *rarify* in late runs "because the xp curve
stretches", building a deliberate doom clock. **That mechanism does not exist and never
did.** The curve stretches, but so does the XP a wave pays, and the two cancel — hence the
flat 1.00 above.

What actually produces mild rarification is **wave duration**: measured across 200 runs,
seconds per wave rises from ~35s around wave 4 to ~41s by wave 15. So heals do thin out, by
about 17% over eleven waves, and they do it through the wave clock.

Removing XP therefore **preserves the doom clock exactly as it really operates** and removes
only a false explanation of it. The specs are corrected to say so. If we want a *real* doom
clock — one that bites — it has to be built deliberately; it is pinned, not assumed.

## Alternatives considered

1. **Daniel's two-track split: wave completion grants a weapon upgrade, XP unlocks passive
   boosts.** The most interesting idea on the table, and the only one that gives XP a job it
   can't be replaced at — two currencies buying two different *kinds* of thing, so neither is
   a costume for the other. **Deferred, not rejected**, on his own objection: the passive
   pool is thin (a handful of stat bumps), so the XP track would currently unlock almost
   nothing and the split would be structure without content. Revisit when passives are worth
   drafting for — this ADR makes that cheaper, not harder, because the level grant is already
   isolated in one function.
2. **Keep XP, make wave clear top the player up to the intended level.** Preserves both
   systems and the bar. Rejected as the worst of both: it keeps every multiplier and node
   while making them provably unable to matter, which is the current situation plus a
   safety net.
3. **Keep XP and give it real variance** — leak enemies for reduced XP, bonus for fast
   clears. Makes the system honest instead of removing it. Rejected for now on two counts:
   leak-punishment is a compounding loss channel (fall behind → level slower → fall further),
   and a fast-clear bonus is a reward for *aggression*, which is Law·Delegation's business
   and wants a deliberate design rather than a side effect of the XP curve.
4. **Delete the bar with the system.** Rejected — see below.

## Consequences

- **The bar stays, as a wave-progress bar.** `app.md` records it as a playtester-driven
  affordance (2026-07-23): *"the level-up is the run's heartbeat and its approach should be
  felt, not discovered."* That is now *more* true, not less — the bar's denominator becomes
  honest (bodies remaining in the wave) and it fills toward the thing it always predicted.
  Deleting it would have thrown away a playtest win for an implementation detail.
- **ADR-0008's causal model is amended.** "Bodies are XP" was the twice-confirmed reason
  durability, not budget, is the difficulty lever — more chaff meant more player power, so
  budget-as-difficulty backfired. With XP gone, **chaff volume feeds nothing**, and the
  conclusion (durability is the lever) now rests on the surviving half of the argument:
  bigger budgets lengthen waves without deepening them. The empirical finding stands; one of
  its two legs is removed.
- **Law·No-meta-accel loses a live exception.** GDD §5's parenthetical — *"in-run xp
  multipliers stay legal: leveling speed is in-game power, not meta speed"* — existed solely
  to bless the six nodes. With them retired the parenthetical is struck; the law is simpler
  and has one fewer carve-out. `test/economy.test.mjs`'s guard asserting `xpAdd` nodes still
  exist is **deleted, and that deletion is a loosening called out here and in the diff.**
- **Tempest loses its `xpMult: 1.1`** with nothing replacing it — a real tower differentiator
  gone. Pinned rather than reinvented: designing a new Tempest edge is not this change's job.
- **The `overqual` achievement ("reach level 12 in one run") becomes "clear wave 10."**
  Left as-is: it is now a *legible* achievement instead of an opaque one.
- `test/tech.test.mjs`'s legacy-id guard names `study1`; it is loosened by one id, following
  the `salv1` precedent already in that file. Also called out.
- Calibrate and conductor keep working untouched — both consume the `levelup` signal, which
  is unchanged. Their reported `lvl` becomes a deterministic function of wave, which makes
  them *easier* to read, and `bossHp`'s reference-DPS guess can now be checked against a
  known level rather than an estimated one.
