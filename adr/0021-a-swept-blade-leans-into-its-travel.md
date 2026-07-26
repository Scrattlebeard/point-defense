# ADR-0021 — A swept blade leans into its own direction of travel

**Date:** 2026-07-26
**Status:** accepted
**Context:** ADR-0020 (the orbit blade is an arc of the ring — this refines how it is *drawn*,
and does not disturb the hit test) · ADR-0019 (the light grammar)

## The ask

Daniel, playtesting the ADR-0020 build:

> *"Definitely better, I think 6 blades this long is a bit much though. And the edge is
> facing outwards, but the rotation is clockwise, so it gives more the feel of a spike
> stabbing than a blade cutting you know?"*

The second half is a real defect and not a matter of taste. It is worth stating precisely,
because the same trap is waiting for every future entity that moves along its own long axis.

## The defect

ADR-0020 made the blade **long along the arc** and honed it on the **outer radius**. Both
choices were right on their own and wrong together:

- The blade travels **tangentially** — along its own length.
- Its bright edge faces **radially** — ninety degrees off the direction of travel.

So nothing about the picture leads. A blade whose edge never meets anything edge-first is not
cutting; it is being carried sideways, and the only part of it that arrives anywhere first is
its tip. The eye reads that correctly and calls it a spike. The blade was also **symmetric** —
tapered to identical points at both ends — which erases the last cue that it has a front at
all. A symmetric shape moving along its axis is a shard, not a knife.

## The decision

**A blade is raked: its leading end rides further out than its trailing end.**

1. **Rake.** The blade's centreline is a *spiral* segment, not a constant-radius arc — the
   leading end sits 7px further out than the trailing heel. That tilts the honed outer face
   into the direction of travel instead of square across it, which is the whole fix. It also
   makes ADR-0019's radial gradient do double duty: because the leading end is at the larger
   radius, "bright at the outer edge" *becomes* "bright at the leading edge" for free.
2. **Asymmetry.** The blade tapers to a sharp point at the leading end and keeps its full
   thickness at the trailing heel. The silhouette now says which way it is going even in a
   still frame — which is the test that matters, since a screenshot cannot show rotation.
3. **The hit test does not move.** It remains the straight chord of ADR-0020. The rake spans
   ±7px of radius against a `reach` of 13, so the drawn blade stays inside the region that
   already bites; no shape is cut by a picture that isn't there, and none survives a picture
   that is.
4. **Blades get shorter.** Lengths drop from 12/22/38/54/72 to 8/14/22/30/38. At the old
   numbers six maxed blades filled **64% of the ring** — that is not six knives, it is a
   cogwheel with gaps. There is now a test bounding it.

## Alternatives considered

- **Re-orient the blade radially** — long in the radial direction, edge facing tangentially.
  This is the textbook rotor and it would read as cutting with no rake needed. Rejected
  because it would either lie about the hit test or replace it. And the replacement is
  measurably worse: *any* blade sweeping a full circle sweeps an annulus, so the geometry
  buys a **thicker band at lower coverage** where the tangential blade buys a **thinner band
  at higher coverage**. A shape crossing inward will cross whatever thickness is there — the
  question is only whether a blade is present when it does, and that is coverage. Tangential
  wins the mechanic; the rake wins the picture; there is no need to trade one for the other.
- **Add a motion trail behind each blade.** Cheap and it would sell rotation hard. Held back:
  the rake and the asymmetry are the structural fix, and a trail would make it impossible to
  tell whether the silhouette is doing its job. If the blades still read as spikes with the
  trail off, *then* the trail is a fix rather than a cover.
- **Drop to five blades instead of shortening them.** Rejected: the six-rung ladder is what
  made every level grant something in ADR-0020, and removing the sixth blade puts the dud
  rung back. Length is the free variable here; blade count is not.

## The general rule this leaves behind

**Anything that moves along its own long axis has to be told which end is the front.** The
cues are rake and asymmetry, in that order. It applies next to the boomerang (currently two
symmetric crossed crescents) and to the force blades, neither of which is being changed here.

## Result

Airiness: maxed blades fill **40%** of the ring, down from 64% — six distinct knives with
visible gaps between them, which is what a still frame needs in order to show six of
anything. Bounded by a test at 45%.

The ladder, seeded, orbit damage/sec by level (120s horizon, which is the one that is not
distorted by target starvation — see below):

| | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|
| before shortening | 27.5 | 63.7 (+132%) | 138.3 (+117%) | 254.1 (+84%) | 383.1 (+51%) |
| after | 26.5 | 65.3 (+146%) | 136.2 (+109%) | 253.9 (+86%) | 355.2 (+40%) |

Shortening costs about a tenth of the capstone and essentially nothing below it — the change
is overwhelmingly visual, which is what it was asked to be. Share of a full maxed build moves
30.8% → 29.4%.

**A harness artifact worth naming, because it nearly caused a bad tuning decision.** At the
400s horizon the same change reads as an L5 step of **+18%**, which looks like the capstone
collapsing. It is not: the measurement harness gives the tower 1e9 HP so runs last long
enough to sample, and by 400 seconds a maxed orbit is clearing its own ring faster than the
wave director refills it. The weapon runs out of *targets*, not out of power, and the top of
the ladder gets compressed against the spawn rate rather than against anything real. The
120s horizon is the honest read for capstone comparisons; the 400s horizon remains the
honest read for damage *share* in a crowded field. **Two horizons, two different questions —
quoting the wrong one is how a healthy capstone gets "fixed" into an overtuned one.**

Onboarding sits back on the 4/5 boundary where it has always been (`calibrate` at 31 trials,
six runs: 4/5/5/5/4/5). ADR-0020 had nudged it to a clean 5/5/5/5; shorter blades give part
of that back, which is expected and within the noise this instrument has always had.
