// Ground/field ordnance: mines, mortar (+shell pool — meteor impacts ride it),
// catapult, caltrops, cascade, and burning-ground patches (flame + scorch).
import { dist, TAU } from '../../core/geom.js';
import { damageEnemy, applyKnock, detonatePrimed } from '../enemies.js';
import { burst, shake } from '../fx.js';
import { sfx } from '../audio.js';
import { lvl, stats, outside, aoe } from './shared.js';

/** Burning ground (flame + meteor scorch): patches gutter out, tick on a
 *  per-patch clock — a shield loses one charge per tick, beam precedent. */
export function updateFires(G, dt) {
  const S = G.S;
  if (!S.fires.length) return;
  for (const f of S.fires) {
    f.life -= dt;
    f.tickT -= dt;
    if (f.tickT <= 0) {
      f.tickT += 0.4;
      for (const e of S.enemies) {
        if (!e.dead && dist(f.x, f.y, e.x, e.y) <= f.r + e.r) {
          damageEnemy(G, e, f.dps * 0.4, { silent: true });
        }
      }
    }
  }
  S.fires = S.fires.filter(f => f.life > 0);
}

export function updateField(G, dt) {
  const S = G.S;
  const wt = G.wt;

  // mines: seed random field spots up to the live cap; armed mines trigger on
  // proximity (core.md mine row)
  if (lvl(S, 'mine') >= 1) {
    const st = stats(S, 'mine');
    wt.mineT -= dt;
    if (wt.mineT <= 0) {
      wt.mineT = st.cd * S.cdMult;
      if (S.mines.length < st.cap) {
        const a = Math.random() * TAU;
        const rr = 120 + Math.random() * Math.max(40, Math.min(G.W, G.H) / 2 - 160);
        S.mines.push({
          x: G.cx + Math.cos(a) * rr, y: G.cy + Math.sin(a) * rr,
          arm: st.arm, dmg: st.dmg, blast: st.blast, trigger: st.trigger,
        });
      }
    }
    for (const m of S.mines) {
      if (m.arm > 0) { m.arm -= dt; continue; }
      for (const e of S.enemies) {
        if (e.dead) continue;
        if (dist(m.x, m.y, e.x, e.y) <= m.trigger + e.r) {
          m.dead = true;
          burst(G.fx, m.x, m.y, '#9ff3ff', 16, 230, 0.4, 2.5);
          burst(G.fx, m.x, m.y, '#e8fbff', 8, 90, 0.25, 1.5);
          shake(G.fx, 2);
          aoe(G, m.x, m.y, m.blast, m.dmg);
          sfx('nova');
          break;
        }
      }
    }
    S.mines = S.mines.filter(m => !m.dead);
  }

  // mortar: lob arcing shells at random living shapes; shells arc OVER the
  // arena wall by design (core.md mortar row)
  if (lvl(S, 'mortar') >= 1) {
    const st = stats(S, 'mortar');
    wt.mortT -= dt;
    if (wt.mortT <= 0) {
      const live = S.enemies.filter(e => !e.dead);
      if (live.length) {
        wt.mortT = st.cd * S.cdMult;
        for (let i = 0; i < st.shells; i++) {
          const e = live[Math.floor(Math.random() * live.length)];
          S.shells.push({
            x0: G.cx, y0: G.cy,
            tx: e.x + (Math.random() * 2 - 1) * st.scatter,
            ty: e.y + (Math.random() * 2 - 1) * st.scatter,
            t: 0, flight: st.flight, dmg: st.dmg, blast: st.blast,
          });
        }
        sfx('seek');
      } else wt.mortT = 0.2;
    }
  }
  // the shell pool serves mortar AND meteor (hold.js pushes kind:'meteor')
  for (const sh of S.shells) {
    sh.t += dt;
    if (sh.t >= sh.flight) {
      sh.dead = true;
      const big = sh.kind === 'meteor';
      burst(G.fx, sh.tx, sh.ty, '#ffd24d', big ? 28 : 18, big ? 300 : 240, 0.45, 3);
      burst(G.fx, sh.tx, sh.ty, '#fff3d0', big ? 14 : 8, big ? 140 : 100, 0.25, 1.5);
      shake(G.fx, big ? 5 : 2);
      // survivors of a meteor take a radial shove scaling with charge (core.md)
      aoe(G, sh.tx, sh.ty, sh.blast, sh.dmg, sh.knock ? e => {
        const d = dist(sh.tx, sh.ty, e.x, e.y) || 1;
        applyKnock(e, ((e.x - sh.tx) / d) * sh.knock, ((e.y - sh.ty) / d) * sh.knock);
      } : null);
      if (sh.scorch && S.fires.length < 40) {
        S.fires.push({
          x: sh.tx, y: sh.ty, r: sh.blast * 0.5, dps: sh.scorch.dps,
          life: sh.scorch.life, max: sh.scorch.life, tickT: 0.2,
        });
      }
      sfx('nova');
    }
  }
  S.shells = S.shells.filter(sh => !sh.dead);

  // catapult: the boulder never stops for anyone — trample + shove (core.md)
  if (lvl(S, 'catapult') >= 1) {
    const st = stats(S, 'catapult');
    wt.cataT -= dt;
    if (wt.cataT <= 0) {
      const live = S.enemies.filter(e => !e.dead);
      if (live.length) {
        wt.cataT = st.cd * S.cdMult;
        for (let i = 0; i < st.n; i++) {
          const e = live[Math.floor(Math.random() * live.length)];
          const a = Math.atan2(e.y - G.cy, e.x - G.cx) + (i ? (Math.random() - 0.5) * 0.5 : 0);
          S.boulders.push({
            x: G.cx, y: G.cy, vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed,
            dmg: st.dmg, r: st.r, knock: st.knock, tick: st.tick,
            rot: 0, hits: new Map(), life: 12,
          });
        }
        sfx('wave');
      } else wt.cataT = 0.2;
    }
    for (const b of S.boulders) {
      b.life -= dt;
      b.rot += 2.2 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (outside(G, b.x, b.y) || b.life <= 0) {
        burst(G.fx, b.x, b.y, '#bcd8e0', 14, 160, 0.4, 2.5); // crumble
        shake(G.fx, 2);
        b.dead = true; continue;
      }
      for (const e of S.enemies) {
        if (e.dead) continue;
        if (dist(b.x, b.y, e.x, e.y) >= e.r + b.r) continue;
        if (S.time < (b.hits.get(e) || 0)) continue;
        b.hits.set(e, S.time + b.tick);
        damageEnemy(G, e, b.dmg);
        if (!e.dead) {
          // shove: part forward along the roll, part aside from the bulk
          const sp = Math.hypot(b.vx, b.vy) || 1;
          const dd = dist(b.x, b.y, e.x, e.y) || 1;
          applyKnock(e,
            ((b.vx / sp) * 0.5 + ((e.x - b.x) / dd) * 0.6) * b.knock,
            ((b.vy / sp) * 0.5 + ((e.y - b.y) / dd) * 0.6) * b.knock);
        }
      }
    }
    S.boulders = S.boulders.filter(b => !b.dead);
  }

  // caltrops: cluster-seeded ground spikes, one prick each (core.md caltrop row)
  if (lvl(S, 'caltrop') >= 1) {
    const st = stats(S, 'caltrop');
    wt.calT -= dt;
    if (wt.calT <= 0) {
      wt.calT = st.cd * S.cdMult;
      if (S.caltrops.length < st.cap) {
        const a = Math.random() * TAU;
        const rr = 120 + Math.random() * Math.max(40, Math.min(G.W, G.H) / 2 - 160);
        const px = G.cx + Math.cos(a) * rr, py = G.cy + Math.sin(a) * rr;
        for (let i = 0; i < st.cluster && S.caltrops.length < st.cap; i++) {
          const ca = Math.random() * TAU, cr = Math.sqrt(Math.random()) * st.patchR;
          S.caltrops.push({
            x: px + Math.cos(ca) * cr, y: py + Math.sin(ca) * cr,
            dmg: st.dmg, slow: st.slow, slowDur: st.slowDur, life: st.life,
          });
        }
      }
    }
    for (const c of S.caltrops) {
      c.life -= dt;
      if (c.life <= 0) { c.dead = true; continue; }
      for (const e of S.enemies) {
        if (e.dead) continue;
        if (dist(c.x, c.y, e.x, e.y) <= 6 + e.r) {
          c.dead = true; // spent on the prick
          damageEnemy(G, e, c.dmg);
          if (!e.dead) { e.calSlow = c.slow; e.calSlowT = c.slowDur; }
          burst(G.fx, c.x, c.y, '#9ff3ff', 3, 60, 0.2, 1.5);
          break;
        }
      }
    }
    S.caltrops = S.caltrops.filter(c => !c.dead);
  }

  // cascade: sparks prime, fuses tick, primes spread on detonation (core.md).
  // Death-while-primed detonates via killEnemy (enemies.js detonatePrimed).
  if (lvl(S, 'cascade') >= 1) {
    const st = stats(S, 'cascade');
    wt.cascT -= dt;
    if (wt.cascT <= 0) {
      const live = S.enemies.filter(e => !e.dead);
      if (live.length) {
        wt.cascT = st.cd * S.cdMult;
        for (let i = 0; i < st.n; i++) {
          const e = live[Math.floor(Math.random() * live.length)];
          const d = dist(G.cx, G.cy, e.x, e.y) || 1;
          S.sparks.push({
            x: G.cx, y: G.cy,
            vx: ((e.x - G.cx) / d) * st.speed, vy: ((e.y - G.cy) / d) * st.speed,
            target: e, dmg: st.dmg, life: 4,
          });
        }
        sfx('zap');
      } else wt.cascT = 0.2;
    }
    for (const sp of S.sparks) {
      sp.life -= dt;
      if (sp.target && !sp.target.dead) {
        // gentle homing: enough to connect, not a seeker missile
        const d = dist(sp.x, sp.y, sp.target.x, sp.target.y) || 1;
        sp.vx += ((sp.target.x - sp.x) / d) * 700 * dt;
        sp.vy += ((sp.target.y - sp.y) / d) * 700 * dt;
        const v = Math.hypot(sp.vx, sp.vy) || 1;
        sp.vx *= st.speed / v; sp.vy *= st.speed / v;
      }
      sp.x += sp.vx * dt; sp.y += sp.vy * dt;
      if (sp.life <= 0) { sp.dead = true; continue; }
      for (const e of S.enemies) {
        if (e.dead) continue;
        if (dist(sp.x, sp.y, e.x, e.y) < e.r + 5) {
          if (!e.primed || e.primed.dmg < sp.dmg) {
            e.primed = { t: st.fuse, dmg: sp.dmg, gen: 0, fuse: st.fuse, blast: st.blast, decay: st.decay, minDmg: st.minDmg, maxGen: st.maxGen };
          }
          sp.dead = true;
          break;
        }
      }
    }
    S.sparks = S.sparks.filter(s => !s.dead);
    // fuse clock: detonate on fuse-out (death path lives in killEnemy)
    for (const e of S.enemies) {
      if (e.dead || !e.primed) continue;
      e.primed.t -= dt;
      if (e.primed.t <= 0) detonatePrimed(G, e);
    }
  }
}
