// Scaling formulas — the single home of every difficulty/economy curve.
// Structural truths (monotonicity, caps, floors) are pinned in test/balance.test.mjs;
// exact constants are tuning and may change freely.
import { clamp } from './geom.js';

export const enemyHpMult = w => 1 + 0.22 * (w - 1) + 0.012 * (w - 1) * (w - 1);
export const enemySpeedMult = w => Math.min(1.6, 1 + (w - 1) * 0.012);
export const waveBudget = w => 8 + 4 * w + 0.35 * w * w;
export const spawnInterval = w => clamp(1.4 - 0.05 * w, 0.22, 1.4);
export const xpForLevel = l => Math.round(10 + 8 * (l - 1) + 1.2 * (l - 1) * (l - 1));
export const bossHp = w => 500 * (1 + 0.3 * (w - 5));

/** Chance that a non-boss spawn rolls a variant. Zero early, capped so lategame stays readable. */
export const variantChance = w => (w <= 5 ? 0 : Math.min(0.35, 0.015 * (w - 5)));

/** Losing must always buy something (README pillar 4). */
export const shardPayout = (wave, kills, bossKills) =>
  Math.max(1, Math.round(3 * wave + kills / 10 + 8 * bossKills));

/** Shapes gain inertia with age: knockback and aura slow divide by this (core.md). */
export const enemyMass = age => 1 + Math.min(2, age / 15);
