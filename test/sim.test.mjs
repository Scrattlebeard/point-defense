// Headless full-sim smoke: the impure shell's sim modules (game/enemies/weapons)
// are DOM-free by construction (app.md), so the entire game loop runs in node.
// This is the regression net for "the game actually plays": waves advance,
// weapons kill, level-ups arrive, the run can end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, newRun, levelChoices, applyChoice } from '../src/core/state.js';
import { makeFx, updateFx } from '../src/app/fx.js';
import { resetWeapons, fireWall } from '../src/app/weapons.js';
import { resetWaveDirector, updateGame } from '../src/app/game.js';
import { nearestEnemy, spawnEnemy, damageEnemy } from '../src/app/enemies.js';

function makeG(towerId = 'bastion', tech = []) {
  const meta = { ...defaultMeta(), tech };
  const G = {
    W: 430, H: 900, cx: 215, cy: 450,
    S: newRun(meta, towerId),
    fx: makeFx(),
    meta,
  };
  resetWeapons(G);
  resetWaveDirector(G);
  return G;
}

/** Simulate `seconds` of play with a competent robot aimer. Returns end signal. */
function simulate(G, seconds, { tap = true } = {}) {
  const dt = 1 / 60;
  let tapT = 0;
  for (let t = 0; t < seconds; t += dt) {
    if (tap) {
      tapT -= dt;
      if (tapT <= 0) {
        const e = nearestEnemy(G.S, G.cx, G.cy);
        if (e) G.aim = { x: e.x, y: e.y };
        tapT = 0.2;
      }
    }
    const sig = updateGame(G, dt);
    updateFx(G.fx, dt);
    if (sig === 'levelup') {
      while (G.S.pendingLevels > 0) {
        const cs = levelChoices(G.S, Math.random);
        assert.ok(cs.length > 0, 'level-up must always offer choices');
        applyChoice(G.S, cs[Math.floor(Math.random() * cs.length)]);
        G.S.pendingLevels--;
      }
    }
    if (sig === 'over') return 'over';
  }
  return null;
}

test('90 sim-seconds of bastion play: waves advance, shapes die, levels arrive', () => {
  const G = makeG();
  simulate(G, 90);
  assert.ok(G.S.wave >= 3, `only reached wave ${G.S.wave}`);
  assert.ok(G.S.kills > 10, `only ${G.S.kills} kills`);
  assert.ok(G.S.lvl > 1, 'never leveled');
  assert.ok(G.meta.seen.enemies.includes('grunt'), 'sighting not recorded in meta');
});

test('a weaponless Point falls', () => {
  // the bolt now auto-fires even unaimed, so "undefended" means no bolt at all
  const G = makeG();
  G.S.weapons.bolt = 0;
  const sig = simulate(G, 240, { tap: false });
  assert.equal(sig, 'over');
  assert.ok(G.S.hp <= 0);
});

test('every tower survives its opening waves without crashing', () => {
  for (const towerId of ['bastion', 'tempest', 'warden', 'lance']) {
    const G = makeG(towerId, ['tower_tempest', 'tower_warden', 'tower_lance']);
    simulate(G, 45);
    assert.ok(G.S.wave >= 2, `${towerId} only reached wave ${G.S.wave}`);
  }
});

test('force wall: pushes shapes away from the Point and ticks damage', () => {
  const G = makeG();
  G.S.weapons.bolt = 0;
  G.S.weapons.wall = 1;
  const e = spawnEnemy(G, 'grunt', null, G.cx, G.cy - 150);
  const y0 = e.y;
  fireWall(G, { x: G.cx - 100, y: G.cy - 160 }, { x: G.cx + 100, y: G.cy - 160 });
  assert.equal(G.walls.length, 1);
  for (let i = 0; i < 30; i++) updateGame(G, 1 / 60); // 0.5s of contact
  assert.ok(e.dead || e.y < y0, `wall neither pushed nor killed the grunt (y ${y0} -> ${e.y})`);
});

test('force wall: anchored at the gesture start when the swipe overshoots', () => {
  const G = makeG();
  G.S.weapons.wall = 1; // len 190 at L1
  fireWall(G, { x: 50, y: 400 }, { x: 900, y: 400 }); // wildly overshot swipe
  const w = G.walls[0];
  assert.equal(Math.round(w.ax), 50, 'wall must start where the gesture started');
  assert.ok(Math.abs(w.bx - w.ax) <= 191, 'wall exceeded its max length');
});

