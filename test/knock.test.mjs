// Boss knockback resistance (core.md enemyMass note, 2026-07-24): player
// impulses on a boss divide by BOSS_KNOCK_RESIST on top of age-mass. A shape
// with a name should not be shoved around by an orbital graze.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, newRun } from '../src/core/state.js';
import { BOSS_KNOCK_RESIST } from '../src/core/balance.js';
import { makeFx } from '../src/app/fx.js';
import { spawnEnemy, applyKnock } from '../src/app/enemies.js';

function makeG() {
  const meta = defaultMeta();
  const G = { W: 800, H: 600, cx: 400, cy: 300, S: newRun(meta, 'bastion'), fx: makeFx(), meta };
  G.S.wave = 5; // boss waves exist from 5
  return G;
}

test('the same impulse moves a boss BOSS_KNOCK_RESIST times less than a fresh grunt', () => {
  const G = makeG();
  const grunt = spawnEnemy(G, 'grunt', null, 100, 100);
  const boss = spawnEnemy(G, 'boss', null, 200, 200);
  applyKnock(grunt, 90, 0);
  applyKnock(boss, 90, 0);
  assert.ok(BOSS_KNOCK_RESIST >= 4, 'resistance should be substantial');
  assert.ok(Math.abs(grunt.kbx / boss.kbx - BOSS_KNOCK_RESIST) < 1e-9,
    `expected ratio ${BOSS_KNOCK_RESIST}, got ${grunt.kbx / boss.kbx}`);
});
