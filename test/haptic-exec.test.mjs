// The haptic executor (app/audio.js). Two things matter and neither is obvious:
// it must no-op on DESKTOP — where navigator.vibrate simply does not exist, which
// is the majority path, not an edge case — and it must rate-limit, or a besieger
// pile-up machine-guns the motor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haptic, setHaptics } from '../src/app/audio.js';
import { HAPTICS, HAPTIC_MIN_GAP } from '../src/core/config.js';

/** Install a fake navigator that records vibrate() calls. Returns the log. */
function stubVibrate() {
  const calls = [];
  globalThis.navigator = { vibrate: p => { calls.push(p); return true; } };
  return calls;
}
const clearNavigator = () => { delete globalThis.navigator; };

test('no navigator at all: silent, and above all no throw', () => {
  clearNavigator();
  setHaptics(true);
  assert.doesNotThrow(() => haptic('hurt'), 'desktop play must not crash on a buzz');
});

test('a navigator without vibrate (desktop browsers) is equally safe', () => {
  globalThis.navigator = {};
  setHaptics(true);
  assert.doesNotThrow(() => haptic('hurt'));
  clearNavigator();
});

test('a known event vibrates with its declared pattern', () => {
  const calls = stubVibrate();
  setHaptics(true);
  haptic('boss', 0);
  assert.deepEqual(calls, [HAPTICS.boss]);
  clearNavigator();
});

test('an unknown event is ignored rather than guessed at', () => {
  const calls = stubVibrate();
  setHaptics(true);
  haptic('shoot', 0);          // deliberately has no pattern (core.md: scarce channel)
  haptic('not-an-event', 0);
  assert.deepEqual(calls, []);
  clearNavigator();
});

test('the setting is respected', () => {
  const calls = stubVibrate();
  setHaptics(false);
  haptic('hurt', 0);
  assert.deepEqual(calls, [], 'haptics off must mean off');
  setHaptics(true);
  haptic('hurt', 1000);
  assert.equal(calls.length, 1);
  clearNavigator();
});

test('rate limit: a pile-up rumbles instead of machine-gunning', () => {
  const calls = stubVibrate();
  setHaptics(true);
  haptic('hurt', 10_000);                        // first strike lands
  haptic('hurt', 10_000 + HAPTIC_MIN_GAP - 5);   // second, too soon
  haptic('hurt', 10_000 + HAPTIC_MIN_GAP - 1);   // third, still too soon
  assert.equal(calls.length, 1, 'suppressed buzzes should collapse into one');
  haptic('hurt', 10_000 + HAPTIC_MIN_GAP + 1);   // now allowed
  assert.equal(calls.length, 2);
  clearNavigator();
});
