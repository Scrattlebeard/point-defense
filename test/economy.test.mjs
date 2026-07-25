// The meta economy honours its own laws (core.md "The Lattice", GDD §6).
// Law·No-meta-accel: nothing purchasable may speed up meta-progression.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LATTICE, RETIRED_NODES } from '../src/core/config.js';
import { refundRetired, effectsOf } from '../src/core/tech.js';
import { defaultMeta } from '../src/core/state.js';

test('no node accelerates meta-progression (Law·No-meta-accel)', () => {
  // an income node is also an optimiser's no-brainer first buy, so it is never a
  // real choice — the focus law convicts it too
  const offenders = LATTICE.filter(n => n.effect.salvageAdd);
  assert.deepEqual(offenders.map(n => n.id), [],
    'a purchasable node speeds up meta-progression');
  assert.equal(effectsOf(LATTICE.map(n => n.id)).salvageMult, 1,
    'owning the whole lattice still must not multiply shard income');
});

test('in-run xp nodes stay legal — levelling speed is game power, not meta speed', () => {
  // the law's own parenthetical allows this; the test exists so a future cleanup
  // does not "fix" xp nodes by mistake
  assert.ok(LATTICE.some(n => n.effect.xpAdd), 'xp nodes were removed with the income line');
  assert.ok(effectsOf(LATTICE.map(n => n.id)).xpMult > 1);
});

test('retired nodes refund their shards exactly once', () => {
  const ids = Object.keys(RETIRED_NODES);
  assert.ok(ids.length > 0, 'nothing retired — this test has no subject');
  const owed = ids.reduce((s, id) => s + RETIRED_NODES[id], 0);
  const save = { ...defaultMeta(), shards: 40, tech: ['vit1', ...ids] };
  const migrated = refundRetired(save);
  assert.equal(migrated.shards, 40 + owed, 'refund did not match what was spent');
  assert.deepEqual(migrated.tech, ['vit1'], 'retired ids must be dropped');
  // idempotent: loading again must not pay twice
  assert.deepEqual(refundRetired(migrated), migrated);
});

test('a save with nothing retired is returned untouched', () => {
  const clean = { ...defaultMeta(), shards: 12, tech: ['vit1', 'over1'] };
  assert.equal(refundRetired(clean), clean, 'clean saves should not be rewritten');
});

test('retired ids are gone from the lattice but remembered for the refund', () => {
  const live = new Set(LATTICE.map(n => n.id));
  for (const id of Object.keys(RETIRED_NODES)) {
    assert.ok(!live.has(id), `${id} is retired but still purchasable`);
  }
});

test('every node is still reachable after the retirement', () => {
  // a prereq pointing at a retired node would strand a whole branch
  const live = new Set(LATTICE.map(n => n.id));
  for (const n of LATTICE) {
    for (const r of n.req) {
      assert.ok(live.has(r), `${n.id} requires ${r}, which no longer exists`);
    }
  }
});
