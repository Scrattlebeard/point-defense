// The Armory, wave A (core.md "Aim ordnance", ADR-0004): scattergun, repeater,
// howitzer, boomerang — headless sim smoke over the same harness as ordnance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, newRun } from '../src/core/state.js';
import { WEAPONS, LATTICE } from '../src/core/config.js';
import { makeFx, updateFx } from '../src/app/fx.js';
import { resetWeapons, updateWeapons } from '../src/app/weapons.js';
import { spawnEnemy } from '../src/app/enemies.js';

function makeG(weaponId, lvl) {
  const meta = defaultMeta();
  const G = {
    W: 800, H: 600, cx: 400, cy: 300,
    S: newRun(meta, 'bastion'), fx: makeFx(), meta,
  };
  G.S.weapons.bolt = 0; // isolate the weapon under test
  if (weaponId) G.S.weapons[weaponId] = lvl;
  resetWeapons(G);
  G.aim = { x: 600, y: 300 }; // aim ordnance needs a standing aim
  return G;
}

function simulate(G, seconds) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    updateWeapons(G, dt);
    G.S.time += dt;
    G.S.enemies = G.S.enemies.filter(e => !e.dead);
    updateFx(G.fx, dt);
  }
}

/** Immortal target: soaks hits without dying so counts stay clean. */
function anvil(G, x, y) {
  const e = spawnEnemy(G, 'boss', null, x, y);
  e.hp = e.maxHp = 1e9;
  return e;
}

test('wave A config contract: tech-locked aim ordnance', () => {
  for (const id of ['scatter', 'burst', 'heavy', 'boomer']) {
    const w = WEAPONS[id];
    assert.ok(w, `${id} missing`);
    assert.equal(w.techLock, true, `${id} must be tech-locked`);
    assert.equal(w.max, 5);
    assert.equal(w.kind, 'auto');
    assert.equal(w.tag, 'AIM', `${id} chip must say how it fires`);
    assert.equal(w.descs.length, 5);
    assert.equal(w.slot, undefined, 'aim is not a slot (ADR-0004)');
  }
});

test('armory lattice nodes exist, tech-locked ids match, sector is Armory', () => {
  for (const id of ['scatter', 'burst', 'heavy', 'boomer']) {
    const n = LATTICE.find(n => n.id === id);
    assert.ok(n, `lattice node ${id} missing`);
    assert.equal(n.sector, 'Armory');
    assert.deepEqual(n.effect, { unlockWeapon: id });
  }
});

test('scattergun: a volley is many overlapping pellets on spread bearings', () => {
  const G = makeG('scatter', 1);
  anvil(G, 600, 300);
  simulate(G, 0.3); // first volley fires at t≈0
  const st = WEAPONS.scatter.stats(1);
  assert.ok(G.S.bullets.length >= st.pellets - 1, // some may already have hit the anvil
    `expected ~${st.pellets} pellets in flight, got ${G.S.bullets.length}`);
  // semi-random distribution: bearings must NOT be identical
  const angles = new Set(G.S.bullets.map(b => Math.atan2(b.vy, b.vx).toFixed(3)));
  assert.ok(angles.size > 1, 'pellets share one bearing — that is a fan, not buckshot');
});

test('scattergun holds fire with no live shape (bolt rule)', () => {
  const G = makeG('scatter', 3);
  simulate(G, 3);
  assert.equal(G.S.bullets.length, 0, 'fired at an empty field');
});

test('repeater: fires its whole salvo, then pauses', () => {
  const G = makeG('burst', 1);
  anvil(G, 700, 550); // far corner: pellets stay in flight during the count
  const st = WEAPONS.burst.stats(1);
  simulate(G, st.gap * st.n + 0.05); // salvo window
  assert.ok(G.S.bullets.length >= st.n - 1,
    `salvo should put ~${st.n} bolts in the air, got ${G.S.bullets.length}`);
  const inAir = G.S.bullets.length;
  simulate(G, 0.3); // well inside the pause — no new shots
  assert.ok(G.S.bullets.length <= inAir, 'kept firing through the pause');
});

test('howitzer: light rounds, a beat, then one heavy piercing shell', () => {
  const G = makeG('heavy', 1);
  anvil(G, 700, 550);
  const st = WEAPONS.heavy.stats(1);
  // capture the whole cycle: 3 lights + pause + shell
  simulate(G, st.lightGap * 3 + st.pause + 0.1);
  const heavies = G.S.bullets.filter(b => b.dmg >= st.heavyDmg * 0.9);
  const lights = G.S.bullets.filter(b => b.dmg < st.heavyDmg * 0.9);
  assert.ok(heavies.length >= 1, 'no heavy shell fired');
  assert.ok(lights.length >= 2, `expected light rounds in flight, got ${lights.length}`);
  assert.ok(heavies[0].pierce >= 2, 'heavy shell must pierce');
});

test('boomerang: hits on the way out AND on the way back', () => {
  const G = makeG('boomer', 1);
  const e = anvil(G, 550, 300); // on the throw line, inside the turn radius
  const before = e.hp;
  simulate(G, 5);
  const hits = Math.round((before - e.hp) / (WEAPONS.boomer.stats(1).dmg * G.S.dmgMult));
  assert.ok(hits >= 2, `expected out+back = 2+ bites, got ${hits}`);
});

test('boomerang bounces off the arena wall and comes home', () => {
  const G = makeG('boomer', 1);
  anvil(G, 60, 60); // aim long: the blade would fly out of bounds
  G.aim = { x: 790, y: 300 };
  const dt = 1 / 60;
  let everOut = false, count = 0;
  for (let t = 0; t < 6; t += dt) {
    updateWeapons(G, dt);
    G.S.time += dt;
    for (const b of G.S.boomers) {
      count = Math.max(count, G.S.boomers.length);
      if (b.x < 0 || b.x > G.W || b.y < 0 || b.y > G.H) everOut = true;
    }
  }
  assert.ok(count >= 1, 'no boomerang ever flew');
  assert.equal(everOut, false, 'boomerang escaped the arena');
  assert.equal(G.S.boomers.length, 0, 'boomerang never came home (leaked)');
});
