// Introduction pacing (core.md Introductions). GDD §9 wants content drip-fed —
// roughly one new thing every 2–3 waves — and specifically NOT bunched onto the
// waves where fresh runs end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES, VARIANTS } from '../src/core/config.js';

/** Every wave that introduces something: a new shape, a new modifier, or the boss. */
function beatWaves() {
  const w = new Set([5]); // the first boss, and every 5th after
  for (const [id, e] of Object.entries(ENEMIES)) if (id !== 'boss') w.add(e.minWave);
  for (const v of Object.values(VARIANTS)) w.add(v.minWave);
  return [...w].sort((a, b) => a - b);
}

test('never three new things in three consecutive waves', () => {
  // tank(4) + boss(5) + swift(6) used to be exactly this, on the waves where ~45%
  // of fresh runs die — and guaranteeing debuts made it certain rather than a coin
  // flip. Swift moved to 7.
  const waves = beatWaves();
  for (let i = 0; i + 2 < waves.length; i++) {
    const run = waves[i + 2] - waves[i] === 2 && waves[i + 1] - waves[i] === 1;
    assert.ok(!run, `waves ${waves[i]}, ${waves[i + 1]}, ${waves[i + 2]} are three beats in a row`);
  }
});

test('variant debuts dodge boss waves so two banners never collide', () => {
  for (const [id, v] of Object.entries(VARIANTS)) {
    assert.notEqual(v.minWave % 5, 0, `${id} debuts on a boss wave (${v.minWave})`);
  }
});

test('the drip keeps arriving, and no gap yawns wider than the last', () => {
  const waves = beatWaves().filter(w => w <= 23);
  const gaps = waves.slice(1).map((w, i) => w - waves[i]);
  assert.ok(Math.max(...gaps) <= 4, `a ${Math.max(...gaps)}-wave silence in the teaching stretch`);
  assert.ok(waves.length >= 9, 'the early game should teach at least nine distinct things');
});
