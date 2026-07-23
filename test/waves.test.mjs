import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeWave, rollVariant } from '../src/core/waves.js';
import { ENEMIES, VARIANTS } from '../src/core/config.js';
import { waveBudget } from '../src/core/balance.js';
import { mulberry32 } from '../src/core/rng.js';

const ids = Object.keys(ENEMIES);
const maxCost = Math.max(...ids.filter(i => i !== 'boss').map(i => ENEMIES[i].cost));

test('composeWave emits only valid enemy ids', () => {
  for (const w of [1, 2, 5, 9, 15, 30]) {
    const plan = composeWave(w, mulberry32(w));
    for (const id of plan.spawns) assert.ok(ids.includes(id), `${id} @ wave ${w}`);
  }
});

test('composeWave respects minWave gates', () => {
  const plan1 = composeWave(1, mulberry32(7));
  assert.ok(plan1.spawns.every(id => id === 'grunt'));
  const plan2 = composeWave(2, mulberry32(7));
  assert.ok(plan2.spawns.every(id => ['grunt', 'dart'].includes(id)));
});

test('boss appears exactly on every 5th wave, once', () => {
  for (const w of [1, 2, 3, 4, 6, 7, 12, 23]) {
    assert.equal(composeWave(w, mulberry32(w)).spawns.filter(i => i === 'boss').length, 0, `wave ${w}`);
  }
  for (const w of [5, 10, 25]) {
    assert.equal(composeWave(w, mulberry32(w)).spawns.filter(i => i === 'boss').length, 1, `wave ${w}`);
  }
});

test('composeWave spends the whole budget without wild overshoot', () => {
  for (const w of [1, 4, 8, 16, 28]) {
    const plan = composeWave(w, mulberry32(w * 13));
    const cost = plan.spawns.filter(i => i !== 'boss')
      .reduce((s, i) => s + ENEMIES[i].cost, 0);
    const budget = waveBudget(w);
    assert.ok(cost >= budget, `wave ${w}: cost ${cost} < budget ${budget}`);
    assert.ok(cost < budget + maxCost, `wave ${w}: cost ${cost} overshoots`);
  }
});

test('composeWave is deterministic under a seeded rng', () => {
  const a = composeWave(9, mulberry32(42));
  const b = composeWave(9, mulberry32(42));
  assert.deepEqual(a, b);
});

test('rollVariant: never before wave 6, valid id or null after', () => {
  assert.equal(rollVariant(5, () => 0), null);
  const v = rollVariant(10, () => 0);
  assert.ok(Object.keys(VARIANTS).includes(v));
  assert.equal(rollVariant(10, () => 0.999), null);
});

test('rollVariant respects per-variant debut waves', () => {
  for (let seed = 0; seed < 60; seed++) {
    const v = rollVariant(12, mulberry32(seed));
    if (v) assert.ok(VARIANTS[v].minWave <= 12, `${v} debuted early at wave 12`);
  }
  // deep wave: the full pool is reachable
  const seen = new Set();
  for (let seed = 0; seed < 500; seed++) {
    const v = rollVariant(30, mulberry32(seed));
    if (v) seen.add(v);
  }
  assert.equal(seen.size, Object.keys(VARIANTS).length, 'full pool never surfaced at wave 30');
});
