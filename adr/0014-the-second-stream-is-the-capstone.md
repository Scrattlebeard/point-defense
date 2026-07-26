# ADR-0014 — The second stream is the capstone

**Status:** ACCEPTED (2026-07-26). Re-cuts the bolt ladder set by ADR-0006 Decision 8;
that decision's *reasoning* (a form must not sell at mastery what levelling gives away)
stands and is in fact what this ADR applies to the ladder's own biggest gift.

## Context

The bolt ladder granted its second stream at **L3**: from that level, a *manual* stream
fires at the player's aim and an *auto* stream picks the nearest in-bounds shape. One
level, and the weapon's emission doubles.

Every other rung on every other ladder is an increment — more damage, one more blade, a
pierce, a chain. The second stream is not an increment; it is a **second weapon**, at a
level reachable in the first minutes of a run. Daniel, playtesting: *"it's too powerful —
should be a capstone."*

The measurement agrees. Damage per second across the old ladder, at the fixed cadence
`0.38 − 0.02L`:

| level | dmg/bolt | streams | dmg/s | step |
|---|---|---|---|---|
| L2 | 17 | 1 | 50 | — |
| **L3** | 21 | **2** | **131** | **×2.6** |
| L4 | 25 | 2 | 167 | ×1.3 |
| L5 | 58 | 2 | 414 | ×2.5 |
| L6 | 99 | 2 | 762 | ×1.8 |

**L3 was the largest single step in the ladder, and it sat third.** A weapon whose steepest
rung is its third has spent its own mastery curve before the player has met a boss — which
is the same failure ADR-0006 Decision 8 named when it took the fan volleys off the ladder,
turned on the one gift the ladder kept.

## Decision

**The auto stream moves from L3 to L6 (MAX), and the three grants above it each shift down
one rung**, so no level is left hollow:

| | L3 | L4 | L5 | L6 (MAX) |
|---|---|---|---|---|
| **was** | +auto stream | pierce 1 | ricochet 1 | ricochet 2 |
| **now** | pierce 1 | ricochet 1 | ricochet 2 | **+auto stream** |

Per-bolt damage stays pinned to the *level* (9+4L through L4, 58 at L5, 99 at L6) rather
than travelling with the grants. Those two numbers are the old fan's emission collapsed
into one bolt (58 = 2×29, 99 = 3×33, ADR-0006 Decision 8); they were never payment for
pierce or ricochet, so there is nothing to move.

## What this actually changes

- **Max bolt is untouched.** L6 is still two streams × 99 with ricochet — identical
  emission, identical concentration, identical to the build nobody complained about. This
  ADR is not a nerf to mastery; it is a re-slope of the road to it.
- **L3–L5 lose half their emission** (131→66, 167→83, 414→207 dmg/s) and get their pierce
  and ricochet a level earlier in exchange. Those two multiply against crowds, so the felt
  loss is smaller than the raw halving — but it is a real mid-game nerf, and it is the
  point.
- **The capstone becomes the biggest step in the ladder** (×3.7 from L5), where a capstone
  belongs, and it is a *qualitative* step — the weapon starts covering targets you are not
  aiming at — which is what mastery should feel like.

## Alternatives considered

1. **Move the stream to L6 and leave the other grants where they are** — the literal
   minimum edit. Rejected: it hollows out L3 to a bare "+damage" (the ladder's only
   contentless rung) and makes MAX a *double* grant, ricochet-2 **and** a second stream,
   which blurs the very thing this ADR exists to sharpen. The capstone should be one
   legible promise.
2. **Keep the stream at L3 and halve its bolt damage.** Rejected: it preserves the shape of
   the complaint — L3 still doubles the weapon's *reach*, which is what makes it feel like
   a second weapon — while making the numbers harder to read. Hidden compensating
   multipliers is the exact move ADR-0013 just finished removing.
3. **Move the stream to L5 instead of MAX.** A softer version, and defensible. Rejected on
   the plain reading of the instruction ("the last level"), and because L5 already carries
   the ladder's other big step (the 25→58 damage collapse); stacking them makes L5 the new
   L3.
4. **Slow the auto stream instead of moving it** (its own, longer cadence). Rejected as new
   mechanism for a tuning problem — two cadences on one weapon, permanently, to solve a
   thing that a rung move solves. Simplest solution that works.

## Consequences

- **Calibrate falls two waves: median 7 → 5**, still inside the [5, 10] band but on its
  floor. Measured, not guessed, and measured against the instrument's known noise — three
  200-trial sweeps after the change all read 5, two before it both read 7, where identical
  inputs had previously wandered ±2–3 waves between sweeps (2026-07-25). A consistent
  separation that large is signal. This is the expected direction: bolt is every tower's
  starting gun, so halving L3–L5 emission is felt by every fresh account. **If the band
  breaks, the fix belongs in the early curve, not in putting the stream back** — and note
  that `BOSS_TTK_FIRST` 15→22s landed the same day and made the wave-5 boss 47% fatter, so
  two independent difficulty increases now compound at exactly the wave the median sits on.
- The Fan form is unaffected — it is offered only for a maxed bolt, and MAX is unchanged.
- `test/bolt.test.mjs` and `test/ricochet.test.mjs` both hard-code the old rungs (L≥3 has
  an auto stream; ricochet arrives at L5). Both are **re-cut, not loosened**: the same
  properties are asserted at the new levels, and the "one bolt per stream" and
  emission-neutrality invariants are untouched.
- Not addressed: whether the ×3.7 capstone step is *too* large a cliff. It equals today's
  shipped max, so it is not new power — but it is newly concentrated at one purchase, and
  that is a playtest question, not a spreadsheet one.
