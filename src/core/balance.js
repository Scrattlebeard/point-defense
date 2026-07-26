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
/** Levels come from waves, not kills (ADR-0015). The run opens at level 1 with no
 *  banked picks (ADR-0016, superseding 0015's three-card draft): the player starts at
 *  the bottom and climbs, and wave 1 is a tutorial beat whose reward is the first
 *  choice. Level at the start of wave N is N. */
export const OPENING_LEVELS = 1;
export const LEVELS_PER_WAVE = 1;
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

/** How far into the spawn queue the boss enters (ADR-0012). Not 1.0: a boss
 *  appended last fights an empty field, because the wave it belongs to has already
 *  been cleared by the time it arrives. A third of the way in leaves two thirds of
 *  the wave still landing during the fight. */
export const BOSS_ENTRY = 0.33;

// ---------- The boss is sized in SECONDS (ADR-0012) ----------
// A boss fight is a designed event with a length. Sizing it as a share of the
// wave's HP (ADR-0008) fixed a decay bug but controlled the wrong quantity: the
// share knows the enemy budget and nothing about player damage, so the fight
// length was free to run away. Measured on a fresh account playing naturally, the
// boss stayed alive 19s at wave 5 and 212s at wave 45 — because `bossHp` grew as
// w^2.19 while natural player dps grows as w^1.15.

/** How long a boss should stay alive, in seconds: a ramp to the target, then flat.
 *  The first boss is a short, legible wall — it teaches what a boss is, and it is
 *  where ~45% of fresh runs end, so lengthening it would move the onboarding band.
 *  By `BOSS_TTK_WAVE` they are full-length events and stay there. */
export const BOSS_TTK_FIRST = 22;
/** DESIGN INTENT is 60s (Daniel, 2026-07-25: "around 60s events as the default").
 *  100 is what Law·Delegation currently permits, and the gap is measured, not
 *  guessed — see ADR-0012. Below ~90s the conductor gate fails outright, because
 *  delegation pressure in this game rests almost entirely on boss HP. Closing the
 *  gap needs undelegatable pressure that is NOT a boss health bar; until then this
 *  constant is a compromise and is labelled as one. */
export const BOSS_TTK_TARGET = 100;
export const BOSS_TTK_WAVE = 25;
export const bossTargetTtk = w => BOSS_TTK_FIRST + (BOSS_TTK_TARGET - BOSS_TTK_FIRST) *
  Math.min(1, Math.max(0, (w - 5) / (BOSS_TTK_WAVE - 5)));

/** Damage per second a fresh account playing naturally brings to a boss at wave w.
 *  Fitted to measurement (`scripts/bosstime.mjs` is the instrument that keeps it
 *  honest), NOT derived: player power comes from level-ups, weapon ladders and
 *  build luck, none of which has a closed form. The gate exists because a fitted
 *  constant rots the moment weapons change — it is allowed to rot, loudly. */
export const REF_DPS_K = 8.0;
export const REF_DPS_EXP = 1.15;
export const referenceDps = w => REF_DPS_K * Math.pow(w, REF_DPS_EXP);

/** A presence floor, not the definition (ADR-0012 supersedes ADR-0008 Decision 2).
 *  The share is still doing one job nothing else does: keeping the boss visible
 *  against its own wave, so it cannot decay into one chunky elite among forty —
 *  which is the bug ADR-0008 was written to fix and which must not come back. */
export const BOSS_HP_SHARE = 0.10;

/** Sized in seconds, floored on presence. Bounded above by the stall constraint:
 *  the director waits for an empty field, so an unkillable boss freezes the run. */
export const bossHp = w => Math.max(
  bossTargetTtk(w) * referenceDps(w),
  (BOSS_HP_SHARE / (1 - BOSS_HP_SHARE)) * waveTrashHp(w),
);

/** A shape shows an HP sliver when it is beefy *for its wave* (app.md "fill
 *  encodes allegiance"). Wave-relative on purpose: the old absolute `maxHp > 40`
 *  went dead by wave 4 once enemyHpMult climbed past it. */
export const hpBarThreshold = w => 2.4 * ENEMIES.grunt.hp * enemyHpMult(w);

/** Chance that a non-boss spawn rolls a variant. Zero early, capped so lategame stays readable. */
export const variantChance = w => (w <= 5 ? 0 : Math.min(0.35, 0.015 * (w - 5)));

/** Wave at which the game changes gear: bosses recirculate with epithets AND
 *  regular spawns start stacking modifiers (core.md Variants "Stacking"). One
 *  threshold, not two — the regime change should read as a single event. */
export const REGIME_WAVE = 40;

/** Chance a variant-bearing spawn gains ANOTHER variant, rolled repeatedly to a
 *  cap of 3 (core.md Variants "Stacking"). Stacked shapes are a scary minority. */
export const stackChance = w =>
  w < REGIME_WAVE ? 0 : clamp(0.12 + 0.012 * (w - REGIME_WAVE), 0, 0.55);

/** Losing must always buy something (README pillar 4). Superlinear wave term
 *  added with the Lattice (ADR-0003): deep rings cost 250-600, deep runs pay deep. */
export const shardPayout = (wave, kills, bossKills) =>
  Math.max(1, Math.round(2.5 * wave + kills / 9 + 9 * bossKills + 0.18 * wave * wave));

/** How far a ricocheting bolt will reach for its next shape (core.md bolt row).
 *  Bounded so a kick reads as "it jumped to that one", not as homing. */
export const RICOCHET_RANGE = 190;

/** Shapes gain inertia with age: knockback and aura slow divide by this (core.md). */
export const enemyMass = age => 1 + Math.min(2, age / 15);

/** Player knockback on bosses divides by this on top of age-mass (core.md). */
export const BOSS_KNOCK_RESIST = 6;
