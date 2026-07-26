import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bladeSpine, distToSegment } from '../src/core/geom.js';
import { WEAPONS } from '../src/core/config.js';

const polar = (x, y, cx = 0, cy = 0) => ({
  r: Math.hypot(x - cx, y - cy),
  a: Math.atan2(y - cy, x - cx),
});

test('a blade spine is rooted at inner, tips at outer, and never doubles back', () => {
  const pts = bladeSpine(0, 0, 0.7, 100, 200, 0.25, 8);
  assert.equal(pts.length, 18, 'steps+1 points, x and y each');
  const radii = [];
  for (let k = 0; k < pts.length; k += 2) radii.push(polar(pts[k], pts[k + 1]).r);
  assert.ok(Math.abs(radii[0] - 100) < 1e-9, `root sits at ${radii[0]}, not inner`);
  assert.ok(Math.abs(radii.at(-1) - 200) < 1e-9, `tip sits at ${radii.at(-1)}, not outer`);
  for (let k = 1; k < radii.length; k++) {
    assert.ok(radii[k] > radii[k - 1], 'the spine must march outward, never fold back on itself');
  }
});

test('the tip lags the root by exactly the sweep, and the root leaves the hub straight', () => {
  const a = 0.7, sweep = 0.25;
  const pts = bladeSpine(0, 0, a, 100, 200, sweep, 8);
  assert.ok(Math.abs(polar(pts[0], pts[1]).a - a) < 1e-9, 'the root must sit on the given bearing');
  assert.ok(Math.abs(polar(pts.at(-2), pts.at(-1)).a - (a - sweep)) < 1e-9,
    'the tip must lag the root by the full sweep');
  // the lag is back-loaded: at the halfway knot, less than half of it has been spent
  const midLag = a - polar(pts[8], pts[9]).a;
  assert.ok(midLag < sweep * 0.5,
    `half way out the blade has already bent ${(midLag / sweep * 100).toFixed(0)}% — the curve belongs at the tip`);
});

test('the spine has the same shape at any smoothness — the sim and the renderer agree', () => {
  // The hit test walks 3 segments and the renderer draws 10. If those disagreed,
  // the blade would bite somewhere it is not drawn — so this is the load-bearing
  // property of sharing the function rather than each side rolling its own curve.
  const st = WEAPONS.orbit.stats(WEAPONS.orbit.max);
  const coarse = bladeSpine(0, 0, 0.4, st.inner, st.outer, st.sweep, 3);
  const fine = bladeSpine(0, 0, 0.4, st.inner, st.outer, st.sweep, 30);
  let worst = 0;
  for (let k = 0; k < fine.length; k += 2) {
    let d = Infinity;
    for (let j = 0; j + 3 < coarse.length; j += 2) {
      d = Math.min(d, distToSegment(fine[k], fine[k + 1], coarse[j], coarse[j + 1], coarse[j + 2], coarse[j + 3]));
    }
    worst = Math.max(worst, d);
  }
  assert.ok(worst < st.reach * 0.5,
    `the drawn spine strays ${worst.toFixed(2)}px from the bitten one — past half of reach (${st.reach}) that is a visible lie`);
});
