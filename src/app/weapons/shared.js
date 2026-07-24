// Cross-family plumbing shared by every weapon module (weapons.md "shared.js").
import { WEAPONS } from '../../core/config.js';
import { dist } from '../../core/geom.js';
import { addFlare } from '../fx.js';
import { damageEnemy } from '../enemies.js';

export const lvl = (S, id) => S.weapons[id];
export const stats = (S, id) => WEAPONS[id].stats(S.weapons[id]);

export const EDGE = 4; // arena wall inset (app.md "the play area is walled")

/** True when (x,y) sits outside the arena walls. */
export const outside = (G, x, y) => x < EDGE || x > G.W - EDGE || y < EDGE || y > G.H - EDGE;

/** Force-field flare at the wall point nearest (x,y) — the standard projectile death. */
export function wallFlare(G, x, y) {
  addFlare(G.fx,
    Math.min(Math.max(x, EDGE), G.W - EDGE),
    Math.min(Math.max(y, EDGE), G.H - EDGE),
    x < EDGE ? 1 : x > G.W - EDGE ? -1 : 0,
    y < EDGE ? 1 : y > G.H - EDGE ? -1 : 0);
}

/** Clamp a projectile back inside the walls, reflecting its velocity (boomerang). */
export function wallBounce(G, b) {
  if (b.x < EDGE) { b.x = EDGE; b.vx = Math.abs(b.vx); }
  if (b.x > G.W - EDGE) { b.x = G.W - EDGE; b.vx = -Math.abs(b.vx); }
  if (b.y < EDGE) { b.y = EDGE; b.vy = Math.abs(b.vy); }
  if (b.y > G.H - EDGE) { b.y = G.H - EDGE; b.vy = -Math.abs(b.vy); }
}

/** Push a straight bullet into S.bullets, flying along `angle`. */
export function fireBullet(S, x, y, angle, speed, dmg, { pierce = 0, r = 3, color = '#9ff3ff' } = {}) {
  S.bullets.push({
    // life is a safety net only — the arena wall is the real range (app.md)
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    dmg, pierce, r, life: 6, color, hit: new Set(),
  });
}

/** Damage every living shape within `radius` of (x,y); `each` runs on survivors. */
export function aoe(G, x, y, radius, dmg, each = null) {
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
export function swipeSegment(G, from, to, maxLen) {
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
