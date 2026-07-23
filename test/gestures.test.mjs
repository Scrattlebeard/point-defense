import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newTrace, addPoint, shouldEngageHold, classifyRelease } from '../src/core/gestures.js';

test('a quick small-movement release is a tap at the release point', () => {
  const t = newTrace(100, 100, 0);
  addPoint(t, 103, 101, 0.09);
  const g = classifyRelease(t);
  assert.equal(g.type, 'tap');
  assert.equal(g.x, 103);
  assert.equal(g.y, 101);
});

test('a long path is a swipe with first→last segment payload', () => {
  const t = newTrace(100, 100, 0);
  addPoint(t, 150, 100, 0.08);
  addPoint(t, 210, 105, 0.16);
  const g = classifyRelease(t);
  assert.equal(g.type, 'swipe');
  assert.deepEqual([g.from.x, g.from.y], [100, 100]);
  assert.deepEqual([g.to.x, g.to.y], [210, 105]);
});

test('sub-30px wiggle stays a tap', () => {
  const t = newTrace(50, 50, 0);
  addPoint(t, 60, 50, 0.1);
  addPoint(t, 52, 55, 0.2);
  assert.equal(classifyRelease(t).type, 'tap');
});

test('hold engages after 0.28s of stillness, owning a hold weapon', () => {
  const t = newTrace(200, 200, 1.0);
  addPoint(t, 205, 203, 1.2); // within slop — still counts as still
  assert.equal(shouldEngageHold(t, 1.2, true), false, 'too early');
  assert.equal(shouldEngageHold(t, 1.4, true), true, 'engages');
  assert.equal(shouldEngageHold(t, 1.4, false), false, 'no hold weapon owned');
});

// 2026-07-24 second-playtester bug: pressing while the finger is in motion must
// not disqualify the hold — stillness is judged recently, not since the press.
test('a press that starts in motion engages 0.28s after the finger settles', () => {
  const t = newTrace(200, 200, 1.0);
  addPoint(t, 240, 210, 1.1); // moving at press time (aim-tracking)
  addPoint(t, 270, 215, 1.2); // still moving
  assert.equal(shouldEngageHold(t, 1.4, true), false, 'not still long enough yet');
  assert.equal(shouldEngageHold(t, 1.49, true), true, 'settled at 1.2 → engages at 1.48');
});

test('continuous motion never engages a hold', () => {
  const t = newTrace(0, 0, 0);
  for (let i = 1; i <= 20; i++) {
    addPoint(t, i * 20, 0, i * 0.1);
    assert.equal(shouldEngageHold(t, i * 0.1, true), false, `still moving at t=${i * 0.1}`);
  }
});

test('an engaged hold stays a hold on release even after movement (aiming)', () => {
  const t = newTrace(200, 200, 0);
  t.holdEngaged = true;
  addPoint(t, 320, 260, 0.9); // aiming the beam
  assert.equal(classifyRelease(t).type, 'hold');
});
