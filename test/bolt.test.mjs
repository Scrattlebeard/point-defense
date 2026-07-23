// Bolt volley shape (core.md bolt row, 2026-07-23 rework): the aimed bolt is
// ALWAYS exactly one bolt on the exact aim line — extra bolts are auto-aimed at
// the nearest distinct in-bounds shapes (L3 +1, L5 +2, L6 +4). This is the
// enforceable form of "you hit where you aim": no spread ever straddles the
// aim point again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, newRun } from '../src/core/state.js';
import { makeFx } from '../src/app/fx.js';
import { resetWeapons, updateWeapons } from '../src/app/weapons.js';
import { spawnEnemy } from '../src/app/enemies.js';

function makeG(boltLvl) {
  const meta = defaultMeta();
  const G = {
    W: 800, H: 600, cx: 400, cy: 300,
    S: newRun(meta, 'bastion'),
    fx: makeFx(),
    meta,
  };
  G.S.weapons.bolt = boltLvl;
  resetWeapons(G);
  return G;
}

/** Step until the first volley fires; return the bullets it produced. */
function fireOnce(G) {
  const before = G.S.bullets.length;
  for (let i = 0; i < 120 && G.S.bullets.length === before; i++) {
    updateWeapons(G, 1 / 60);
  }
  return G.S.bullets.slice(before);
}

/** Angle error (radians) between a bullet's velocity and center→(x,y). */
function angErr(G, b, x, y) {
  const want = Math.atan2(y - G.cy, x - G.cx);
  const got = Math.atan2(b.vy, b.vx);
  let d = Math.abs(want - got) % (2 * Math.PI);
  return Math.min(d, 2 * Math.PI - d);
}

test('the aimed bolt flies exactly along the aim line at every level', () => {
  for (const l of [1, 3, 5, 6]) {
    const G = makeG(l);
    spawnEnemy(G, 'grunt', null, 650, 300);
    spawnEnemy(G, 'grunt', null, 400, 100);
    spawnEnemy(G, 'grunt', null, 150, 450);
    spawnEnemy(G, 'grunt', null, 650, 500);
    G.aim = { x: 200, y: 120 }; // deliberately NOT at any enemy
    const shots = fireOnce(G);
    assert.ok(shots.length >= 1, `L${l}: no bolts fired`);
    const onAim = shots.filter(b => angErr(G, b, 200, 120) < 1e-9);
    assert.equal(onAim.length, 1,
      `L${l}: expected exactly 1 bolt on the aim line, got ${onAim.length} of ${shots.length}`);
  }
});

test('auto bolts: +1 at L3, +2 at L5, +4 at L6, each at a distinct nearest shape', () => {
  const expect = { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 4 };
  for (const [l, autos] of Object.entries(expect)) {
    const G = makeG(Number(l));
    const spots = [[650, 300], [400, 100], [150, 450], [650, 500], [100, 100]];
    for (const [x, y] of spots) spawnEnemy(G, 'grunt', null, x, y);
    G.aim = { x: 200, y: 120 };
    const shots = fireOnce(G);
    assert.equal(shots.length, 1 + autos, `L${l}: wrong volley size`);
    // every auto bolt points at a distinct enemy position
    const auto = shots.filter(b => angErr(G, b, 200, 120) >= 1e-9);
    const claimed = new Set();
    for (const b of auto) {
      const hit = spots.findIndex(([x, y]) => angErr(G, b, x, y) < 1e-9);
      assert.ok(hit >= 0, `L${l}: auto bolt aimed at no enemy`);
      assert.ok(!claimed.has(hit), `L${l}: two auto bolts share a target`);
      claimed.add(hit);
    }
  }
});

test('auto bolts ignore shapes outside the arena walls', () => {
  const G = makeG(3);
  spawnEnemy(G, 'grunt', null, -40, 300);  // outside — nearest, but unhittable
  spawnEnemy(G, 'grunt', null, 650, 300);  // inside
  G.aim = { x: 200, y: 120 };
  const shots = fireOnce(G);
  const auto = shots.filter(b => angErr(G, b, 200, 120) >= 1e-9);
  assert.equal(auto.length, 1);
  assert.ok(angErr(G, auto[0], 650, 300) < 1e-9, 'auto bolt chased an out-of-bounds shape');
});

test('scarce targets shrink the volley — the aimed bolt still fires', () => {
  const G = makeG(6);
  spawnEnemy(G, 'grunt', null, 650, 300); // one target, would-be 4 autos
  G.aim = { x: 200, y: 120 };
  const shots = fireOnce(G);
  assert.equal(shots.length, 2, 'expected 1 aimed + 1 auto with a single live target');
});
