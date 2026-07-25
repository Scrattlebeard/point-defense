// Bolt's ladder re-cut + the Fan form (ADR-0006 Decision 8, core.md bolt row).
// The fan moved OUT of the level ladder into a form, because a form must not sell
// at mastery what levelling already gives away; the ladder gained ricochet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, FORMS, LATTICE } from '../src/core/config.js';
import { defaultMeta, newRun } from '../src/core/state.js';
import { makeFx, updateFx } from '../src/app/fx.js';
import { resetWeapons, updateWeapons } from '../src/app/weapons/index.js';
import { spawnEnemy } from '../src/app/enemies.js';
import { seedRandom } from './seed.mjs';

function rig(boltLvl, form = null) {
  seedRandom(); // deterministic sim (test/seed.mjs)
  const meta = { ...defaultMeta(), tech: LATTICE.map(n => n.id) };
  const G = { W: 800, H: 600, cx: 400, cy: 300, S: newRun(meta, 'bastion'), fx: makeFx(), meta };
  for (const id of Object.keys(G.S.weapons)) G.S.weapons[id] = 0;
  G.S.weapons.bolt = boltLvl;
  // crit off: these tests convert damage back into a HIT COUNT, and a 2x crit
  // would read as a phantom extra hit (it did — 99 "hits" from 86 bolts, which
  // is exactly the 20% crit chance a fully-invested account carries)
  G.S.critChance = 0;
  if (form) G.S.forms.bolt = form;
  resetWeapons(G);
  G.aim = { x: 700, y: 300 };
  return G;
}

/** Damage EMITTED per second: bullets spawned × their damage (core.md Forms). */
function emission(form, secs = 12) {
  const G = rig(WEAPONS.bolt.max, form);
  const anvil = spawnEnemy(G, 'boss', null, 760, 300);
  anvil.hp = anvil.maxHp = 1e12;
  const dt = 1 / 60;
  let emitted = 0;
  for (let t = 0; t < secs; t += dt) {
    const before = new Set(G.S.bullets);
    updateWeapons(G, dt);
    for (const b of G.S.bullets) if (!before.has(b)) emitted += b.dmg;
    G.S.time += dt;
    updateFx(G.fx, dt);
  }
  return emitted / secs;
}

test('the ladder no longer gives fans away — that is the form\'s job now', () => {
  for (let l = 1; l <= WEAPONS.bolt.max; l++) {
    const st = WEAPONS.bolt.stats(l);
    assert.ok(!st.volley || st.volley === 1,
      `bolt L${l} still grants a volley of ${st.volley} — the fan belongs to the form`);
  }
});

test('the ladder gives ricochet instead, and it escalates', () => {
  assert.equal(WEAPONS.bolt.stats(4).ricochet || 0, 0, 'ricochet should not arrive before L5');
  assert.ok(WEAPONS.bolt.stats(5).ricochet >= 1, 'L5 must grant ricochet');
  assert.ok(WEAPONS.bolt.stats(6).ricochet > WEAPONS.bolt.stats(5).ricochet, 'MAX must deepen it');
});

test('a ricocheting bolt kicks to a SECOND shape instead of dying', () => {
  const G = rig(WEAPONS.bolt.max);
  // two shapes side by side, off the aim line so only a kick reaches the second
  const a = spawnEnemy(G, 'tank', null, 600, 300);
  const b = spawnEnemy(G, 'tank', null, 640, 330);
  a.hp = a.maxHp = 1e9; b.hp = b.maxHp = 1e9;
  const dt = 1 / 60;
  for (let t = 0; t < 4; t += dt) { updateWeapons(G, dt); G.S.time += dt; }
  assert.ok(a.hp < a.maxHp, 'setup: the aimed shape should be taking fire');
  assert.ok(b.hp < b.maxHp, 'the off-line shape was never reached — no kick happened');
});

test('ricochet needs a second shape: a lone target does not get hit twice by one bolt', () => {
  const G = rig(WEAPONS.bolt.max);
  const lone = spawnEnemy(G, 'boss', null, 700, 300);
  lone.hp = lone.maxHp = 1e12;
  // count SPAWNS by identity — a length delta undercounts whenever a bullet
  // dies in the same frame another is fired
  const dt = 1 / 60;
  let shots = 0;
  for (let t = 0; t < 6; t += dt) {
    const before = new Set(G.S.bullets);
    updateWeapons(G, dt);
    for (const b of G.S.bullets) if (!before.has(b)) shots++;
    G.S.time += dt;
  }
  const st = WEAPONS.bolt.stats(WEAPONS.bolt.max);
  const hits = Math.round((lone.maxHp - lone.hp) / (st.dmg * G.S.dmgMult));
  assert.ok(hits <= shots * 1.15,
    `a lone target took ${hits} hits from ${shots} bolts — a kick must find a DIFFERENT shape`);
});

test('Fan redistributes in space: emission neutral, spread wider', () => {
  const base = emission(null);
  const fan = emission('fan');
  const drift = Math.abs(fan - base) / base;
  assert.ok(drift < 0.08,
    `Fan is not emission-neutral: ${base.toFixed(0)} vs ${fan.toFixed(0)} dmg/s (${(100 * drift).toFixed(1)}%)`);
  // and it must actually spread: more, weaker bolts
  const G1 = rig(WEAPONS.bolt.max), G2 = rig(WEAPONS.bolt.max, 'fan');
  for (const G of [G1, G2]) {
    spawnEnemy(G, 'boss', null, 760, 300).hp = 1e12;
    // run until the first shot is actually due (resetWeapons arms boltT at 0.3)
    for (let i = 0; i < 40 && G.S.bullets.length === 0; i++) updateWeapons(G, 1 / 60);
  }
  assert.ok(G2.S.bullets.length > G1.S.bullets.length, 'Fan fired no extra bolts');
  assert.ok(G2.S.bullets[0].dmg < G1.S.bullets[0].dmg, 'Fan bolts must each carry less');
});

test('Fan and ricochet compose — the max-bolt picture ADR-0006 wanted', () => {
  const st = WEAPONS.bolt.stats(WEAPONS.bolt.max);
  assert.ok(st.ricochet >= 1, 'setup: max bolt ricochets');
  assert.ok(FORMS.fan && FORMS.fan.of === 'bolt', 'setup: Fan is a form of bolt');
  const G = rig(WEAPONS.bolt.max, 'fan');
  spawnEnemy(G, 'boss', null, 760, 300).hp = 1e12;
  for (let i = 0; i < 40 && G.S.bullets.length === 0; i++) updateWeapons(G, 1 / 60);
  assert.ok(G.S.bullets.length >= FORMS.fan.spread, 'the spread did not fire');
  for (const b of G.S.bullets) {
    assert.ok(b.ric >= 1, 'a fanned bolt lost its ricochet — the two must compose');
  }
});
