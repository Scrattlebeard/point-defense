// Everything that fires toward the standing aim (README pillar 1 + ADR-0004
// "AIM is not a slot"): bolt, scattergun, repeater, howitzer, boomerang, and
// the shared bullet pool. All hold fire with no live in-bounds shape.
import { dist } from '../../core/geom.js';
import { damageEnemy, nearestEnemies } from '../enemies.js';
import { shake } from '../fx.js';
import { sfx } from '../audio.js';
import { lvl, stats, outside, wallFlare, wallBounce, fireBullet } from './shared.js';

const aimReady = G => G.aim && G.S.enemies.some(e => !e.dead);
const aimAngle = G => Math.atan2(G.aim.y - G.cy, G.aim.x - G.cx);

// Center-true fan: one bolt EXACTLY on the target line + flanks at ±0.11 —
// aim fidelity is the weapon's identity (core.md bolt row, 2026-07-24).
const FAN_OFFSETS = [[0], [0, 0.11], [0, 0.11, -0.11]];
function fireFan(G, tx, ty, st) {
  const base = Math.atan2(ty - G.cy, tx - G.cx);
  for (const off of FAN_OFFSETS[st.volley - 1]) {
    fireBullet(G.S, G.cx, G.cy, base + off, 540, st.dmg, { pierce: st.pierce, r: 3.5 });
  }
}

/** Bolt: auto-fires toward the standing aim; the auto stream picks its own targets. */
export function updateBolt(G, dt) {
  const S = G.S;
  const wt = G.wt;
  if (lvl(S, 'bolt') < 1) return;
  const st = stats(S, 'bolt');
  wt.boltT -= dt;
  if (wt.boltT <= 0) {
    if (S.enemies.some(e => !e.dead)) {
      if (G.aim) fireFan(G, G.aim.x, G.aim.y, st);
      for (const e of nearestEnemies(S, G.cx, G.cy, st.auto, { W: G.W, H: G.H })) {
        fireFan(G, e.x, e.y, st);
      }
      sfx('shoot');
      wt.boltT = st.cd * S.cdMult;
    } else wt.boltT = 0.1;
  }
}

