import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, newRun, addXp, levelChoices, applyChoice, payout, addScore, evalAchievements } from '../src/core/state.js';
import { xpForLevel } from '../src/core/balance.js';
import { WEAPONS } from '../src/core/config.js';
import { mulberry32 } from '../src/core/rng.js';

test('bastion baseline: 100 hp, bolt L2, level 1', () => {
  const S = newRun(defaultMeta(), 'bastion');
  assert.equal(S.maxHp, 100);
  assert.equal(S.hp, 100);
  assert.equal(S.weapons.bolt, 2);
  assert.equal(S.lvl, 1);
  assert.equal(S.xpNext, xpForLevel(1));
  assert.equal(S.pendingLevels, 0);
});

test('tower profiles apply: warden is tanky and starts nova, lance starts beam', () => {
  const w = newRun(defaultMeta(), 'warden');
  assert.equal(w.maxHp, 130);
  assert.equal(w.weapons.nova, 1);
  assert.equal(w.weapons.bolt, 1);
  const l = newRun(defaultMeta(), 'lance');
  assert.equal(l.weapons.beam, 1);
  assert.ok(l.dmgMult > 1);
});

test('tech effects fold into the run', () => {
  const meta = { ...defaultMeta(), tech: ['vit1', 'over1', 'head'] };
  const S = newRun(meta, 'bastion');
  assert.equal(S.maxHp, 120);
  assert.ok(Math.abs(S.dmgMult - 1.08) < 1e-9);
  assert.equal(S.lvl, 2);
  assert.equal(S.pendingLevels, 1, 'head start grants a free pick');
});

test('addXp levels up across thresholds and reports the count', () => {
  const S = newRun(defaultMeta(), 'bastion');
  const need = xpForLevel(1);
  assert.equal(addXp(S, need - 1), 0);
  assert.equal(addXp(S, 1), 1);
  assert.equal(S.lvl, 2);
  const burst = xpForLevel(2) + xpForLevel(3);
  assert.equal(addXp(S, burst), 2);
  assert.equal(S.lvl, 4);
});

test('xp multiplier from tech applies', () => {
  const meta = { ...defaultMeta(), tech: ['study1'] };
  const S = newRun(meta, 'bastion');
  addXp(S, xpForLevel(1) / 1.1 + 0.01);
  assert.equal(S.lvl, 2);
});

test('levelChoices: three distinct options, tech-locked weapons excluded', () => {
  const S = newRun(defaultMeta(), 'bastion');
  for (let seed = 0; seed < 40; seed++) {
    const cs = levelChoices(S, mulberry32(seed));
    assert.equal(cs.length, 3);
    assert.equal(new Set(cs.map(c => c.id)).size, 3);
    for (const c of cs) {
      if (c.type === 'weapon') {
        assert.ok(!WEAPONS[c.id].techLock, `${c.id} is tech-locked`);
      }
    }
  }
});

test('levelChoices: unlocked arsenal weapons can appear', () => {
  const meta = { ...defaultMeta(), tech: ['tesla'] };
  const S = newRun(meta, 'bastion');
  let seen = false;
  for (let seed = 0; seed < 200 && !seen; seed++) {
    seen = levelChoices(S, mulberry32(seed)).some(c => c.id === 'tesla');
  }
  assert.ok(seen, 'tesla never offered despite unlock');
});

test('levelChoices: repair only offered when hurt; maxed weapons drop out', () => {
  const S = newRun(defaultMeta(), 'bastion');
  for (let seed = 0; seed < 60; seed++) {
    assert.ok(!levelChoices(S, mulberry32(seed)).some(c => c.id === 'repair'), 'repair at full hp');
  }
  for (const id of Object.keys(S.weapons)) S.weapons[id] = WEAPONS[id].max;
  for (let seed = 0; seed < 20; seed++) {
    const cs = levelChoices(S, mulberry32(seed));
    assert.equal(cs.length, 3);
    assert.ok(cs.every(c => c.type === 'generic'), 'only generics remain when maxed');
  }
});

