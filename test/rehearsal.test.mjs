// Rehearsal: start wave + starting weapon (ADR-0018). Playtest surface today,
// unbuilt lattice nodes being used early — so these tests pin the RUN PARAMETERS,
// which survive the graduation, not the menu, which does not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, newRun, payout, addScore, evalAchievements } from '../src/core/state.js';
import { WEAPONS, TOWERS } from '../src/core/config.js';

test('no rehearsal parameters: a run is exactly what it always was', () => {
  const plain = newRun(defaultMeta(), 'bastion');
  const explicit = newRun(defaultMeta(), 'bastion', {});
  assert.equal(plain.wave, explicit.wave);
  assert.equal(plain.lvl, explicit.lvl);
  assert.equal(plain.weapons.bolt, explicit.weapons.bolt);
  assert.ok(!plain.rehearsal, 'a normal run must not be flagged');
});

test('startWave opens on that wave at that level, with the picks banked', () => {
  // ADR-0016 made level == wave; ADR-0018 keeps the two locked together so a
  // rehearsal at wave 12 is a genuine wave-12 player, not a level-1 tourist.
  for (const w of [1, 5, 12, 30]) {
    const S = newRun(defaultMeta(), 'bastion', { startWave: w });
    assert.equal(S.lvl, w, `wave ${w} should open at level ${w}`);
    assert.equal(S.pendingLevels, w - 1, 'the picks are banked, not auto-assigned');
    // the director increments into the wave on its first tick
    assert.equal(S.wave, w - 1, 'director must land on the requested wave');
  }
});

test('startWeapon replaces bolt at bolt\'s level, and joins the pool', () => {
  const S = newRun(defaultMeta(), 'bastion', { startWeapon: 'flame' });
  assert.equal(S.weapons.bolt, 0, 'bolt must be gone — ADR-0007 allows a bolt-less loadout');
  assert.equal(S.weapons.flame, TOWERS.bastion.start.bolt, 'the swap keeps bolt\'s level');
  assert.ok(S.pool.has('flame'), 'the chosen weapon must be levellable');
});

test('startWeapon leaves the tower\'s OTHER starters alone', () => {
  // Lance is its beam; only its bolt is being swapped out.
  const S = newRun(defaultMeta(), 'lance', { startWeapon: 'flame' });
  assert.equal(S.weapons.beam, TOWERS.lance.start.beam, 'lance must keep its beam');
  assert.equal(S.weapons.bolt, 0);
  assert.ok(S.weapons.flame > 0);
});

test('tech locks are ignored on purpose — the locked weapons are the ones needing a pass', () => {
  const locked = Object.keys(WEAPONS).find(id => WEAPONS[id].techLock);
  assert.ok(locked, 'setup: expected at least one tech-locked weapon');
  const S = newRun(defaultMeta(), 'bastion', { startWeapon: locked });
  assert.ok(S.weapons[locked] > 0, `${locked} is locked, but a rehearsal must still field it`);
});

// The risky half of ADR-0018: a missed guard here is silent and shows up weeks
// later as a corrupted `best`. Tested directly rather than by inspection.
test('a rehearsal run pays no shards and sets no best', () => {
  const meta = { ...defaultMeta(), shards: 7, best: 3 };
  const S = newRun(meta, 'bastion', { startWave: 25 });
  S.kills = 500; S.bossKills = 5; S.wave = 27;
  const { meta: after, earned } = payout(S, meta);
  assert.equal(earned, 0, 'a wave-25 opening must not pay for waves it did not survive');
  assert.equal(after.shards, 7, 'shards moved');
  assert.equal(after.best, 3, 'best was overwritten by a run that started past it');
  assert.equal(after.totalKills, meta.totalKills || 0, 'lifetime counters moved');
});

test('a rehearsal run writes no score row and unlocks no achievements', () => {
  const meta = { ...defaultMeta(), scores: [], ach: [] };
  const S = newRun(meta, 'bastion', { startWave: 20 });
  S.wave = 22; S.kills = 900; S.lvl = 22;
  assert.equal(addScore(meta, { wave: S.wave, kills: S.kills, rehearsal: true }).rank, 0,
    'a rehearsal placed on the leaderboard');
  assert.deepEqual(evalAchievements(meta, S).meta.ach, meta.ach,
    'a rehearsal unlocked achievements');
});

test('a NORMAL run still pays, records and unlocks', () => {
  // the guard must be narrow: it would be easy to void every run by accident
  const meta = { ...defaultMeta(), shards: 7, best: 3 };
  const S = newRun(meta, 'bastion');
  S.kills = 200; S.bossKills = 2; S.wave = 9;
  const { meta: after, earned } = payout(S, meta);
  assert.ok(earned > 0, 'a real run must still pay');
  assert.equal(after.best, 9, 'a real run must still set best');
  assert.equal(addScore(meta, { wave: 9, kills: 200 }).rank, 1, 'a real run must still place');
});
