// Every damaging weapon must be attributable (core.md Run state). This exists
// because boomerang silently pooled into `other` for a full landing: the hit loop
// read `b.src` and the projectile record never set it, so a working weapon read as
// dead content in the damage census. The `other` bucket preserved the damage — but
// a mislabelled ledger is a ledger that lies confidently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, newRun } from '../src/core/state.js';
import { WEAPONS, LATTICE } from '../src/core/config.js';
import { makeFx, updateFx } from '../src/app/fx.js';
import { resetWeapons, updateWeapons, fireWall, fireBlades } from '../src/app/weapons/index.js';
import { spawnEnemy } from '../src/app/enemies.js';
import { seedRandom } from './seed.mjs';

/** Run one weapon alone against a ring of immortal shapes; return its ledger. */
function ledgerFor(id) {
  seedRandom();
  const meta = { ...defaultMeta(), tech: LATTICE.map(n => n.id) };
  const G = { W: 800, H: 800, cx: 400, cy: 400, S: newRun(meta, 'bastion'), fx: makeFx(), meta };
  for (const k of Object.keys(G.S.weapons)) G.S.weapons[k] = 0;
  G.S.weapons[id] = WEAPONS[id].max;
  G.S.wave = 20;
  resetWeapons(G);
  G.aim = { x: 400, y: 250 };
  G.wt.holdAim = G.aim;                    // hold weapons need a channel
  // shapes at several radii so short- and long-reach weapons both find bodies
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, r = 90 + (i % 6) * 45;
    const e = spawnEnemy(G, 'grunt', null, 400 + Math.cos(a) * r, 400 + Math.sin(a) * r);
    e.hp = e.maxHp = 1e9; e.spd = 0;
  }
  if (WEAPONS[id].input === 'swipe') {      // the only weapons needing a gesture
    (id === 'wall' ? fireWall : fireBlades)(G, { x: 250, y: 250 }, { x: 550, y: 250 });
  }
  for (let t = 0; t < 12; t += 1 / 60) { updateWeapons(G, 1 / 60); G.S.time += 1 / 60; updateFx(G.fx, 1 / 60); }
  return G.S.dmgBy;
}

test('every damaging weapon credits itself, and nothing lands in `other`', () => {
  const utility = new Set(['frost']); // a slow, not a damage source — 0 is correct
  const missing = [], mislabelled = [];
  for (const id of Object.keys(WEAPONS)) {
    if (utility.has(id)) continue;
    const led = ledgerFor(id);
    if (!(led[id] > 0)) missing.push(id);
    if (led.other > 0) mislabelled.push(`${id}→other(${Math.round(led.other)})`);
  }
  assert.deepEqual(missing, [], `these dealt no attributed damage: ${missing.join(', ')}`);
  assert.deepEqual(mislabelled, [], `these leaked into the other bucket: ${mislabelled.join(', ')}`);
});

test('frost is deliberately absent from the ledger — it slows, it does not damage', () => {
  assert.equal(ledgerFor('frost').frost, undefined);
});
