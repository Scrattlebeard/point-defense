// Scaling formulas — the single home of every difficulty/economy curve.
// Structural truths (monotonicity, caps, floors) are pinned in test/balance.test.mjs;
// exact constants are tuning and may change freely.
import { clamp } from './geom.js';
import { ENEMIES } from './config.js';

// hp/budget curves reshaped 2026-07-23: higher floor, trimmed slope, re-converging
// with the previous totals ≈ wave 35 (core.md Balance formulas).
export const enemyHpMult = w => 1 + 0.70 * (w - 1) + 0.003 * (w - 1) * (w - 1);
export const enemySpeedMult = w => Math.min(1.6, 1 + (w - 1) * 0.012);
export const waveBudget = w => 22 + 7 * w + 0.21 * w * w;
export const spawnInterval = w => clamp(1.1 - 0.05 * w, 0.22, 1.1);
/** Composition tilt (core.md "Wave composition"): species budget share scales as
 *  cost^mixTilt, so the wave buys fewer, meaner bodies as it deepens. Flat until
 *  the elite debut, endpoint at wave 54 — the escalation lever that was missing
 *  past wave 29, where every other composition lever is inert. */
export const mixTilt = w => clamp(0.55 * (w - 14) / 40, 0, 0.55);
export const xpForLevel = l => Math.round(10 + 8 * (l - 1) + 1.2 * (l - 1) * (l - 1));
/** Expected total HP of a wave's non-boss bodies, under the same mix weights
 *  composeWave uses (core.md "Balance formulas" / "Wave composition"). */
export function waveTrashHp(w) {
  const k = mixTilt(w) - 1;
  let wSum = 0, hpSum = 0, costSum = 0;
  for (const [id, e] of Object.entries(ENEMIES)) {
    if (id === 'boss' || e.minWave > w) continue;
    const wt = Math.pow(e.cost, k);
    wSum += wt; hpSum += wt * e.hp; costSum += wt * e.cost;
  }
  const bodies = waveBudget(w) / (costSum / wSum); // budget ÷ expected cost per body
  return bodies * (hpSum / wSum) * enemyHpMult(w);
}

/** A boss is always the same fraction of its wave's total HP — Law·Bosses, and
 *  the fix for a curve that decayed from 31% to 4.9% by wave 45 (core.md).
 *  Bounded above by the stall constraint: the director waits for an empty field. */
export const BOSS_HP_SHARE = 0.31;
export const bossHp = w => (BOSS_HP_SHARE / (1 - BOSS_HP_SHARE)) * waveTrashHp(w);

/** A shape shows an HP sliver when it is beefy *for its wave* (app.md "fill
 *  encodes allegiance"). Wave-relative on purpose: the old absolute `maxHp > 40`
 *  went dead by wave 4 once enemyHpMult climbed past it. */
export const hpBarThreshold = w => 2.4 * ENEMIES.grunt.hp * enemyHpMult(w);

/** Chance that a non-boss spawn rolls a variant. Zero early, capped so lategame stays readable. */
export const variantChance = w => (w <= 5 ? 0 : Math.min(0.35, 0.015 * (w - 5)));

/** Losing must always buy something (README pillar 4). Superlinear wave term
 *  added with the Lattice (ADR-0003): deep rings cost 250-600, deep runs pay deep. */
export const shardPayout = (wave, kills, bossKills) =>
  Math.max(1, Math.round(2.5 * wave + kills / 9 + 9 * bossKills + 0.18 * wave * wave));

/** Shapes gain inertia with age: knockback and aura slow divide by this (core.md). */
export const enemyMass = age => 1 + Math.min(2, age / 15);

/** Player knockback on bosses divides by this on top of age-mass (core.md). */
export const BOSS_KNOCK_RESIST = 6;