test('applyChoice: weapon levels up, generics do what they say', () => {
  const S = newRun(defaultMeta(), 'bastion');
  applyChoice(S, { type: 'weapon', id: 'orbit' });
  assert.equal(S.weapons.orbit, 1);
  const d0 = S.dmgMult;
  applyChoice(S, { type: 'generic', id: 'overclock' });
  assert.ok(Math.abs(S.dmgMult - (d0 + 0.1)) < 1e-9);
  const hp0 = S.maxHp;
  applyChoice(S, { type: 'generic', id: 'bulkhead' });
  assert.equal(S.maxHp, hp0 + 25);
  S.hp = 10;
  applyChoice(S, { type: 'generic', id: 'repair' });
  assert.ok(Math.abs(S.hp - (10 + 0.4 * S.maxHp)) < 1e-9);
});

test('meta tracks sightings: empty by default, preserved through payout', () => {
  const m = defaultMeta();
  assert.deepEqual(m.seen, { enemies: [], variants: [] });
  const S = newRun(m, 'bastion');
  m.seen.enemies.push('grunt');
  m.seen.variants.push('swift');
  const { meta } = payout(S, m);
  assert.ok(meta.seen.enemies.includes('grunt'));
  assert.ok(meta.seen.variants.includes('swift'));
  // run-scoped introduction record starts empty every run (banners repeat by design)
  assert.equal(S.introduced.enemies.size, 0);
  assert.equal(S.introduced.variants.size, 0);
});

test('addScore keeps a sorted top-10 and reports the rank', () => {
  let m = defaultMeta();
  for (let w = 1; w <= 12; w++) {
    ({ meta: m } = addScore(m, { wave: w, kills: w * 10, tower: 'bastion', ts: w }));
  }
  assert.equal(m.scores.length, 10, 'list must trim to 10');
  assert.equal(m.scores[0].wave, 12, 'best run first');
  assert.equal(m.scores[9].wave, 3, 'worst surviving entry is wave 3');
  const { rank } = addScore(m, { wave: 8, kills: 999, tower: 'lance', ts: 99 });
  assert.equal(rank, 5, 'wave-8 with more kills ranks above the old wave-8');
  const { rank: noRank } = addScore(m, { wave: 1, kills: 0, tower: 'bastion', ts: 99 });
  assert.equal(noRank, 0, 'a run that does not place reports rank 0');
});

test('payout accumulates lifetime totals', () => {
  const S = newRun(defaultMeta(), 'bastion');
  S.wave = 6; S.kills = 40; S.bossKills = 1;
  const { meta, earned } = payout(S, defaultMeta());
  assert.equal(meta.totalKills, 40);
  assert.equal(meta.totalBossKills, 1);
  assert.equal(meta.totalShards, earned);
});

test('achievements unlock once and never re-award', () => {
  let m = { ...defaultMeta(), totalKills: 1, totalBossKills: 1, best: 5 };
  const first = evalAchievements(m, null);
  m = first.meta;
  const ids = first.unlocked.map(a => a.id);
  assert.ok(ids.includes('first'), 'First Blood should unlock');
  assert.ok(ids.includes('regicide'), 'Regicide should unlock');
  assert.ok(ids.includes('wave5'), 'Meet the Nobility should unlock');
  const again = evalAchievements(m, null);
  assert.equal(again.unlocked.length, 0, 're-evaluation must not re-award');
  assert.equal(new Set(again.meta.ach).size, again.meta.ach.length, 'no duplicate ids');
});

test('run-scoped achievements need the final run state', () => {
  const m = { ...defaultMeta(), totalKills: 1 };
  const S = newRun(defaultMeta(), 'bastion');
  S.weapons.orbit = 5; // maxed
  const withRun = evalAchievements(m, S);
  assert.ok(withRun.unlocked.some(a => a.id === 'specialist'));
  const without = evalAchievements(m, null);
  assert.ok(!without.unlocked.some(a => a.id === 'specialist'), 'menu-time eval must not see run state');
});

test('payout adds shards, tracks best wave, applies salvage, never pays zero', () => {
  const S = newRun(defaultMeta(), 'bastion');
  S.wave = 10; S.kills = 100; S.bossKills = 2;
  const { meta, earned } = payout(S, defaultMeta());
  assert.ok(earned >= 1);
  assert.equal(meta.shards, earned);
  assert.equal(meta.best, 10);
  const salvMeta = { ...defaultMeta(), tech: ['study1', 'salv1'] };
  const { earned: salvEarned } = payout(S, salvMeta);
  assert.ok(salvEarned > earned);
  const S0 = newRun(defaultMeta(), 'bastion');
  const { earned: zeroRun } = payout(S0, defaultMeta());
  assert.ok(zeroRun >= 1, 'losing must always buy something');
});
