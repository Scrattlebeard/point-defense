// Bolt: two streams, center-true fan volleys (core.md bolt row, 2026-07-24).
// Manual stream fires at the aim point; from L3 an auto stream fires at the
// nearest in-bounds shape. A fan of n = one bolt EXACTLY on the target line +
// flanks at ±0.11 — the enforceable form of "you hit where you aim", kept
// through the 2026-07-24 rebalance (independent auto-aims were overpowered).
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

const onLine = (G, shots, x, y) => shots.filter(b => angErr(G, b, x, y) < 1e-9);
// fan membership: exactly on the line to (x,y) or within the ±0.11 flank spread
const inFan = (G, shots, x, y) => shots.filter(b => angErr(G, b, x, y) < 0.111);

test('volley sizes across the ladder: 1 / 1+1 / 2+2 / 3+3', () => {
  const expect = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 4, 6: 6 };
  for (const [l, n] of Object.entries(expect)) {
    const G = makeG(Number(l));
    spawnEnemy(G, 'grunt', null, 650, 300);
    G.aim = { x: 200, y: 120 };
    const shots = fireOnce(G);
    assert.equal(shots.length, n, `L${l}: wrong volley size`);
  }
});

test('every fan is center-true: exactly one bolt on each target line', () => {
  for (const l of [1, 3, 5, 6]) {
    const G = makeG(l);
    spawnEnemy(G, 'grunt', null, 650, 300);
    G.aim = { x: 200, y: 120 }; // deliberately NOT at the enemy
    const shots = fireOnce(G);
    assert.equal(onLine(G, shots, 200, 120).length, 1,
      `L${l}: expected exactly 1 bolt on the aim line`);
    if (l >= 3) {
      assert.equal(onLine(G, shots, 650, 300).length, 1,
        `L${l}: expected exactly 1 bolt on the auto-target line`);
    }
    // no strays: every bolt belongs to one of the two fans
    const strays = shots.filter(b =>
      angErr(G, b, 200, 120) >= 0.111 && angErr(G, b, 650, 300) >= 0.111);
    assert.equal(strays.length, 0, `L${l}: bolts outside both fans`);
  }
});

test('at L6 the streams split 3+3 between aim and auto target', () => {
  const G = makeG(6);
  spawnEnemy(G, 'grunt', null, 400, 80); // straight up from center
  G.aim = { x: 200, y: 500 };            // down-left — fans well separated
  const shots = fireOnce(G);
  assert.equal(inFan(G, shots, 200, 500).length, 3, 'manual fan size');
  assert.equal(inFan(G, shots, 400, 80).length, 3, 'auto fan size');
});

test('auto stream ignores shapes outside the arena walls', () => {
  const G = makeG(3);
  spawnEnemy(G, 'grunt', null, -40, 300);  // outside — nearest, but unhittable
  spawnEnemy(G, 'grunt', null, 650, 300);  // inside
  G.aim = { x: 200, y: 120 };
  const shots = fireOnce(G);
  assert.equal(onLine(G, shots, 650, 300).length, 1, 'auto fan skipped the in-bounds shape');
  assert.equal(onLine(G, shots, -40, 300).length, 0, 'auto fan chased an out-of-bounds shape');
});

test('no in-bounds target: the auto stream holds fire, the manual stream fires', () => {
  const G = makeG(6);
  spawnEnemy(G, 'grunt', null, -40, 300); // only an out-of-bounds shape alive
  G.aim = { x: 200, y: 120 };
  const shots = fireOnce(G);
  assert.equal(shots.length, 3, 'expected the 3-bolt manual fan alone');
  assert.equal(onLine(G, shots, 200, 120).length, 1);
});
