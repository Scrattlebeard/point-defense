# `perf.js` — the frame-time instrument

Pure sampling and statistics for frame timing. **This module holds no opinion about
drawing**; `src/app/perfhud.js` renders what it reports, and `main.js` feeds it. Pillar 5:
the decision of *what counts as a bad frame* is core, the measuring and drawing are shell.

## Why this exists

Every gate in this project measures whether the game is **correct**. None measured whether
it is **playable**. On 2026-07-25 Daniel reported the game "noticeably starts
struggling/slowing down at wave 17" on a phone, and the repo had — with 219 tests, two
balance gates, a render crash-net, a calibrator and a conductor — **no way to observe a
single frame.** Both are laws; only one had an instrument.

## The one number

`FRAME_BUDGET_MS = 1000 / 60 ≈ 16.67`. A frame that takes longer than the budget is a frame
the player did not get. Everything here is expressed against that.

The headline statistic is **p95, not the mean.** A mean hides exactly the thing being
complained about: a run that renders 90% of frames in 6ms and 10% in 40ms *feels* broken and
*averages* fine. Judder is a tail property, so the tail is what gets reported. `worst` is
kept beside it because a single 300ms hitch is a different bug from a sustained 20ms.

## Vsync quantizes everything, and the first version of this got it wrong

**On a real device, frame times are not a continuous quantity.** The first phone capture
(2026-07-25, waves 17→45) returned p50 = **16.7** at every single wave and p95 of exactly
**16.8 / 33.4 / 50.0** — one, two and three refresh intervals on a 60Hz panel. The compositor
hands out whole frames; you never observe "we used 21ms", only which multiple you landed on.

Two consequences, both learned by shipping the wrong thing:

- **`over` cannot be "longer than the budget".** A perfectly vsynced 60fps frame measures
  ~16.7ms against a 16.666ms budget, so the original definition counted float noise and
  reported **72–94% of frames over budget for a game holding a solid 60fps** — the whole
  table red while the phone was hitting its target. An instrument that argues with the person
  holding the device is worse than no instrument. `dropped` now means **longer than 1.5× the
  median frame**, which is refresh-rate agnostic: it catches 33.4 against a 16.7 median and
  16.7 against an 8.3 one, with no assumption about the panel.
- **The gap alone cannot diagnose.** Once vsync-locked, "we spent 3ms and waited" and "we
  spent 16ms and just made it" are *the same reading*. So the HUD reports **`work`** beside
  it — the wall time our `updateGame + renderFrame` actually consumed inside the frame. The
  gap says *whether* we dropped; work says *how much headroom is left*. Neither is
  sufficient alone, which is why the first design (gap only, justified at length) was half an
  instrument.

## The peak window, not the wave average

**A wave is not one workload.** Daniel, second capture: *"p50 would often go to 33, then drop
back down to 16.7 at the end of the level when the active enemies had been thinned out."*
A wave ramps — spawns arrive, the field fills, the player clears it — so a whole-wave
aggregate averages the crunch together with the mop-up and reports neither.

Worse, it smears **both axes at once**: the timing *and* the entity count beside it. The
first phone capture appeared to show the wave-20 step happening at the *fewest* entities on
the table, which read as strong evidence that cost was not entity-driven. That comparison is
invalid — wave 19's "18 entities" and wave 20's "10" are wave-long means, and neither
describes the moment the frames actually dropped. **A conclusion drawn from two aggregates
whose peaks are invisible is not a conclusion.**

So each wave reports its **worst `WINDOW` window** (~2s), re-evaluated every `WINDOW_STRIDE`
frames, and the entity count reported beside it is the mean **inside that same window** —
co-timed, so the row is internally consistent and the cost/count question can actually be
asked. Whole-wave figures are still computed and available; the table shows the peak, because
the peak is what the player feels and the average is what hides it.

## What it records

Samples are bucketed **per wave**, because the complaint is shaped like a wave number and a
per-wave table is the artifact a playtester can screenshot and send back. Each bucket keeps:

| field | meaning |
|-------|---------|
| `wave` | the wave these frames were drawn during |
| `ms` | bounded ring of recent frame times — the rAF *gap* (`KEEP_SAMPLES`, ~10s at 60fps) |
| `work` | bounded ring of the wall time our own update+render consumed inside those frames |
| `ents` / `parts` | mean live enemies and fx particles over the bucket — the two counts most likely to explain a cost curve |
| `n` | frames sampled (a bucket with too few is not reported: `MIN_SAMPLES`) |

`perfStats(ms)` returns `{ p50, p95, worst, dropped }`, where `dropped` is the **fraction of
frames longer than 1.5× the median** — the closest single number to "does this feel bad", and
the only one that survives vsync quantization.

## Bounded by construction

Two caps, both load-bearing rather than defensive:

- **`KEEP_SAMPLES` per bucket.** Unbounded sample arrays would make the instrument's own cost
  grow with session length, which is the one thing a performance instrument must never do.
- **`KEEP_WAVES` buckets.** A long run must not turn the HUD into a scrolling log.

**The instrument must be cheaper than the thing it measures.** Percentiles sort, so
`perfStats` is called on demand by the HUD (throttled there), never per sample. Sampling
itself is an array write and four adds.

## Seam

```js
makePerf()                       -> state
samplePerf(state, ms, {wave, ents, parts})
perfStats(msArray)               -> { p50, p95, worst, dropped }
perfRows(state)                  -> [{ wave, p50, p95, worst, over, ents, parts, n }, …]
FRAME_BUDGET_MS, KEEP_SAMPLES, KEEP_WAVES, MIN_SAMPLES
```

`perfRows` includes the in-progress wave last, so the HUD always has a live row.

## What this cannot tell you

**It measures wall-clock frames on whatever device is running them, and nothing else.**
Specifically it does not attribute cost. A JS-side harness (`scripts/perf.mjs`) separates
sim from render *in node with a stub canvas*, which bounds our JavaScript cost but is blind
to rasterisation — and rasterisation is where a canvas game on a phone usually spends its
time. Measured 2026-07-25, our JS at realistic wave-29 entity counts is **0.02–0.04 ms/frame,
about 0.2% of budget**, so a device that struggles is not struggling on our loops. Numbers
that matter therefore come from a real browser, and the numbers that matter *most* come from
Daniel's actual phone, which nothing in this repo can simulate.
