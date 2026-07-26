# ADR-0019 — Light has a grammar: emissive tubes, lit solids, one light direction

**Date:** 2026-07-26
**Status:** accepted
**Context:** ADR-0002 (the dark neon-arcade look is the single theme) · PINS [perf] (the
wave-20 p95 step; blur is the suspect)

## The ask

Daniel, mid-playtest: *"A lot of our things are quite uniformly-colored lines/shapes. A bit
of highlight and shadow to give it more of the shiny cyber Tron look would be nice."*

He is describing a real property of the renderer, not a vibe. Almost every entity on the
field was drawn as **one flat stroke or one flat fill** — a single colour, a single width,
no depth. The theme said "neon"; the drawing said "vector diagram". The gap between them is
the whole of this ADR.

## What makes neon art look like neon

Two tricks, and they are different tricks — which is the part that matters, because the way
this goes wrong is applying both to everything and getting mud.

- **Emissive** things make their own light. A real neon tube is *white in the middle and
  coloured in its bloom*. So: a wide, saturated, low-alpha halo under a thin, whitened core.
  A self-lit object has no shadow side.
- **Lit** things are solids catching light from somewhere. So: a gradient offset toward the
  light, a bright rim where the surface turns into it, a far edge falling into shadow. A lit
  object does not bloom.

**Decision: every shiny thing is exactly one of the two, never both**, and the light comes
from one shared direction (`LIGHT_A`, up and to the left) for the entire game. A scene lit
from two directions reads flat, which is the defect being fixed — so the direction is a
constant in `neon.js`, not an opinion at each call site.

The grammar lives in a module (`src/app/neon.js`: `tube`, `litDisc`, `rimLight`, `litBar`)
rather than as a habit repeated by hand in fifteen places. That is what makes it a grammar
instead of a style pass — the next entity added to the field inherits it.

## The hue lives in the halo, not the core

Non-obvious, and load-bearing. Whitening a stroke desaturates it, and "enemy species = hue"
(ADR-0002) is the single most important read in the game. Putting the species colour in the
**halo** — the larger patch of screen — and the brightness in the thin core preserves the
hue read while making the shape look lit. `test/neon.test.mjs` pins it: the halo must be the
more *saturated* of the two passes and the core the more *luminous*. Invert that pairing and
the law dies on every shape at once, silently.

## This is implemented with halos, not `ctx.shadowBlur`, and that is a cost decision

The obvious way to make a canvas glow is `shadowBlur`. We are not doing that, and the reason
is on the record already: blur forces an offscreen pass per draw, it is the most expensive
2D operation on mobile silicon, and **it is the standing suspect for the wave-20 p95 step**
(PINS [perf]) precisely because the renderer applied it *per enemy* — 2.5 blurred draws per
frame at wave 14 rising to 7.3 by wave 29. A cost that scales with how busy the fight is has
exactly the shape of the observed step.

A wide low-alpha stroke of the same path buys the same read for plain fill rate. So the
shine-up **removed** both per-enemy blur sites (the hit pop, the swift under-glow) by folding
them into the halo each shape now draws anyway. **`shadowBlur` is now set at most once per
frame — the tower alone**, and `test/render.test.mjs` fails if the count starts scaling with
the field again. The `?noblur` hatch survives and still isolates the tower's glow cleanly.

Stated honestly: **this repo cannot time a GPU**, so "cheaper" is an argument from the
mechanism, not a measurement. What is measured: JS render cost roughly doubled (0.012 →
0.024 ms/frame at wave 22, still 0.2% of budget) and context calls rose ~39% (615 → 854).
Both are the cheap axis. The expensive axis got strictly fewer operations. If the device
disagrees, the p95 capture on Daniel's phone is the instrument that will say so.

## Shade, don't dim

The first cut ran `litDisc` at lift 0.55 / sink 0.45 around the midpoint — visually balanced
on paper. It is not: a radial gradient's outer stops cover most of the *area* (weight ∝ r²),
so that pairing rendered every lit object at **83% of the flat fill it replaced**, including
the Point. Shading the thing you are defending must not make it harder to see.

Caught by a magnified before/after screenshot, which is not something CI can do — but the
*rule* is, and now is: the test area-weights the gradient's stops and fails below 95% of the
base colour, with a control arm asserting the old defaults still measure as dimming.

This is the same defect class the repo keeps meeting from a new angle: **a number that looks
symmetric next to a curve that is not.** (Cf. `bossHp` vs `enemyHpMult`, the absolute hp-bar
threshold, and ADR-0008.) Here the curve is r².

## The shine raises the ceiling, never the floor

Caltrops, frost crystals and grid sparks keep their flat, dim treatment. Their dimness was
bought with playtests — "a frost upgrade read as nova got bigger", "extra motion reads as
threat in a game where every moving thing is one" — and those rulings outrank a coat of
polish. Making everything shiny would have quietly repealed three legibility decisions in a
commit whose message said "graphics".

## Alternatives considered

- **`shadowBlur` everywhere.** Fewest lines, best-looking at rest, and it would have walked
  straight into the open perf investigation. Rejected on cost, not on looks.
- **A post-process bloom pass** (draw to an offscreen canvas, blur, composite additively).
  This is how you would do it with a real renderer, and it is *one* blur instead of N. But it
  needs a second full-size canvas, a per-frame composite, and it blooms indiscriminately —
  the dim-by-decree elements would light up with everything else, which is exactly what we
  do not want. Revisit only if halos prove too expensive on device.
- **Per-entity hand-tuning, no shared module.** Rejected: it is how the renderer got flat in
  the first place. Fifteen call sites with fifteen opinions is not a look.

## Consequences

- New entities get the look by calling `tube`/`litDisc`, and get it *consistently*.
- Two laws now have automated cover that they never had: hue-in-the-halo, and blur-is-a-
  frame-constant. Both were previously enforceable only by eye, and by eye they were wrong.
- The `?specimen` plates remain the check for anything about *looks*. A test cannot hold that
  opinion, and this ADR does not pretend otherwise.
