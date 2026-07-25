// Haptics (core.md "Haptics", GDD §8). A buzz means "this happened to you" —
// the channel only carries meaning while it stays scarce, which is Law·Legibility
// applied to touch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HAPTICS, HAPTIC_MIN_GAP, HAPTIC_MAX_MS } from '../src/core/config.js';
import { defaultMeta } from '../src/core/state.js';

const total = p => (Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p);

test('every pattern is well-formed and bounded — no punishing buzz', () => {
  for (const [id, p] of Object.entries(HAPTICS)) {
    const parts = Array.isArray(p) ? p : [p];
    assert.ok(parts.length > 0, `${id}: empty pattern`);
    for (const n of parts) {
      assert.equal(typeof n, 'number', `${id}: non-numeric segment`);
      assert.ok(n >= 0 && Number.isFinite(n), `${id}: bad segment ${n}`);
    }
    assert.ok(total(p) <= HAPTIC_MAX_MS,
      `${id}: ${total(p)}ms exceeds the ${HAPTIC_MAX_MS}ms ceiling`);
  }
});

test('the channel stays scarce: high-frequency events never buzz', () => {
  // shoot fires from five call sites and death fires on every kill. A phone that
  // buzzes for those is unusable, and if everything buzzes nothing does.
  for (const id of ['shoot', 'death', 'zap', 'seek', 'nova', 'wave', 'boom', 'shield']) {
    assert.equal(HAPTICS[id], undefined, `${id} must not carry haptics — it is not rare`);
  }
  assert.ok(Object.keys(HAPTICS).length <= 4,
    `${Object.keys(HAPTICS).length} haptic events — the channel is losing its scarcity`);
});

test('the events that DO buzz are the ones that happen TO the player', () => {
  assert.ok(HAPTICS.hurt, 'taking damage is the whole point of the channel');
  assert.ok(HAPTICS.boss, 'a boss arrives off-screen more often than not');
  assert.ok(HAPTICS.gameover, 'the run ending should be felt');
});

test('the rate limit is long enough to blunt a pile-up, short enough to feel live', () => {
  // a surrounded tower takes a strike every 0.9s PER besieger; without a limit a
  // pile-up machine-guns the motor
  assert.ok(HAPTIC_MIN_GAP >= 60 && HAPTIC_MIN_GAP <= 250,
    `${HAPTIC_MIN_GAP}ms gap is outside the useful range`);
  assert.ok(HAPTIC_MIN_GAP > total(HAPTICS.hurt),
    'the gap must exceed the chip buzz, or chips can overlap themselves');
});

test('haptics are their own setting, defaulting on', () => {
  // silent-with-haptics is a real way to play a phone game in company
  const m = defaultMeta();
  assert.equal(m.haptics, true);
  assert.equal(typeof m.sound, 'boolean', 'and they stay independent of sound');
});
