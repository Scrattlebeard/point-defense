// Forms (core.md "Forms", ADR-0006 Decisions 6-8). A form changes how a weapon
// FEELS, never what it produces — "a form that is only bigger-slower-more is a
// stat wearing a name". The neutrality test below is what makes that enforceable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORMS, WEAPONS, LATTICE } from '../src/core/config.js';
import { defaultMeta, newRun, levelChoices, applyChoice } from '../src/core/state.js';
import { makeFx, updateFx } from '../src/app/fx.js';
import { resetWeapons, updateWeapons } from '../src/app/weapons/index.js';
import { spawnEnemy } from '../src/app/enemies.js';
import { mulberry32 } from '../src/core/rng.js';

function rig(form) {
  const meta = { ...defaultMeta(), tech: LATTICE.map(n => n.id) };
  const G = { W: 800, H: 600, cx: 400, cy: 300, S: newRun(meta, 'bastion'), fx: makeFx(), meta };
  G.S.weapons.bolt = WEAPONS.bolt.max;
  if (form) G.S.forms.bolt = form;
  resetWeapons(G);
  G.aim = { x: 700, y: 300 };
  return G;
}

/** Total damage a maxed bolt deals to an immortal anvil over `secs`. */
function output(form, secs = 20) {
  const G = rig(form);
  const e = spawnEnemy(G, 'boss', null, 700, 300);
  e.hp = e.maxHp = 1e12;
  const dt = 1 / 60;
  for (let t = 0; t < secs; t += dt) {
    updateWeapons(G, dt);
    G.S.time += dt;
    updateFx(G.fx, dt);
  }
  return e.maxHp - e.hp;
}

test('every form names a real base weapon and is not a weapon itself', () => {
  for (const [id, f] of Object.entries(FORMS)) {
    assert.ok(WEAPONS[f.of], `${id} is a form of "${f.of}", which is not a weapon`);
    assert.equal(WEAPONS[id], undefined,
      `${id} still exists as a WEAPON — a form must not cost a slot`);
  }
});

test('a form regroups output in time; it does not change output', () => {
  // THE rule (core.md Forms). Neutrality is by construction — same shots, re-timed —
  // so this must hold without tuning, and must keep holding if bolt is rebalanced.
  const base = output(null);
  const burst = output('burst');
  assert.ok(base > 0 && burst > 0, 'setup: both configurations must be shooting');
  const drift = Math.abs(burst - base) / base;
  assert.ok(drift < 0.08,
    `burst form is not power-neutral: ${Math.round(base)} vs ${Math.round(burst)} (${(100 * drift).toFixed(1)}% drift)`);
});

test('the form actually changes the rhythm — it is not a no-op', () => {
  // measure shot arrival: the salvo must be burstier than the even stream
  const gaps = form => {
    const G = rig(form);
    const e = spawnEnemy(G, 'boss', null, 700, 300);
    e.hp = e.maxHp = 1e12;
    const dt = 1 / 60;
    let last = 0, seen = 0;
    const intervals = [];
    for (let t = 0; t < 6; t += dt) {
      const before = G.S.bullets.length;
      updateWeapons(G, dt);
      G.S.time += dt;
      if (G.S.bullets.length > before) {
        if (seen++) intervals.push(t - last);
        last = t;
      }
    }
    return intervals;
  };
  const spread = xs => {
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
  };
  const evenSpread = spread(gaps(null));
  const burstSpread = spread(gaps('burst'));
  assert.ok(burstSpread > evenSpread * 2,
    `burst should arrive unevenly (spread ${burstSpread.toFixed(3)} vs even ${evenSpread.toFixed(3)})`);
});

test('a form card is offered only at max level, once, and costs no slot', () => {
  const meta = { ...defaultMeta(), tech: LATTICE.map(n => n.id) };
  const S = newRun(meta, 'bastion');
  const draw = (st, seed = 3, rounds = 400) => {
    const rng = mulberry32(seed);
    const out = new Set();
    for (let i = 0; i < rounds; i++) {
      for (const c of levelChoices(st, rng)) if (c.type === 'form') out.add(c.id);
    }
    return out;
  };
  assert.ok(!draw(S).has('burst'), 'form offered before the base weapon is mastered');
  S.weapons.bolt = WEAPONS.bolt.max;
  assert.ok(draw(S).has('burst'), 'form never offered despite a maxed base weapon');

  const owned = Object.values(S.weapons).filter(l => l > 0).length;
  applyChoice(S, { type: 'form', id: 'burst', of: 'bolt' });
  assert.equal(S.forms.bolt, 'burst', 'taking the card did not set the form');
  assert.equal(Object.values(S.weapons).filter(l => l > 0).length, owned,
    'taking a form consumed a weapon slot — forms are free');
  assert.ok(!draw(S).has('burst'), 'the active form was offered again');
});

test('an unlocked-but-unowned form stays out of a fresh account draft', () => {
  const S = newRun(defaultMeta(), 'bastion'); // no tech at all
  S.weapons.bolt = WEAPONS.bolt.max;
  const rng = mulberry32(9);
  for (let i = 0; i < 300; i++) {
    for (const c of levelChoices(S, rng)) {
      assert.notEqual(c.type, 'form', 'a form appeared without its lattice unlock');
    }
  }
});

// ---- Loadout visibility (core.md Forms: "rhythm is loot") ----
import { loadout } from '../src/core/state.js';

test('loadout() reports owned weapons, their level, and the form each wears', () => {
  const meta = { ...defaultMeta(), tech: LATTICE.map(n => n.id) };
  const S = newRun(meta, 'bastion');
  S.weapons.bolt = WEAPONS.bolt.max;
  S.weapons.orbit = 2;
  const before = loadout(S);
  const bolt = before.find(r => r.id === 'bolt');
  assert.ok(bolt, 'owned weapon missing from the loadout');
  assert.equal(bolt.isMax, true);
  assert.equal(bolt.form, null, 'no form worn yet');
  assert.ok(!before.some(r => r.lvl < 1), 'unowned weapons must not appear');

  applyChoice(S, { type: 'form', id: 'burst', of: 'bolt' });
  const after = loadout(S);
  const worn = after.find(r => r.id === 'bolt');
  assert.equal(worn.form, 'burst', 'the worn form is not reported');
  assert.equal(worn.formName, FORMS.burst.name, 'the form needs a display name');
  // and a weapon with no form is unaffected
  assert.equal(after.find(r => r.id === 'orbit').form, null);
});

test('the loadout signature changes when a form is taken', () => {
  // the in-fight weapons bar rebuilds only when this changes — before forms were
  // included, taking one mid-fight left the bar showing the old loadout forever
  const meta = { ...defaultMeta(), tech: LATTICE.map(n => n.id) };
  const S = newRun(meta, 'bastion');
  S.weapons.bolt = WEAPONS.bolt.max;
  const sig = l => l.map(r => `${r.id}${r.lvl}${r.form || ''}`).join('.');
  const before = sig(loadout(S));
  applyChoice(S, { type: 'form', id: 'burst', of: 'bolt' });
  assert.notEqual(sig(loadout(S)), before, 'the bar would never refresh');
});
