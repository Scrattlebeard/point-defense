// Boss signature moves (core.md Enemies "Boss signature moves"). Law·Bosses says
// a boss is a focus-forcer; a threat that only rams differs from the last one by
// an HP number. Decisions live in the BOSS_MOVES table, execution in the shell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_MOVES, BOSS_NAMES } from '../src/core/config.js';
import { defaultMeta, newRun } from '../src/core/state.js';
import { makeFx } from '../src/app/fx.js';
import { resetWeapons } from '../src/app/weapons/index.js';
import { resetWaveDirector, updateGame } from '../src/app/game.js';
import { spawnEnemy } from '../src/app/enemies.js';

function makeG(wave) {
  const meta = defaultMeta();
  const G = { W: 430, H: 900, cx: 215, cy: 450, S: newRun(meta, 'bastion'), fx: makeFx(), meta };
  resetWeapons(G);
  resetWaveDirector(G);
  G.S.weapons.bolt = 0;   // nothing shoots back; the boss is the subject
  G.wd.phase = 'clear';   // no wave traffic
  G.S.wave = wave;
  G.S.maxHp = G.S.hp = 1e9; // the player is not the subject
  return G;
}
const step = (G, secs) => { for (let i = 0; i < secs * 60; i++) updateGame(G, 1 / 60); };

test('every move names a real boss, and moves are the minority for now', () => {
  for (const name of Object.keys(BOSS_MOVES)) {
    assert.ok(BOSS_NAMES.includes(name), `${name} is not a boss`);
  }
  assert.ok(Object.keys(BOSS_MOVES).length >= 1, 'no boss has a signature move');
  assert.ok(Object.keys(BOSS_MOVES).length < BOSS_NAMES.length,
    'every boss has a move — the unbuilt ones should stay honestly unbuilt');
});

test('Sir Cumference shakes adds out of his sides (GDD §3, verbatim)', () => {
  const G = makeG(40);            // recirculated: moves are live
  const boss = spawnEnemy(G, 'boss', null);
  boss.moveId = 'adds';
  boss.spd = 0;
  const before = G.S.enemies.length;
  step(G, 8);
  const after = G.S.enemies.filter(e => !e.dead).length;
  assert.ok(after > before, `no adds spawned (${before} → ${after})`);
});

test('The Obtuse One surges when wounded — a hurt boss is a faster boss', () => {
  const G = makeG(40);
  const boss = spawnEnemy(G, 'boss', null);
  boss.moveId = 'surge';
  const healthy = boss.spd;
  step(G, 0.5);
  assert.ok(Math.abs(boss.spd - healthy) < 1, 'a healthy boss must not be surging');
  boss.hp = boss.maxHp * 0.2;     // below the threshold
  step(G, 0.5);
  assert.ok(boss.spd > healthy * 1.3, `wounded boss did not surge (${healthy} → ${boss.spd})`);
});

test('the wave-5 noble stays a clean ram — one thing at a time', () => {
  // A PACING choice, not a balance one: measured, moves from the first appearance
  // leave the fresh-run median at 8, in band. The first boss fight teaches what a
  // boss IS; every one after it teaches what a boss can DO.
  const G = makeG(5);
  const boss = spawnEnemy(G, 'boss', null);
  boss.spd = 0;
  const before = G.S.enemies.length;
  step(G, 10);
  assert.equal(G.S.enemies.filter(e => !e.dead).length, before,
    'the first boss spawned adds — signature moves start at wave 10');
});
