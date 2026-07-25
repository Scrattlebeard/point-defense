// Control metric (core.md Run state: "control is measured in seconds"). GDD §4
// judges these weapons by seconds purchased, not DPS — a damage ledger cannot see
// them at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, newRun } from '../src/core/state.js';
import { makeFx } from '../src/app/fx.js';
import { resetWeapons } from '../src/app/weapons/index.js';
import { resetWaveDirector, updateGame } from '../src/app/game.js';
import { spawnEnemy } from '../src/app/enemies.js';
import { seedRandom } from './seed.mjs';

function rig(weapons = {}) {
  seedRandom();
  const meta = defaultMeta();
  const G = { W: 800, H: 800, cx: 400, cy: 400, S: newRun(meta, 'bastion'), fx: makeFx(), meta };
  for (const k of Object.keys(G.S.weapons)) G.S.weapons[k] = 0;
  Object.assign(G.S.weapons, weapons);
  resetWeapons(G);
  resetWaveDirector(G);
  G.wd.phase = 'clear';
  return G;
}
const step = (G, secs) => { for (let i = 0; i < secs * 60; i++) updateGame(G, 1 / 60); };

test('a fresh run has purchased no seconds', () => {
  assert.deepEqual(rig().S.slowBy, {});
});

test('frost buys seconds, and they land under frost', () => {
  const G = rig({ frost: 4 });
  spawnEnemy(G, 'grunt', null, G.cx, G.cy - 140); // inside the aura
  step(G, 2);
  assert.ok(G.S.slowBy.frost > 0, 'a shape crossing the aura bought nothing');
  // 2s at ~38% slow is well under 2 shape-seconds and clearly above zero
  assert.ok(G.S.slowBy.frost < 2, `implausible denial: ${G.S.slowBy.frost}`);
});

test('no aura, no purchase', () => {
  const G = rig({ bolt: 1 });
  spawnEnemy(G, 'grunt', null, G.cx, G.cy - 140);
  step(G, 2);
  assert.deepEqual(G.S.slowBy, {});
});

test('a caltrop prick is credited to caltrops, not to frost', () => {
  const G = rig({});
  const e = spawnEnemy(G, 'grunt', null, G.cx, G.cy - 200);
  e.calSlowT = 3; e.calSlow = 0.45;
  step(G, 1);
  assert.ok(G.S.slowBy.caltrop > 0, 'the prick bought no time');
  assert.equal(G.S.slowBy.frost, undefined);
});

test('an aged shape yields fewer seconds — mass resists control', () => {
  // core.md enemyMass: CC decays against anything that has survived long enough
  const fresh = rig({ frost: 4 }), old = rig({ frost: 4 });
  const a = spawnEnemy(fresh, 'grunt', null, fresh.cx, fresh.cy - 140);
  const b = spawnEnemy(old, 'grunt', null, old.cx, old.cy - 140);
  a.age = 0; b.age = 60; // b is past the mass cap
  step(fresh, 1); step(old, 1);
  assert.ok(fresh.S.slowBy.frost > old.S.slowBy.frost * 1.5,
    `fresh ${fresh.S.slowBy.frost} should be denied far more than aged ${old.S.slowBy.frost}`);
});

test('two sources on one shape split the second — never double-count it', () => {
  const G = rig({ frost: 4 });
  const e = spawnEnemy(G, 'grunt', null, G.cx, G.cy - 140);
  e.calSlowT = 5; e.calSlow = 0.45;
  step(G, 1);
  const total = Object.values(G.S.slowBy).reduce((a, b) => a + b, 0);
  assert.ok(G.S.slowBy.frost > 0 && G.S.slowBy.caltrop > 0, 'both should be credited');
  assert.ok(total <= 1.001, `denied ${total} shape-seconds in 1s of wall-clock — double counted`);
});
