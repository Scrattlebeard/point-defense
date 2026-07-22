import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TECH } from '../src/core/config.js';
import { canBuy, buy, effectsOf } from '../src/core/tech.js';

test('tech tree integrity: unique ids, positive costs, resolvable prereqs', () => {
  const ids = TECH.map(n => n.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
  for (const n of TECH) {
    assert.ok(n.cost > 0, `${n.id} cost`);
    assert.ok(n.branch && n.name && n.desc, `${n.id} metadata`);
    for (const r of n.req) assert.ok(ids.includes(r), `${n.id} req ${r} missing`);
  }
});

test('every node is reachable (no prereq cycles)', () => {
  const owned = new Set();
  let progress = true;
  while (progress) {
    progress = false;
    for (const n of TECH) {
      if (!owned.has(n.id) && n.req.every(r => owned.has(r))) { owned.add(n.id); progress = true; }
    }
  }
  assert.equal(owned.size, TECH.length);
});

test('canBuy enforces shards, prereqs, and non-ownership', () => {
  const root = TECH.find(n => n.req.length === 0);
  const gated = TECH.find(n => n.req.length > 0);
  assert.equal(canBuy(root.id, [], root.cost), true);
  assert.equal(canBuy(root.id, [], root.cost - 1), false, 'insufficient shards');
  assert.equal(canBuy(root.id, [root.id], 9999), false, 'already owned');
  assert.equal(canBuy(gated.id, [], 9999), false, 'missing prereq');
  assert.equal(canBuy(gated.id, gated.req, 9999), true);
});

test('buy deducts shards and records the node', () => {
  const root = TECH.find(n => n.req.length === 0);
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
  assert.equal(base.xpMult, 1);
  assert.equal(base.cdMult, 1);
  assert.equal(base.dmgTakenMult, 1);
  assert.equal(base.salvageMult, 1);
  assert.equal(base.startLevel, 1);
  assert.equal(effectsOf(['vit1']).hpBonus, 20);
  assert.equal(effectsOf(['vit1', 'vit2']).hpBonus, 40);
  const dmg = effectsOf(['over1', 'over2']).dmgMult;
  assert.ok(Math.abs(dmg - 1.16) < 1e-9);
  assert.ok(effectsOf(['plate1']).dmgTakenMult < 1);
  assert.ok(effectsOf(['haste1']).cdMult < 1);
  assert.equal(effectsOf(['head']).startLevel, 2);
});

test('arsenal and tower nodes unlock into sets', () => {
  const fx = effectsOf(['tesla', 'tower_tempest']);
  assert.ok(fx.weapons.has('tesla'));
  assert.ok(fx.towers.has('tempest'));
  assert.ok(!fx.weapons.has('turret'));
  assert.ok(!fx.towers.has('lance'));
});
