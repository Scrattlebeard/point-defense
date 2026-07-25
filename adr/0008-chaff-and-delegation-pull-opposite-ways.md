# ADR-0008: Chaff restoration and the delegation law pull opposite ways — focus-forcers are the resolution, not mix-tuning

**Status:** ACCEPTED 2026-07-25 (Zephyr, overnight phase-3 session; measured, not argued.
Daniel is the design authority and may overturn the tuning — the *finding* is the ADR.)

**Relates to:** ADR-0006 (slot budget), ADR-0007 (laws bind the default). Implements the
first half of GDD §11 phase 3. Amends nothing; it records a tension the GDD's laws contain
but never named.

## Context

GDD §5 says species are roles in the focus economy: *"chaff that autos eat (grunts) …
focus-sinks that must be answered manually (elites)"*, and Law·Focus wants chaff to be
cheap in autos. Separately, GDD §3's Law·Delegation says autos must be **deliberately
insufficient alone**, enforced since 2026-07-25 by `scripts/conductor.mjs`.

The prototype violated the first: `composeWave` picked a species **uniformly** and only
subtracted its cost afterward, so cost regulated wave *size* and never the *mix*. Measured:
the species share was **20/20/20/20/20 by body count at wave 14 and identical at wave 500**,
elites were **52% of wave HP against grunts' 6%**, and every composition lever was inert past
wave 29.

Restoring chaff (cost-weighted picking, so a species' body count is its budget share divided
by its cost) was expected to be a straightforward fix. It was not.

## The finding

**Restoring chaff, alone, broke the delegation law.** With the composition fix in and nothing
else changed, the conductor gate went from holding to:

> hands worth **1 wave**, parked deaths **0/11** — the do-nothing run became unkillable again.

The mechanism is obvious in hindsight and worth stating plainly: **chaff is exactly what
autos are best at.** The wave budget is conserved, so buying more cheap bodies *takes budget
away from* the expensive ones — elite pressure at wave 45 fell by a third (44 elites → 29).
Law·Focus and Law·Delegation therefore pull in opposite directions under the mechanics as
they stood.

**The trap this creates, and it is the reason this ADR exists.** Sweeping the composition
tilt, a steep setting (`0.55 → 1.3`) makes the conductor gate pass cleanly — hands worth 4
waves, parked deaths 5/7. But the mix it produces at wave 60 is **59% elite HP and 14% grunts
by body count**: *worse than the degenerate state the fix was written to correct.* A
conductor gate, on its own, **rewards elite-loading** — the cheapest way to make autos
insufficient is to delete the chaff. The gate would have been green for precisely the wrong
reason, and a future session reading only the green check would never know.

## Decision 1 — the composition fix does not land alone

Chaff restoration ships **together with** a threat that is undelegatable for a reason other
than raw HP concentration. Tuning the mix cannot resolve the tension; it only slides along it.

## Decision 2 — the boss is the focus-forcer, and is derived from its wave

`bossHp` was **linear against a quartic wave-HP curve**: a named boss was 31% of its wave's
HP at wave 5 and **4.9% by wave 45** — Law·Bosses decaying into one chunky elite among
forty-four. It is now derived: `bossHp(w) = share/(1−share) · waveTrashHp(w)`, so a boss is
always the same fraction of its wave, and changing the budget or the mix moves the boss with
it. Structural decay becomes impossible rather than merely fixed.

**`BOSS_HP_SHARE = 0.31` is a measured threshold, not a preference.** Swept against the gate:

| share | hands worth | parked deaths | verdict |
|-------|-------------|---------------|---------|
| 0.15 | 1 wave | 4/7 | broken |
| 0.22 | 0 waves | 7/7 | broken — parked dies, but so does the robot, at the same wave |
| **0.31** | **10 waves** | **7/7** | holds |

The 0.22 row is the interesting one: the boss is big enough to kill the parked run but not
big enough to *require aim*, so hands buy nothing. Somewhere below 0.31 the boss crosses from
"the autos grind it down eventually" to "you must point at it" — that crossing **is**
Law·Bosses, and it has a number. 0.31 is independently the measured wave-5 value, which
playtesting already validated as the onboarding wall.

Combined result (composition + boss, no tech, maxed budget-legal build): **hands worth 10
waves, parked deaths 11/11**, calibrate median 10 in band — with the chaff-correct mix
(elite HP share 24% at wave 14 rising to 39% at wave 60, against a frozen 52% before).

## Decision 3 — the stall constraint bounds the boss share, permanently

The wave director will not start wave *w+1* until the field is empty (`game.js`, phase
`clear`). A boss too tanky to kill therefore does not raise difficulty — **it freezes the
run**. Any future increase to `BOSS_HP_SHARE` must re-check time-to-kill, not just the share.
Recorded in `core.md` beside the formula because it is invisible from the curve alone.

## Decision 4 — the anti-elite-loading guard lives in the test tier

The conductor gate is not taught to detect a degenerate mix; that would overload one
instrument with two jobs. Instead `test/waves.test.mjs` pins the mix directly: cheap species
outnumber expensive ones, the expensive share rises with the wave, and **chaff never falls
below 15% of bodies** — so a future change cannot buy a green conductor by deleting the chaff
without going red at the tier above.

## Alternatives considered

1. **Tune the tilt until the gate passes.** Rejected — this is the trap itself (see above).
   It produces a worse mix than the bug being fixed and hides that behind a green check.
2. **Grow `waveBudget` so chaff is added without displacing elites.** Rejected: bodies are
   XP. The "budget as difficulty" mistake is twice-confirmed in `core.md` — bigger budgets
   made runs *longer*, because volume feeds the player.
3. **Fix the rim dead zone first** (orbit/frost/mine/caltrop deal literally zero to shapes
   holding the rim — its own [phase 3] pin). Deliberately *not* sequenced here, and the
   reason is worth recording: every candidate fix **gives autos more power**, so it pushes
   the conductor number *down* while fixing Law·Death-shape. It is a genuine law-vs-law
   trade and should be measured against the gate on its own, not smuggled in beside a change
   that moves the same number.
4. **Let elites carry the focus-forcing.** Rejected — that is the 52%-elite status quo, and
   it makes "what now?" have exactly one answer, violating Law·Focus.

## Consequences

- Runs got shorter and deaths now **quantize hard to boss waves** (30/35/40/45 in the gate
  runs) — Law·Bosses working as designed, but it wants human eyes: five-wave walls could read
  as rhythm or as a metronome. First playtest question.
- No-tech maxed-weapon runs now die around wave 40–45 where they previously survived to the
  time cap at wave 55–56. That leaves the lattice room to push toward GDD §2's wave 50–100
  end-boss placement instead of arriving there ungeared.
- **Modifiers are the untapped focus-forcer.** Regen especially: autos deal chip damage, and
  partial damage on a regenerating elite is wasted damage. Variant stacking past wave 40 (its
  own pin) is the natural next lever, and is now the *designed* successor to this ADR rather
  than a content idea.
- The conductor gate's ratchets are unchanged (hands ≥ 3, parked deaths ≥ 2/11); tonight's
  numbers clear both with room. Raising them is a later decision, taken deliberately.
