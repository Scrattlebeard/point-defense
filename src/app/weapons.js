// Weapon executors: manual (bolt/shockwave/beam) + auto (orbit, nova, frost,
// tesla, seek, turret) + projectiles. Stats come from core config; every
// cooldown is scaled by S.cdMult. No tuning constants of its own beyond
// projectile plumbing (speeds/lifetimes of visuals).
import { WEAPONS } from '../core/config.js';
import { dist, distToSegment, TAU } from '../core/geom.js';
import { damageEnemy, nearestEnemy } from './enemies.js';
import { burst, shake } from './fx.js';
import { sfx } from './audio.js';

export function resetWeapons(G) {
  G.wt = {
    boltT: 0.3, waveCd: 0,
    orbA: 0, novaT: 2.5, teslaT: 1.2, seekT: 1.6, turretT: 0.8,
    beamOwner: null, beamAim: null,
  };
  G.aim = { x: G.cx, y: G.cy - 160 }; // standing aim point; input moves it
  G.aura = null;
  G.waveFx = [];
}

const lvl = (S, id) => S.weapons[id];
const stats = (S, id) => WEAPONS[id].stats(S.weapons[id]);

// ---------- bolt volley (aim-driven; fired by updateWeapons, never by input) ----------
function boltVolley(G, tx, ty, st) {
  const S = G.S;
  const base = Math.atan2(ty - G.cy, tx - G.cx);
  for (let i = 0; i < st.count; i++) {
    const a = base + (i - (st.count - 1) / 2) * 0.11;
    S.bullets.push({
      x: G.cx, y: G.cy, vx: Math.cos(a) * 540, vy: Math.sin(a) * 540,
      dmg: st.dmg, pierce: st.pierce, r: 3.5, life: 1.3, color: '#9ff3ff', hit: new Set(),
    });
  }
  sfx('shoot');
}

// ---------- manual: shockwave (swipe) ----------
export function fireShockwave(G, from, to) {
  const S = G.S;
  if (lvl(S, 'shockwave') < 1) return false;
  if (G.wt.waveCd > 0) return false;
  const st = stats(S, 'shockwave');
  G.wt.waveCd = st.cd * S.cdMult;
  const len = dist(from.x, from.y, to.x, to.y) || 1;
  const dx = (to.x - from.x) / len, dy = (to.y - from.y) / len;
  for (const e of S.enemies) {
    if (e.dead) continue;
    if (distToSegment(e.x, e.y, from.x, from.y, to.x, to.y) <= st.width / 2 + e.r) {
      damageEnemy(G, e, st.dmg);
      e.kbx += dx * st.knock; e.kby += dy * st.knock;
    }
  }
  G.waveFx.push({ from: { ...from }, to: { ...to }, width: st.width, t: 0 });
  for (let i = 0; i <= 6; i++) {
    burst(G.fx, from.x + (to.x - from.x) * (i / 6), from.y + (to.y - from.y) * (i / 6), '#4de8ff', 2, 90, 0.35, 2);
  }
  shake(G.fx, 3);
  sfx('wave');
  return true;
}