test('force wall is siegeable: shapes chew through its HP', () => {
  const G = makeG();
  G.S.weapons.bolt = 0;
  G.S.weapons.wall = 1;
  fireWall(G, { x: G.cx - 80, y: G.cy - 160 }, { x: G.cx + 80, y: G.cy - 160 });
  for (let i = 0; i < 3; i++) spawnEnemy(G, 'tank', null, G.cx - 40 + i * 40, G.cy - 150);
  for (let i = 0; i < 150 && G.walls.length; i++) updateGame(G, 1 / 60); // ≤2.5s
  assert.equal(G.walls.length, 0, 'three tanks failed to break a fresh L1 wall well before natural decay');
});

test('volatile bursts heal nearby shapes and never harm them', () => {
  const G = makeG();
  const friend = spawnEnemy(G, 'tank', null, G.cx + 100, G.cy);
  friend.hp = friend.maxHp * 0.4;
  const bomber = spawnEnemy(G, 'grunt', 'volatile', G.cx + 130, G.cy);
  const before = friend.hp;
  damageEnemy(G, bomber, 99999);
  assert.ok(bomber.dead);
  assert.ok(friend.hp > before, 'burst did not heal the nearby shape');
  assert.ok(!friend.dead, 'burst harmed a friend');
});

test('force wall: active-wall cap replaces the oldest', () => {
  const G = makeG();
  G.S.weapons.wall = 1; // maxWalls 1 at L1
  fireWall(G, { x: 0, y: 100 }, { x: 120, y: 100 });
  G.wt.wallCd = 0;
  const ok = fireWall(G, { x: 0, y: 300 }, { x: 120, y: 300 });
  assert.ok(ok, 'second swipe should conjure (replacing the first)');
  assert.equal(G.walls.length, 1);
  assert.ok(Math.abs(G.walls[0].ay - 300) < 30, 'oldest wall was not the one replaced');
});

test('a max-level beam channels on its own — no hold input ever given', () => {
  const G = makeG();
  G.S.weapons.bolt = 0;
  G.S.weapons.beam = 5;
  simulate(G, 30); // robot only aims; nothing ever sets wt.holdAim
  assert.ok(G.S.kills > 0, 'always-on beam killed nothing');
});

test('seekers connect: a seeker-only loadout clears shapes unaided', () => {
  const G = makeG('bastion', ['tesla', 'seek']);
  G.S.weapons.bolt = 0;
  G.S.weapons.seek = 3;
  simulate(G, 45, { tap: false }); // nobody aims; homing must do all the work
  assert.ok(G.S.kills > 8, `seekers only killed ${G.S.kills}`);
});

test('beam ticks discretely: a brushing touch cannot strip a shield, sustained focus can', () => {
  const G = makeG();
  G.S.weapons.bolt = 0;
  G.S.weapons.beam = 1;
  const e = spawnEnemy(G, 'grunt', 'shielded', G.cx, G.cy - 220);
  e.shield = 3;
  G.wt.holdAim = { x: G.cx, y: G.cy - 300 }; // beam straight through the grunt
  for (let i = 0; i < 18; i++) updateGame(G, 1 / 60); // ~0.3s of contact
  assert.ok(e.shield >= 1, `0.3s of beam stripped the whole shield (left: ${e.shield})`);
  for (let i = 0; i < 60; i++) updateGame(G, 1 / 60); // ~1.3s total
  assert.equal(e.shield, 0, 'sustained beam failed to strip the shield');
});

test('projectiles flare and die at the arena wall instead of flying on', () => {
  const G = makeG();
  spawnEnemy(G, 'grunt', null, G.W + 300, G.cy); // beyond the wall, walking in
  G.aim = { x: G.W - 10, y: G.cy };              // bolts fly at the right edge
  let flared = false;
  for (let i = 0; i < 120; i++) {
    updateGame(G, 1 / 60);
    updateFx(G.fx, 1 / 60);
    if (G.fx.flares.length) flared = true;
    for (const b of G.S.bullets) {
      assert.ok(b.x <= G.W + 1, 'a bullet escaped the arena');
    }
  }
  assert.ok(flared, 'no boundary flare was ever emitted');
});

test('a maxed loadout deep-wave stress run does not explode', () => {
  const G = makeG('bastion', ['tesla', 'seek', 'turret']);
  for (const id of Object.keys(G.S.weapons)) G.S.weapons[id] = 5;
  G.S.weapons.bolt = 6;
  G.S.pool.add('tesla'); G.S.pool.add('seek'); G.S.pool.add('turret');
  G.S.wave = 14; // director will start wave 15 (boss wave) next
  simulate(G, 60);
  assert.ok(G.S.wave >= 15);
  assert.ok(G.S.kills > 0);
});
