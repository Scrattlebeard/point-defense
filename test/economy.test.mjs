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

// DELETED 2026-07-26 (ADR-0015): 'in-run xp nodes stay legal — levelling speed is
// game power, not meta speed'. It asserted `LATTICE.some(n => n.effect.xpAdd)` and
// existed precisely to stop a future cleanup from removing the xp nodes by mistake.
// This removal is NOT a mistake and NOT a cleanup: in-run XP is gone entirely, the
// six nodes are retired with refunds, and Law·No-meta-accel's carve-out that blessed
// them is struck. Flagged as a LOOSENING per CLAUDE.md "Review protocol" — a guard
// was deleted, deliberately, and this comment is the argument it demanded.
test('the xp line is fully retired — no node grants levelling speed any more', () => {
  assert.ok(!LATTICE.some(n => n.effect.xpAdd), 'an xpAdd node survived ADR-0015');
  for (const id of ['study1', 'study2', 'study3', 'study4', 'enlighten', 'scholarsoldier']) {
    assert.ok(RETIRED_NODES[id] !== undefined, `${id} was removed without a refund`);
  }
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
