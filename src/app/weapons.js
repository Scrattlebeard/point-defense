// Weapon executors: manual (bolt/force-wall/beam) + auto (orbit, nova, frost,
// tesla, seek, turret) + projectiles. Stats come from core config; every
// cooldown is scaled by S.cdMult. No tuning constants of its own beyond
// projectile plumbing (speeds/lifetimes of visuals).
import { WEAPONS } from '../core/config.js';
import { dist, distToSegment, TAU } from '../core/geom.js';
import { enemyMass } from '../core/balance.js';
import { damageEnemy, nearestEnemy, nearestEnemies, applyKnock, detonatePrimed } from './enemies.js';
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
    bladeCd: 0, flamePatchT: 0, metCharge: 0, metCd: 0,
    cataT: 2.0, calT: 1.0, cascT: 2.5,
    holdOwner: null, holdAim: null, // one hold-slot weapon per run (ADR-0004)
  };
  G.aim = { x: G.cx, y: G.cy - 160 }; // standing aim point; input moves it
  G.aura = null;
  G.walls = [];
}

const lvl = (S, id) => S.weapons[id];
const stats = (S, id) => WEAPONS[id].stats(S.weapons[id]);

// ---------- shared projectile plumbing ----------
const EDGE = 4; // arena wall inset (app.md "the play area is walled")

/** True when (x,y) sits outside the arena walls. */
const outside = (G, x, y) => x < EDGE || x > G.W - EDGE || y < EDGE || y > G.H - EDGE;

/** Force-field flare at the wall point nearest (x,y) — the standard projectile death. */
function wallFlare(G, x, y) {
  addFlare(G.fx,
    Math.min(Math.max(x, EDGE), G.W - EDGE),
    Math.min(Math.max(y, EDGE), G.H - EDGE),
    x < EDGE ? 1 : x > G.W - EDGE ? -1 : 0,
    y < EDGE ? 1 : y > G.H - EDGE ? -1 : 0);
}

/** Clamp a projectile back inside the walls, reflecting its velocity (boomerang). */
function wallBounce(G, b) {
  if (b.x < EDGE) { b.x = EDGE; b.vx = Math.abs(b.vx); }
  if (b.x > G.W - EDGE) { b.x = G.W - EDGE; b.vx = -Math.abs(b.vx); }
  if (b.y < EDGE) { b.y = EDGE; b.vy = Math.abs(b.vy); }
  if (b.y > G.H - EDGE) { b.y = G.H - EDGE; b.vy = -Math.abs(b.vy); }
}

/** Push a straight bullet into S.bullets, flying along `angle`. */
function fireBullet(S, x, y, angle, speed, dmg, { pierce = 0, r = 3, color = '#9ff3ff' } = {}) {
  S.bullets.push({
    // life is a safety net only — the arena wall is the real range (app.md)
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    dmg, pierce, r, life: 6, color, hit: new Set(),
  });
}

/** Damage every living shape within `radius` of (x,y); `each` runs on survivors. */
function aoe(G, x, y, radius, dmg, each = null) {
  for (const e of G.S.enemies) {
    if (e.dead || dist(x, y, e.x, e.y) > radius + e.r) continue;
    damageEnemy(G, e, dmg);
    if (each && !e.dead) each(e);
  }
}

/**
 * A swipe as the sim sees it: segment anchored at the gesture start, trimmed
 * toward it past maxLen (overshooting the tail must not move the anchor —
 * core.md wall row), plus the unit normal pointing away from the Point.
 * Shared by the force wall and force blades (same gesture, two weapons).
 */
function swipeSegment(G, from, to, maxLen) {
  let { x: ax, y: ay } = from, { x: bx, y: by } = to;
  const len = dist(ax, ay, bx, by) || 1;
  if (len > maxLen) {
    bx = ax + ((bx - ax) / len) * maxLen;
    by = ay + ((by - ay) / len) * maxLen;
  }
  let nx = -(by - ay), ny = bx - ax;
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl; ny /= nl;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  if (nx * (G.cx - mx) + ny * (G.cy - my) > 0) { nx = -nx; ny = -ny; }
  return { ax, ay, bx, by, nx, ny };
}

// ---------- bolt (aim-driven; fired by updateWeapons, never by input) ----------
// Center-true fan: one bolt EXACTLY on the target line + flanks at ±0.11 —
// aim fidelity is the weapon's identity (core.md bolt row, 2026-07-24).
const FAN_OFFSETS = [[0], [0, 0.11], [0, 0.11, -0.11]];
function fireFan(G, tx, ty, st) {
  const base = Math.atan2(ty - G.cy, tx - G.cx);
  for (const off of FAN_OFFSETS[st.volley - 1]) {
    fireBullet(G.S, G.cx, G.cy, base + off, 540, st.dmg, { pierce: st.pierce, r: 3.5 });
  }
}

