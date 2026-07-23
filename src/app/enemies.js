// Enemy entities: spawning (base × variant), movement, contact, damage/death
// side-effects. Rules and numbers come from core; this file executes them.
import { ENEMIES, VARIANTS, SPLIT } from '../core/config.js';
import { enemyHpMult, enemySpeedMult, bossHp, enemyMass, BOSS_KNOCK_RESIST } from '../core/balance.js';
import { addXp } from '../core/state.js';
import { dist, edgeSpawn } from '../core/geom.js';
import { burst, dmgText, shake, flash, announce } from './fx.js';
import { sfx } from './audio.js';

const TOWER_R = 24;
const COMBAT_R = 280; // inertia-age accrual zone (core.md enemyMass)

export function spawnEnemy(G, kind, variantId = null, x = null, y = null) {
  const S = G.S;
  const def = ENEMIES[kind];
  const v = variantId ? VARIANTS[variantId] : null;
  const isBoss = kind === 'boss';
  const baseHp = isBoss ? bossHp(S.wave) : def.hp * enemyHpMult(S.wave);
  const hp = baseHp * (v?.hpMult || 1);
  // Wave spawns: on the wall, speed normalized so time-to-Point is constant
  // (core.md "Spawn geometry"). Splits pass explicit x,y and stay unscaled.
  let laneMult = 1;
  if (x === null) {
    const s = edgeSpawn(Math.random(), G.W, G.H, def.r + 6);
    x = s.x; y = s.y; laneMult = s.spdMult;
  }
  const e = {
    kind, def, sides: def.sides, color: def.color,
    x, y, r: def.r,
    hp, maxHp: hp,
    spd: def.spd * enemySpeedMult(S.wave) * (v?.spdMult || 1) * laneMult,
    dmg: def.dmg,
    xp: Math.round(def.xp * (v?.xpMult || 1)),
    rot: Math.random() * Math.PI * 2,
    rotSpd: (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 1.2),
    variant: variantId, vdef: v,
    shield: v?.shield || 0,
    kbx: 0, kby: 0, contactCd: 0, flash: 0, orbHit: 0, age: 0, wallAtk: 0,
    beamHeat: 0, beamTick: 0,
    boss: isBoss, dead: false,
  };
  S.enemies.push(e);
  // bestiary sighting record (core.md meta.seen) — forever-firsts
  const seen = G.meta?.seen;
  if (seen) {
    if (!seen.enemies.includes(kind)) seen.enemies.push(kind);
    if (variantId && !seen.variants.includes(variantId)) seen.variants.push(variantId);
  }
  // on-field introductions repeat every run (core.md "Introductions" — tutorial
  // beat, not trophy). Bosses introduce themselves by name banner instead.
  const intro = S.introduced;
  if (intro) {
    if (!intro.enemies.has(kind)) {
      intro.enemies.add(kind);
      if (!isBoss) {
        announce(G.fx, `NEW SHAPE: ${def.name.toUpperCase()}`, def.color, def.intro,
          { sides: def.sides, color: def.color, variant: null });
        e.introduce = 3;
        sfx('discover');
      }
    }
    if (variantId && !intro.variants.has(variantId)) {
      intro.variants.add(variantId);
      announce(G.fx, `NEW SPECIMEN: ${v.name.toUpperCase()}`, v.color, v.desc,
        { sides: def.sides, color: def.color, variant: variantId });
      e.introduce = 3;
      sfx('discover');
    }
  }
  return e;
}

/** The k nearest distinct live shapes to (x,y); same bounds rule as nearestEnemy. */
export function nearestEnemies(S, x, y, k, bounds = null) {
  if (k <= 0) return [];
  const live = S.enemies.filter(e => !e.dead &&
    !(bounds && (e.x < 0 || e.x > bounds.W || e.y < 0 || e.y > bounds.H)));
  live.sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y));
  return live.slice(0, k);
}

