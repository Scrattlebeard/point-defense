// Damage attribution: a besieging shape is explicit state so the view can answer
// "who is hurting me?" (core.md Enemies, app.md "A besieger telegraphs its
// strike"). The renderer must never re-derive this from geometry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, newRun } from '../src/core/state.js';
import { makeFx } from '../src/app/fx.js';
import { resetWeapons } from '../src/app/weapons/index.js';
import { resetWaveDirector, updateGame } from '../src/app/game.js';
import { spawnEnemy, applyKnock } from '../src/app/enemies.js';
import { seedRandom } from './seed.mjs';

function makeG() {
  seedRandom(); // deterministic sim (test/seed.mjs)
  const meta = defaultMeta();
  const G = { W: 430, H: 900, cx: 215, cy: 450, S: newRun(meta, 'bastion'), fx: makeFx(), meta };
  resetWeapons(G);
  resetWaveDirector(G);
  G.S.weapons.bolt = 0; // nothing shoots back; the siege is the subject
  G.wd.phase = 'clear';
  return G;
}

const step = (G, n) => { for (let i = 0; i < n; i++) updateGame(G, 1 / 60); };

test('a shape holding the rim is marked as besieging; one still walking in is not', () => {
  const G = makeG();
  const atRim = spawnEnemy(G, 'grunt', null, G.cx, G.cy - 36); // r 12 + TOWER_R 24
  const inbound = spawnEnemy(G, 'grunt', null, G.cx, G.cy - 260);
  step(G, 2);
  assert.equal(atRim.sieging, true, 'a shape on the rim must read as besieging');
  assert.equal(inbound.sieging, false, 'a shape still approaching must not');
});

test('shoving a besieger off the rim clears the mark', () => {
  const G = makeG();
  const e = spawnEnemy(G, 'grunt', null, G.cx, G.cy - 36);
  step(G, 2);
  assert.equal(e.sieging, true);
  e.age = 0; // fresh shapes take full knockback (core.md enemyMass)
  applyKnock(e, 0, -9000);
  step(G, 6);
  assert.equal(e.sieging, false, 'CC shoved it off the rim — it is no longer besieging');
});

test('each strike leaves a decaying marker the view can render', () => {
  const G = makeG();
  const e = spawnEnemy(G, 'grunt', null, G.cx, G.cy - 36);
  const hp0 = G.S.hp;
  step(G, 2);
  assert.ok(G.S.hp < hp0, 'setup: the besieger struck on arrival');
  assert.ok(e.strike > 0, 'a strike must leave a marker for the attacker flash');
  const peak = e.strike;
  step(G, 20);
  assert.ok(e.strike < peak, 'the strike marker must decay');
});

test('the wind-up arrives before the damage, not after', () => {
  // the load-bearing half: a tell that fires only ON the hit cannot be answered
  const G = makeG();
  const e = spawnEnemy(G, 'grunt', null, G.cx, G.cy - 36);
  step(G, 2);                        // first strike on arrival
  const hpAfterFirst = G.S.hp;
  step(G, 40);                       // ~0.67s into a 0.9s cadence
  assert.equal(G.S.hp, hpAfterFirst, 'setup: still between strikes');
  assert.ok(e.contactCd > 0 && e.contactCd < 0.3,
    `the next strike must be visibly imminent (cd ${e.contactCd.toFixed(2)}) while no damage has landed`);
});
