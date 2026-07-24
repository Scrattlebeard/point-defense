// Weapon executors: manual (bolt/force-wall/beam) + auto (orbit, nova, frost,
// tesla, seek, turret) + projectiles. Stats come from core config; every
// cooldown is scaled by S.cdMult. No tuning constants of its own beyond
// projectile plumbing (speeds/lifetimes of visuals).
import { WEAPONS } from '../core/config.js';
import { dist, distToSegment, TAU } from '../core/geom.js';
import { enemyMass } from '../core/balance.js';
import { damageEnemy, nearestEnemy, nearestEnemies, applyKnock } from './enemies.js';
import { burst, shake, addFlare } from './fx.js';
import { sfx } from './audio.js';

// Overheat lockout releases at this heat level; the HUD gauge draws a notch here
// so the player can see when the beam comes back (core.md beam row).
export const BEAM_REARM = 0.35;

export function resetWeapons(G) {
  G.wt = {
    boltT: 0.3, wallCd: 0,
    orbA: 0, novaT: 2.5, teslaT: 1.2, teslaReady: false, teslaCharge: 0, seekT: 1.6, turretT: 0.8,
    mineT: 1.0, mortT: 1.5,
    scatT: 0.15, burstT: 0.1, burstLeft: 0, burstGapT: 0,
    heavyPhase: 0, heavyPhaseT: 0.1, boomT: 1.4,
    beamOwner: null, beamAim: null,
  };
  G.aim = { x: G.cx, y: G.cy - 160 }; // standing aim point; input moves it
  G.aura = null;
  G.walls = [];
}

const lvl = (S, id) => S.weapons[id];
const stats = (S, id) => WEAPONS[id].stats(S.weapons[id]);

// ---------- bolt (aim-driven; fired by updateWeapons, never by input) ----------
// Center-true fan: one bolt EXACTLY on the target line + flanks at ±0.11 —
// aim fidelity is the weapon's identity (core.md bolt row, 2026-07-24).
const FAN_OFFSETS = [[0], [0, 0.11], [0, 0.11, -0.11]];
function fireFan(G, tx, ty, st) {
  const base = Math.atan2(ty - G.cy, tx - G.cx);
  for (const off of FAN_OFFSETS[st.volley - 1]) {
    const a = base + off;
    G.S.bullets.push({
      // life is a safety net only — the arena wall is the real range (app.md)
      x: G.cx, y: G.cy, vx: Math.cos(a) * 540, vy: Math.sin(a) * 540,
      dmg: st.dmg, pierce: st.pierce, r: 3.5, life: 6, color: '#9ff3ff', hit: new Set(),
    });
  }
}

// ---------- manual: force wall (swipe) ----------
export function fireWall(G, from, to) {
  const S = G.S;
  if (lvl(S, 'wall') < 1) return false;
  if (G.wt.wallCd > 0) return false;
  const st = stats(S, 'wall');
  G.wt.wallCd = st.cd;
  // anchor at the gesture start; trim overshoot toward the tail (core.md wall row)
  let { x: ax, y: ay } = from, { x: bx, y: by } = to;
  const len = dist(ax, ay, bx, by) || 1;
  if (len > st.len) {
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    bx = ax + ux * st.len;
    by = ay + uy * st.len;
  }
  // outward normal: perpendicular pointing away from the Point
  let nx = -(by - ay), ny = bx - ax;
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl; ny /= nl;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  if (nx * (G.cx - mx) + ny * (G.cy - my) > 0) { nx = -nx; ny = -ny; }
  while (G.walls.length >= st.maxWalls) G.walls.shift(); // cap: replace the oldest
  G.walls.push({ ax, ay, bx, by, nx, ny, hp: st.hp, maxHp: st.hp, tick: 0 });
  for (let i = 0; i <= 5; i++) {
    burst(G.fx, ax + (bx - ax) * (i / 5), ay + (by - ay) * (i / 5), '#4de8ff', 2, 80, 0.3, 2);
  }
  sfx('wave');
  return true;
}

