// Mines + Mortar (core.md weapon rows, ADR-0003 stage 1) — headless sim smoke:
// both new weapons must actually kill shapes with nobody aiming.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, newRun } from '../src/core/state.js';
import { WEAPONS } from '../src/core/config.js';
import { makeFx, updateFx } from '../src/app/fx.js';
import { resetWeapons, updateWeapons } from '../src/app/weapons/index.js';
import { spawnEnemy } from '../src/app/enemies.js';

function makeG(weaponId, lvl) {
  const meta = defaultMeta();
  const G = {
    W: 800, H: 600, cx: 400, cy: 300,
    S: newRun(meta, 'bastion'), fx: makeFx(), meta,
  };
  G.S.weapons.bolt = 0;       // isolate the weapon under test
  G.S.weapons[weaponId] = lvl;
  resetWeapons(G);
  G.aim = null;
  return G;
}

function simulate(G, seconds, respawn) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    if (respawn && !G.S.enemies.some(e => !e.dead)) respawn(G);
    updateWeapons(G, dt);
    // minimal enemy bookkeeping: cull the dead like game.js would
    G.S.enemies = G.S.enemies.filter(e => !e.dead);
    updateFx(G.fx, dt);
  }
}

test('mine/mortar exist in config with the tech-locked contract', () => {
  for (const id of ['mine', 'mortar']) {
    const w = WEAPONS[id];
    assert.ok(w, `${id} missing`);
    assert.equal(w.techLock, true, `${id} must be tech-locked`);
    assert.equal(w.max, 5);
    assert.equal(w.kind, 'auto');
    assert.equal(w.descs.length, 5);
  }
});

test('mines seed up to the cap, arm, and kill a shape that walks in', () => {
  const G = makeG('mine', 3);
  simulate(G, 8); // seed with an empty field
  const cap = WEAPONS.mine.stats(3).cap;
  assert.ok(G.S.mines.length >= 1 && G.S.mines.length <= cap,
    `expected 1..${cap} mines, got ${G.S.mines.length}`);
  // march a grunt straight through the minefield's position
  const m = G.S.mines[0];
  const e = spawnEnemy(G, 'grunt', null, m.x, m.y);
  simulate(G, 2);
  assert.ok(G.S.kills >= 1 || e.dead || e.hp < e.maxHp,
    'a shape standing on an armed mine took no damage');
});

test('mortar shells fly, land, and hurt a stationary crowd', () => {
  const G = makeG('mortar', 3);
  for (let i = 0; i < 5; i++) spawnEnemy(G, 'grunt', null, 600, 300 + i * 8);
  // grunts here don't move (no game.js update): a landing shell must connect
  simulate(G, 12);
  const hurt = G.S.enemies.some(e => e.hp < e.maxHp);
  assert.ok(G.S.kills >= 1 || hurt, 'no shell ever connected');
});

test('mines respect the live cap at every level', () => {
  for (const l of [1, 3, 5]) {
    const G = makeG('mine', l);
    simulate(G, 30);
    assert.ok(G.S.mines.length <= WEAPONS.mine.stats(l).cap,
      `L${l}: ${G.S.mines.length} mines over cap`);
  }
});