/** Aim ordnance (ADR-0004 wave A): scattergun, repeater, howitzer, boomerang. */
export function updateAimOrdnance(G, dt) {
  const S = G.S;
  const wt = G.wt;

  // scattergun: a shot PATTERN, not a fan — every pellet on its own random
  // bearing/speed inside the cone (core.md scatter row)
  if (lvl(S, 'scatter') >= 1) {
    const st = stats(S, 'scatter');
    wt.scatT -= dt;
    if (wt.scatT <= 0) {
      if (aimReady(G)) {
        const base = aimAngle(G);
        for (let i = 0; i < st.pellets; i++) {
          fireBullet(S, G.cx, G.cy,
            base + (Math.random() * 2 - 1) * st.spread,
            st.speed + (Math.random() * 2 - 1) * st.jitter,
            st.dmg, { color: '#bfe9ff' });
        }
        sfx('shoot');
        wt.scatT = st.cd * S.cdMult;
      } else wt.scatT = 0.1;
    }
  }

  // repeater: salvo state machine; each shot tracks the LIVE aim (core.md)
  if (lvl(S, 'burst') >= 1) {
    const st = stats(S, 'burst');
    if (wt.burstLeft > 0) {
      wt.burstGapT -= dt;
      if (wt.burstGapT <= 0 && G.aim) {
        fireBullet(S, G.cx, G.cy, aimAngle(G), st.speed, st.dmg);
        sfx('shoot');
        wt.burstLeft--;
        wt.burstGapT += st.gap;
        if (wt.burstLeft === 0) wt.burstT = st.cd * S.cdMult;
      }
    } else {
      wt.burstT -= dt;
      if (wt.burstT <= 0) {
        if (aimReady(G)) { wt.burstLeft = st.n; wt.burstGapT = 0; }
        else wt.burstT = 0.1;
      }
    }
  }

  // howitzer: three light rounds, a beat, one piercing shell (core.md heavy row)
  if (lvl(S, 'heavy') >= 1) {
    const st = stats(S, 'heavy');
    wt.heavyPhaseT -= dt;
    if (wt.heavyPhaseT <= 0) {
      if (!aimReady(G)) wt.heavyPhaseT = 0.1;
      else if (wt.heavyPhase < 3) {
        fireBullet(S, G.cx, G.cy, aimAngle(G), st.lightSpeed, st.lightDmg, { r: 2.5 });
        sfx('shoot');
        wt.heavyPhase++;
        wt.heavyPhaseT = wt.heavyPhase === 3 ? st.pause : st.lightGap;
      } else {
        fireBullet(S, G.cx, G.cy, aimAngle(G), st.heavySpeed, st.heavyDmg,
          { pierce: st.pierce, r: 7, color: '#dff6ff' });
        shake(G.fx, 1.5);
        sfx('shoot');
        wt.heavyPhase = 0;
        wt.heavyPhaseT = st.cd * S.cdMult;
      }
    }
  }

  // boomerang: out (decelerating) → turn/wall-bounce → home (core.md boomer row)
  if (lvl(S, 'boomer') >= 1) {
    const st = stats(S, 'boomer');
    wt.boomT -= dt;
    if (wt.boomT <= 0) {
      if (aimReady(G)) {
        wt.boomT = st.cd * S.cdMult;
        const base = aimAngle(G);
        for (let i = 0; i < st.n; i++) {
          const a = base + i * 0.5;
          S.boomers.push({
            x: G.cx, y: G.cy, vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed,
            dmg: st.dmg, r: st.r, out: true, hit: new Set(), spin: 0, life: 8,
          });
        }
        sfx('wave');
      } else wt.boomT = 0.1;
    }
    const turn = b => { b.out = false; b.hit.clear(); }; // the return leg re-bites
    for (const b of S.boomers) {
      b.life -= dt;
      b.spin += 13 * dt;
      if (b.out) {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const ns = sp - st.decel * dt;
        if (ns <= 0) { b.vx = 0; b.vy = 0; turn(b); }
        else { b.vx *= ns / sp; b.vy *= ns / sp; }
      } else {
        const d = dist(b.x, b.y, G.cx, G.cy) || 1;
        b.vx += ((G.cx - b.x) / d) * st.retAccel * dt;
        b.vy += ((G.cy - b.y) / d) * st.retAccel * dt;
        const sp = Math.hypot(b.vx, b.vy) || 1;
        if (sp > st.retSpeed) { b.vx *= st.retSpeed / sp; b.vy *= st.retSpeed / sp; }
        if (d < 26) { b.dead = true; continue; }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      // the force field returns it to sender (core.md: bounce, don't die)
      if (outside(G, b.x, b.y)) {
        wallFlare(G, b.x, b.y);
        wallBounce(G, b);
        if (b.out) turn(b);
      }
      if (b.life <= 0) { b.dead = true; continue; }
      for (const e of S.enemies) {
        if (e.dead || b.hit.has(e)) continue;
        if (dist(b.x, b.y, e.x, e.y) < e.r + b.r) {
          b.hit.add(e);
          damageEnemy(G, e, b.dmg);
        }
      }
    }
    S.boomers = S.boomers.filter(b => !b.dead);
  }
}

/** The shared bullet pool (bolt + turret + aim ordnance) — runs after every
 *  spawn site so a bullet fired this frame moves this frame (weapons.md order). */
export function updateBullets(G, dt) {
  const S = G.S;
  for (const b of S.bullets) {
    b.life -= dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (outside(G, b.x, b.y)) {
      wallFlare(G, b.x, b.y);
      b.dead = true; continue;
    }
    if (b.life <= 0) { b.dead = true; continue; }
    for (const e of S.enemies) {
      if (e.dead || b.hit.has(e)) continue;
      if (dist(b.x, b.y, e.x, e.y) < e.r + b.r) {
        b.hit.add(e);
        damageEnemy(G, e, b.dmg);
        if (b.pierce > 0) b.pierce--;
        else { b.dead = true; break; }
      }
    }
  }
  S.bullets = S.bullets.filter(b => !b.dead);
}
