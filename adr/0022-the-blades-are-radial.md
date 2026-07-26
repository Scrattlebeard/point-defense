# ADR-0022 — The blades are radial spokes, and ADR-0021's arithmetic was wrong

**Date:** 2026-07-26
**Status:** accepted
**Supersedes:** ADR-0020 decision 2 (the blade is an arc of the ring) and the whole of
ADR-0021 (the rake, which exists only to fake a leading edge a radial blade has for free).
The *other* ADR-0020 decisions — one rooted radius, a blade per level, the bite cooldown as a
ladder, the frost-aura law — all survive and are the load-bearing part.

## The ask

Daniel, after the ADR-0021 build:

> *"What if we put them more upright, like radials extending from the point"*

This is the alternative ADR-0021 listed and rejected. **The rejection was wrong**, and the
error is worth recording, because it was an error of reasoning rather than of taste.

## The error

ADR-0021 argued that a radial blade buys *"a thicker band at lower coverage"* where a
tangential blade buys *"a thinner band at higher coverage"*, and concluded that coverage is
what matters, so tangential wins. The first clause is true. The conclusion does not follow.

What determines how hard a shape is ground is **how long it spends inside the swept region ×
how often a blade passes it**. Blade passes over a given angular position happen at
`n·ω/2π` — **independent of the blade's orientation**. So orientation does not change the
pass rate; it changes only the dwell time. And the dwell times are not close:

| | swept region | dwell for a shape approaching at ~55px/s | bites |
|---|---|---|---|
| tangential (ADR-0020/21) | a 26px band | ~0.47s | ~1.4 |
| radial (this) | a 100px reach | ~1.8s | ~5 |

Coverage dominates only for **brief** transits, where the question really is "was a blade
there during the one moment available". For a shape walking through the entire blade, dwell
time dominates and radial wins by roughly 4×. ADR-0021 generalised the brief-transit case to
every case. **Daniel proposed a straight buff and it was refused with a confident sentence
that had not been checked.**

## The decision

**A blade is a radial spoke: rooted at a fixed `inner`, reaching out to `outer`.**

1. **`inner` is 96 at every level; `outer` is what levelling buys** — 140/156/170/184/196.
   This keeps the answer ADR-0020 gave to *"I don't like that we keep increasing the radius
   per default"*: what must not drift is where the blades are **rooted**. The tip extending
   is a legible grant; the whole weapon sliding outward was not.
2. **The leading edge is free.** A radial blade's entire tangential face leads, so it cuts
   edge-first with no rake. ADR-0021's rake was a workaround for a geometry that had no
   leading face, and it retires with that geometry.
3. **It reaches both ways at once, which the tangential blade could not.** The root sits
   inside frost's weakest aura (96 − 9 reach = 87, against frost L1's 126) *and* the tip
   reaches 196, back out into the 120–240px band where shapes actually die. ADR-0020 had to
   choose between the frost pairing and that harvest and recorded the trade as unavoidable.
   **It was not unavoidable — it was an artifact of the blade being a point on a circle.**
4. **Power is held, not raised.** Damage falls to 10+4L and the bite cooldown ladder is
   re-cut to 0.80/0.66/0.52/0.40/0.31s, landing orbit at 30.8% of a full maxed build against
   the previous build's 29.4%.
5. **Two new failure modes get tests**, because a radial blade can fail in ways a tangential
   one could not: reaching the Point (the weapon becomes a disc and swallows the tower) and
   reaching past a 430px screen's half-width (tips off-canvas at the sides, paying fill rate
   for blade nobody can see — the *old* 218px ring was doing exactly that).

## Why the damage number went down and should not be read as a nerf

Per-bite damage at max drops from 62 to 30, which looks like the opposite of *"up the
damage"*. Per **crossing** it goes the other way: a shape used to take ~1.4 bites of 62 (~87
damage) on its way in and now takes ~5 bites of 30 (~150). The geometry converts a few large
ticks into many small ones at higher total. That is what a *grinder* should feel like, and
core.md has described this weapon as grinding since the day it was written.

## What this costs

**Blade count and the bite cooldown fight each other, and the tuning is genuinely delicate.**
Blade count raises the pass rate; the cooldown caps it. Whenever the cap binds, blade count
stops mattering and the rungs that grant blades go dead — measured, a cooldown ladder that
bound at every level flattened L2 and L3 to +89% and +54% and dropped the weapon to 23.6% of
a build. The ladder that ships keeps the cap *just* above the pass rate at every level, so
both levers stay live. **Anyone re-tuning either curve must re-measure the other**; they are
not independent, and the failure is silent — it looks like a level that simply feels weak.

## Alternatives considered

- **Keep the tangential blade and accept the aura/harvest trade** (the ADR-0020 position).
  Rejected: that trade turns out to be an artifact rather than a law, and refusing a
  strictly-better geometry to protect two ADRs would be the tail wagging the dog.
- **Radial blades reaching all the way to the hub.** Rejected: the measured death-radius
  distribution says nothing dies inside 120px, so blade inside ~90 is nearly dead area, and
  it visually swallows the tower — the one thing on screen the player must always read.
  Hence a hub gap, with a test.
- **Keep per-bite damage at 62 by raising the cooldown.** Tried and measured. It makes the
  cooldown bind everywhere, which kills the blade-count rungs (see above). Bigger numbers are
  not worth a dead ladder.
