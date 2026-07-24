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

// ---- Wave B (ADR-0004): gesture slots + flamethrower, meteor, force blades ----
import { levelChoices } from '../src/core/state.js';
import { TOWERS } from '../src/core/config.js';
import { fireBlades, releaseHold } from '../src/app/weapons.js';
import { mulberry32 } from '../src/core/rng.js';

test('wave B config contract: slots declared, tech-locked, manual', () => {
  assert.equal(WEAPONS.beam.slot, 'hold');
  assert.equal(WEAPONS.flame.slot, 'hold');
  assert.equal(WEAPONS.meteor.slot, 'hold');
  assert.equal(WEAPONS.wall.slot, 'swipe');
  assert.equal(WEAPONS.blades.slot, 'swipe');
  for (const id of ['flame', 'meteor', 'blades']) {
    const w = WEAPONS[id];
    assert.equal(w.techLock, true, `${id} must be tech-locked`);
    assert.equal(w.kind, 'manual');
    assert.equal(w.max, 5);
    assert.equal(w.descs.length, 5);
  }
});

test('gesture slots: an occupied slot is never offered again (ADR-0004)', () => {
  const S = newRun(defaultMeta(), 'bastion');
  for (const id of ['flame', 'meteor', 'blades', 'beam', 'wall']) S.pool.add(id);
  S.weapons.beam = 1; // hold slot occupied
  S.weapons.wall = 1; // swipe slot occupied
  const rng = mulberry32(7);
  for (let i = 0; i < 300; i++) {
    for (const c of levelChoices(S, rng)) {
      assert.ok(!['flame', 'meteor', 'blades'].includes(c.id),
        `${c.id} offered while its slot is occupied`);
    }
  }
});

test('gesture slots: a free slot still offers its weapons', () => {
  const S = newRun(defaultMeta(), 'bastion');
  for (const id of ['flame', 'meteor', 'blades']) S.pool.add(id);
  const rng = mulberry32(11);
  const seen = new Set();
  for (let i = 0; i < 400; i++) for (const c of levelChoices(S, rng)) seen.add(c.id);
  for (const id of ['flame', 'meteor', 'blades']) {
    assert.ok(seen.has(id), `${id} never offered despite free slot`);
  }
});

test('no tower starts with two weapons in one gesture slot', () => {
  for (const [tid, t] of Object.entries(TOWERS)) {
    const bySlot = {};
    for (const wid of Object.keys(t.start)) {
      const slot = WEAPONS[wid].slot;
      if (!slot) continue;
      assert.ok(!bySlot[slot], `${tid} starts two ${slot}-slot weapons`);
      bySlot[slot] = wid;
    }
  }
});

test('flamethrower: burn stacks keep cooking after the shape leaves the cone', () => {
  const G = makeG('flame', 2);
  G.wt.holdAim = { x: 600, y: 300 };
  const e = anvil(G, 520, 300); // inside the cone
  simulate(G, 1.0); // paint it
  const cooked = e.maxHp - e.hp;
  assert.ok(cooked > 0, 'cone never burned the target');
  assert.ok(e.burnStacks >= 1, 'no burn stacks applied');
  // leave the cone: stop channeling entirely
  G.wt.holdAim = null;
  const hpAtExit = e.hp;
  simulate(G, 1.2);
  assert.ok(e.hp < hpAtExit, 'burn stopped the instant the cone left — DoT is the identity');
});

test('flamethrower leaves burning ground that hurts a latecomer', () => {
  const G = makeG('flame', 3);
  G.wt.holdAim = { x: 600, y: 300 };
  anvil(G, 560, 300);
  simulate(G, 1.5); // sweep long enough to drop patches
  assert.ok(G.S.fires.length >= 1, 'no ground patches dropped');
  G.wt.holdAim = null;
  const f = G.S.fires[G.S.fires.length - 1];
  const late = anvil(G, f.x, f.y); // walks in AFTER the cone is gone
  simulate(G, 0.9);
  assert.ok(late.hp < late.maxHp, 'burning ground did not burn');
});

test('meteor: auto-releases at full charge, hits harder than a pebble', () => {
  // full charge: hold until auto-release
  const G1 = makeG('meteor', 1);
  const e1 = anvil(G1, 600, 300);
  G1.wt.holdAim = { x: 600, y: 300 };
  simulate(G1, 3.0); // charge 1.5s + fall + impact, no release call ever
  const fullDmg = e1.maxHp - e1.hp;
  assert.ok(fullDmg > 0, 'auto-release never fired');
  // pebble: brief hold, manual release
  const G2 = makeG('meteor', 1);
  const e2 = anvil(G2, 600, 300);
  G2.wt.holdAim = { x: 600, y: 300 };
  simulate(G2, 0.3);
  releaseHold(G2);
  G2.wt.holdAim = null;
  simulate(G2, 1.5);
  const pebbleDmg = e2.maxHp - e2.hp;
  assert.ok(pebbleDmg > 0, 'min-charge release was a dead input');
  assert.ok(fullDmg > pebbleDmg * 1.5, `charge must matter: full ${fullDmg} vs pebble ${pebbleDmg}`);
});

test('force blades: swipe hurls piercing crescents outward', () => {
  const G = makeG('blades', 2);
  // swipe across, above the Point: outward normal points up (away from tower)
  const a = anvil(G, 400, 150);
  const b = anvil(G, 400, 80); // second shape further along the SAME path: pierce proof
  const ok = fireBlades(G, { x: 300, y: 220 }, { x: 500, y: 220 });
  assert.equal(ok, true, 'owned blades refused to fire');
  simulate(G, 1.2);
  assert.ok(a.hp < a.maxHp, 'first shape untouched');
  assert.ok(b.hp < b.maxHp, 'blade did not pierce to the second shape');
  assert.equal(G.S.blades.length, 0, 'blades must die at the wall (leaked)');
});

test('force blades: not owned → returns false (swipe degrades to re-aim)', () => {
  const G = makeG('bolt', 1);
  assert.equal(fireBlades(G, { x: 300, y: 220 }, { x: 500, y: 220 }), false);
});

test('flamethrower overheats like the beam: sustained channel forces a lockout', () => {
  const G = makeG('flame', 1);
  G.wt.holdAim = { x: 600, y: 300 };
  anvil(G, 520, 300);
  let overheated = false;
  const dt = 1 / 60;
  for (let t = 0; t < 8; t += dt) {
    updateWeapons(G, dt);
    G.S.time += dt;
    if (G.S.overheated) { overheated = true; break; }
  }
  assert.ok(overheated, 'flame never overheated — another weapon is bleeding its heat');
});