export function nearestEnemy(S, x, y, maxR = Infinity, bounds = null) {
  let best = null, bestD = maxR;
  for (const e of S.enemies) {
    if (e.dead) continue;
    // bounds: only shapes inside the arena walls — bullets die at the wall
    // (core.md bolt L6), so an outside target can't be damaged
    if (bounds && (e.x < 0 || e.x > bounds.W || e.y < 0 || e.y > bounds.H)) continue;
    const d = dist(x, y, e.x, e.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function hitTower(G, dmg) {
  const S = G.S;
  S.hp = Math.max(0, S.hp - dmg * S.dmgTakenMult);
  shake(G.fx, 7);
  flash(G.fx, 0.22);
  sfx('hurt');
}

/** Knockback entry point: impulses divide by age-mass; bosses resist ×6 on top
 *  (core.md enemyMass note — ram recoil bypasses this on purpose). */
export function applyKnock(e, ix, iy) {
  const m = enemyMass(e.age) * (e.boss ? BOSS_KNOCK_RESIST : 1);
  e.kbx += ix / m;
  e.kby += iy / m;
}

/** Death by player: full side-effects (xp, splits, explosions). */
function killEnemy(G, e) {
  const S = G.S;
  e.dead = true;
  addXp(S, e.xp);
  S.kills++;
  if (e.boss) { S.bossKills++; sfx('boom'); shake(G.fx, 10); }
  else sfx('death');
  burst(G.fx, e.x, e.y, e.color, e.boss ? 40 : 12, e.boss ? 260 : 140);
  if (e.kind === 'splitter') {
    for (let i = 0; i < SPLIT.count; i++) {
      const c = spawnEnemy(G, SPLIT.child, null, e.x + (Math.random() * 20 - 10), e.y + (Math.random() * 20 - 10));
      c.hp = c.maxHp = c.maxHp * SPLIT.hpMult;
    }
  }
  if (e.vdef?.explode) {
    // medic-bomb (core.md volatile): the burst heals its own kind, harms only the Point
    const { r, healPct } = e.vdef.explode;
    burst(G.fx, e.x, e.y, e.vdef.color, 22, 220);
    sfx('boom');
    for (const o of S.enemies) {
      if (o.dead || o === e) continue;
      if (dist(e.x, e.y, o.x, o.y) <= r + o.r && o.hp < o.maxHp) {
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * healPct);
        burst(G.fx, o.x, o.y, '#4dff88', 5, 80, 0.35, 2);
      }
    }
    if (dist(e.x, e.y, G.cx, G.cy) <= r + TOWER_R) hitTower(G, e.dmg);
  }
}

/**
 * Apply damage to an enemy. Player-sourced by default (dmgMult + crit apply);
 * opts.noMult for environmental damage, opts.silent to skip floating numbers.
 * Returns the damage actually dealt (0 if absorbed by a shield).
 */
export function damageEnemy(G, e, raw, { noMult = false, silent = false } = {}) {
  const S = G.S;
  if (e.dead) return 0;
  if (e.shield > 0) {
    e.shield--;
    e.flash = 0.08;
    burst(G.fx, e.x, e.y, e.vdef?.color || '#7fd8ff', 4, 90, 0.3, 2);
    sfx('shield');
    return 0;
  }
  let dmg = noMult ? raw : raw * S.dmgMult;
  let crit = false;
  if (!noMult && S.critChance > 0 && Math.random() < S.critChance) {
    dmg *= S.critMult; crit = true;
  }
  e.hp -= dmg;
  e.flash = 0.08;
  if (!silent || crit) dmgText(G.fx, e.x, e.y - e.r - 4, dmg, { crit });
  if (e.hp <= 0) killEnemy(G, e);
  return dmg;
}

export function updateEnemies(G, dt) {
  const S = G.S;
  for (const e of S.enemies) {
    if (e.dead) continue;
    const d = dist(e.x, e.y, G.cx, G.cy) || 1;
    // age accrues only inside the combat radius — the inertia clock starts when
    // the fight does, not at spawn (core.md enemyMass; screen-size independence)
    if (d < COMBAT_R) e.age += dt;
    if (e.introduce) e.introduce = Math.max(0, e.introduce - dt);
    e.flash = Math.max(0, e.flash - dt);
    e.contactCd = Math.max(0, e.contactCd - dt);
    e.rot += e.rotSpd * dt;
    if (e.vdef?.regenPct && e.hp < e.maxHp) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.vdef.regenPct * dt);
    }
    // frost aura slow, resisted by age-mass (core.md enemyMass)
    let slow = 1;
    if (G.aura && d < G.aura.r + e.r) {
      slow = 1 - G.aura.slow / enemyMass(e.age);
    }
    // seek the Point
    const ux = (G.cx - e.x) / d, uy = (G.cy - e.y) / d;
    e.x += (ux * e.spd * slow + e.kbx) * dt;
    e.y += (uy * e.spd * slow + e.kby) * dt;
    e.kbx *= Math.pow(0.02, dt); // knockback decays hard
    e.kby *= Math.pow(0.02, dt);
    // contact with the Point
    if (d < e.r + TOWER_R) {
      if (e.boss) {
        if (e.contactCd <= 0) {
          hitTower(G, e.dmg);
          e.contactCd = 1.1;
          // ram, recoil, return — an aged boss recoils less and rams more often
          const m = enemyMass(e.age);
          e.kbx = (-ux * 420) / m; e.kby = (-uy * 420) / m;
        }
      } else {
        hitTower(G, e.dmg);
        // kamikaze: dies uncelebrated — no xp, no splits, no explosion
        e.dead = true;
        burst(G.fx, e.x, e.y, e.color, 8, 110);
      }
    }
  }
  S.enemies = S.enemies.filter(e => !e.dead);
}