// ---------- main per-frame update ----------
export function updateWeapons(G, dt) {
  const S = G.S;
  const wt = G.wt;
  wt.waveCd = Math.max(0, wt.waveCd - dt);

  // bolt: auto-fires toward the standing aim; L6 adds a nearest-target volley
  if (lvl(S, 'bolt') >= 1) {
    const st = stats(S, 'bolt');
    wt.boltT -= dt;
    if (wt.boltT <= 0) {
      if (S.enemies.some(e => !e.dead)) {
        if (G.aim) boltVolley(G, G.aim.x, G.aim.y, st);
        if (st.twin) {
          const e = nearestEnemy(S, G.cx, G.cy);
          if (e) boltVolley(G, e.x, e.y, st);
        }
        wt.boltT = st.cd * S.cdMult;
      } else wt.boltT = 0.1;
    }
  }

  // beam (hold)
  updateBeam(G, dt);

  // frost aura (passive; read by enemies.js)
  G.aura = lvl(S, 'frost') >= 1
    ? { r: stats(S, 'frost').radius, slow: stats(S, 'frost').slow }
    : null;

  // orbitals
  if (lvl(S, 'orbit') >= 1) {
    const st = stats(S, 'orbit');
    wt.orbA += st.speed * dt;
    for (let i = 0; i < st.n; i++) {
      const a = wt.orbA + (i * TAU) / st.n;
      const bx = G.cx + Math.cos(a) * st.radius;
      const by = G.cy + Math.sin(a) * st.radius;
      for (const e of S.enemies) {
        if (e.dead || S.time < e.orbHit) continue;
        if (dist(bx, by, e.x, e.y) < 13 + e.r) {
          damageEnemy(G, e, st.dmg);
          e.orbHit = S.time + 0.35;
          const d = dist(G.cx, G.cy, e.x, e.y) || 1;
          // modest shove: with frost slow it must never exceed walking speed (core.md frost note)
          e.kbx += ((e.x - G.cx) / d) * 35; e.kby += ((e.y - G.cy) / d) * 35;
        }
      }
    }
  }

  // nova
  if (lvl(S, 'nova') >= 1) {
    const st = stats(S, 'nova');
    wt.novaT -= dt;
    if (wt.novaT <= 0) {
      wt.novaT = st.cd * S.cdMult;
      S.rings.push({ r: 26, max: st.radius, speed: 330, dmg: st.dmg, hit: new Set() });
      sfx('nova');
    }
  }
  for (const ring of S.rings) {
    ring.r += ring.speed * dt;
    for (const e of S.enemies) {
      if (e.dead || ring.hit.has(e)) continue;
      if (Math.abs(dist(e.x, e.y, G.cx, G.cy) - ring.r) < 20 + e.r) {
        ring.hit.add(e);
        damageEnemy(G, e, ring.dmg);
      }
    }
  }
  S.rings = S.rings.filter(r => r.r < r.max);

  // tesla
  if (lvl(S, 'tesla') >= 1) {
    const st = stats(S, 'tesla');
    wt.teslaT -= dt;
    if (wt.teslaT <= 0) {
      const first = nearestEnemy(S, G.cx, G.cy, st.range);
      if (first) {
        wt.teslaT = st.cd * S.cdMult;
        const targets = [first];
        while (targets.length < st.chains) {
          const last = targets[targets.length - 1];
          let next = null, bd = 140;
          for (const e of S.enemies) {
            if (e.dead || targets.includes(e)) continue;
            const d = dist(last.x, last.y, e.x, e.y);
            if (d < bd) { bd = d; next = e; }
          }
          if (!next) break;
          targets.push(next);
        }
        targets.forEach((e, i) => damageEnemy(G, e, st.dmg * Math.pow(0.8, i)));
        S.zaps.push({ pts: [{ x: G.cx, y: G.cy }, ...targets.map(e => ({ x: e.x, y: e.y }))], t: 0 });
        sfx('zap');
      } else wt.teslaT = 0.2;
    }
  }
  for (const z of S.zaps) z.t += dt;
  S.zaps = S.zaps.filter(z => z.t < 0.14);

  // seekers
  if (lvl(S, 'seek') >= 1) {
    const st = stats(S, 'seek');
    wt.seekT -= dt;
    if (wt.seekT <= 0 && S.enemies.some(e => !e.dead)) {
      wt.seekT = st.cd * S.cdMult;
      for (let i = 0; i < st.n; i++) {
        const a = Math.random() * TAU;
        S.missiles.push({
          x: G.cx, y: G.cy, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140,
          speed: st.speed, dmg: st.dmg, blast: st.blast, target: null, life: 4,
        });
      }
      sfx('seek');
    }
  }
  for (const m of S.missiles) {
    m.life -= dt;
    if (!m.target || m.target.dead) m.target = nearestEnemy(S, m.x, m.y);
    if (m.target) {
      const d = dist(m.x, m.y, m.target.x, m.target.y) || 1;
      const ux = (m.target.x - m.x) / d, uy = (m.target.y - m.y) / d;
      m.vx += ux * 900 * dt; m.vy += uy * 900 * dt;
      const sp = Math.hypot(m.vx, m.vy) || 1;
      m.vx = (m.vx / sp) * m.speed; m.vy = (m.vy / sp) * m.speed;
    }
    m.x += m.vx * dt; m.y += m.vy * dt;
    const hit = m.target && !m.target.dead && dist(m.x, m.y, m.target.x, m.target.y) < m.target.r + 6;
    if (hit || m.life <= 0) {
      m.dead = true;
      burst(G.fx, m.x, m.y, '#ffd24d', 10, 150, 0.35, 2.5);
      for (const e of G.S.enemies) {
        if (e.dead) continue;
        if (dist(m.x, m.y, e.x, e.y) <= m.blast + e.r) damageEnemy(G, e, m.dmg);
      }
    }
  }
  S.missiles = S.missiles.filter(m => !m.dead);

  // turrets
  if (lvl(S, 'turret') >= 1) {
    const st = stats(S, 'turret');
    wt.turretT -= dt;
    if (wt.turretT <= 0) {
      let fired = false;
      for (let i = 0; i < st.n; i++) {
        const a = S.time * 0.5 + (i * TAU) / st.n;
        const tx = G.cx + Math.cos(a) * 46;
        const ty = G.cy + Math.sin(a) * 46;
        const e = nearestEnemy(S, tx, ty, st.range);
        if (!e) continue;
        const d = dist(tx, ty, e.x, e.y) || 1;
        S.bullets.push({
          x: tx, y: ty, vx: ((e.x - tx) / d) * 460, vy: ((e.y - ty) / d) * 460,
          dmg: st.dmg, pierce: 0, r: 2.5, life: 1.1, color: '#ffd24d', hit: new Set(),
        });
        fired = true;
      }
      if (fired) sfx('shoot');
      wt.turretT = st.cd * S.cdMult;
    }
  }

  // bullets (bolt + turret)
  for (const b of S.bullets) {
    b.life -= dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
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

  for (const w of G.waveFx) w.t += dt;
  G.waveFx = G.waveFx.filter(w => w.t < 0.3);
}

function updateBeam(G, dt) {
  const S = G.S;
  const wt = G.wt;
  const l = lvl(S, 'beam');
  const beaming = l >= 1 && wt.beamAim && !S.overheated;
  if (beaming) {
    const st = stats(S, 'beam');
    const dx = wt.beamAim.x - G.cx, dy = wt.beamAim.y - G.cy;
    const len = Math.hypot(dx, dy);
    if (len > 4) {
      const ex = G.cx + (dx / len) * 1600, ey = G.cy + (dy / len) * 1600;
      G.beamEnd = { x: ex, y: ey, width: st.width };
      for (const e of S.enemies) {
        if (e.dead) continue;
        if (distToSegment(e.x, e.y, G.cx, G.cy, ex, ey) <= st.width / 2 + e.r) {
          damageEnemy(G, e, st.dps * dt, { silent: true });
        }
      }
      if (st.heatRate > 0) {
        S.heat = Math.min(1, S.heat + st.heatRate * dt);
        if (S.heat >= 1) S.overheated = true;
      }
    } else G.beamEnd = null;
  } else {
    G.beamEnd = null;
    S.heat = Math.max(0, S.heat - 0.45 * dt);
    if (S.overheated && S.heat < 0.35) S.overheated = false;
  }
}
