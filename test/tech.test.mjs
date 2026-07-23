// The Lattice (core.md, ADR-0003 stage 1): graph invariants, purchase rules,
// effect aggregation. Structure is pinned; exact node content is tuning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LATTICE } from '../src/core/config.js';
import { canBuy, buy, effectsOf } from '../src/core/tech.js';

const SECTORS = ['Hull', 'Arms', 'Mind', 'Salvage', 'Arsenal', 'Towers'];
const RING_MIN_COST = { 1: 10, 2: 30, 3: 70, 4: 200, 5: 500 };

test('lattice integrity: unique ids, sectors, rings 1-5, resolvable prereqs', () => {
  const ids = LATTICE.map(n => n.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
  for (const n of LATTICE) {
    assert.ok(n.cost > 0, `${n.id} cost`);
    assert.ok(SECTORS.includes(n.sector), `${n.id} sector "${n.sector}"`);
    assert.ok(n.ring >= 1 && n.ring <= 5, `${n.id} ring`);
    assert.ok(n.name && n.desc, `${n.id} metadata`);
    for (const r of n.req) assert.ok(ids.includes(r), `${n.id} req ${r} missing`);
    if (n.reqMode) assert.equal(n.reqMode, 'any', `${n.id} reqMode`);
  }
});

test('the lattice is LARGE: meaningfully deeper than the old 24-node tree', () => {
  assert.ok(LATTICE.length >= 55, `only ${LATTICE.length} nodes`);
  for (let ring = 1; ring <= 5; ring++) {
    assert.ok(LATTICE.some(n => n.ring === ring), `ring ${ring} empty`);
  }
});

test('escalating costs: every node respects its ring cost floor', () => {
  for (const n of LATTICE) {
    assert.ok(n.cost >= RING_MIN_COST[n.ring],
      `${n.id} (ring ${n.ring}) costs ${n.cost} < floor ${RING_MIN_COST[n.ring]}`);
  }
});

test('every node is reachable (any-mode edges honored, no dead branches)', () => {
  const owned = new Set();
  let progress = true;
  const satisfied = n => n.reqMode === 'any'
    ? (n.req.length === 0 || n.req.some(r => owned.has(r)))
    : n.req.every(r => owned.has(r));
  while (progress) {
    progress = false;
    for (const n of LATTICE) {
      if (!owned.has(n.id) && satisfied(n)) { owned.add(n.id); progress = true; }
    }
  }
  assert.equal(owned.size, LATTICE.length,
    `unreachable: ${LATTICE.filter(n => !owned.has(n.id)).map(n => n.id).join(', ')}`);
});

test('legacy node ids survive so old saves keep their purchases', () => {
  const ids = new Set(LATTICE.map(n => n.id));
  for (const legacy of ['vit1', 'vit2', 'plate1', 'nano1', 'over1', 'prec', 'haste1',
    'study1', 'head', 'salv1', 'tesla', 'seek', 'turret',
    'tower_tempest', 'tower_warden', 'tower_lance']) {
    assert.ok(ids.has(legacy), `legacy id ${legacy} dropped — save migration broken`);
  }
});

test('cross-links exist: at least 4 any-mode nodes weave the web', () => {
  const links = LATTICE.filter(n => n.reqMode === 'any' && n.req.length >= 2);
  assert.ok(links.length >= 4, `only ${links.length} cross-links`);
});

test('canBuy enforces shards, prereqs (all + any modes), non-ownership', () => {
  const root = LATTICE.find(n => n.req.length === 0);
  const gated = LATTICE.find(n => n.req.length > 0 && n.reqMode !== 'any');
  const anyN = LATTICE.find(n => n.reqMode === 'any' && n.req.length >= 2);
  assert.equal(canBuy(root.id, [], root.cost), true);
  assert.equal(canBuy(root.id, [], root.cost - 1), false, 'insufficient shards');
  assert.equal(canBuy(root.id, [root.id], 99999), false, 'already owned');
  assert.equal(canBuy(gated.id, [], 99999), false, 'missing prereq');
  assert.equal(canBuy(gated.id, gated.req, 99999), true);
  assert.equal(canBuy(anyN.id, [], 99999), false, 'any-node with nothing owned');
  assert.equal(canBuy(anyN.id, [anyN.req[0]], 99999), true, 'any-node with ONE req owned');
  assert.equal(canBuy(anyN.id, [anyN.req[1]], 99999), true, 'any-node with the OTHER req owned');
});

test('buy deducts shards and records the node', () => {
  const root = LATTICE.find(n => n.req.length === 0);
  const meta = { shards: root.cost + 5, tech: [] };
  const after = buy(root.id, meta);
  assert.equal(after.shards, 5);
  assert.ok(after.tech.includes(root.id));
  assert.equal(meta.tech.length, 0, 'input meta not mutated');
});

test('effectsOf aggregates stat nodes additively', () => {
  const base = effectsOf([]);
  assert.equal(base.hpBonus, 0);
  assert.equal(base.dmgMult, 1);
  assert.equal(base.startLevel, 1);
  assert.equal(effectsOf(['vit1']).hpBonus, 20);
  assert.equal(effectsOf(['vit1', 'vit2']).hpBonus, 40);
  assert.ok(effectsOf(['plate1']).dmgTakenMult < 1);
  assert.ok(effectsOf(['haste1']).cdMult < 1);
  assert.equal(effectsOf(['head']).startLevel, 2);
});

test('arsenal and tower nodes unlock into sets — including mine and mortar', () => {
  const fx = effectsOf(['tesla', 'mine', 'mortar', 'tower_tempest']);
  assert.ok(fx.weapons.has('tesla'));
  assert.ok(fx.weapons.has('mine'));
  assert.ok(fx.weapons.has('mortar'));
  assert.ok(fx.towers.has('tempest'));
  assert.ok(!fx.weapons.has('turret'));
});
