// The wave-40 regime change announces itself (core.md Introductions). Without a
// banner the gear change is invisible: the player meets a shape that is quietly
// several times harder with no way to know a rule changed rather than the dice
// going badly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, newRun } from '../src/core/state.js';
import { makeFx } from '../src/app/fx.js';
import { resetWeapons } from '../src/app/weapons/index.js';
import { resetWaveDirector } from '../src/app/game.js';
import { spawnEnemy } from '../src/app/enemies.js';
import { seedRandom } from './seed.mjs';

function makeG(wave = 45) {
  seedRandom(); // deterministic sim (test/seed.mjs)
  const meta = defaultMeta();
  const G = { W: 430, H: 900, cx: 215, cy: 450, S: newRun(meta, 'bastion'), fx: makeFx(), meta };
  resetWeapons(G);
  resetWaveDirector(G);
  G.S.wave = wave;
  // silence the ordinary debut banners so only the regime beat is under test
  G.S.introduced.enemies = new Set(['grunt', 'dart', 'tank', 'splitter', 'elite', 'boss']);
  G.S.introduced.variants = new Set(['swift', 'armored', 'regen', 'shielded', 'volatile']);
  G.fx.texts.length = 0;
  return G;
}

const banners = G => G.fx.texts.filter(t => t.center).map(t => t.str);

test('the first stacked shape announces the regime change', () => {
  const G = makeG();
  spawnEnemy(G, 'dart', ['armored', 'swift']);
  const b = banners(G);
  assert.equal(b.length, 1, `expected exactly one regime banner, got ${JSON.stringify(b)}`);
  assert.match(b[0], /COMPOUND/i);
});

test('it fires once per run, and a single modifier never triggers it', () => {
  const G = makeG();
  spawnEnemy(G, 'dart', ['armored']);        // one modifier: not a stack
  assert.deepEqual(banners(G), [], 'a lone modifier announced a regime change');
  spawnEnemy(G, 'grunt', ['regen', 'swift']); // first real stack
  assert.equal(banners(G).length, 1);
  spawnEnemy(G, 'tank', ['armored', 'regen', 'swift']); // and never again
  assert.equal(banners(G).length, 1, 'the regime change announced itself twice');
});

test('the banner carries the stacked specimen, not a bare shape', () => {
  const G = makeG();
  spawnEnemy(G, 'elite', ['armored', 'shielded']);
  const t = G.fx.texts.find(t => t.center && /COMPOUND/i.test(t.str));
  assert.ok(t.icon, 'no specimen icon on the regime banner');
  assert.ok(Array.isArray(t.icon.variants) && t.icon.variants.length >= 2,
    'the icon must wear the actual stack it is teaching');
});
