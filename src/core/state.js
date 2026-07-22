// Run-state math: creation, XP/leveling, level-up choices, payout.
// The shell mutates entity arrays inside S during play; the *rules* stay here.
import { TOWERS, WEAPONS, GENERICS } from './config.js';
import { effectsOf } from './tech.js';
import { xpForLevel, shardPayout } from './balance.js';

export function defaultMeta() {
  return { shards: 0, best: 0, tech: [], tower: 'bastion', sound: true };
}

export function towerUnlocked(meta, towerId) {
  if (towerId === 'bastion') return true;
  return effectsOf(meta.tech).towers.has(towerId);
}

export function newRun(meta, towerId) {
  const tower = TOWERS[towerId] || TOWERS.bastion;
  const fx = effectsOf(meta.tech);

  const weapons = {};
  for (const id in WEAPONS) weapons[id] = 0;
  for (const [id, l] of Object.entries(tower.start)) weapons[id] = l;

  // Level-up pool: unlocked-by-default + tech unlocks + anything the tower itself
  // grants (the tower IS the unlock — core.md "Towers").
  const pool = new Set(Object.keys(WEAPONS).filter(id => !WEAPONS[id].techLock));
  for (const w of fx.weapons) pool.add(w);
  for (const id in weapons) if (weapons[id] > 0) pool.add(id);

  const maxHp = Math.round((100 + fx.hpBonus) * tower.hpMult);
  const S = {
    towerId, maxHp, hp: maxHp,
    regen: fx.regen,
    dmgMult: fx.dmgMult * tower.dmgMult,
    xpMult: fx.xpMult * (tower.xpMult || 1),
    cdMult: fx.cdMult,
    critChance: fx.critChance, critMult: fx.critMult,
    dmgTakenMult: fx.dmgTakenMult,
    weapons, pool,
    lvl: 1, xp: 0, xpNext: xpForLevel(1), pendingLevels: 0,
    wave: 0, kills: 0, bossKills: 0, time: 0,
    // sim entity arrays, owned here so a run is one object; the shell fills them
    enemies: [], bullets: [], missiles: [], rings: [], zaps: [],
    heat: 0, overheated: false,
  };
  for (let i = 1; i < fx.startLevel; i++) {
    S.lvl++; S.pendingLevels++; S.xpNext = xpForLevel(S.lvl);
  }
  return S;
}

/** Applies xp multipliers, consumes thresholds. Returns levels gained (also queued on S.pendingLevels). */
export function addXp(S, amount) {
  S.xp += amount * S.xpMult;
  let n = 0;
  while (S.xp >= S.xpNext) {
    S.xp -= S.xpNext;
    S.lvl++; n++;
    S.xpNext = xpForLevel(S.lvl);
  }
  S.pendingLevels += n;
  return n;
}

/** Three distinct options: upgradeable/ownable weapons from the pool + generic cards. */
export function levelChoices(S, rng) {
  const opts = [];
  for (const id of S.pool) {
    const l = S.weapons[id];
    if (l < WEAPONS[id].max) opts.push({ type: 'weapon', id, lvl: l });
  }
  for (const id of Object.keys(GENERICS)) {
    if (id === 'repair' && S.hp >= 0.7 * S.maxHp) continue;
    opts.push({ type: 'generic', id });
  }
  const picks = [];
  while (picks.length < 3 && opts.length) {
    picks.push(opts.splice(Math.floor(rng() * opts.length), 1)[0]);
  }
  return picks;
}

export function applyChoice(S, c) {
  if (c.type === 'weapon') {
    S.weapons[c.id] = Math.min(WEAPONS[c.id].max, S.weapons[c.id] + 1);
    return;
  }
  if (c.id === 'repair') S.hp = Math.min(S.maxHp, S.hp + 0.4 * S.maxHp);
  else if (c.id === 'bulkhead') { S.maxHp += 25; S.hp = Math.min(S.maxHp, S.hp + 25); }
  else if (c.id === 'overclock') S.dmgMult += 0.1;
  else if (c.id === 'coolant') S.cdMult *= 0.95;
}

/** Wave-clear breather: heal 4% max hp. */
export function waveCleared(S) {
  S.hp = Math.min(S.maxHp, S.hp + 0.04 * S.maxHp);
}

/** Death → shards. Returns {meta, earned}; input meta is not mutated. */
export function payout(S, meta) {
  const fx = effectsOf(meta.tech);
  const earned = Math.max(1, Math.round(shardPayout(S.wave, S.kills, S.bossKills) * fx.salvageMult));
  return {
    meta: { ...meta, shards: meta.shards + earned, best: Math.max(meta.best, S.wave) },
    earned,
  };
}
