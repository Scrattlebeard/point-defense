// The frame-time instrument (core/perf.md). The statistics are the whole product
// here, so they are pinned directly: a perf HUD that reports a comfortable mean
// while the player watches judder is worse than no HUD, because it actively
// argues against the person holding the phone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makePerf, samplePerf, perfStats, perfRows,
  FRAME_BUDGET_MS, KEEP_SAMPLES, KEEP_WAVES, MIN_SAMPLES,
} from '../src/core/perf.js';

const feed = (p, wave, times, ents = 10, parts = 20) => {
  for (const ms of times) samplePerf(p, ms, { wave, ents, parts });
};

test('the budget is one frame at 60fps, and nothing else pretends to be a target', () => {
  assert.ok(Math.abs(FRAME_BUDGET_MS - 16.666) < 0.01);
});

test('p95 catches judder that the mean hides — the reason p95 is the headline', () => {
  // 90 good frames, 10 terrible ones: a mean of ~9ms says "fine", and the player
  // is watching the game hitch six times a second.
  const ms = [...Array(90).fill(6), ...Array(10).fill(40)];
  const s = perfStats(ms);
  const mean = ms.reduce((a, b) => a + b, 0) / ms.length;
  assert.ok(mean < FRAME_BUDGET_MS, `setup: the mean must look innocent (${mean.toFixed(1)}ms)`);
  assert.ok(s.p95 > FRAME_BUDGET_MS, `p95 ${s.p95} must expose what the mean hid`);
  assert.equal(s.p50, 6);
  assert.equal(s.worst, 40);
});

test('`over` is the fraction of frames the player did not get', () => {
  const s = perfStats([...Array(75).fill(5), ...Array(25).fill(30)]);
  assert.ok(Math.abs(s.over - 0.25) < 0.001, `expected 0.25, got ${s.over}`);
});

test('a single hitch and a sustained overrun are distinguishable', () => {
  const hitch = perfStats([...Array(99).fill(5), 300]);
  const sustained = perfStats(Array(100).fill(22));
  assert.ok(hitch.p95 < FRAME_BUDGET_MS, 'one hitch must not read as sustained slowness');
  assert.ok(hitch.worst > 100, 'but it must still be visible');
  assert.ok(sustained.p95 > FRAME_BUDGET_MS && sustained.worst < 100,
    'sustained slowness reads in the percentile, not the worst');
});

test('samples bucket by wave, and the live wave is always the last row', () => {
  const p = makePerf();
  feed(p, 5, Array(MIN_SAMPLES + 5).fill(8));
  feed(p, 6, Array(MIN_SAMPLES + 5).fill(12));
  feed(p, 7, Array(MIN_SAMPLES + 5).fill(20));
  const rows = perfRows(p);
  assert.deepEqual(rows.map(r => r.wave), [5, 6, 7]);
  assert.equal(rows.at(-1).wave, 7, 'the in-progress wave must be visible while it is happening');
  assert.ok(rows[2].p50 > rows[0].p50, 'the table must be able to show a cost curve');
});

test('a bucket with too few frames is not reported — two frames is not a measurement', () => {
  const p = makePerf();
  feed(p, 5, Array(MIN_SAMPLES + 5).fill(8));
  feed(p, 6, [9, 9]); // a wave that ended instantly
  assert.deepEqual(perfRows(p).map(r => r.wave), [5]);
});

// The instrument must not become the problem it exists to detect.
test('memory is bounded: neither samples nor waves grow with session length', () => {
  const p = makePerf();
  for (let w = 1; w <= KEEP_WAVES * 3; w++) feed(p, w, Array(KEEP_SAMPLES * 3).fill(7));
  assert.ok(perfRows(p).length <= KEEP_WAVES, 'wave buckets grew without bound');
  for (const b of [...p.waves, p.cur]) {
    if (b) assert.ok(b.ms.length <= KEEP_SAMPLES, `bucket kept ${b.ms.length} samples`);
  }
});

test('a bounded ring keeps the RECENT frames, not the first ones it happened to see', () => {
  // If the ring dropped new samples instead of old ones, the HUD would freeze on
  // whatever the first ten seconds of a wave looked like and never show a decline.
  const p = makePerf();
  feed(p, 9, Array(KEEP_SAMPLES).fill(5));
  feed(p, 9, Array(KEEP_SAMPLES).fill(25));
  const row = perfRows(p).at(-1);
  assert.equal(row.p50, 25, 'the ring reported stale frames over current ones');
});

test('entity and particle counts are means over the bucket, so a row explains itself', () => {
  const p = makePerf();
  for (let i = 0; i < MIN_SAMPLES + 5; i++) samplePerf(p, 8, { wave: 3, ents: i, parts: 2 * i });
  const row = perfRows(p).at(-1);
  const n = MIN_SAMPLES + 5;
  assert.ok(Math.abs(row.ents - (n - 1) / 2) < 0.5, `ents mean was ${row.ents}`);
  assert.ok(Math.abs(row.parts - (n - 1)) < 1, `parts mean was ${row.parts}`);
});

test('perfStats on nothing returns zeroes rather than NaN', () => {
  // The HUD draws on frame one, before any wave has enough samples.
  const s = perfStats([]);
  for (const k of ['p50', 'p95', 'worst', 'over']) {
    assert.equal(s[k], 0, `${k} was ${s[k]} — a NaN here paints "NaN" across the screen`);
  }
});

// ---- the JS-cost gate (scripts/perf.mjs) ----
import { scorePerf, JS_BUDGET_SHARE } from '../scripts/perf.mjs';

const row = (wave, ms, ents = 10) => ({ wave, sim: ms / 2, render: ms / 2, ents, calls: 500, frames: 100 });

test('the gate scores the WORST wave, not the average one', () => {
  // averaging would let a single unplayable wave hide behind twenty good ones,
  // which is the same tail-vs-mean mistake p95 exists to avoid
  const s = scorePerf([row(10, 0.1), row(11, 0.1), row(12, 8)]);
  assert.equal(s.worst.wave, 12);
  assert.ok(Math.abs(s.worst.total - 8) < 1e-9);
});

test('the gate is a share of a frame, never a millisecond count', () => {
  // absolute times depend on the machine running CI; a fixed ms threshold is an
  // absolute bar beside a moving target — this repo's most repeated defect
  const s = scorePerf([row(5, FRAME_BUDGET_MS / 2)]);
  assert.ok(Math.abs(s.share - 0.5) < 1e-9, `share was ${s.share}`);
  assert.equal(s.ok, JS_BUDGET_SHARE >= 0.5);
});

test('wave 0 is warm-up and must not define the worst case', () => {
  // measured: 0.082ms at ZERO entities, three times wave 22's cost with 38 of them
  const s = scorePerf([row(0, 99), row(7, 0.2)]);
  assert.equal(s.worst.wave, 7, 'JIT warm-up on an empty field became the gate');
});

test('the gate trips when JS actually gets expensive', () => {
  // a net that has never failed is theatre: this is the failing direction, pinned
  assert.equal(scorePerf([row(9, FRAME_BUDGET_MS * 0.9)]).ok, false);
  assert.equal(scorePerf([row(9, FRAME_BUDGET_MS * 0.01)]).ok, true);
});
