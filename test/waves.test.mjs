import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeWave, rollVariants, pickVariant } from '../src/core/waves.js';
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

// ---- Composition: cost governs the mix, and the mix escalates (core.md
// "Wave composition"; GDD §5 content doctrine). Structural truths only — the
// tilt endpoint and reach are tuning and may move freely. ----

/** Species histogram over many seeded waves: {count, hp} shares. */
function mix(w, trials = 300) {
  const count = {}, hp = {};
  for (const id of ids) { count[id] = 0; hp[id] = 0; }
  for (let t = 0; t < trials; t++) {
    for (const id of composeWave(w, mulberry32(w * 977 + t)).spawns) {
      if (id === 'boss') continue;
      count[id]++; hp[id] += ENEMIES[id].hp; // hpMult is uniform, so it cancels
    }
  }
  const totC = Object.values(count).reduce((a, b) => a + b, 0);
  const totH = Object.values(hp).reduce((a, b) => a + b, 0);
  const share = {};
  for (const id of ids) share[id] = { count: count[id] / totC, hp: hp[id] / totH };
  return share;
}

test('cheap species outnumber expensive ones: chaff exists', () => {
  // the uniform-pick regression this replaces put every species at ~20% of
  // bodies forever, so the wave was 52% elite HP and had no chaff to delegate
  const m = mix(20);
  assert.ok(m.grunt.count > m.elite.count * 2,
    `grunts ${(100 * m.grunt.count).toFixed(0)}% vs elites ${(100 * m.elite.count).toFixed(0)}% — chaff must dominate by body count`);
  const order = ['grunt', 'dart', 'tank', 'splitter', 'elite']; // ascending cost
  for (let i = 1; i < order.length; i++) {
    assert.ok(m[order[i - 1]].count >= m[order[i]].count - 0.02,
      `${order[i - 1]} (cheaper) should not be rarer than ${order[i]}`);
  }
});

test('the mix escalates: the expensive share rises with the wave', () => {
  const early = mix(14), mid = mix(30), deep = mix(60);
  assert.ok(mid.elite.hp > early.elite.hp + 0.02,
    `elite HP share must climb 14→30 (${(100 * early.elite.hp).toFixed(0)}% → ${(100 * mid.elite.hp).toFixed(0)}%)`);
  assert.ok(deep.elite.hp > mid.elite.hp + 0.02,
    `elite HP share must keep climbing past wave 29 (${(100 * mid.elite.hp).toFixed(0)}% → ${(100 * deep.elite.hp).toFixed(0)}%)`);
  assert.ok(deep.grunt.count < early.grunt.count,
    'chaff share must thin as the wave deepens');
  // ...but chaff never disappears: the autos must always have a bottom to eat
  assert.ok(deep.grunt.count > 0.15,
    `grunts fell to ${(100 * deep.grunt.count).toFixed(0)}% of bodies — autos need chaff`);
});

test('composition is frozen nowhere: wave 100 differs from wave 30', () => {
  // the regression: every composition lever was inert past wave 29, so the
  // threat distribution was identical at every wave forever
  const a = mix(30), b = mix(100);
  const drift = ids.filter(i => i !== 'boss')
    .reduce((s, i) => s + Math.abs(a[i].count - b[i].count), 0);
  assert.ok(drift > 0.05, `wave 30 and wave 100 have the same mix (drift ${drift.toFixed(3)})`);
});

test('rollVariants: never before wave 6, valid ids or empty after', () => {
  assert.deepEqual(rollVariants(5, () => 0), []);
  const v = rollVariants(10, () => 0);
  assert.ok(v.length >= 1 && v.every(id => Object.keys(VARIANTS).includes(id)));
  assert.deepEqual(rollVariants(10, () => 0.999), []);
});

test('stacking is the wave-40 regime change: nothing stacks before it', () => {
  // core.md Variants "Stacking" — same threshold as boss recirculation on purpose
  for (const w of [10, 20, 30, 39]) {
    for (let seed = 0; seed < 120; seed++) {
      assert.ok(rollVariants(w, mulberry32(seed)).length <= 1,
        `wave ${w} produced a stack before the regime change`);
    }
  }
});

