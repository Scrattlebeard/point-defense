// The swipe slot (ADR-0004): force wall | force blades — one per run.
// Firing is input-triggered (input.js routes the gesture); flight/siege is per-frame.
import { dist, distToSegment } from '../../core/geom.js';
import { enemyMass } from '../../core/balance.js';
import { damageEnemy } from '../enemies.js';
import { burst } from '../fx.js';
import { sfx } from '../audio.js';
import { lvl, stats, outside, wallFlare, swipeSegment } from './shared.js';

// ---------- force wall ----------
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

// ---------- force blades (ADR-0004 wave B) ----------
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

/** Per-frame: gesture cooldowns, wall siege, blades in flight. */
export function updateSwipe(G, dt) {
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
}
