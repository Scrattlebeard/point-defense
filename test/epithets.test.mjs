// Boss variants (core.md "Boss variants"): an epithet changes the fight, not the
// arithmetic. Bosses use VARIANTS[id].boss overrides, never the trash multipliers
// — which, applied to a pool that is a share of the whole wave, produced a
// mathematically unkillable regen boss and a stalled run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VARIANTS, ENEMIES } from '../src/core/config.js';
import { bossHp, enemyHpMult } from '../src/core/balance.js';
import { defaultMeta, newRun } from '../src/core/state.js';
import { makeFx } from '../src/app/fx.js';
import { resetWeapons } from '../src/app/weapons/index.js';
import { resetWaveDirector, updateGame } from '../src/app/game.js';
import { spawnEnemy } from '../src/app/enemies.js';
import { seedRandom } from './seed.mjs';

function makeG(wave) {
  seedRandom(); // deterministic sim (test/seed.mjs)
  const meta = defaultMeta();
  const G = { W: 430, H: 900, cx: 215, cy: 450, S: newRun(meta, 'bastion'), fx: makeFx(), meta };
  resetWeapons(G);
  resetWaveDirector(G);
  G.S.wave = wave;
  G.wd.phase = 'clear'; // isolate the boss: no trash spawns
  return G;
}

test('every variant declares a boss override', () => {
  for (const [id, v] of Object.entries(VARIANTS)) {
    assert.ok(v.boss, `${id} has no .boss override — bosses would inherit trash multipliers`);
  }
});

test('boss overrides are gentler than the trash multipliers they replace', () => {
  // the boss HP pool is already a share of the whole wave (core.md bossHp), so a
  // trash multiplier on top compounds against a curve it was never sized for
  assert.ok(VARIANTS.armored.boss.hpMult < VARIANTS.armored.hpMult);
  assert.ok(VARIANTS.swift.boss.spdMult < VARIANTS.swift.spdMult);
  assert.ok(VARIANTS.regen.boss.regenPct < VARIANTS.regen.regenPct);
  // ...except shielded, which must go UP: 3 charges are invisible on a boss
  assert.ok(VARIANTS.shielded.boss.shield > VARIANTS.shielded.shield);
});

test('a boss spawns with the boss override, a grunt with the trash multiplier', () => {
  const G = makeG(40);
  const boss = spawnEnemy(G, 'boss', 'armored');
  const plain = spawnEnemy(G, 'boss', null);
  assert.ok(Math.abs(boss.maxHp / plain.maxHp - VARIANTS.armored.boss.hpMult) < 0.01,
    `boss armored used ${(boss.maxHp / plain.maxHp).toFixed(2)}×, expected the boss override`);
  const grunt = spawnEnemy(G, 'grunt', 'armored');
  const grunt0 = spawnEnemy(G, 'grunt', null);
  assert.ok(Math.abs(grunt.maxHp / grunt0.maxHp - VARIANTS.armored.hpMult) < 0.01,
    'trash must keep the full trash multiplier');
});

test('no epithet makes a boss unkillable: regen never outpaces sustained damage', () => {
  // the regression: 3%/s of a wave-share HP pool healed faster than a maxed
  // build could damage it — 0% damage dealt in 23s, and the wave director will
  // not advance until the field is empty
  const G = makeG(40);
  const boss = spawnEnemy(G, 'boss', 'regen');
  const dps = boss.maxHp * 0.02; // a modest 2%-of-pool-per-second attacker
  const heal = boss.maxHp * VARIANTS.regen.boss.regenPct;
  assert.ok(heal < dps * 0.5,
    `boss regen ${heal.toFixed(0)}/s vs a modest ${dps.toFixed(0)}/s attacker — regen must be a DPS check, not a wall`);
});

test('a regen boss actually dies to sustained fire in the live sim', () => {
  const G = makeG(40);
  for (const [id, l] of Object.entries({ bolt: 6, orbit: 5, nova: 5, frost: 5, tesla: 5, turret: 5 })) {
    G.S.weapons[id] = l; G.S.pool.add(id);
  }
  resetWeapons(G);
  const boss = spawnEnemy(G, 'boss', 'regen');
  boss.hp = boss.maxHp * 0.02; // nearly dead: regen must not claw it back
  G.S.hp = G.S.maxHp = 1e9;    // the player is not the subject of this test
  G.aim = { x: boss.x, y: boss.y };
  for (let i = 0; i < 60 * 30 && !boss.dead; i++) {
    G.aim = { x: boss.x, y: boss.y };
    updateGame(G, 1 / 60);
  }
  assert.ok(boss.dead, `a 2%-hp regen boss survived 30s of focused fire (${(100 * boss.hp / boss.maxHp).toFixed(0)}% hp)`);
});
