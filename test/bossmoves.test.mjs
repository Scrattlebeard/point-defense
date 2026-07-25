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
import { spawnEnemy, damageEnemy } from '../src/app/enemies.js';
import { seedRandom } from './seed.mjs';

function makeG(wave) {
  seedRandom(); // deterministic sim (test/seed.mjs)
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

// 2026-07-25, Daniel's first playtest: waves 30 and 35 are bossIdx 5 and 6 —
// Marquis de Sides and The Final Vertex, the two names furthest down the unbuilt
// list. "A single boss attack racing against their hp bar" was a correct report
// of a structural gap, not a tuning complaint.
const bossOf = G => G.S.enemies.find(e => e.kind === 'boss' && !e.dead);

function spawnBossWithMove(wave, name) {
  const G = makeG(wave);
  spawnEnemy(G, 'boss');
  const b = bossOf(G);
  b.moveId = BOSS_MOVES[name].id;
  return { G, b };
}

test('the two bosses Daniel fought at waves 30 and 35 now have moves', () => {
  // The mapping is the finding: bossIdx = wave/5 - 1, and both were ram-only.
  assert.equal(BOSS_NAMES[5], 'MARQUIS DE SIDES');
  assert.equal(BOSS_NAMES[6], 'THE FINAL VERTEX');
  assert.ok(BOSS_MOVES['MARQUIS DE SIDES'], 'wave 30 boss has a move');
  assert.ok(BOSS_MOVES['THE FINAL VERTEX'], 'wave 35 boss has a move');
});

test('sunder: shards appear at the threshold and the boss is guarded while they live', () => {
  const { G, b } = spawnBossWithMove(30, 'MARQUIS DE SIDES');
  const before = G.S.enemies.length;
  step(G, 1);
  assert.equal(b.guard ?? 1, 1, 'unwounded boss takes full damage');
  assert.equal(G.S.enemies.length, before, 'and has not shed anything yet');

  b.hp = b.maxHp * 0.5; // cross the threshold
  step(G, 0.5);
  const shards = G.S.enemies.filter(e => e.wardOf === b.wardToken && !e.dead);
  assert.ok(shards.length > 0, 'crossing 55% sheds shards');
  assert.ok(b.guard < 1, 'and the boss is guarded while they live');

  for (const s of shards) s.dead = true;
  step(G, 0.5);
  assert.equal(b.guard, 1, 'clearing the shards re-opens the boss');
});

test('sunder fires once, not every time the boss dips', () => {
  const { G, b } = spawnBossWithMove(30, 'MARQUIS DE SIDES');
  b.hp = b.maxHp * 0.5;
  step(G, 0.5);
  const n = G.S.enemies.filter(e => e.wardOf === b.wardToken).length;
  for (const e of G.S.enemies) if (e.wardOf === b.wardToken) e.dead = true;
  b.hp = b.maxHp * 0.2;
  step(G, 2);
  const again = G.S.enemies.filter(e => e.wardOf === b.wardToken && !e.dead).length;
  assert.equal(again, 0, `sunder must not re-trigger (shed ${n} once)`);
});

test('bulwark: the boss cycles between open and planted, and stops while planted', () => {
  const { G, b } = spawnBossWithMove(35, 'THE FINAL VERTEX');
  const seen = new Set();
  let stoppedWhileGuarded = true;
  for (let i = 0; i < 60 * 25; i++) {
    updateGame(G, 1 / 60);
    if (b.dead) break;
    const guarded = (b.guard ?? 1) < 1;
    seen.add(guarded);
    if (guarded && b.spd !== 0) stoppedWhileGuarded = false;
  }
  assert.ok(seen.has(true), 'it plants at some point');
  assert.ok(seen.has(false), 'and it re-opens — the window is not permanent');
  assert.ok(stoppedWhileGuarded, 'a planted boss does not advance: the window is a trade, not a punishment');
});

test('a guarded boss takes reduced damage, and the ledger records what landed', () => {
  const { G, b } = spawnBossWithMove(35, 'THE FINAL VERTEX');
  b.guard = 0.25;
  const hp0 = b.hp;
  const dealt = damageEnemy(G, b, 1000, { noMult: true, src: 'bolt' });
  assert.ok(dealt < 1000, 'the guard bites');
  assert.equal(Math.round(hp0 - b.hp), Math.round(dealt), 'hp lost equals damage reported');
  assert.equal(Math.round(G.S.dmgBy.bolt), Math.round(dealt),
    'attribution records the damage actually dealt, not the damage attempted');
});
