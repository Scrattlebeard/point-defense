// The emissive grammar (app.md "Light has a grammar"). What a shape LOOKS like is an
// eye question answered with the ?specimen plates — but the two rules that make the
// look coherent are checkable, and both are the kind that rot silently:
//   1. the hue lives in the halo, not the core (or "species = hue" quietly dies);
//   2. every lit object is lit from the SAME direction (or the scene reads flat,
//      which is the exact defect this grammar was added to fix).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rgb, shade, alpha, tube, litDisc, rimLight, litBar, LIGHT_A, LIGHT_X, LIGHT_Y } from '../src/app/neon.js';

/** Records every stroke/fill with the style and width in force at the time. */
function recorder() {
  const ops = [];
  const grads = [];
  const ctx = {
    strokeStyle: '', fillStyle: '', lineWidth: 1,
    beginPath() {}, arc() {}, moveTo() {}, lineTo() {}, closePath() {},
    stroke() { ops.push({ op: 'stroke', style: this.strokeStyle, width: this.lineWidth }); },
    fill() { ops.push({ op: 'fill', style: this.fillStyle }); },
    fillRect(x, y, w, h) { ops.push({ op: 'fillRect', style: this.fillStyle, x, y, w, h }); },
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      const g = { stops: [], x0, y0, r0, x1, y1, r1, addColorStop(p, c) { this.stops.push([p, c]); } };
      grads.push(g);
      return g;
    },
  };
  return { ctx, ops, grads };
}

const lum = s => { const c = rgb(s); return (c[0] + c[1] + c[2]) / 3; };
const sat = s => { const c = rgb(s); return Math.max(...c) - Math.min(...c); };

test('colour parsing survives long hex, short hex and nonsense', () => {
  assert.deepEqual(rgb('#ff5c6c'), [255, 92, 108]);
  assert.deepEqual(rgb('#0a0d15'), [10, 13, 21]);
  assert.deepEqual(rgb('#fff'), [255, 255, 255]);
  // A renderer must never take the frame down over a colour string.
  assert.deepEqual(rgb('rebeccapurple'), [136, 136, 136]);
  assert.deepEqual(rgb(undefined), [136, 136, 136]);
});

test('shade blends toward white and black, and repeat calls agree', () => {
  assert.equal(shade('#808080', 1), 'rgb(255, 255, 255)');
  assert.equal(shade('#808080', -1), 'rgb(0, 0, 0)');
  assert.equal(shade('#4de8ff', 0), 'rgb(77, 232, 255)');
  // memoized — a second call must not drift
  assert.equal(shade('#4de8ff', 0.4), shade('#4de8ff', 0.4));
  assert.ok(lum(shade('#ff5c6c', 0.5)) > lum('rgb(255, 92, 108)'));
  assert.ok(lum(shade('#ff5c6c', -0.5)) < lum('rgb(255, 92, 108)'));
  assert.equal(alpha('#ff5c6c', 0.2), 'rgba(255, 92, 108, 0.2)');
});

test('a tube is a wide saturated halo under a thin whitened core', () => {
  const { ctx, ops } = recorder();
  let built = 0;
  tube(ctx, () => { built++; }, '#ff5c6c', 3);

  assert.equal(built, 2, 'the path callback must be re-run per pass — a path is consumed by stroke');
  assert.equal(ops.length, 2, 'exactly two strokes: halo, then core');
  const [halo, core] = ops;

  assert.ok(halo.width > core.width, `halo (${halo.width}) must be wider than core (${core.width})`);
  assert.equal(core.width, 3, 'the core carries the requested width — the silhouette must not change');
  assert.ok(/rgba\(.*0\.\d+\)$/.test(halo.style), 'the halo must be translucent, or it is just a fat stroke');

  // The load-bearing half: hue in the halo, brightness in the core. Invert this and
  // "enemy species = hue" (app.md) becomes false on every shape at once.
  assert.ok(sat(halo.style) > sat(core.style), 'the halo must be the more saturated of the two');
  assert.ok(lum(core.style) > lum(halo.style), 'the core must be the brighter of the two');
});

test('every lit object is lit from the one shared direction', () => {
  const { ctx, ops, grads } = recorder();
  litDisc(ctx, 100, 100, 20, '#4de8ff');
  rimLight(ctx, 100, 100, 20, '#4de8ff');

  const g = grads[0];
  assert.ok(g, 'litDisc must build a gradient — a flat fill is the thing being replaced');
  // the highlight sits toward the light, the far edge away from it
  assert.ok(Math.sign(g.x0 - 100) === Math.sign(LIGHT_X), 'highlight is offset toward the light in x');
  assert.ok(Math.sign(g.y0 - 100) === Math.sign(LIGHT_Y), 'highlight is offset toward the light in y');
  assert.ok(lum(g.stops[0][1]) > lum(g.stops[1][1]), 'the near stop is the highlight');
  assert.ok(lum(g.stops[2][1]) < lum(g.stops[1][1]), 'the far stop falls into shadow');

  // LIGHT_A is up and to the left: the arcade's whole scene agrees on this.
  assert.ok(LIGHT_X < 0 && LIGHT_Y < 0, 'the light comes from up and to the left');
  assert.equal(ops.filter(o => o.op === 'stroke').length, 1, 'the rim is a single arc');
  assert.equal(ops.filter(o => o.op === 'fill').length, 1, 'the disc is a single gradient fill');
});

test('a lit bar puts its highlight on top and vanishes when empty', () => {
  const { ctx, ops } = recorder();
  litBar(ctx, 10, 50, 80, 6, '#4de8ff');
  assert.equal(ops.length, 2, 'body plus highlight strip');
  const [body, hi] = ops;
  assert.equal(hi.y, body.y, 'the highlight sits at the top edge');
  assert.ok(hi.h < body.h, 'the highlight is a strip, not a second bar');
  assert.ok(lum(hi.style) > lum('rgb(77, 232, 255)'), 'the strip is lighter than the fill');

  ops.length = 0;
  litBar(ctx, 10, 50, 0, 6, '#4de8ff');
  assert.equal(ops.filter(o => o.w > 0).length, 0, 'an empty bar must not draw a highlight sliver');
});
