import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../src/core/balance.js';
import { ENEMIES, VARIANTS } from '../src/core/config.js';

test('enemyHpMult is 1 at wave 1 and strictly increasing', () => {
  assert.equal(B.enemyHpMult(1), 1);
  for (let w = 1; w < 50; w++) {
    assert.ok(B.enemyHpMult(w + 1) > B.enemyHpMult(w), `wave ${w}`);
  }
});

test('enemySpeedMult increases but is capped', () => {
  assert.ok(B.enemySpeedMult(2) > B.enemySpeedMult(1));
  for (let w = 1; w <= 200; w++) assert.ok(B.enemySpeedMult(w) <= 1.6);
});

test('waveBudget strictly increasing', () => {
  for (let w = 1; w < 60; w++) assert.ok(B.waveBudget(w + 1) > B.waveBudget(w));
});

test('spawnInterval bounded and non-increasing', () => {
  for (let w = 1; w < 60; w++) {
    const s = B.spawnInterval(w);
    assert.ok(s >= 0.22 && s <= 1.4, `wave ${w}: ${s}`);
    assert.ok(B.spawnInterval(w + 1) <= s);
  }
});

test('xpForLevel is a positive-integer increasing curve', () => {
  for (let l = 1; l < 60; l++) {
    const x = B.xpForLevel(l);
    assert.ok(Number.isInteger(x) && x > 0);
    assert.ok(B.xpForLevel(l + 1) > x);
  }
});

test('the hp-bar gate stays meaningful as the HP curve climbs', () => {
  // the regression: an absolute `maxHp > 40` against a curve that multiplies every
  // enemy's HP — dead by wave 4, so every damaged shape carried a bar (app.md).
  // Same bug class as the pre-ADR-0008 bossHp and the pre-0009 boss variants.
  const hpOf = (id, w) => ENEMIES[id].hp * B.enemyHpMult(w);
  for (const w of [1, 4, 20, 40, 80]) {
    const t = B.hpBarThreshold(w);
    assert.ok(hpOf('grunt', w) < t, `chaff earns a bar at wave ${w} — the gate is dead again`);
    assert.ok(hpOf('dart', w) < t, `darts earn a bar at wave ${w}`);
    assert.ok(hpOf('tank', w) > t, `a tank should read as beefy at wave ${w}`);
    assert.ok(hpOf('elite', w) > t, `an elite should read as beefy at wave ${w}`);
  }
  // a variant that genuinely makes chaff tanky flips it — the rule working
  assert.ok(hpOf('grunt', 20) * VARIANTS.armored.hpMult > B.hpBarThreshold(20),
    'an armored grunt is beefy and should earn a bar');
});

// REWRITTEN 2026-07-25 (ADR-0012), and CALLED OUT as a loosening of the drift
// clause. This used to assert the boss share was near-CONSTANT (spread < 5%)
// because ADR-0008 defined bossHp as a fixed share. ADR-0012 sizes the boss in
// SECONDS instead, so the share is now an output and legitimately varies — the
// old assertion would forbid the fix. What survives is the property the original
// regression actually violated: the boss must never decay into the crowd.
test('a boss never decays into the crowd, at any depth', () => {
  // The regression this guards: bossHp linear against a quartic wave curve — 31%
  // of wave HP at wave 5, 4.9% by wave 45, Law·Bosses dissolving into one chunky
  // elite among forty-four. The presence FLOOR is what makes that impossible now.
  const share = w => B.bossHp(w) / (B.bossHp(w) + B.waveTrashHp(w));
  for (const w of [5, 10, 15, 20, 30, 40, 50, 60, 80, 120]) {
    const s = share(w);
    assert.ok(s >= B.BOSS_HP_SHARE - 0.001,
      `wave ${w}: boss is ${(100 * s).toFixed(1)}% of its wave, under the presence floor`);
    assert.ok(s < 0.45, `wave ${w}: boss is ${(100 * s).toFixed(1)}% of its wave — that is the wave`);
  }
});

test('a boss is sized in seconds, and the target ramps then holds', () => {
  // Daniel, 2026-07-25: "around 60s events as the default". The ramp is deliberate:
  // the first boss is short because it is the onboarding wall and ~45% of fresh
  // runs end there — lengthening it moves the calibrate band.
  assert.ok(B.bossTargetTtk(5) < B.BOSS_TTK_TARGET, 'the first boss must be shorter');
  assert.equal(B.bossTargetTtk(B.BOSS_TTK_WAVE), B.BOSS_TTK_TARGET);
  assert.equal(B.bossTargetTtk(120), B.BOSS_TTK_TARGET, 'and it holds, rather than growing');
  // monotone: no wave should be a shorter designed fight than an earlier one
  for (let w = 5; w < 60; w += 5) {
    assert.ok(B.bossTargetTtk(w + 5) >= B.bossTargetTtk(w), `target dipped at wave ${w + 5}`);
  }
});

test('bossHp grows across boss waves', () => {
  assert.ok(B.bossHp(10) > B.bossHp(5));
  assert.ok(B.bossHp(15) > B.bossHp(10));
});

test('enemyMass: 1 at spawn, grows with age, caps at 3', () => {
  assert.equal(B.enemyMass(0), 1);
  assert.ok(B.enemyMass(10) > B.enemyMass(1));
  for (const a of [30, 60, 500]) assert.ok(B.enemyMass(a) <= 3);
  assert.ok(Math.abs(B.enemyMass(60) - 3) < 1e-9);
});

test('shardPayout: losing always buys something, and deeper runs pay more', () => {
  assert.ok(B.shardPayout(0, 0, 0) >= 1);
  assert.ok(B.shardPayout(1, 0, 0) >= 1);
  assert.ok(B.shardPayout(10, 100, 2) > B.shardPayout(3, 20, 0));
  // superlinear in wave (ADR-0003: deep lattice rings need deep runs to pay)
  const w10 = B.shardPayout(10, 0, 0), w20 = B.shardPayout(20, 0, 0), w30 = B.shardPayout(30, 0, 0);
  assert.ok(w30 - w20 > w20 - w10, 'payout must accelerate with wave');
});

test('variantChance: none before wave 6, capped at 0.35, non-decreasing', () => {
  for (let w = 1; w <= 5; w++) assert.equal(B.variantChance(w), 0);
  for (let w = 1; w <= 100; w++) {
    assert.ok(B.variantChance(w) <= 0.35);
    assert.ok(B.variantChance(w + 1) >= B.variantChance(w));
  }
  assert.ok(B.variantChance(10) > 0);
});
