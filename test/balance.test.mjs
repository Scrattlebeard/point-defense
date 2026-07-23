import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../src/core/balance.js';

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
});

test('variantChance: none before wave 4, capped at 0.35, non-decreasing', () => {
  for (let w = 1; w <= 3; w++) assert.equal(B.variantChance(w), 0);
  for (let w = 1; w <= 100; w++) {
    assert.ok(B.variantChance(w) <= 0.35);
    assert.ok(B.variantChance(w + 1) >= B.variantChance(w));
  }
  assert.ok(B.variantChance(10) > 0);
});
