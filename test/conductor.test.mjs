// The conductor gate's scoring rule (ADR-0010; README "Delegation tooling";
// GDD §3 Law·Delegation). The 40-minute sims stay gate-only — what is testable
// at inner-loop speed is the RULE: what the gate reads, and what it ignores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreConductor, BAND } from '../scripts/conductor.mjs';

const CAP = 2400;
// A pair as runOnce reports it. Times are the signal; waves are decoration.
const pair = (pt, rt, { pw = 30, rw = 40, pDied = true, rDied = true } = {}) => ({
  parked: { wave: pw, died: pDied, time: pt },
  robot: { wave: rw, died: rDied, time: rt },
});

// A set that comfortably holds: hands buy ~19% more time, parked always dies.
const holding = () => Array.from({ length: 11 }, (_, i) => pair(1500 + i * 10, 1790 + i * 12));

test('the band never sanctions hands being worthless', () => {
  // A ratio band at or below 1.0 would let "hands change nothing" pass as lawful.
  assert.ok(BAND.ratio > 1, 'survival ratio band must demand hands buy something');
  assert.ok(BAND.parkedDeaths >= 1, 'the do-nothing run must be required to die');
});

test('the gate reads survival, not wave pace', () => {
  // Same clock, wildly different wave columns. The verdict must not move —
  // this is the whole of ADR-0010's Problem 1.
  const times = holding();
  const slowClock = times.map(p => pair(p.parked.time, p.robot.time, { pw: 30, rw: 31 }));
  const fastClock = times.map(p => pair(p.parked.time, p.robot.time, { pw: 30, rw: 55 }));
  assert.equal(scoreConductor(slowClock).ratio, scoreConductor(fastClock).ratio);
  assert.equal(scoreConductor(slowClock).ok, scoreConductor(fastClock).ok);
  assert.ok(scoreConductor(slowClock).ok);
});

test('a wall that slows the clock does not read as weakness', () => {
  // The measured Force Wall case: robot reaches a LOWER wave than parked while
  // surviving markedly longer. Wave-delta called this harmful; survival must not.
  const walled = Array.from({ length: 11 }, () => pair(1500, 1950, { pw: 25, rw: 13 }));
  const scored = scoreConductor(walled);
  assert.ok(scored.waveDelta < 0, 'the wave column really does go backwards here');
  assert.ok(scored.ok, 'buying 30% more life is the law working, not breaking');
});

test('hands that buy no time break the gate', () => {
  const inert = Array.from({ length: 11 }, (_, i) => pair(1500 + i * 10, 1500 + i * 10));
  const scored = scoreConductor(inert);
  assert.equal(scored.ratio, 1);
  assert.equal(scored.handsOk, false);
  assert.equal(scored.ok, false);
});

test('a robot alive at the cap is scored at the cap, never extrapolated', () => {
  // ADR-0010 Decision 3: censoring understates hands, which is the safe direction
  // for a floor — it can produce a false BROKEN, never a false HOLDS.
  const censored = [pair(1200, CAP, { rDied: false })];
  assert.equal(scoreConductor(censored).ratio, CAP / 1200);
});

test('a parked run that survives the cap trips the gate on both clauses', () => {
  // A do-nothing build that lives 40 minutes IS the law broken.
  const unkillable = Array.from({ length: 11 }, () => pair(CAP, CAP, { pDied: false, rDied: false }));
  const scored = scoreConductor(unkillable);
  assert.equal(scored.handsOk, false, 'ratio <= 1 when the parked run cannot be beaten');
  assert.equal(scored.dieOk, false, 'and the death clause says so independently');
});

test('the death clause is independent of the ratio', () => {
  // Hands look excellent, but the do-nothing run never dies: still BROKEN.
  const surviving = Array.from({ length: 11 }, () => pair(CAP, CAP, { pDied: false, rDied: false }));
  // Force a healthy ratio while keeping parked alive, to isolate the clause.
  const rigged = surviving.map(p => ({ ...p, robot: { ...p.robot, time: p.parked.time * 1.5 } }));
  const scored = scoreConductor(rigged);
  assert.equal(scored.handsOk, true);
  assert.equal(scored.dieOk, false);
  assert.equal(scored.ok, false, 'both clauses are required');
});

test('the medians are medians, not means', () => {
  // One freak pair must not carry the set — the gate is a median for noise control.
  const withOutlier = [...Array.from({ length: 10 }, () => pair(1500, 1500)), pair(1500, 15000)];
  assert.equal(scoreConductor(withOutlier).ratio, 1, 'the outlier cannot rescue an inert set');
});