test('stacking appears past wave 40, escalates, and never exceeds three', () => {
  const stackRate = w => {
    let stacked = 0, withVariant = 0, most = 0;
    for (let seed = 0; seed < 900; seed++) {
      const v = rollVariants(w, mulberry32(seed));
      most = Math.max(most, v.length);
      if (v.length >= 1) withVariant++;
      if (v.length >= 2) stacked++;
    }
    return { frac: stacked / withVariant, most };
  };
  const at45 = stackRate(45), at70 = stackRate(70), at120 = stackRate(120);
  assert.ok(at45.frac > 0, 'nothing stacked at wave 45');
  assert.ok(at70.frac > at45.frac, `stacking must escalate (${at45.frac.toFixed(2)} → ${at70.frac.toFixed(2)})`);
  for (const r of [at45, at70, at120]) {
    assert.ok(r.most <= 3, `stack of ${r.most} exceeds the three-channel cap`);
  }
});

test('a stack never repeats a variant: three channels, three distinct modifiers', () => {
  for (let seed = 0; seed < 600; seed++) {
    const v = rollVariants(80, mulberry32(seed));
    assert.equal(new Set(v).size, v.length, `duplicate modifier in stack ${v.join('+')}`);
    for (const id of v) assert.ok(VARIANTS[id].minWave <= 80, `${id} debuted early`);
  }
});

test('pickVariant: guaranteed pick from the debuted pool (recirculating bosses)', () => {
  assert.equal(pickVariant(1, () => 0), null, 'nothing has debuted at wave 1');
  for (let seed = 0; seed < 40; seed++) {
    const v = pickVariant(40, mulberry32(seed));
    assert.ok(Object.keys(VARIANTS).includes(v), 'wave-40 boss must always get a variant');
  }
});

test('rollVariants respects per-variant debut waves', () => {
  for (let seed = 0; seed < 60; seed++) {
    for (const v of rollVariants(12, mulberry32(seed))) {
      assert.ok(VARIANTS[v].minWave <= 12, `${v} debuted early at wave 12`);
    }
  }
  // deep wave: the full pool is reachable
  const seen = new Set();
  for (let seed = 0; seed < 500; seed++) {
    for (const v of rollVariants(30, mulberry32(seed))) seen.add(v);
  }
  assert.equal(seen.size, Object.keys(VARIANTS).length, 'full pool never surfaced at wave 30');
});

// The boss arrives during the CRUNCH, not the mop-up (core.md "Wave composition",
// ADR-0012). Daniel, 2026-07-25: "I would like to move the boss timing up so it
// spawns during the high-intensity part, not as one of the last enemies."
// Appended last, a boss fought a wave that was already over: a solo duel with the
// field empty, which is the opposite of a focus-forcer.
test('the boss enters mid-wave, with trash still arriving behind it', () => {
  for (const w of [5, 10, 20, 40]) {
    const plan = composeWave(w, mulberry32(7 + w));
    const at = plan.spawns.indexOf('boss');
    assert.ok(at >= 0, `wave ${w} has no boss`);
    const frac = at / plan.spawns.length;
    assert.ok(frac > 0.15 && frac < 0.6,
      `wave ${w}: boss enters at ${(frac * 100).toFixed(0)}% of the queue — ` +
      'it must land in the busy middle, not at either end');
    assert.ok(plan.spawns.length - at > 3,
      `wave ${w}: only ${plan.spawns.length - at - 1} shapes arrive after the boss — ` +
      'nothing is competing for attention');
  }
});

test('exactly one boss, and only on boss waves', () => {
  assert.equal(composeWave(20, mulberry32(3)).spawns.filter(s => s === 'boss').length, 1);
  assert.equal(composeWave(21, mulberry32(3)).spawns.filter(s => s === 'boss').length, 0);
});

test('the debut index still points at a non-boss spawn once the boss moved inward', () => {
  // The debut marker is an index into `spawns`. With the boss appended last, any
  // index was safely non-boss; inserting it mid-list makes that an assumption.
  for (let w = 1; w <= 45; w++) {
    const plan = composeWave(w, mulberry32(w * 31));
    if (plan.debutAt === null) continue;
    assert.notEqual(plan.spawns[plan.debutAt], 'boss',
      `wave ${w}: the guaranteed debut landed on the boss, so no shape carries it`);
  }
});
