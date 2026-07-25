// The lattice authors the draft (core.md "Generic cards", GDD §6). The generic
// pool was a hard-coded four-entry object every draft received unconditionally —
// so the meta layer's headline principle ("the account changes what cards EXIST,
// not just how big they are") had no mechanism behind it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, newRun, levelChoices, applyChoice } from '../src/core/state.js';
import { GENERICS, LATTICE } from '../src/core/config.js';
import { effectsOf } from '../src/core/tech.js';
import { mulberry32 } from '../src/core/rng.js';

const run = (tech = []) => newRun({ ...defaultMeta(), tech }, 'bastion');

/** Every generic id offered across many draws. */
function offeredGenerics(S, seed = 5, rounds = 500) {
  const rng = mulberry32(seed);
  const seen = new Set();
  for (let i = 0; i < rounds; i++) {
    for (const c of levelChoices(S, rng)) if (c.type === 'generic') seen.add(c.id);
  }
  return seen;
}

test('a tech-locked generic is absent from a fresh account draft', () => {
  const locked = Object.keys(GENERICS).filter(id => GENERICS[id].techLock);
  assert.ok(locked.length > 0, 'no lattice-authored generic exists — the seam is unused');
  const seen = offeredGenerics(run());
  for (const id of locked) {
    assert.ok(!seen.has(id), `${id} was offered without its unlock`);
  }
});

test('unlocking the node injects the card into the pool', () => {
  const S = run(['over1', 'prec']);
  assert.ok(offeredGenerics(S).has('crit'),
    'the crit card never appeared despite owning Precision (GDD §7 canonical draft)');
});

test('the always-on generics need no unlock', () => {
  const seen = offeredGenerics(run());
  for (const id of ['bulkhead', 'overclock', 'coolant']) {
    assert.ok(seen.has(id), `${id} should always be draftable`);
  }
});

test('some lattice node actually authors the pool', () => {
  const authors = LATTICE.filter(n => n.effect.unlockGeneric);
  assert.ok(authors.length > 0, 'no node injects a card type — GDD §6 has no mechanism');
  for (const n of authors) {
    assert.ok(GENERICS[n.effect.unlockGeneric], `${n.id} unlocks a card that does not exist`);
  }
  // and the seam is reflected in the aggregated effects
  assert.ok(effectsOf(['over1', 'prec']).generics.has('crit'));
});

test('taking the crit card raises crit chance, and it stacks within a run', () => {
  const S = run(['over1', 'prec']);
  const before = S.critChance;
  applyChoice(S, { type: 'generic', id: 'crit' });
  const once = S.critChance;
  assert.ok(once > before, 'crit card did nothing');
  applyChoice(S, { type: 'generic', id: 'crit' });
  assert.ok(S.critChance > once, 'crit card should stack within a run');
});

test('crit is bought as a card, not handed over as a passive', () => {
  // the point of the change: meta progression pays in richer decks, not bigger
  // constants. Owning Precision alone must not silently grant crit chance.
  assert.equal(run(['over1', 'prec']).critChance, 0,
    'Precision still grants flat crit — it should buy the card instead');
});
