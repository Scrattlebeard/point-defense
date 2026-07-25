// Run-state math: creation, XP/leveling, level-up choices, payout.
// The shell mutates entity arrays inside S during play; the *rules* stay here.
import { TOWERS, WEAPONS, GENERICS, FORMS, ACHIEVEMENTS, SLOT_BUDGET } from './config.js';
import { effectsOf } from './tech.js';
import { xpForLevel, shardPayout } from './balance.js';

export function defaultMeta() {
  return {
    shards: 0, best: 0, tech: [], tower: 'bastion', sound: true,
    seen: { enemies: [], variants: [] }, // bestiary discovery record (core.md)
    scores: [], ach: [],                 // records (core.md "Records")
    totalKills: 0, totalBossKills: 0, totalShards: 0,
  };
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

  // The lattice authors the generic pool too (core.md "Generic cards"): a
  // techLock'd card is absent until a node's unlockGeneric names it.
  const generics = new Set(Object.keys(GENERICS).filter(id => !GENERICS[id].techLock));
  for (const g of fx.generics) generics.add(g);

  const maxHp = Math.round((100 + fx.hpBonus) * tower.hpMult);
  const S = {
    towerId, maxHp, hp: maxHp,
    regen: fx.regen,
    dmgMult: fx.dmgMult * tower.dmgMult,
    xpMult: fx.xpMult * (tower.xpMult || 1),
    cdMult: fx.cdMult,
    critChance: fx.critChance, critMult: fx.critMult,
    dmgTakenMult: fx.dmgTakenMult,
    weapons, pool, generics,
    // forms (core.md "Forms"): what the account unlocked, and what is active
    formPool: new Set(fx.forms), forms: {},
    lvl: 1, xp: 0, xpNext: xpForLevel(1), pendingLevels: 0,
    wave: 0, kills: 0, bossKills: 0, time: 0,
    // run-scoped introduction record — banners repeat each run (core.md Introductions)
    // run-scoped introduction record; `stacked` is the wave-40 regime beat
    introduced: { enemies: new Set(), variants: new Set(), stacked: false },
    // sim entity arrays, owned here so a run is one object; the shell fills them
    enemies: [], bullets: [], missiles: [], rings: [], zaps: [], mines: [], shells: [],
    boomers: [], blades: [], fires: [], boulders: [], caltrops: [], sparks: [],
    heat: 0, overheated: false,
  };
  for (let i = 1; i < fx.startLevel; i++) {
    S.lvl++; S.pendingLevels++; S.xpNext = xpForLevel(S.lvl);
  }
  return S;
}

/** Fraction of max HP restored per level gained (core.md "Run state"): GDD §7's
 *  three-cards-and-a-heal, and GDD §2's mechanism for keeping chip damage in the
 *  signal business rather than the death business. */
export const LEVELUP_HEAL = 0.10;

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
  if (n > 0) S.hp = Math.min(S.maxHp, S.hp + n * LEVELUP_HEAL * S.maxHp);
  return n;
}

/** Three distinct options: upgradeable/ownable weapons from the pool + generic cards. */
export function levelChoices(S, rng) {
  const opts = [];
  // slot budget (core.md "The slot budget", ADR-0006): ≤ total weapons per run;
  // a gun/hold/swipe ceiling held by an owned weapon locks its rivals out of the
  // draft. Upgrades to owned weapons always flow — the budget prices NEW weapons.
  let owned = 0;
  const catTaken = {};
  for (const id in S.weapons) {
    if (S.weapons[id] > 0) {
      owned++;
      const cat = WEAPONS[id].category;
      if (SLOT_BUDGET[cat]) catTaken[cat] = id;
    }
  }
  for (const id of S.pool) {
    const l = S.weapons[id];
    const w = WEAPONS[id];
    if (l >= w.max) continue;
    if (l === 0) {
      if (owned >= SLOT_BUDGET.total) continue;
      if (SLOT_BUDGET[w.category] && catTaken[w.category]) continue;
      // a form pilot is a card you draw at max level (ADR-0006 Alt-4)
      if (w.formOf && S.weapons[w.formOf] < WEAPONS[w.formOf].max) continue;
    }
    opts.push({ type: 'weapon', id, lvl: l });
  }
  // form cards (core.md "Forms"): base at max, form unlocked, not already worn.
  // They cost no slot, so the budget above does not gate them.
  for (const id of S.formPool) {
    const f = FORMS[id];
    if (!f) continue;
    if (S.weapons[f.of] < WEAPONS[f.of].max) continue;
    if (S.forms[f.of] === id) continue;
    opts.push({ type: 'form', id, of: f.of });
  }
  for (const id of S.generics) {
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
  if (c.type === 'form') {
    S.forms[c.of] = c.id;
    return;
  }
  if (c.type === 'weapon') {
    S.weapons[c.id] = Math.min(WEAPONS[c.id].max, S.weapons[c.id] + 1);
    return;
  }
  if (c.id === 'repair') S.hp = Math.min(S.maxHp, S.hp + 0.4 * S.maxHp);
  else if (c.id === 'bulkhead') { S.maxHp += 25; S.hp = Math.min(S.maxHp, S.hp + 25); }
  else if (c.id === 'overclock') S.dmgMult += 0.1;
  else if (c.id === 'coolant') S.cdMult *= 0.95;
  else if (c.id === 'crit') S.critChance += 0.10;
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
    meta: {
      ...meta,
      shards: meta.shards + earned,
      best: Math.max(meta.best, S.wave),
      totalKills: (meta.totalKills || 0) + S.kills,
      totalBossKills: (meta.totalBossKills || 0) + S.bossKills,
      totalShards: (meta.totalShards || 0) + earned,
    },
    earned,
  };
}

/** Top-10 high scores, wave then kills. Returns {meta, rank} — rank 0 if it didn't place. */
export function addScore(meta, entry) {
  const scores = [...(meta.scores || []), entry]
    .sort((a, b) => b.wave - a.wave || b.kills - a.kills)
    .slice(0, 10);
  const idx = scores.indexOf(entry);
  return { meta: { ...meta, scores }, rank: idx >= 0 ? idx + 1 : 0 };
}

/** Evaluate achievements over (meta, finalRunState|null). Unlocks are forever. */
export function evalAchievements(meta, S) {
  const owned = new Set(meta.ach || []);
  const unlocked = ACHIEVEMENTS.filter(a => !owned.has(a.id) && a.test(meta, S));
  if (!unlocked.length) return { meta, unlocked };
  return {
    meta: { ...meta, ach: [...owned, ...unlocked.map(a => a.id)] },
    unlocked,
  };
}
