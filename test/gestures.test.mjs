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

test('hold engages only after 0.28s, under 14px displacement, owning a hold weapon', () => {
  const t = newTrace(200, 200, 1.0);
  addPoint(t, 205, 203, 1.2);
  assert.equal(shouldEngageHold(t, 1.2, true), false, 'too early');
  assert.equal(shouldEngageHold(t, 1.4, true), true, 'engages');
  assert.equal(shouldEngageHold(t, 1.4, false), false, 'no hold weapon owned');
  const moved = newTrace(200, 200, 1.0);
  addPoint(moved, 230, 200, 1.1);
  assert.equal(shouldEngageHold(moved, 1.5, true), false, 'moved too far');
});

test('an engaged hold stays a hold on release even after movement (aiming)', () => {
  const t = newTrace(200, 200, 0);
  t.holdEngaged = true;
  addPoint(t, 320, 260, 0.9); // aiming the beam
  assert.equal(classifyRelease(t).type, 'hold');
});
