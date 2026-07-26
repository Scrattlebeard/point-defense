// Damage attribution (core.md Run state: "damage is attributed to its source").
// The substrate mastery XP earns against, and the answer to "what carried this run".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, newRun } from '../src/core/state.js';
import { makeFx, updateFx } from '../src/app/fx.js';
import { resetWeapons, updateWeapons } from '../src/app/weapons/index.js';
import { spawnEnemy, damageEnemy } from '../src/app/enemies.js';
import { WEAPONS } from '../src/core/config.js';
import { seedRandom } from './seed.mjs';

function rig(weapons) {
  seedRandom();
  const meta = defaultMeta();
  const G = { W: 800, H: 600, cx: 400, cy: 300, S: newRun(meta, 'bastion'), fx: makeFx(), meta };
  for (const id of Object.keys(G.S.weapons)) G.S.weapons[id] = 0;
  Object.assign(G.S.weapons, weapons);
  resetWeapons(G);
  G.aim = { x: 700, y: 300 };
  return G;
}
const anvil = G => { const e = spawnEnemy(G, 'boss', null, 690, 300); e.hp = e.maxHp = 1e12; return e; };
const run = (G, secs) => { for (let t = 0; t < secs; t += 1 / 60) { updateWeapons(G, 1 / 60); G.S.time += 1 / 60; updateFx(G.fx, 1 / 60); } };

test('a fresh run starts with an empty ledger', () => {
  assert.deepEqual(rig({}).S.dmgBy, {});
});

test('damage lands under the weapon that dealt it', () => {
  const G = rig({ bolt: 3 });
  anvil(G);
  run(G, 4);
  assert.ok(G.S.dmgBy.bolt > 0, 'bolt dealt damage but is not in the ledger');
  assert.deepEqual(Object.keys(G.S.dmgBy), ['bolt'], 'something else was credited');
});

test('several weapons are tracked separately', () => {
  const G = rig({ bolt: 3, nova: 3, orbit: 3 });
  anvil(G);
  // orbit grinds along a radial blade, so it needs a body somewhere between the
  // blade's root and its tip — read both from config rather than hardcoding, or
  // re-shaping the blade silently breaks a test that is not about the blade
  const s3 = WEAPONS.orbit.stats(3);
  const ring = (s3.inner + s3.outer) * 0.5;
  const near = spawnEnemy(G, 'boss', null, G.cx + ring, G.cy);
  near.hp = near.maxHp = 1e12;
  run(G, 8);
  for (const id of ['bolt', 'nova', 'orbit']) {
    assert.ok(G.S.dmgBy[id] > 0, `${id} contributed nothing to the ledger`);
  }
});

test('the ledger accounts for the damage actually dealt — nothing vanishes', () => {
  const G = rig({ bolt: 4, frost: 2, orbit: 2 });
  const e = anvil(G);
  run(G, 8);
  const dealt = e.maxHp - e.hp;
  const ledger = Object.values(G.S.dmgBy).reduce((a, b) => a + b, 0);
  assert.ok(dealt > 0, 'setup: something should have been damaged');
  assert.ok(Math.abs(ledger - dealt) / dealt < 0.02,
    `ledger ${Math.round(ledger)} vs actual ${Math.round(dealt)} — attribution is leaking`);
});

test('sourceless damage is bucketed, not dropped', () => {
  // a breakdown that silently loses damage reads as complete and is not
  const G = rig({});
  const e = anvil(G);
  damageEnemy(G, e, 500);          // no src given at all
  assert.ok(G.S.dmgBy.other >= 500, 'unattributed damage disappeared from the ledger');
});

test('a form credits its base weapon — a fanned bolt is still bolt', () => {
  const G = rig({ bolt: WEAPONS.bolt.max });
  G.S.forms.bolt = 'fan';
  anvil(G);
  run(G, 4);
  assert.ok(G.S.dmgBy.bolt > 0);
  assert.equal(G.S.dmgBy.fan, undefined, 'the form was credited as if it were a weapon');
});
