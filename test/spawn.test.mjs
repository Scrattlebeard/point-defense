// Spawn geometry: time-to-Point is the invariant, not speed (core.md Enemies).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edgeSpawn, dist } from '../src/core/geom.js';

const ASPECTS = [
  [1920, 1080], // widescreen desktop
  [390, 844],   // phone portrait (pre-zoom CSS px)
  [520, 1125],  // phone portrait at 0.75 zoom
  [844, 390],   // phone landscape
  [900, 900],   // square
];
const PAD = 14;
const us = Array.from({ length: 400 }, (_, i) => i / 400);

test('spawns sit on the wall: outside the field, within pad of it', () => {
  for (const [W, H] of ASPECTS) {
    for (const u of us) {
      const { x, y } = edgeSpawn(u, W, H, PAD);
      const inside = x > 0 && x < W && y > 0 && y < H;
      assert.ok(!inside, `spawn inside field at u=${u} ${W}x${H}`);
      assert.ok(x >= -PAD - 1e-9 && x <= W + PAD + 1e-9, `x beyond pad at u=${u}`);
      assert.ok(y >= -PAD - 1e-9 && y <= H + PAD + 1e-9, `y beyond pad at u=${u}`);
    }
  }
});

test('time-to-Point is constant: distToPoint / spdMult == max(W,H)/2 + pad, every origin', () => {
  for (const [W, H] of ASPECTS) {
    const ref = Math.max(W, H) / 2 + PAD;
    for (const u of us) {
      const { x, y, spdMult } = edgeSpawn(u, W, H, PAD);
      const t = dist(x, y, W / 2, H / 2) / spdMult;
      assert.ok(Math.abs(t - ref) < 1e-6, `travel time ${t} != ref ${ref} at u=${u} ${W}x${H}`);
    }
  }
});

test('short-axis origins are slowed, long-axis midpoint runs at full speed', () => {
  const [W, H] = [1920, 1080];
  // u=0 corner of top edge → walk to top midpoint: pick u for each side midpoint instead
  const per = 2 * (W + 2 * PAD) + 2 * (H + 2 * PAD);
  const topMid = edgeSpawn((W / 2 + PAD) / per, W, H, PAD);          // top edge midpoint (short axis)
  const rightMid = edgeSpawn((W + 2 * PAD + PAD + H / 2) / per, W, H, PAD); // right edge midpoint (long axis)
  assert.ok(topMid.spdMult < 0.65, `widescreen top spawn should crawl, got ${topMid.spdMult}`);
  assert.ok(Math.abs(rightMid.spdMult - 1) < 0.03, `long-axis spawn ~full speed, got ${rightMid.spdMult}`);
});

test('all four sides are reachable across u', () => {
  const [W, H] = [800, 600];
  const sides = new Set();
  for (const u of us) {
    const { x, y } = edgeSpawn(u, W, H, PAD);
    if (y <= 0) sides.add('top');
    else if (y >= H) sides.add('bottom');
    if (x <= 0) sides.add('left');
    else if (x >= W) sides.add('right');
  }
  assert.equal(sides.size, 4, `sides seen: ${[...sides]}`);
});
