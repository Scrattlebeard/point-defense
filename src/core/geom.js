// Pure vector/math helpers. No game knowledge.
export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

/**
 * Wave-spawn origin on the arena-wall perimeter (core.md "Spawn geometry").
 * u ∈ [0,1) → uniform position on the field rect expanded outward by pad;
 * spdMult normalizes travel time: distToPoint / spdMult == max(W,H)/2 + pad.
 */
export function edgeSpawn(u, W, H, pad) {
  const ow = W + 2 * pad, oh = H + 2 * pad;
  let t = (u - Math.floor(u)) * 2 * (ow + oh);
  let x, y;
  if (t < ow) { x = -pad + t; y = -pad; }
  else if ((t -= ow) < oh) { x = W + pad; y = -pad + t; }
  else if ((t -= oh) < ow) { x = W + pad - t; y = H + pad; }
  else { x = -pad; y = H + pad - (t - ow); }
  const spdMult = dist(x, y, W / 2, H / 2) / (Math.max(W, H) / 2 + pad);
  return { x, y, spdMult };
}

/** Distance from point (px,py) to segment (ax,ay)-(bx,by). */
export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
