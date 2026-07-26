# ADR-0020 — The blade grows along the ring, not away from it

**Date:** 2026-07-26
**Status:** accepted
**Context:** core.md orbit row (the 2026-07-24 "slight nerf" and the 2026-07-25 exposure
fix) · ADR-0017 (balance gates are advisory) · ADR-0006 (weapon taxonomy — orbit is an
`auto`, so it has no input and cannot ask the player for a decision)

## The ask

Daniel, playtesting the arsenal, 2026-07-26:

> *"The damage upgrade at level 3 or 4 feels very underwhelming. I don't like that we keep
> increasing the radius per default, and taking it out of the slow aura is a huge nerf
> actually. And perhaps we could make a slight overhaul to make them look more knife/blade
> like? Maybe in general nerf the knockback a bit but up the damage."*

Four complaints. Three of them turn out to be the same defect seen from different angles,
and the fourth (the look) is the one that names the fix.

## What was actually wrong

**1. Arc coverage fell as the weapon levelled.** A blade is a point with a 13px hit radius;
a shape of radius `e.r` is caught across roughly `2(13 + e.r)` of the circumference. With
`e.r ≈ 14`, the fraction of the ring that is *bladed at all*:

| level | blades | radius | coverage |
|-------|--------|--------|----------|
| 1 | 2 | 96 | 17.9% |
| 2 | 3 | 104 | **24.8%** |
| 3 | 3 | 112 | 23.0% |
| 4 | 4 | 168 | 20.5% |
| 5 | 5 | 218 | 19.7% |

Coverage **peaks at L2 and declines for the rest of the ladder**. Every level after the
second added blades to a ring that was outrunning them faster than they were being added.
This is the repo's most repeated defect in a new costume: an absolute constant (the 13px
blade) sitting beside a scaling curve (the radius). core.md already recorded half of it —
the 2026-07-24 note calls pushing the ring out *"a deliberate slight nerf"* for exactly this
reason — and then the 2026-07-25 exposure fix pushed it much further as a *buff*, without
anyone pricing the coverage that bought it.

**2. L3 grants nothing legible.** L2, L4 and L5 each hand over a blade. L3 hands over +8px
of radius and the +6 damage that *every* level ticks anyway. Measured — seeded scenario,
bolt held at L3, only orbit's level varying, orbit damage/sec at two horizons:

| level | dmg/s @120s | step | dmg/s @400s | step |
|-------|------------|------|------------|------|
| 1 | 16.9 | — | 5.0 | — |
| 2 | 44.7 | +165% | 13.7 | +176% |
| 3 | 63.1 | **+41%** | 19.4 | **+42%** |
| 4 | 145.2 | +130% | 42.5 | +119% |
| 5 | 291.8 | +101% | 184.7 | +335% |

L3 buys about a quarter of what its neighbours buy. Daniel felt this before it was measured.
The same table shows the other half of the shape nobody had complained about yet: **L5 is a
cliff**. The ladder is big, tiny, big, enormous — and both defects have one cause, which is
that blades are granted on some levels and not others.

**3. The ring left the frost aura.** Frost's radius is `100 + 26L` — 126 / 152 / 178 / 204 /
230. Orbit at L4 (168) and L5 (218) sat outside every frost level but the deepest. The
grind-plus-slow interaction that made the pair feel good stopped existing exactly when both
weapons were most invested in. A weapon whose synergy *expires* as it levels is a trap.

## The decision

**The ring is a constant. Levelling lengthens the blades along it.**

1. **Orbit radius is 138 at every level.** One number, no ladder. It sits inside the
   measured kill band (deaths cluster at 120–240px; nothing dies inside 120), which is what
   the 2026-07-25 change was really buying — and 138 minus the blade's own 13px reach puts
   its inner edge at 125, inside frost's *weakest* aura (L1, radius 126). The pairing now
   holds at every level of both weapons instead of expiring when both are maxed. There is a
   test for exactly that.
2. **A blade has length, measured along the arc.** The hit test is point-to-segment, not
   point-to-point. Coverage is now **linear in blade length**, which makes it a knob that
   can be tuned instead of a side effect that has to be discovered.
3. **Every level grants a blade: 2/3/4/5/6.** No rung is a filler rung.
4. **The per-shape bite cooldown is a stat, and it shortens with level** — 0.50 / 0.46 /
   0.42 / 0.36 / 0.30s. It is the ceiling control (see below), and making it a ladder is
   what keeps the top of the curve from flattening.
5. **Knockback 45 → 30, damage 10+6L → 17+9L.** As asked. The knockback nerf costs exposure
   (a shoved shape re-crosses the band), and the coverage gain is what pays for it — the two
   changes are a pair, not two independent dials.
6. **The ladder is reshaped, and the top is deliberately not held flat.** Measured in
   isolation the weapon is ~30% stronger at max; measured as a *share* of a full maxed build
   it is weaker, because the ring came in. Both are consequences of decision 1 and neither is
   an accident — see "The cost, stated" below, which is the part of this ADR most likely to
   be argued with later.

