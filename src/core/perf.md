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

## What it records

Samples are bucketed **per wave**, because the complaint is shaped like a wave number and a
per-wave table is the artifact a playtester can screenshot and send back. Each bucket keeps:

| field | meaning |
|-------|---------|
| `wave` | the wave these frames were drawn during |
| `ms` | bounded ring of recent frame times (`KEEP_SAMPLES`, ~10s at 60fps) |
| `ents` / `parts` | mean live enemies and fx particles over the bucket — the two counts most likely to explain a cost curve |
| `n` | frames sampled (a bucket with too few is not reported: `MIN_SAMPLES`) |

`perfStats(ms)` returns `{ p50, p95, worst, over }`, where `over` is the **fraction of frames
past budget** — the closest single number to "does this feel bad".

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
perfStats(msArray)               -> { p50, p95, worst, over }
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
