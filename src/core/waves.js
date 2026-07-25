// Wave composition: budget → spawn plan. Deterministic given the injected rng.
import { ENEMIES, VARIANTS } from './config.js';
import { waveBudget, spawnInterval, variantChance, stackChance, mixTilt, BOSS_ENTRY } from './balance.js';

/** @returns {{spawns: string[], interval: number, boss: boolean}} */
export function composeWave(w, rng) {
  const avail = Object.entries(ENEMIES).filter(([id, e]) => id !== 'boss' && e.minWave <= w);
  // Each species is allocated a share of the budget (∝ cost^tilt) and spends it
  // at its own cost, so pick weight ∝ cost^(tilt−1): cheap species are numerous,
  // and the tilt shifts the allocation toward the expensive ones as the wave
  // deepens (core.md "Wave composition").
  const k = mixTilt(w) - 1;
  const weights = avail.map(([, e]) => Math.pow(e.cost, k));
  const total = weights.reduce((a, b) => a + b, 0);
  let budget = waveBudget(w);
  const spawns = [];
  while (budget > 0) {
    let r = rng() * total, i = 0;
    while (i < weights.length - 1 && (r -= weights[i]) >= 0) i++;
    const [id, e] = avail[i];
    spawns.push(id);
    budget -= e.cost;
  }
  // The boss enters DURING the crunch, not after it (ADR-0012). Appended last it
  // arrived once the wave was effectively over — a solo duel against an empty
  // field, which is the opposite of a focus-forcer: there is nothing to be torn
  // between. Placed a third of the way in, the rest of the wave is still landing
  // while you fight it, so "do I answer the boss or the leakers" is a live
  // question rather than a rhetorical one.
  const boss = w % 5 === 0;
  if (boss) spawns.splice(Math.floor(spawns.length * BOSS_ENTRY), 0, 'boss');
  // A debut is guaranteed, not hoped for (core.md Introductions): on the wave a
  // variant's minWave names, one non-boss spawn is marked to carry it. Core picks
  // both the modifier and the body; the director only executes. Before this a
  // debut was merely the first ELIGIBLE wave, so swift's wave-6 debut actually
  // happened that wave in 53% of runs — a tutorial beat that fires "usually".
  const debutVariant = Object.keys(VARIANTS).find(id => VARIANTS[id].minWave === w) || null;
  // Index into `spawns`, so it must skip the boss: with the boss appended last any
  // index was safely non-boss, but it now sits in the middle of the queue.
  const bodies = spawns.reduce((acc, id, i) => (id === 'boss' ? acc : (acc.push(i), acc)), []);
  const debutAt = debutVariant && bodies.length
    ? bodies[Math.floor(rng() * bodies.length)]
    : null;
  return { spawns, interval: spawnInterval(w), boss, debutVariant, debutAt };
}

/** Uniform pick from the debuted variant pool (null if none has debuted). */
export function pickVariant(w, rng) {
  const pool = Object.keys(VARIANTS).filter(id => VARIANTS[id].minWave <= w);
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

/** Modifier stack for one non-boss spawn — an array, possibly empty (core.md
 *  Variants "Stacking"). First variant on `variantChance`; from the regime wave
 *  each carrier rolls again on `stackChance`, to a hard cap of three distinct
 *  modifiers (GDD §5: "three modifiers read as three channels on one silhouette"). */
export const MAX_STACK = 3;

export function rollVariants(w, rng) {
  const c = variantChance(w);
  if (c <= 0 || rng() >= c) return [];
  const first = pickVariant(w, rng);
  if (!first) return [];
  const out = [first];
  const s = stackChance(w);
  while (out.length < MAX_STACK && s > 0 && rng() < s) {
    const rest = Object.keys(VARIANTS)
      .filter(id => VARIANTS[id].minWave <= w && !out.includes(id));
    if (!rest.length) break;
    out.push(rest[Math.floor(rng() * rest.length)]);
  }
  return out;
}
