// Weapon taxonomy + slot budget (ADR-0006, corrected by ADR-0007; core.md
// "Taxonomy" / "The slot budget"). Two orthogonal axes on every weapon —
// input (how you drive it) and category (what it costs the build) — and the
// budget: ≤ 6 weapons, ≤ 1 gun, ≤ 1 hold, ≤ 1 swipe, autos capped only by the
// total. Deliberately NOT pinned here: "every tower has a gun" — the gun slot
// may sit empty (ADR-0007 Decision 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, TOWERS, SLOT_BUDGET, chipOf } from '../src/core/config.js';
import { defaultMeta, newRun, levelChoices } from '../src/core/state.js';
import { mulberry32 } from '../src/core/rng.js';

const INPUTS = ['aim', 'hold', 'swipe', 'none'];
const CATEGORIES = ['gun', 'hold', 'swipe', 'auto'];

/** Draw many times; return the set of weapon ids ever offered as NEW (lvl 0). */
function offeredNew(S, seed = 7, rounds = 400) {
  const rng = mulberry32(seed);
  const seen = new Set();
  for (let i = 0; i < rounds; i++) {
    for (const c of levelChoices(S, rng)) {
      if (c.type === 'weapon' && c.lvl === 0) seen.add(c.id);
    }
  }
  return seen;
}

test('every weapon declares the two axes, and only the two axes', () => {
  for (const [id, w] of Object.entries(WEAPONS)) {
    assert.ok(INPUTS.includes(w.input), `${id}: bad input '${w.input}'`);
    assert.ok(CATEGORIES.includes(w.category), `${id}: bad category '${w.category}'`);
    // the collapsed triple must not linger — a half-migrated weapon would
    // silently dodge the budget
    for (const dead of ['kind', 'slot', 'tag', 'gesture']) {
      assert.equal(w[dead], undefined, `${id} still carries '${dead}'`);
    }
  }
});

test('the chip is a display of input, not category (ADR-0006 Decision 1)', () => {
  assert.equal(chipOf(WEAPONS.bolt), 'AIM');
  assert.equal(chipOf(WEAPONS.beam), 'HOLD');
  assert.equal(chipOf(WEAPONS.wall), 'SWIPE');
  assert.equal(chipOf(WEAPONS.orbit), 'AUTO');
  // the interesting case: an auto that reads the aim wears the AIM chip
  assert.equal(chipOf(WEAPONS.boomer), 'AIM');
  assert.equal(WEAPONS.boomer.category, 'auto');
});

test('Decision 7 roster assignments: guns, holds, swipes, the boomer demotion', () => {
  for (const id of ['bolt', 'scatter', 'heavy']) {
    assert.equal(WEAPONS[id].category, 'gun', `${id} is a gun`);
  }
  for (const id of ['beam', 'flame', 'meteor']) {
    assert.equal(WEAPONS[id].category, 'hold', `${id} is a hold`);
  }
  for (const id of ['wall', 'blades']) {
    assert.equal(WEAPONS[id].category, 'swipe', `${id} is a swipe`);
  }
  for (const id of ['orbit', 'nova', 'frost', 'tesla', 'seek', 'turret', 'mine',
    'mortar', 'catapult', 'caltrop', 'cascade', 'boomer']) {
    assert.equal(WEAPONS[id].category, 'auto', `${id} is an auto`);
  }
});

// ('burst is the demoted form of bolt' MOVED to test/forms.test.mjs, 2026-07-25 —
// burst stopped being an interim slot-costing weapon and became a real form, so
// the behaviour it pinned is now the form contract: offered only at max base
// level, costing no slot, and power-neutral.)

test('budget: at 6 owned weapons no new weapon is offered; upgrades continue', () => {
  const S = newRun(defaultMeta(), 'bastion');
  for (const id of ['orbit', 'nova', 'frost', 'tesla', 'seek']) S.weapons[id] = 1;
  // bolt (from the tower) + 5 autos = 6/6
  for (const id of ['tesla', 'seek', 'turret']) S.pool.add(id);
  const seen = offeredNew(S);
  assert.equal(seen.size, 0, `full build was offered new weapons: ${[...seen]}`);
  // upgrades to owned weapons must still flow
  const rng = mulberry32(3);
  let upgrades = 0;
  for (let i = 0; i < 50; i++) {
    upgrades += levelChoices(S, rng).filter(c => c.type === 'weapon').length;
  }
  assert.ok(upgrades > 0, 'a full build must still be offered upgrades');
});

test('gun ceiling: owning any gun locks the other guns out of the draft', () => {
  const S = newRun(defaultMeta(), 'bastion'); // bolt L2 — the gun slot is held
  for (const id of ['scatter', 'heavy']) S.pool.add(id);
  const seen = offeredNew(S);
  assert.ok(!seen.has('scatter') && !seen.has('heavy'),
    'a second gun was offered while bolt holds the slot');
});

test('the gun slot may sit empty — and an empty slot still offers guns (ADR-0007)', () => {
  const S = newRun(defaultMeta(), 'bastion');
  S.weapons.bolt = 0; // a gunless run is legal, not an error
  for (const id of ['scatter', 'heavy']) S.pool.add(id);
  const seen = offeredNew(S);
  assert.ok(seen.has('scatter') && seen.has('heavy'),
    'an empty gun slot must offer gun candidates');
});

test('autos have no cap of their own: they fill what the budget leaves', () => {
  const S = newRun(defaultMeta(), 'bastion'); // bolt + wall/beam/frost/orbit/nova in pool
  S.weapons.beam = 1;
  S.weapons.wall = 1;
  S.weapons.orbit = 1;
  S.weapons.nova = 1; // 5/6 owned: gun+hold+swipe+2 autos
  assert.ok(offeredNew(S).has('frost'), 'a 4th auto must be offered at 5/6');
  S.weapons.frost = 1; // 6/6
  S.pool.add('tesla');
  assert.ok(!offeredNew(S).has('tesla'), 'a 5th auto offered past the budget');
});

test('every tower loadout respects the budget and its ceilings — nothing more', () => {
  // ADR-0007: the invariant worth pinning is the budget, never "has a gun".
  for (const [tid, t] of Object.entries(TOWERS)) {
    const ids = Object.keys(t.start);
    assert.ok(ids.length <= SLOT_BUDGET.total, `${tid} starts over budget`);
    const counts = {};
    for (const wid of ids) {
      const cat = WEAPONS[wid].category;
      counts[cat] = (counts[cat] || 0) + 1;
      if (SLOT_BUDGET[cat]) {
        assert.ok(counts[cat] <= SLOT_BUDGET[cat],
          `${tid} starts ${counts[cat]} ${cat} weapons (ceiling ${SLOT_BUDGET[cat]})`);
      }
    }
  }
});
