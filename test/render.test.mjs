// Headless render smoke. `render.js` is DOM-free apart from a 2D context, so a
// stub context runs the whole draw path in node — which matters because the
// renderer carries real decisions now (annulus slots for stacked highlights, the
// wave-relative hp gate, the siege telegraph) and had no automated cover at all.
//
// This is a CRASH net, not a pixel net: it asserts the draw path survives a deep,
// fully-populated field. What a shape LOOKS like is checked with the `?specimen`
// plates by eye — a test cannot hold that opinion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, newRun, levelChoices, applyChoice } from '../src/core/state.js';
import { makeFx, updateFx } from '../src/app/fx.js';
import { resetWeapons, fireWall } from '../src/app/weapons/index.js';
import { resetWaveDirector, updateGame } from '../src/app/game.js';
import { spawnEnemy } from '../src/app/enemies.js';
import { renderFrame } from '../src/app/render.js';
import { mulberry32 } from '../src/core/rng.js';
import { VARIANTS } from '../src/core/config.js';

/** A 2D context that records call volume and swallows everything else. */
function stubCtx() {
  const stats = { calls: 0 };
  const gradient = { addColorStop() {} };
  const target = {};
  return {
    stats,
    ctx: new Proxy(target, {
      get(t, k) {
        if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradient;
        if (k === 'measureText') return () => ({ width: 12 });
        if (k in t) return t[k];
        return () => { stats.calls++; };
      },
      set(t, k, v) { t[k] = v; return true; },
    }),
  };
}

function deepField(wave, seconds) {
  Math.random = mulberry32(20260725);
  const meta = defaultMeta();
  const { ctx, stats } = stubCtx();
  const G = {
    ctx, W: 430, H: 900, cx: 215, cy: 450,
    S: newRun(meta, 'bastion'), fx: makeFx(), meta, mode: 'play', stats,
  };
  // a full, budget-legal loadout so every weapon family puts entities on the field
  for (const [id, l] of Object.entries({ bolt: 6, beam: 5, wall: 5, orbit: 5, nova: 5, frost: 5 })) {
    G.S.weapons[id] = l; G.S.pool.add(id);
  }
  resetWeapons(G);
  resetWaveDirector(G);
  G.S.wave = wave;
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    G.aim = { x: 215 + Math.cos(t) * 150, y: 450 + Math.sin(t) * 150 };
    G.wt.holdAim = G.aim;                       // channel the beam: heat gauge draws
    if (Math.floor(t * 2) % 7 === 0) fireWall(G, { x: 60, y: 300 }, { x: 360, y: 300 });
    const sig = updateGame(G, dt);
    updateFx(G.fx, dt);
    if (sig === 'levelup') {
      while (G.S.pendingLevels > 0) {
        applyChoice(G.S, levelChoices(G.S, Math.random)[0]);
        G.S.pendingLevels--;
      }
    }
    if (sig === 'over') break;
  }
  return G;
}

test('the draw path survives a deep, fully-populated field', () => {
  const G = deepField(45, 12); // past the regime wave: stacks are live
  assert.ok(G.S.enemies.length > 0, 'setup: the field should have shapes on it');
  renderFrame(G);
  assert.ok(G.stats.calls > 200, `renderer barely drew (${G.stats.calls} calls)`);
});

test('stacked modifiers, a boss with a signature move, and a besieger all draw', () => {
  const G = deepField(45, 3);
  // the combinations that only meet each other at depth
  spawnEnemy(G, 'dart', ['armored', 'shielded', 'regen'], 200, 200);
  spawnEnemy(G, 'grunt', ['volatile', 'swift'], 260, 240);
  const boss = spawnEnemy(G, 'boss', ['armored'], 215, 300);
  boss.moveId = 'adds';
  const sieger = spawnEnemy(G, 'tank', null, G.cx, G.cy - 39);
  sieger.sieging = true; sieger.contactCd = 0.05; // mid wind-up
  const striking = spawnEnemy(G, 'grunt', ['regen'], G.cx + 36, G.cy);
  striking.sieging = true; striking.strike = 1;   // mid blow
  renderFrame(G);
  assert.ok(G.stats.calls > 200);
});

test('an empty field and a menu-mode frame both draw', () => {
  // regression guard: the grid/spark path and the no-run path are easy to break
  const { ctx, stats } = stubCtx();
  const G = { ctx, W: 430, H: 900, cx: 215, cy: 450, fx: makeFx(), S: null, mode: 'menu', stats };
  renderFrame(G);
  assert.ok(stats.calls > 0, 'menu frame drew nothing');
});

// A guarded boss must LOOK guarded (core.md "Boss signature moves", app.md).
// Without a tell, sunder and bulwark read as "my weapons stopped working" — the
// player sees small numbers and blames the game. The suite being green proves
// nothing here: no other test ever sets e.guard, so the branch is otherwise
// unexecuted. This asserts it draws, and in its own colour channel.
test('a guarded boss draws its own tell, in a channel nothing else uses', () => {
  const { ctx } = stubCtx();
  const strokes = [];
  const spy = new Proxy(ctx, {
    get: (t, k) => t[k],
    set: (t, k, v) => { if (k === 'strokeStyle') strokes.push(String(v)); t[k] = v; return true; },
  });
  const meta = defaultMeta();
  const G = { W: 430, H: 900, cx: 215, cy: 450, S: newRun(meta, 'bastion'), fx: makeFx(), meta, ctx: spy, mode: 'play' };
  resetWeapons(G); resetWaveDirector(G);
  G.S.wave = 30;
  const b = spawnEnemy(G, 'boss');
  b.x = 215; b.y = 300;

  renderFrame(G);
  const before = strokes.filter(s => s.includes('255, 209, 102')).length;
  assert.equal(before, 0, 'an unguarded boss shows no guard ring');

  strokes.length = 0;
  b.guard = 0.25;
  renderFrame(G);
  const after = strokes.filter(s => s.includes('255, 209, 102')).length;
  assert.ok(after > 0, 'a guarded boss draws the gold ring');

  // The four channels already spoken for, per the comment block in render.js.
  const taken = [VARIANTS.armored.color, VARIANTS.shielded.color, '255, 92, 108', '#ffffff'];
  assert.ok(!taken.some(c => '#ffd166'.toLowerCase() === String(c).toLowerCase()),
    'gold must not collide with armored grey, shielded blue, siege red or hit-flash white');
});