function updateWalls(G, dt) {
  const S = G.S;
  if (!G.walls.length) return;
  const st = stats(S, 'wall');
  for (const w of G.walls) {
    w.hp -= (w.maxHp / st.dur) * dt; // passive degen: no wall is forever
    w.tick -= dt;
    const doTick = w.tick <= 0;
    if (doTick) w.tick += st.tick;
    for (const e of S.enemies) {
      if (e.dead) continue;
      if (distToSegment(e.x, e.y, w.ax, w.ay, w.bx, w.by) <= 14 + e.r) {
        const m = enemyMass(e.age);
        e.x += (w.nx * st.push * dt) / m;
        e.y += (w.ny * st.push * dt) / m;
        if (doTick) damageEnemy(G, e, st.dmg);
        if (S.time >= e.wallAtk) { // the siege: shapes fight the wall (core.md)
          w.hp -= e.dmg;
          e.wallAtk = S.time + 0.9;
          burst(G.fx, e.x - w.nx * e.r, e.y - w.ny * e.r, '#9fd8ff', 3, 70, 0.25, 1.5);
        }
      }
    }
  }
  G.walls = G.walls.filter(w => w.hp > 0);
}

// ---------- main per-frame update ----------
export function updateWeapons(G, dt) {
  const S = G.S;
  const wt = G.wt;
  wt.wallCd = Math.max(0, wt.wallCd - dt);
  updateWalls(G, dt);

  // bolt: auto-fires toward the standing aim; L6 adds a nearest-target volley
  if (lvl(S, 'bolt') >= 1) {
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
          // shove restored 35→45 after the age-accrual fix: fresh shapes fling
          // properly again, veterans still resist via mass (core.md enemyMass)
          applyKnock(e, ((e.x - G.cx) / d) * 45, ((e.y - G.cy) / d) * 45);
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

  // tesla — explicit charge state for the telegraph (app.md): charging 0→1,
  // held at full when ready with no target in range
  if (lvl(S, 'tesla') >= 1) {
    const st = stats(S, 'tesla');
    const cd = st.cd * S.cdMult;
    wt.teslaT -= dt;
    if (wt.teslaT <= 0) {
      const first = nearestEnemy(S, G.cx, G.cy, st.range);
      if (first) {
        wt.teslaT = cd;
        wt.teslaReady = false;
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
        // discharge oomph: the built-up charge visibly lets go (app.md)
        burst(G.fx, G.cx, G.cy, '#bee6ff', 9, 170, 0.3, 2);
        burst(G.fx, first.x, first.y, '#bee6ff', 7, 130, 0.25, 2);
        shake(G.fx, 2);
        sfx('zap');
      } else {
        wt.teslaT = 0.15; // rescan soon, but display stays "charged"
        wt.teslaReady = true;
      }
    }
    wt.teslaCharge = wt.teslaReady ? 1 : Math.max(0, Math.min(1, 1 - wt.teslaT / cd));
  }
  for (const z of S.zaps) z.t += dt;
  S.zaps = S.zaps.filter(z => z.t < 0.18);

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
    const sp0 = Math.hypot(m.vx, m.vy) || 1;
    const vhx = m.vx / sp0, vhy = m.vy / sp0;
    // trajectory re-acquisition (core.md seek row): retarget when the target is
    // gone OR has fallen behind our heading — never orbit a lost cause.
    let stale = !m.target || m.target.dead;
    if (!stale) {
      const d = dist(m.x, m.y, m.target.x, m.target.y) || 1;
      if (((m.target.x - m.x) / d) * vhx + ((m.target.y - m.y) / d) * vhy < -0.1) stale = true;
    }
    if (stale) m.target = acquireAhead(S, m, vhx, vhy);
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
          dmg: st.dmg, pierce: 0, r: 2.5, life: 6, color: '#ffd24d', hit: new Set(),
        });
        fired = true;
      }
      if (fired) sfx('shoot');
      wt.turretT = st.cd * S.cdMult;
    }
  }

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
          for (const t2 of S.enemies) {
            if (!t2.dead && dist(m.x, m.y, t2.x, t2.y) <= m.blast + t2.r) damageEnemy(G, t2, m.dmg);
          }
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
  for (const sh of S.shells) {
    sh.t += dt;
    if (sh.t >= sh.flight) {
      sh.dead = true;
      burst(G.fx, sh.tx, sh.ty, '#ffd24d', 18, 240, 0.45, 3);
      burst(G.fx, sh.tx, sh.ty, '#fff3d0', 8, 100, 0.25, 1.5);
      shake(G.fx, 2);
      for (const e of S.enemies) {
        if (!e.dead && dist(sh.tx, sh.ty, e.x, e.y) <= sh.blast + e.r) damageEnemy(G, e, sh.dmg);
      }
      sfx('nova');
    }
  }
  S.shells = S.shells.filter(sh => !sh.dead);

  // ---- aim ordnance (ADR-0004 wave A): fires toward the standing aim, holds
  // fire with no live shape (the bolt rule) ----
  const aimReady = () => G.aim && S.enemies.some(e => !e.dead);
  const aimAngle = () => Math.atan2(G.aim.y - G.cy, G.aim.x - G.cx);

  // scattergun: a shot PATTERN, not a fan — every pellet on its own random
  // bearing/speed inside the cone (core.md scatter row)
  if (lvl(S, 'scatter') >= 1) {
    const st = stats(S, 'scatter');
    wt.scatT -= dt;
    if (wt.scatT <= 0) {
      if (aimReady()) {
        const base = aimAngle();
        for (let i = 0; i < st.pellets; i++) {
          const a = base + (Math.random() * 2 - 1) * st.spread;
          const sp = st.speed + (Math.random() * 2 - 1) * st.jitter;
          S.bullets.push({
            x: G.cx, y: G.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            dmg: st.dmg, pierce: 0, r: 3, life: 6, color: '#bfe9ff', hit: new Set(),
          });
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
        const a = aimAngle();
        S.bullets.push({
          x: G.cx, y: G.cy, vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed,
          dmg: st.dmg, pierce: 0, r: 3, life: 6, color: '#9ff3ff', hit: new Set(),
        });
        sfx('shoot');
        wt.burstLeft--;
        wt.burstGapT += st.gap;
        if (wt.burstLeft === 0) wt.burstT = st.cd * S.cdMult;
      }
    } else {
      wt.burstT -= dt;
      if (wt.burstT <= 0) {
        if (aimReady()) { wt.burstLeft = st.n; wt.burstGapT = 0; }
        else wt.burstT = 0.1;
      }
    }
  }

  // howitzer: three light rounds, a beat, one piercing shell (core.md heavy row)
  if (lvl(S, 'heavy') >= 1) {
    const st = stats(S, 'heavy');
    wt.heavyPhaseT -= dt;
    if (wt.heavyPhaseT <= 0) {
      if (!aimReady()) wt.heavyPhaseT = 0.1;
      else if (wt.heavyPhase < 3) {
        const a = aimAngle();
        S.bullets.push({
          x: G.cx, y: G.cy, vx: Math.cos(a) * st.lightSpeed, vy: Math.sin(a) * st.lightSpeed,
          dmg: st.lightDmg, pierce: 0, r: 2.5, life: 6, color: '#9ff3ff', hit: new Set(),
        });
        sfx('shoot');
        wt.heavyPhase++;
        wt.heavyPhaseT = wt.heavyPhase === 3 ? st.pause : st.lightGap;
      } else {
        const a = aimAngle();
        S.bullets.push({
          x: G.cx, y: G.cy, vx: Math.cos(a) * st.heavySpeed, vy: Math.sin(a) * st.heavySpeed,
          dmg: st.heavyDmg, pierce: st.pierce, r: 7, life: 6, color: '#dff6ff', hit: new Set(),
        });
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
      if (aimReady()) {
        wt.boomT = st.cd * S.cdMult;
        const base = aimAngle();
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
    const EDGE = 4;
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
      if (b.x < EDGE || b.x > G.W - EDGE || b.y < EDGE || b.y > G.H - EDGE) {
        addFlare(G.fx, Math.min(Math.max(b.x, EDGE), G.W - EDGE),
          Math.min(Math.max(b.y, EDGE), G.H - EDGE),
          b.x < EDGE ? 1 : b.x > G.W - EDGE ? -1 : 0,
          b.y < EDGE ? 1 : b.y > G.H - EDGE ? -1 : 0);
        if (b.x < EDGE) { b.x = EDGE; b.vx = Math.abs(b.vx); }
        if (b.x > G.W - EDGE) { b.x = G.W - EDGE; b.vx = -Math.abs(b.vx); }
        if (b.y < EDGE) { b.y = EDGE; b.vy = Math.abs(b.vy); }
        if (b.y > G.H - EDGE) { b.y = G.H - EDGE; b.vy = -Math.abs(b.vy); }
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

  // bullets (bolt + turret + aim ordnance)
  const EDGE = 4; // arena wall inset (app.md "the play area is walled")
  for (const b of S.bullets) {
    b.life -= dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < EDGE || b.x > G.W - EDGE || b.y < EDGE || b.y > G.H - EDGE) {
      const fx = Math.min(Math.max(b.x, EDGE), G.W - EDGE);
      const fy = Math.min(Math.max(b.y, EDGE), G.H - EDGE);
      addFlare(G.fx, fx, fy,
        b.x < EDGE ? 1 : b.x > G.W - EDGE ? -1 : 0,
        b.y < EDGE ? 1 : b.y > G.H - EDGE ? -1 : 0);
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

/** Best-aligned living shape ahead of the missile's heading; nearest as fallback. */
function acquireAhead(S, m, vhx, vhy) {
  let best = null, bestScore = 0.15; // must be at least vaguely in front
  for (const e of S.enemies) {
    if (e.dead) continue;
    const d = dist(m.x, m.y, e.x, e.y) || 1;
    const align = ((e.x - m.x) / d) * vhx + ((e.y - m.y) / d) * vhy;
    const score = align - d / 2200; // prefer aligned, mildly prefer close
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best || nearestEnemy(S, m.x, m.y);
}

function updateBeam(G, dt) {
  const S = G.S;
  const wt = G.wt;
  const l = lvl(S, 'beam');
  // at max level the beam is always-on, tracking the standing aim (core.md beam row)
  const st = l >= 1 ? stats(S, 'beam') : null;
  const target = wt.beamAim || (st?.alwaysOn ? G.aim : null);
  const beaming = l >= 1 && target && !S.overheated;
  let inBeam = null;
  if (beaming) {
    const dx = target.x - G.cx, dy = target.y - G.cy;
    const len = Math.hypot(dx, dy);
    if (len > 4) {
      // clip the beam at the arena wall (app.md): it blooms there, not beyond
      const ux = dx / len, uy = dy / len;
      const EDGE = 4;
      let t = 1600;
      if (ux > 0) t = Math.min(t, (G.W - EDGE - G.cx) / ux);
      else if (ux < 0) t = Math.min(t, (EDGE - G.cx) / ux);
      if (uy > 0) t = Math.min(t, (G.H - EDGE - G.cy) / uy);
      else if (uy < 0) t = Math.min(t, (EDGE - G.cy) / uy);
      const ex = G.cx + ux * t, ey = G.cy + uy * t;
      G.beamEnd = { x: ex, y: ey, width: st.width };
      inBeam = new Set();
      for (const e of S.enemies) {
        if (!e.dead && distToSegment(e.x, e.y, G.cx, G.cy, ex, ey) <= st.width / 2 + e.r) inBeam.add(e);
      }
      if (st.heatRate > 0) {
        S.heat = Math.min(1, S.heat + st.heatRate * dt);
        if (S.heat >= 1) S.overheated = true;
      }
    } else G.beamEnd = null;
  } else {
    G.beamEnd = null;
    S.heat = Math.max(0, S.heat - 0.45 * dt);
    if (S.overheated && S.heat < BEAM_REARM) S.overheated = false;
  }
  // discrete per-target ticks + exposure ramp (core.md beam row): a shield loses
  // one charge per TICK, never per frame; sustained tracking cooks the target.
  for (const e of S.enemies) {
    if (e.dead) continue;
    if (inBeam && inBeam.has(e)) {
      e.beamHeat = Math.min(1, e.beamHeat + dt / st.rampUp);
      e.beamTick -= dt;
      if (e.beamTick <= 0) {
        damageEnemy(G, e, st.dps * st.tick * (1 + (st.rampMax - 1) * e.beamHeat));
        e.beamTick += st.tick;
      }
    } else if (e.beamHeat > 0) {
      e.beamHeat = Math.max(0, e.beamHeat - dt / 1.5);
      e.beamTick = 0; // re-entry ticks immediately
    }
  }
}
