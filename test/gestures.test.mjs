import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newTrace, addPoint, shouldEngageHold, classifyRelease } from '../src/core/gestures.js';

// The two regimes (core.md Gestures). STRICT = the run also owns a swipe weapon,
// so a stroke must be protected and stillness is required. SOLO = hold weapon only,
// nothing to disambiguate against.
const STRICT = { ownsHold: true, ownsSwipe: true };
const SOLO = { ownsHold: true, ownsSwipe: false };

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

test('STRICT: hold engages after 0.28s of stillness, owning a hold weapon', () => {
  const t = newTrace(200, 200, 1.0);
  addPoint(t, 205, 203, 1.2); // within slop — still counts as still
  assert.equal(shouldEngageHold(t, 1.2, STRICT), false, 'too early');
  assert.equal(shouldEngageHold(t, 1.4, STRICT), true, 'engages');
  assert.equal(shouldEngageHold(t, 1.4, { ownsHold: false, ownsSwipe: true }), false, 'no hold weapon owned');
});

// 2026-07-24 second-playtester bug: pressing while the finger is in motion must
// not disqualify the hold — stillness is judged recently, not since the press.
test('STRICT: a press that starts in motion engages 0.28s after the finger settles', () => {
  const t = newTrace(200, 200, 1.0);
  addPoint(t, 240, 210, 1.1); // moving at press time (aim-tracking)
  addPoint(t, 270, 215, 1.2); // still moving
  assert.equal(shouldEngageHold(t, 1.4, STRICT), false, 'not still long enough yet');
  assert.equal(shouldEngageHold(t, 1.49, STRICT), true, 'settled at 1.2 → engages at 1.48');
});

test('STRICT: continuous motion never engages a hold — the swipe must survive', () => {
  const t = newTrace(0, 0, 0);
  for (let i = 1; i <= 20; i++) {
    addPoint(t, i * 20, 0, i * 0.1);
    assert.equal(shouldEngageHold(t, i * 0.1, STRICT), false, `still moving at t=${i * 0.1}`);
  }
});

test('an engaged hold stays a hold on release even after movement (aiming)', () => {
  const t = newTrace(200, 200, 0);
  t.holdEngaged = true;
  addPoint(t, 320, 260, 0.9); // aiming the beam
  assert.equal(classifyRelease(t).type, 'hold');
});

// 2026-07-25, Daniel's first playtest: "noticeable delay before lance starts after
// I start holding." Tracking a moving shape with the beam looks exactly like
// wandering, so the stillness anchor reset every frame and the channel never began.
test('SOLO: a press engages at 0.15s even while the finger keeps moving', () => {
  const t = newTrace(0, 0, 0);
  addPoint(t, 40, 0, 0.05);   // tracking a shape across the field
  addPoint(t, 80, 0, 0.10);   // still tracking — never "still" for a moment
  addPoint(t, 130, 0, 0.16);
  assert.equal(shouldEngageHold(t, 0.14, SOLO), false, 'not yet — a tap must stay a tap');
  assert.equal(shouldEngageHold(t, 0.16, SOLO), true, 'engages despite continuous motion');
});

test('SOLO: a brisk tap still aims rather than channeling', () => {
  const t = newTrace(100, 100, 0);
  addPoint(t, 104, 101, 0.09);
  assert.equal(shouldEngageHold(t, 0.12, SOLO), false, 'a 120ms tap must not become a hold');
  assert.equal(classifyRelease(t).type, 'tap');
});

test('the fast path is unreachable when a swipe could be stolen', () => {
  // The whole safety argument for SOLO in one assertion: same trace, same instant,
  // and owning a swipe weapon is what withholds the engage.
  const t = newTrace(0, 0, 0);
  addPoint(t, 60, 0, 0.10);
  assert.equal(shouldEngageHold(t, 0.16, SOLO), true);
  assert.equal(shouldEngageHold(t, 0.16, STRICT), false);
});

test('no hold weapon owned means no hold, in either regime', () => {
  const t = newTrace(200, 200, 0);
  addPoint(t, 201, 201, 0.1);
  for (const r of [{ ownsHold: false, ownsSwipe: false }, { ownsHold: false, ownsSwipe: true }]) {
    assert.equal(shouldEngageHold(t, 5, r), false);
  }
});