## What the measurement changed about this decision

The first draft of this ADR said *"L3 is the length level"* — keep blades at 2/3/3/4/5 and
let longer blades carry the third rung. **Measurement falsified it.** With that ladder L3
still stepped only +42%, unchanged from the shipped curve, at both the 120s and 400s
horizons — so it was not a pile-up artifact of the harness but a real property.

The reason is worth writing down, because it is the design constraint underneath the whole
weapon: **blade count multiplies the rate at which a shape is bitten; blade length only
multiplies the chance a shape is bitten at all.** Against anything standing in the band the
first term dominates outright, and no plausible amount of length substitutes for a blade.
Length is a coverage knob, not a power knob — which is exactly why it is the right knob for
tuning and the wrong one for carrying a level.

That has a mirror image at the top of the ladder. Blade count saturates against the bite
cooldown: at a fixed 0.4s, L4 (5 blades) and L5 (6 blades) both swept past faster than a
shape could be re-cut, and L5 measured a **+15% step** — the runt had simply moved from the
middle of the ladder to the end. Hence decision 4: the cooldown has to come down as the
blades go up, or the last level buys a blade that cannot bite.

## Result

Same instrument, same seeds, after:

| level | dmg/s @120s | step | dmg/s @400s | step |
|-------|------------|------|------------|------|
| 1 | 27.5 | — | 8.3 | — |
| 2 | 63.7 | +132% | 19.3 | +133% |
| 3 | 138.3 | +117% | 42.2 | +119% |
| 4 | 254.1 | +84% | 102.5 | +143% |
| 5 | 383.1 | +51% | 242.7 | +137% |

The worst rung goes from **+41%** to **+51%**, and every rung is now worth taking. Onboarding
is untouched or slightly steadier: `scripts/calibrate` at 31 trials runs 5/5/5/5 in band
against a baseline of 4/5/4/5. *(At 15 trials both read 5/5/4-ish and the difference is
invisible — this effect is smaller than that sample's noise, which is worth knowing before
anyone re-runs the gate to check a weapon tweak.)*

## The cost, stated: exposure and the frost pairing are in competition

In isolation the weapon got stronger — the ladder above is ~30% up at max. But measured in a
**full budget-legal maxed build** (bolt 6 / orbit / nova / frost / tesla / turret, 4 × 15
minutes, seeded), orbit's damage *share* goes the other way:

| | bolt | orbit | nova | turret | tesla |
|---|---|---|---|---|---|
| before | 43.4% | **35.9%** | 14.5% | 3.4% | 2.8% |
| after | 48.7% | **30.8%** | 13.7% | 3.7% | 3.0% |

Both readings are true and the gap between them is the real finding: **a ring at 218 sat in
the middle of where the rest of the build was already killing, and harvested it.** Bringing
the ring in to 138 buys the frost pairing and costs that harvest. The 2026-07-25 exposure
argument was not wrong; it was simply the other side of a trade nobody had named, and Daniel
has now chosen the pairing side of it. If the harvest is wanted back, it is one number —
`radius` — and the test that guards the aura rule is the thing that will object.

The look follows the mechanic rather than decorating it: a blade with real length, swept
edge-first, is a knife. The old triangle pointed *outward* — radially, like a spike on a
hubcap — which is precisely the wrong reading of a weapon that grinds by sweeping.

## Alternatives considered

- **Make the blade long *radially* instead** — a spinning rotor sweeping the whole field.
  Rejected on arithmetic: swept area goes as r², so a blade spanning 79→237 sweeps
  156,800px² against the old band's 35,600 — a **4.4× exposure buff** before a single point
  of damage is added. It would have needed damage cut by three quarters, which is the
  opposite of what was asked. (The same r² weighting that made a symmetric gradient a net
  *darkening* in ADR-0019. Radial distance is expensive; arc length is not.) It is also the
  wrong *picture*: a radial blade is a spike on a hubcap, and the thing being asked for was
  a knife.
- **Leave the radius ladder alone and just fix L3.** Rejected: it treats the symptom. The
  coverage decline and the lost aura overlap are both consequences of the ring moving, and
  both are real at L4/L5 where L3 is not.
- **Tie the orbit radius to the frost radius when frost is present.** Rejected: spooky
  action between two weapons that must each be legible alone, and it makes orbit's behaviour
  depend on a card the player may never be offered.
- **Let the player choose the radius.** Rejected by ADR-0006: an `auto` weapon has no input.
  A weapon that asks for a decision is not in the auto category, and moving it there would
  cost a gesture slot the arsenal cannot spare.

## What this does not settle

The measurement harness is a **spike, and it is biased**: an immortal tower lets shapes pile
up in the ring, which flatters every contact weapon. Its numbers are trustworthy as
*relative* readings between two builds under the same bias — which is the only way they are
used here — and not as absolute damage shares. The authority on whether this feels right is
the next playtest, per ADR-0017.
