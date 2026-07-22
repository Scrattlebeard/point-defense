// Enemy entities: spawning (base × variant), movement, contact, damage/death
// side-effects. Rules and numbers come from core; this file executes them.
import { ENEMIES, VARIANTS, SPLIT } from '../core/config.js';
import { enemyHpMult, enemySpeedMult, bossHp } from '../core/balance.js';
import { addXp } from '../core/state.js';
import { dist } from '../core/geom.js';
import { burst, dmgText, shake, flash } from './fx.js';
import { sfx } from './audio.js';

const TOWER_R = 24;

export function spawnEnemy(G, kind, variantId = null, x = null, y = null) {
  const S = G.S;
  const def = ENEMIES[kind];
  const v = variantId ? VARIANTS[variantId] : null;
  const isBoss = kind === 'boss';
  const baseHp = isBoss ? bossHp(S.wave) : def.hp * enemyHpMult(S.wave);
  const hp = baseHp * (v?.hpMult || 1);
  if (x === null) {
    const a = Math.random() * Math.PI * 2;
    const rad = Math.max(G.W, G.H) * 0.5 + 60;
    x = G.cx + Math.cos(a) * rad;
    y = G.cy + Math.sin(a) * rad;
  }
  const e = {
    kind, def, sides: def.sides, color: def.color,
    x, y, r: def.r,
    hp, maxHp: hp,
    spd: def.spd * enemySpeedMult(S.wave) * (v?.spdMult || 1),
    dmg: def.dmg,
    xp: Math.round(def.xp * (v?.xpMult || 1)),
    rot: Math.random() * Math.PI * 2,
    rotSpd: (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 1.2),
    variant: variantId, vdef: v,
    shield: v?.shield || 0,
    kbx: 0, kby: 0, contactCd: 0, flash: 0, orbHit: 0,
    boss: isBoss, dead: false,
  };
  S.enemies.push(e);
  return e;
}

export function nearestEnemy(S, x, y, maxR = Infinity) {
  let best = null, bestD = maxR;
  for (const e of S.enemies) {
    if (e.dead) continue;
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
    const { r, dmgMult } = e.vdef.explode;
    burst(G.fx, e.x, e.y, e.vdef.color, 22, 220);
    sfx('boom');
    for (const o of S.enemies) {
      if (o.dead || o === e) continue;
      if (dist(e.x, e.y, o.x, o.y) <= r + o.r) damageEnemy(G, o, e.dmg * dmgMult, { noMult: true });
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
    e.flash = Math.max(0, e.flash - dt);
    e.contactCd = Math.max(0, e.contactCd - dt);
    e.rot += e.rotSpd * dt;
    if (e.vdef?.regenPct && e.hp < e.maxHp) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.vdef.regenPct * dt);
    }
    // frost aura slow
    let slow = 1;
    if (G.aura && dist(e.x, e.y, G.cx, G.cy) < G.aura.r + e.r) slow = 1 - G.aura.slow;
    // seek the Point
    const d = dist(e.x, e.y, G.cx, G.cy) || 1;
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
          e.kbx = -ux * 420; e.kby = -uy * 420; // ram, recoil, return
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
