// Enemy entities: spawning (base × variant), movement, contact, damage/death
// side-effects. Rules and numbers come from core; this file executes them.
import { ENEMIES, VARIANTS, SPLIT, BOSS_MOVES, WEAPONS } from '../core/config.js';
import { enemyHpMult, enemySpeedMult, bossHp, enemyMass, BOSS_KNOCK_RESIST } from '../core/balance.js';
import { addXp } from '../core/state.js';
import { dist, edgeSpawn } from '../core/geom.js';
import { burst, dmgText, shake, flash, announce } from './fx.js';
import { sfx, haptic } from './audio.js';

const TOWER_R = 24;
const COMBAT_R = 280; // inertia-age accrual zone (core.md enemyMass)

export function spawnEnemy(G, kind, variants = null, x = null, y = null) {
  const S = G.S;
  const def = ENEMIES[kind];
  const isBoss = kind === 'boss';
  // A stack composes multiplicatively; flags take the strongest present, since a
  // stack never repeats a modifier (core.md Variants "Stacking"). An epithet
  // changes the fight, not the arithmetic — a boss's HP is a share of the whole
  // wave, so trash multipliers compound against a curve they were never sized
  // for, hence the `.boss` override (core.md "Boss variants" / ADR-0009).
  const ids = (Array.isArray(variants) ? variants : variants ? [variants] : [])
    .filter(id => VARIANTS[id]);
  const vdefs = ids.map(id => {
    const raw = VARIANTS[id];
    return isBoss && raw.boss ? { ...raw, ...raw.boss } : raw;
  });
  const prod = key => vdefs.reduce((m, v) => m * (v[key] || 1), 1);
  const strongest = key => vdefs.reduce((m, v) => Math.max(m, v[key] || 0), 0);
  const baseHp = isBoss ? bossHp(S.wave) : def.hp * enemyHpMult(S.wave);
  const hp = baseHp * prod('hpMult');
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
    spd: def.spd * enemySpeedMult(S.wave) * prod('spdMult') * laneMult,
    // spawn-time speed, kept so a move can scale it without recomputing the
    // lane normalisation baked in above (core.md "Spawn geometry")
    baseSpd: def.spd * enemySpeedMult(S.wave) * prod('spdMult') * laneMult,
    dmg: def.dmg,
    xp: Math.round(def.xp * prod('xpMult')),
    rot: Math.random() * Math.PI * 2,
    rotSpd: (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 1.2),
    variants: ids, vdefs,
    regenPct: strongest('regenPct'),
    explode: vdefs.find(d => d.explode)?.explode || null,
    shield: strongest('shield'),
    kbx: 0, kby: 0, contactCd: 0, flash: 0, orbHit: 0, age: 0, wallAtk: 0,
    // damage attribution (core.md Enemies): the shell owns these, render reads them
    sieging: false, strike: 0,
    // boss signature move (core.md), assigned by game.js. `hurtT` = seconds
    // since the last landed hit (study reads it); starts high so a freshly
    // spawned noble is never mid-`study` before anyone has shot at it.
    moveId: null, moveT: 0, hurtT: 9, studyT: 0, guard: 1,
    // interruptible charge (core.md): stagger timer + wind-up resistance
    stun: 0, windNeed: 0, windDmg: 0, windTell: 0, windStun: 0, windEvery: 0,
    beamHeat: 0, beamTick: 0,
    burnStacks: 0, burnLeft: 0, burnTick: 0, // flamethrower DoT (core.md flame row)
    calSlowT: 0, calSlow: 0, // caltrop prick (core.md caltrop row)
    primed: null, // cascade charge {t, dmg, gen, ...params} (core.md cascade row)
    boss: isBoss, dead: false,
  };
  S.enemies.push(e);
  // bestiary sighting record (core.md meta.seen) — forever-firsts
  const seen = G.meta?.seen;
  if (seen) {
    if (!seen.enemies.includes(kind)) seen.enemies.push(kind);
    for (const id of ids) if (!seen.variants.includes(id)) seen.variants.push(id);
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
    // The regime change teaches itself (core.md Introductions): the first shape
    // wearing two or more modifiers gets its own beat, carrying the actual stack
    // as its icon. Without it the wave-40 gear change is invisible — a shape
    // several times harder reads as bad dice, not as a rule that changed.
    if (ids.length >= 2 && !intro.stacked) {
      intro.stacked = true;
      announce(G.fx, 'MODIFIERS ARE COMPOUNDING', '#ff5c9d',
        'shapes now wear more than one', { sides: def.sides, color: def.color, variants: ids });
      e.introduce = 3;
      sfx('discover');
    }
    // one banner per newly-sighted modifier, even when several arrive stacked
    for (let i = 0; i < ids.length; i++) {
      if (intro.variants.has(ids[i])) continue;
      intro.variants.add(ids[i]);
      const vd = VARIANTS[ids[i]];
      announce(G.fx, `NEW SPECIMEN: ${vd.name.toUpperCase()}`, vd.color, vd.desc,
        { sides: def.sides, color: def.color, variant: ids[i] });
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
  haptic('hurt'); // core.md Haptics: a chip is a signal, and touch always reaches
}

/** Knockback entry point: impulses divide by age-mass; bosses resist ×6 on top
 *  (core.md enemyMass note — ram recoil bypasses this on purpose). */
export function applyKnock(e, ix, iy) {
  const m = enemyMass(e.age) * (e.boss ? BOSS_KNOCK_RESIST : 1);
  e.kbx += ix / m;
  e.kby += iy / m;
}

/**
 * Cascade detonation (core.md cascade row) — lives here because "primed shapes
 * detonate on death" is a death side-effect, and the recursive domino (a blast
 * kills an already-primed neighbor → it detonates too) falls out of killEnemy
 * for free. Params ride on e.primed so no weapon-config import is needed.
 */
export function detonatePrimed(G, e) {
  const p = e.primed;
  if (!p) return;
  e.primed = null;
  const S = G.S;
  burst(G.fx, e.x, e.y, '#ffffff', 14, 220, 0.35, 2.5);
  burst(G.fx, e.x, e.y, '#e8fbff', 7, 90, 0.2, 1.5);
  shake(G.fx, 2);
  sfx('zap');
  const spreads = p.dmg * p.decay >= p.minDmg && p.gen + 1 <= p.maxGen;
  for (const o of S.enemies) {
    if (o.dead || o === e) continue;
    if (dist(e.x, e.y, o.x, o.y) > p.blast + o.r) continue;
    damageEnemy(G, o, p.dmg, { src: 'cascade' });
    // survivors inherit a weaker prime — the chain reaction (spec: ×decay)
    if (spreads && !o.dead && (!o.primed || o.primed.dmg < p.dmg * p.decay)) {
      o.primed = { ...p, t: p.fuse, dmg: p.dmg * p.decay, gen: p.gen + 1 };
    }
  }
  // the carrier takes the blast too (fuse-out case; a dead carrier is past caring)
  if (!e.dead) damageEnemy(G, e, p.dmg, { src: 'cascade' });
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
  if (e.primed) detonatePrimed(G, e); // death lights the fuse instantly (core.md cascade)
  if (e.explode) {
    // medic-bomb (core.md volatile): the burst heals its own kind, harms only the Point
    const { r, healPct } = e.explode;
    burst(G.fx, e.x, e.y, VARIANTS.volatile.color, 22, 220);
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
export function damageEnemy(G, e, raw, { noMult = false, silent = false, src = null } = {}) {
  const S = G.S;
  if (e.dead) return 0;
  if (e.shield > 0) {
    e.shield--;
    e.flash = 0.08;
    burst(G.fx, e.x, e.y, VARIANTS.shielded.color, 4, 90, 0.3, 2);
    sfx('shield');
    return 0;
  }
  let dmg = noMult ? raw : raw * S.dmgMult;
  let crit = false;
  if (!noMult && S.critChance > 0 && Math.random() < S.critChance) {
    dmg *= S.critMult; crit = true;
  }
  // guarded bosses (core.md "Boss signature moves"): scalar, not a shield —
  // applied before attribution so a guarded hit is recorded at what it dealt
  if (e.guard != null && e.guard < 1) dmg *= e.guard;
  // An interruptible charge (core.md "Boss signature moves"): damage pushes the
  // wind-up back, and emptying its resistance staggers the boss instead. ALL
  // damage counts — the bias toward hands is emergent, since concentrating enough
  // damage inside a ~1.1s window is what aiming does and delegation does not.
  if (e.winding && e.windNeed > 0) {
    e.windDmg += dmg;
    e.moveT += (dmg / e.windNeed) * e.windTell; // visibly delays it
    if (e.windDmg >= e.windNeed) {
      e.winding = false;
      e.stun = e.windStun;
      // the FULL cycle restarts: without this the boss re-enters its wind-up on
      // the frame the stagger ends, which is a chain-charge, not counterplay
      e.moveT = e.windEvery;
      e.spd = 0;
      burst(G.fx, e.x, e.y, '#ffd24d', 18, 200, 0.5, 3);
      shake(G.fx, 4);
      sfx('shield');
    }
  }
  // `study` reads ATTENTION, not damage: only weapons the player drives reset the
  // clock, or a single auto would pin the boss at its floor forever and the
  // "let it forget" half of the dilemma could never fire (core.md).
  if (src && WEAPONS[src] && WEAPONS[src].input !== 'none') e.hurtT = 0;
  // attribute before anything can kill the shape (core.md Run state). Damage with
  // no weapon behind it lands in 'other' rather than vanishing — a breakdown that
  // silently drops damage reads as complete and is not.
  const bucket = src || 'other';
  S.dmgBy[bucket] = (S.dmgBy[bucket] || 0) + Math.min(dmg, Math.max(0, e.hp));
  e.hp -= dmg;
  e.flash = 0.08;
  if (!silent || crit) dmgText(G.fx, e.x, e.y - e.r - 4, dmg, { crit });
  if (e.hp <= 0) killEnemy(G, e);
  return dmg;
}

/** Execute a boss's signature move. The BOSS_MOVES table owns every number. */
let S_TOKEN = 0; // distinguishes one Marquis's shards from a later one's
function runBossMove(G, e, dt) {
  const mv = Object.values(BOSS_MOVES).find(m => m.id === e.moveId);
  if (!mv) return;
  if (mv.id === 'adds') {
    e.moveT -= dt;
    if (e.moveT <= 0) {
      e.moveT = mv.every;
      for (let i = 0; i < mv.count; i++) {
        const a = e.rot + (i / mv.count) * Math.PI * 2;
        spawnEnemy(G, mv.child, null, e.x + Math.cos(a) * (e.r + 8), e.y + Math.sin(a) * (e.r + 8));
      }
      burst(G.fx, e.x, e.y, e.color, 16, 200, 0.4, 2);
      shake(G.fx, 4);
      sfx('boss');
    }
  } else if (mv.id === 'surge') {
    // a wounded boss is a FASTER boss: chip damage without commitment is the
    // worst option, which is the focus dilemma the move exists to pose
    const surging = e.hp < e.maxHp * mv.belowHp;
    e.spd = e.baseSpd * (surging ? mv.spdMult : 1);
  } else if (mv.id === 'sunder') {
    // sheds its sides ONCE at the threshold, and is guarded until they are
    // cleared: the dilemma is "stop hitting the boss" (core.md Boss signature moves)
    if (!e.sundered && e.hp < e.maxHp * mv.belowHp) {
      e.sundered = true;
      e.wardToken = `sunder${S_TOKEN++}`;
      for (let i = 0; i < mv.count; i++) {
        const a = e.rot + (i / mv.count) * Math.PI * 2;
        spawnEnemy(G, mv.child, null, e.x + Math.cos(a) * (e.r + 10), e.y + Math.sin(a) * (e.r + 10));
        const shard = G.S.enemies[G.S.enemies.length - 1];
        if (shard) shard.wardOf = e.wardToken;
      }
      burst(G.fx, e.x, e.y, e.color, 22, 240, 0.5, 3);
      shake(G.fx, 6);
      sfx('boss');
    }
    const warded = e.sundered && G.S.enemies.some(x => !x.dead && x.wardOf === e.wardToken);
    e.guard = warded ? mv.guard : 1;
  } else if (mv.id === 'bulwark') {
    // plants and hardens on a cycle. It stops moving too, so the window costs the
    // player tempo rather than health — seconds are the currency (GDD §4)
    e.moveT -= dt;
    if (e.moveT <= 0) {
      e.planted = !e.planted;
      e.moveT = e.planted ? mv.dur : mv.every;
      if (e.planted) { burst(G.fx, e.x, e.y, e.color, 14, 120, 0.4, 2); sfx('shield'); }
    }
    e.guard = e.planted ? mv.guard : 1;
    e.spd = e.planted ? 0 : e.baseSpd;
  } else if (mv.id === 'charge') {
    // wind-up, then cross. The tell is the move: it stops (costing the boss the
    // tempo it is about to buy back) and is marked, so the player gets the
    // decision — wall it, slow it, or commit (core.md "Boss signature moves").
    if (e.chargeInit !== true) { e.chargeInit = true; e.moveT = mv.every; }
    e.moveT -= dt;
    if (e.charging) {
      if (e.moveT <= 0) { e.charging = false; e.spd = e.baseSpd; e.moveT = mv.every; }
    } else if (e.winding) {
      e.spd = 0;
      if (e.moveT <= 0) {
        e.winding = false; e.charging = true; e.moveT = mv.dur;
        e.spd = e.baseSpd * mv.spdMult;
        burst(G.fx, e.x, e.y, e.color, 20, 260, 0.45, 3);
        shake(G.fx, 5);
        sfx('boss');
      }
    } else if (e.moveT <= 0) {
      // The wind-up is a window with a meter in it (core.md): the thresholds are
      // copied onto the entity so damageEnemy can resolve an interrupt without
      // knowing the move table — the table still owns every number.
      e.winding = true; e.moveT = mv.tell; e.spd = 0;
      e.windNeed = e.maxHp * mv.interruptFrac;
      e.windDmg = 0;
      e.windTell = mv.tell;
      e.windStun = mv.stun;
      e.windEvery = mv.every;
      sfx('shield');
    }
  } else if (mv.id === 'study') {
    // hardens under CONSECUTIVE fire and forgets when you stop: the mirror of
    // surge. `hurtT` is seconds since the last landed hit (reset in damageEnemy).
    e.hurtT += dt;
    if (e.hurtT >= mv.forget) {
      e.studyT = 0;
      e.guard = 1;
    } else if (e.hurtT < 0.3) {
      e.studyT += dt;
      e.guard = Math.max(mv.floor, Math.pow(mv.step, Math.floor(e.studyT)));
    }
  } else if (mv.id === 'devour') {
    // eats its escort. Not a kill: no xp, no shards, no split — the shape is
    // consumed, which is the whole point of ignoring it being a mistake.
    e.moveT -= dt;
    if (e.moveT <= 0) {
      e.moveT = mv.every;
      let meal = null, best = mv.range;
      for (const x of G.S.enemies) {
        if (x === e || x.dead || x.kind === 'boss') continue;
        const d = dist(e.x, e.y, x.x, x.y);
        if (d < best) { best = d; meal = x; }
      }
      if (meal) {
        meal.dead = true;
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * mv.healPct);
        burst(G.fx, meal.x, meal.y, e.color, 12, 160, 0.4, 2);
        burst(G.fx, e.x, e.y, e.color, 8, 90, 0.3, 2);
        sfx('boss');
      }
    }
  }
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
    e.strike = Math.max(0, e.strike - dt * 4);
    e.rot += e.rotSpd * dt;
    if (e.regenPct && e.hp < e.maxHp) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regenPct * dt);
    }
    // boss signature move (core.md "Boss signature moves"): the table decides,
    // this only executes. Movement multipliers apply before the aura slow.
    if (e.stun > 0) {
      // staggered: it does not advance and its move clock does not run. Tempo,
      // not a damage window — the guard is deliberately untouched (core.md).
      e.stun = Math.max(0, e.stun - dt);
      e.spd = 0;
      if (e.stun === 0 && e.moveId) e.spd = e.baseSpd;
    } else if (e.moveId) runBossMove(G, e, dt);
    // frost aura slow, resisted by age-mass (core.md enemyMass)
    let slow = 1;
    let frostCut = 0, calCut = 0;
    if (G.aura && d < G.aura.r + e.r) {
      frostCut = G.aura.slow / enemyMass(e.age);
      slow = 1 - frostCut;
    }
    // caltrop prick: brief, multiplicative with frost, mass-resisted (core.md)
    if (e.calSlowT > 0) {
      e.calSlowT -= dt;
      calCut = e.calSlow / enemyMass(e.age);
      slow *= 1 - calCut;
    }
    // Seconds purchased (core.md Run state): a shape held at half speed for two
    // seconds has been denied one second of approach. Sources multiply, so the
    // denied second is split in proportion to each one's own reduction rather
    // than credited twice — the ledger totals what was actually denied.
    const denied = (1 - slow) * dt;
    if (denied > 0) {
      const share = frostCut + calCut;
      if (frostCut > 0) S.slowBy.frost = (S.slowBy.frost || 0) + denied * (frostCut / share);
      if (calCut > 0) S.slowBy.caltrop = (S.slowBy.caltrop || 0) + denied * (calCut / share);
    }
    // seek the Point — stop at the rim: besiegers hold position, they don't
    // burrow (core.md Enemies "besiege"). Knockback rides on top unclamped,
    // so CC can still shove a besieger off the rim; it walks back in.
    const ux = (G.cx - e.x) / d, uy = (G.cy - e.y) / d;
    const adv = Math.min(e.spd * slow * dt, Math.max(0, d - (e.r + TOWER_R)));
    e.x += ux * adv + e.kbx * dt;
    e.y += uy * adv + e.kby * dt;
    e.kbx *= Math.pow(0.02, dt); // knockback decays hard
    e.kby *= Math.pow(0.02, dt);
    // contact with the Point (core.md Enemies: siege, not kamikaze).
    // `sieging` is set every frame from the live distance so CC that shoves a
    // shape off the rim clears it immediately — the view must never show a tell
    // for a shape that is no longer in contact.
    const inContact = dist(e.x, e.y, G.cx, G.cy) < e.r + TOWER_R + 1;
    e.sieging = inContact;
    if (inContact) {
      if (e.boss) {
        if (e.contactCd <= 0) {
          hitTower(G, e.dmg);
          e.strike = 1;
          e.contactCd = 1.1;
          // ram, recoil, return — an aged boss recoils less and rams more often
          const m = enemyMass(e.age);
          e.kbx = (-ux * 420) / m; e.kby = (-uy * 420) / m;
        }
      } else if (e.contactCd <= 0) {
        // besiege: strike and stay — dmg every 0.9s, same cadence as the
        // wall siege (core.md force wall row)
        hitTower(G, e.dmg);
        e.strike = 1;
        e.contactCd = 0.9;
        burst(G.fx, e.x, e.y, e.color, 5, 90, 0.25, 2);
      }
    }
  }
  S.enemies = S.enemies.filter(e => !e.dead);
}