// ---------- manual: force blades (swipe slot, ADR-0004) ----------
export function fireBlades(G, from, to) {
  const S = G.S;
  if (lvl(S, 'blades') < 1) return false;
  if (G.wt.bladeCd > 0) return false; // cooling: swipe degrades to re-aim (wall rule)
  const st = stats(S, 'blades');
  G.wt.bladeCd = st.cd;
  const { ax, ay, bx, by, nx, ny } = swipeSegment(G, from, to, st.len);
  for (let i = 0; i < st.n; i++) {
    const t = st.n === 1 ? 0.5 : i / (st.n - 1);
    S.blades.push({
      x: ax + (bx - ax) * t, y: ay + (by - ay) * t,
      vx: nx * st.speed, vy: ny * st.speed,
      dmg: st.dmg, r: st.r, a: Math.atan2(ny, nx), hit: new Set(), life: 4,
    });
  }
  sfx('wave');
  return true;
}

// ---------- manual: force wall (swipe) ----------
export function fireWall(G, from, to) {
  const S = G.S;
  if (lvl(S, 'wall') < 1) return false;
  if (G.wt.wallCd > 0) return false;
  const st = stats(S, 'wall');
  G.wt.wallCd = st.cd;
  const { ax, ay, bx, by, nx, ny } = swipeSegment(G, from, to, st.len);
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
  wt.bladeCd = Math.max(0, wt.bladeCd - dt);
  updateWalls(G, dt);

  // force blades in flight (ADR-0004 wave B): pierce all, die at the wall
  if (S.blades.length) {
    for (const bl of S.blades) {
      bl.life -= dt;
      bl.x += bl.vx * dt; bl.y += bl.vy * dt;
      if (outside(G, bl.x, bl.y) || bl.life <= 0) {
        wallFlare(G, bl.x, bl.y);
        bl.dead = true; continue;
      }
      for (const e of S.enemies) {
        if (e.dead || bl.hit.has(e)) continue;
        if (dist(bl.x, bl.y, e.x, e.y) < e.r + bl.r) {
          bl.hit.add(e);
          damageEnemy(G, e, bl.dmg);
        }
      }
    }
    S.blades = S.blades.filter(b => !b.dead);
  }

  // burning ground (flame + meteor scorch): patches gutter out, tick on a
  // per-patch clock — a shield loses one charge per tick, beam precedent
  if (S.fires.length) {
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

  // hold-slot weapons (at most one owned — ADR-0004)
  updateBeam(G, dt);
  updateFlame(G, dt);
  updateMeteor(G, dt);

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
      aoe(G, m.x, m.y, m.blast, m.dmg);
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
        fireBullet(S, tx, ty, Math.atan2(e.y - ty, e.x - tx), 460, st.dmg,
          { r: 2.5, color: '#ffd24d' });
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

  // ---- field exotics (ADR-0004 wave C) ----

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
        fireBullet(S, G.cx, G.cy, aimAngle(), st.speed, st.dmg);
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
        fireBullet(S, G.cx, G.cy, aimAngle(), st.lightSpeed, st.lightDmg, { r: 2.5 });
        sfx('shoot');
        wt.heavyPhase++;
        wt.heavyPhaseT = wt.heavyPhase === 3 ? st.pause : st.lightGap;
      } else {
        fireBullet(S, G.cx, G.cy, aimAngle(), st.heavySpeed, st.heavyDmg,
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

  // bullets (bolt + turret + aim ordnance)
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
  // heat belongs to the weapon channeling it: an unowned beam must not bleed
  // the flamethrower's heat away (test: "flamethrower overheats like the beam")
  if (l < 1) { G.beamEnd = null; return; }
  // at max level the beam is always-on, tracking the standing aim (core.md beam row)
  const st = l >= 1 ? stats(S, 'beam') : null;
  const target = wt.holdAim || (st?.alwaysOn ? G.aim : null);
  const beaming = l >= 1 && target && !S.overheated;
  let inBeam = null;
  if (beaming) {
    const dx = target.x - G.cx, dy = target.y - G.cy;
    const len = Math.hypot(dx, dy);
    if (len > 4) {
      // clip the beam at the arena wall (app.md): it blooms there, not beyond
      const ux = dx / len, uy = dy / len;
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

// ---------- flamethrower (hold slot, ADR-0004): cone + burn stacks + ground ----
function updateFlame(G, dt) {
  const S = G.S;
  const wt = G.wt;
  const l = lvl(S, 'flame');
  const st = l >= 1 ? stats(S, 'flame') : null;
  const target = wt.holdAim || (st?.alwaysOn ? G.aim : null);
  const on = l >= 1 && target && !S.overheated;
  G.flameCone = null;
  if (on) {
    const dx = target.x - G.cx, dy = target.y - G.cy;
    const len = Math.hypot(dx, dy);
    if (len > 4) {
      const base = Math.atan2(dy, dx);
      G.flameCone = { a: base, range: st.range, arc: st.arc }; // render reads this
      if (st.heatRate > 0) {
        S.heat = Math.min(1, S.heat + st.heatRate * dt);
        if (S.heat >= 1) S.overheated = true;
      }
      // per-target cone ticks reuse the beam's tick fields (slot-exclusive, no clash)
      for (const e of S.enemies) {
        if (e.dead) continue;
        const d = dist(e.x, e.y, G.cx, G.cy);
        let da = Math.atan2(e.y - G.cy, e.x - G.cx) - base;
        da = Math.atan2(Math.sin(da), Math.cos(da)); // wrap to [-pi, pi]
        if (d <= st.range + e.r && Math.abs(da) <= st.arc) {
          e.beamTick -= dt;
          if (e.beamTick <= 0) {
            e.beamTick += st.tick;
            damageEnemy(G, e, st.direct, { silent: true });
            e.burnStacks = Math.min(st.maxStacks, e.burnStacks + 1);
            e.burnLeft = st.burnDur;
          }
        }
      }
      // burning ground drops in the cone's mid-far zone (app.md register)
      wt.flamePatchT -= dt;
      if (wt.flamePatchT <= 0 && S.fires.length < 40) {
        wt.flamePatchT += st.patchEvery;
        const fa = base + (Math.random() * 2 - 1) * st.arc * 0.8;
        const fr = st.range * (0.35 + Math.random() * 0.6);
        S.fires.push({
          x: G.cx + Math.cos(fa) * fr, y: G.cy + Math.sin(fa) * fr,
          r: st.patchR, dps: st.patchDps, life: st.patchLife, max: st.patchLife, tickT: 0.2,
        });
      }
    }
  } else if (l >= 1 && st.heatRate > 0) {
    S.heat = Math.max(0, S.heat - 0.45 * dt);
    if (S.overheated && S.heat < BEAM_REARM) S.overheated = false;
  }
  // burn DoT keeps cooking wherever the shape goes (core.md flame row)
  if (l >= 1) {
    for (const e of S.enemies) {
      if (e.dead || e.burnStacks <= 0) continue;
      e.burnLeft -= dt;
      e.burnTick -= dt;
      if (e.burnTick <= 0) {
        e.burnTick += 0.5;
        damageEnemy(G, e, st.burnDps * e.burnStacks * 0.5, { silent: true });
      }
      if (e.burnLeft <= 0) { e.burnStacks = 0; e.burnTick = 0; }
    }
  }
}

// ---------- meteor (hold slot, ADR-0004): charge, release, auto-release ----
function updateMeteor(G, dt) {
  const S = G.S;
  const wt = G.wt;
  const l = lvl(S, 'meteor');
  if (l < 1) return;
  wt.metCd = Math.max(0, wt.metCd - dt);
  const st = stats(S, 'meteor');
  if (wt.holdAim && wt.metCd <= 0) {
    wt.metCharge = Math.min(1, wt.metCharge + dt / st.chargeTime);
    if (wt.metCharge >= 1) releaseHold(G); // auto-release at max (core.md)
  }
}

/** Hold released (input seam or auto at full charge): the meteor drops. */
export function releaseHold(G) {
  const S = G.S;
  const wt = G.wt;
  if (lvl(S, 'meteor') < 1 || wt.metCharge <= 0 || !wt.holdAim) { wt.metCharge = 0; return; }
  const st = stats(S, 'meteor');
  const c = wt.metCharge;
  wt.metCharge = 0;
  wt.metCd = st.cd * S.cdMult;
  S.shells.push({
    kind: 'meteor',
    x0: G.cx, y0: G.cy, tx: wt.holdAim.x, ty: wt.holdAim.y,
    t: 0, flight: st.fall,
    dmg: st.dmg * (st.minDmgFrac + (1 - st.minDmgFrac) * c),
    blast: st.blast * (st.minBlastFrac + (1 - st.minBlastFrac) * c),
    knock: st.knock * (0.4 + 0.6 * c),
    scorch: { dps: st.scorchDps, life: st.scorchLife },
  });
  sfx('seek');
}
