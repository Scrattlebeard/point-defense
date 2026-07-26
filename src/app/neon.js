// The emissive drawing grammar (app.md "Light has a grammar"): how a flat stroke
// becomes a neon tube, and how a flat disc becomes a lit object.
//
// Two primitives, one convention. Everything shiny in this game is one of:
//   - EMISSIVE — it makes its own light. A wide, saturated, low-alpha halo under a
//     thin, whitened core. Enemy wireframes, blades, bullets, mines, walls.
//   - LIT — it is a solid object catching light from somewhere. A radial gradient
//     offset toward LIGHT_A with a bright rim on the lit side and a dark far edge.
//     The tower hull, turrets, boulders.
// A thing is one or the other, never both: self-lit objects have no shadow side,
// and lit objects do not bloom. Mixing them is what makes neon art look muddy.
//
// Why halos instead of ctx.shadowBlur: blur is the most expensive 2D operation on a
// mobile GPU (each one forces an offscreen pass) and is the standing suspect for the
// wave-20 p95 step (PINS [perf]). A wide low-alpha stroke of the same path buys the
// same read for plain fill rate. See app.md — this is a cost decision, not taste.

/** The world's light direction, in radians: up and to the left. One constant so the
 *  highlights of every lit object agree — a scene lit from two directions reads as
 *  flat, which is exactly the look we are fixing. */
export const LIGHT_A = -2.25;
export const LIGHT_X = Math.cos(LIGHT_A);
export const LIGHT_Y = Math.sin(LIGHT_A);

// The palette is a small fixed set (core/config.js species, variants, towers), so
// memoizing makes per-frame colour math a map lookup. Keyed by the input string.
const rgbCache = new Map();

/** '#rrggbb' | '#rgb' | 'rgb(...)' | 'rgba(...)' → [r, g, b].
 *
 *  The rgb()/rgba() forms are not decoration: `shade` and `alpha` return them, and
 *  every composition (`alpha(shade(c, 0.8), 0.5)` — the whole highlight idiom) feeds
 *  one back in. Hex-only parsing made those compositions silently return the grey
 *  fallback instead of a colour, which is a bug that looks like a taste decision.
 *
 *  Unknown formats still fall back to mid-grey rather than throwing: a renderer must
 *  never take the frame down over a colour string. */
export function rgb(hex) {
  let v = rgbCache.get(hex);
  if (v) return v;
  const h = String(hex).trim();
  if (h[0] === '#') {
    let d = h.slice(1);
    if (d.length === 3) d = d[0] + d[0] + d[1] + d[1] + d[2] + d[2];
    const n = parseInt(d, 16);
    v = d.length === 6 && Number.isFinite(n)
      ? [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      : [136, 136, 136];
  } else {
    const m = h.match(/^rgba?\(\s*([\d.]+)\D+([\d.]+)\D+([\d.]+)/);
    v = m ? [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])] : [136, 136, 136];
  }
  rgbCache.set(hex, v);
  return v;
}

const mixCache = new Map();
/** Blend toward white (t > 0) or black (t < 0) by |t|, as a css rgb() string. */
export function shade(hex, t) {
  const key = hex + '|' + t;
  let s = mixCache.get(key);
  if (s) return s;
  const [r, g, b] = rgb(hex);
  const to = t >= 0 ? 255 : 0, k = Math.abs(t);
  s = `rgb(${Math.round(r + (to - r) * k)}, ${Math.round(g + (to - g) * k)}, ${Math.round(b + (to - b) * k)})`;
  mixCache.set(key, s);
  return s;
}

/** The colour at alpha a — the halo's currency. Not cached: alpha is usually animated. */
export function alpha(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Stroke a path as a neon tube: saturated halo, whitened core.
 *
 * `path` is called once per pass and must build the path itself (it will be invoked
 * twice) — that is why this takes a callback rather than a prepared path.
 *
 * The hue lives in the HALO, not the core. That keeps "enemy species = hue" true
 * (app.md) while the core goes bright: a neon tube is white in the middle and
 * coloured in its bloom, and the bloom is the bigger patch of screen.
 */
export function tube(ctx, path, color, width, { halo = 5, haloA = 0.17, core = 0.35, coreA = 1 } = {}) {
  ctx.strokeStyle = alpha(color, haloA);
  ctx.lineWidth = width + halo;
  path();
  ctx.stroke();
  ctx.strokeStyle = coreA >= 1 ? shade(color, core) : alpha(shade(color, core), coreA);
  ctx.lineWidth = width;
  path();
  ctx.stroke();
}

/**
 * Fill a circle as a lit sphere: highlight toward LIGHT_A, base in the middle, the
 * far edge falling into shadow. `lift` controls how hot the highlight runs.
 */
export function litDisc(ctx, x, y, r, color, { lift = 0.55, sink = 0.45 } = {}) {
  const g = ctx.createRadialGradient(
    x + LIGHT_X * r * 0.42, y + LIGHT_Y * r * 0.42, r * 0.06, x, y, r);
  g.addColorStop(0, shade(color, lift));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shade(color, -sink));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/** The bright crescent where a round object turns into the light. Sells the volume
 *  that litDisc's gradient only suggests — a gradient alone still reads as a decal. */
export function rimLight(ctx, x, y, r, color, a = 0.8, width = 2) {
  ctx.strokeStyle = alpha(shade(color, 0.75), a);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, LIGHT_A - 1.15, LIGHT_A + 1.15);
  ctx.stroke();
}

/** A flat bar with a lit top edge — bars are the one place a 1px lighter strip does
 *  the whole job (hp slivers, boss bar, heat gauge). */
export function litBar(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  if (w <= 0) return;
  ctx.fillStyle = alpha(shade(color, 0.85), 0.55);
  ctx.fillRect(x, y, w, Math.max(1, h * 0.34));
}
