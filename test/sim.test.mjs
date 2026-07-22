// Headless full-sim smoke: the impure shell's sim modules (game/enemies/weapons)
// are DOM-free by construction (app.md), so the entire game loop runs in node.
// This is the regression net for "the game actually plays": waves advance,
// weapons kill, level-ups arrive, the run can end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, newRun, levelChoices, applyChoice } from '../src/core/state.js';
import { makeFx, updateFx } from '../src/app/fx.js';
import { resetWeapons, fireBolt, fireShockwave } from '../src/app/weapons.js';
import { resetWaveDirector, updateGame } from '../src/app/game.js';
import { nearestEnemy } from '../src/app/enemies.js';

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

/** Simulate `seconds` of play with a competent robot thumb. Returns end signal. */
function simulate(G, seconds, { tap = true } = {}) {
  const dt = 1 / 60;
  let tapT = 0;
  for (let t = 0; t < seconds; t += dt) {
    if (tap) {
      tapT -= dt;
      if (tapT <= 0) {
        const e = nearestEnemy(G.S, G.cx, G.cy);
        if (e) fireBolt(G, e.x, e.y);
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
});

test('an undefended Point falls', () => {
  const G = makeG();
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

test('shockwave fires along a swipe and respects its cooldown', () => {
  const G = makeG();
  G.S.weapons.shockwave = 1;
  simulate(G, 10, { tap: false });
  const before = G.S.kills;
  // sweep across the whole field several times
  let fired = 0;
  for (let i = 0; i < 6; i++) {
    if (fireShockwave(G, { x: 0, y: 100 + i * 120 }, { x: G.W, y: 100 + i * 120 })) fired++;
    simulate(G, 2, { tap: false });
  }
  assert.ok(fired >= 5, `cooldown ate swipes: ${fired}/6`);
  assert.ok(G.S.kills > before, 'shockwave sweeps killed nothing');
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
