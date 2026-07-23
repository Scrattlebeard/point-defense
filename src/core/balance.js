// Scaling formulas — the single home of every difficulty/economy curve.
// Structural truths (monotonicity, caps, floors) are pinned in test/balance.test.mjs;
// exact constants are tuning and may change freely.
import { clamp } from './geom.js';

// hp/budget curves reshaped 2026-07-23: higher floor, trimmed slope, re-converging
// with the previous totals ≈ wave 35 (core.md Balance formulas).
export const enemyHpMult = w => 1 + 0.58 * (w - 1) + 0.003 * (w - 1) * (w - 1);
export const enemySpeedMult = w => Math.min(1.6, 1 + (w - 1) * 0.012);
export const waveBudget = w => 22 + 7 * w + 0.21 * w * w;
export const spawnInterval = w => clamp(1.1 - 0.05 * w, 0.22, 1.1);
export const xpForLevel = l => Math.round(10 + 8 * (l - 1) + 1.2 * (l - 1) * (l - 1));
// Tripled 2026-07-23: boss radius means full multi-bolt connects; see core.md.
export const bossHp = w => 1500 * (1 + 0.3 * (w - 5));

/** Chance that a non-boss spawn rolls a variant. Zero early, capped so lategame stays readable. */
export const variantChance = w => (w <= 5 ? 0 : Math.min(0.35, 0.015 * (w - 5)));

/** Losing must always buy something (README pillar 4). */
export const shardPayout = (wave, kills, bossKills) =>
  Math.max(1, Math.round(3 * wave + kills / 10 + 8 * bossKills));

/** Shapes gain inertia with age: knockback and aura slow divide by this (core.md). */
export const enemyMass = age => 1 + Math.min(2, age / 15);

/** Player knockback on bosses divides by this on top of age-mass (core.md). */
export const BOSS_KNOCK_RESIST = 6;
