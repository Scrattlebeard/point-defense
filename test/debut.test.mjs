// Guaranteed variant debuts (core.md Introductions: "a debut is guaranteed, not
// hoped for"). A tutorial beat that fires "usually" is not a tutorial beat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeWave } from '../src/core/waves.js';
import { VARIANTS } from '../src/core/config.js';
import { mulberry32 } from '../src/core/rng.js';
import { defaultMeta, newRun } from '../src/core/state.js';
import { makeFx, updateFx } from '../src/app/fx.js';
import { resetWeapons } from '../src/app/weapons/index.js';
import { resetWaveDirector, updateGame } from '../src/app/game.js';
import { seedRandom } from './seed.mjs';

test('every variant is marked for debut on exactly its own wave', () => {
  for (const [id, v] of Object.entries(VARIANTS)) {
    const plan = composeWave(v.minWave, mulberry32(v.minWave * 7));
    assert.equal(plan.debutVariant, id, `wave ${v.minWave} should debut ${id}`);
    assert.ok(Number.isInteger(plan.debutAt), `${id}: no spawn chosen`);
    assert.ok(plan.debutAt >= 0 && plan.debutAt < plan.spawns.length, `${id}: index out of range`);
    assert.notEqual(plan.spawns[plan.debutAt], 'boss', `${id}: a boss cannot carry a debut`);
  }
});

test('waves that debut nothing say so', () => {
  const debutWaves = new Set(Object.values(VARIANTS).map(v => v.minWave));
  for (const w of [1, 5, 7, 12, 25, 40]) {
    if (debutWaves.has(w)) continue;
    assert.equal(composeWave(w, mulberry32(w)).debutVariant, null, `wave ${w} invented a debut`);
  }
});

test('the debut is deterministic under a seeded rng, like the rest of the plan', () => {
  const a = composeWave(6, mulberry32(3));
  const b = composeWave(6, mulberry32(3));
  assert.equal(a.debutVariant, b.debutVariant);
  assert.equal(a.debutAt, b.debutAt);
});

test('a debut specimen wears exactly one modifier — teach one thing at a time', () => {
  for (let seed = 0; seed < 30; seed++) {
    seedRandom(seed);
    const meta = defaultMeta();
    const G = { W: 430, H: 900, cx: 215, cy: 450, S: newRun(meta, 'bastion'), fx: makeFx(), meta };
    G.S.weapons.bolt = 0; // nothing dies, so every spawn stays inspectable
    resetWeapons(G);
    resetWaveDirector(G);
    G.S.wave = 5; // the director will start wave 6 next
    // wave 6 emits ~50 spawns at ~0.8s apart, so the whole wave takes ~40s to
    // ARRIVE; a shorter window can finish before a late debut index is reached
    for (let i = 0; i < 60 * 120 && G.S.wave < 7; i++) updateGame(G, 1 / 60);
    const swifts = G.S.enemies.filter(e => e.variants.includes('swift'));
    assert.ok(swifts.length >= 1, `seed ${seed}: wave 6 produced no swift at all`);
    const debut = swifts[0];
    assert.equal(debut.variants.length, 1, `seed ${seed}: the debut specimen was stacked`);
  }
});

test('the guarantee is a floor, not a cap — the variant may still roll elsewhere', () => {
  // pinning "exactly one swift per debut wave" would be wrong: the ordinary roll
  // still applies to every other spawn
  const plan = composeWave(6, mulberry32(11));
  assert.ok(plan.spawns.length > 1, 'setup');
  assert.equal(typeof plan.debutAt, 'number');
});
