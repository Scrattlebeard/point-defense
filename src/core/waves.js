// Wave composition: budget → spawn plan. Deterministic given the injected rng.
import { ENEMIES, VARIANTS } from './config.js';
import { waveBudget, spawnInterval, variantChance } from './balance.js';

/** @returns {{spawns: string[], interval: number, boss: boolean}} */
export function composeWave(w, rng) {
  const avail = Object.entries(ENEMIES).filter(([id, e]) => id !== 'boss' && e.minWave <= w);
  let budget = waveBudget(w);
  const spawns = [];
  while (budget > 0) {
    const [id, e] = avail[Math.floor(rng() * avail.length)];
    spawns.push(id);
    budget -= e.cost;
  }
  const boss = w % 5 === 0;
  if (boss) spawns.push('boss');
  return { spawns, interval: spawnInterval(w), boss };
}

/** Uniform pick from the debuted variant pool (null if none has debuted). */
export function pickVariant(w, rng) {
  const pool = Object.keys(VARIANTS).filter(id => VARIANTS[id].minWave <= w);
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

/** One variant id or null, for a single non-boss spawn. Pool = variants whose debut wave has arrived. */
export function rollVariant(w, rng) {
  const c = variantChance(w);
  if (c <= 0 || rng() >= c) return null;
  return pickVariant(w, rng);
}
