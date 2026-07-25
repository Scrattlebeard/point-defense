#!/usr/bin/env node
// Boss-event tooling (README "Boss tooling", ADR-0012). How long is a boss ALIVE
// during a REAL wave, on the build a player actually holds at that depth?
//
// This is the instrument that keeps `referenceDps` honest. That constant is FITTED
// to measurement, not derived — player power comes from level-ups, weapon ladders
// and build luck, none of which has a closed form — so it rots the moment weapons
// change. Run this after any weapon or curve change and compare against
// BOSS_TTK_TARGET.
//
// Deliberately NOT wired into CI: a useful reading needs several full runs per
// wave and takes minutes, and a gate slow enough to skip is worse than no gate.
// calibrate and conductor already guard the properties that must hold per-commit.
import { LATTICE } from '../src/core/config.js';
import { BOSS_TTK_TARGET, bossTargetTtk } from '../src/core/balance.js';
import { defaultMeta, newRun, levelChoices, applyChoice } from '../src/core/state.js';
import { makeFx, updateFx } from '../src/app/fx.js';
import { resetWeapons } from '../src/app/weapons/index.js';
import { resetWaveDirector, updateGame } from '../src/app/game.js';
import { nearestEnemy } from '../src/app/enemies.js';
import { mulberry32 } from '../src/core/rng.js';

function run(seed, tech, maxWave) {
  Math.random = mulberry32(seed);
  const meta = defaultMeta();
  if (tech) meta.tech = LATTICE.map(n => n.id);
  const G = { W: 430, H: 900, cx: 215, cy: 450, S: newRun(meta, 'bastion'), fx: makeFx(), meta };
  resetWeapons(G); resetWaveDirector(G);
  G.S.hp = G.S.maxHp = 1e9;  // immortal: measuring the boss, not survival
  const events = [];
  let live = null;
  for (let i = 0; i < 60 * 60 * 90 && G.S.wave <= maxWave; i++) {
    const t = nearestEnemy(G.S, G.cx, G.cy);
    G.aim = t ? { x: t.x, y: t.y } : { x: G.cx, y: G.cy - 100 };
    const sig = updateGame(G, 1 / 60);
    updateFx(G.fx, 1 / 60);
    const boss = G.S.enemies.find(e => e.kind === 'boss' && !e.dead);
    if (boss && !live) live = { wave: G.S.wave, t: 0 };
    else if (live) {
      live.t += 1 / 60;
      if (!boss) { events.push(live); live = null; }
    }
    if (sig === 'levelup') { while (G.S.pendingLevels > 0) { applyChoice(G.S, levelChoices(G.S, Math.random)[0]); G.S.pendingLevels--; } }
  }
  return events;
}
const med = a => a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : NaN;
console.log(`boss ALIVE time during a real wave · target ${BOSS_TTK_TARGET}s (ramp from ${bossTargetTtk(5).toFixed(0)}s at wave 5)\n`);
for (const tech of [false, true]) {
  const all = {};
  for (const s of [1, 2, 3, 4, 5]) {
    for (const e of run(20260725 + s * 7919, tech, 45)) (all[e.wave] ||= []).push(e.t);
  }
  console.log(tech ? 'FULL LATTICE' : 'FRESH ACCOUNT');
  const waves = Object.keys(all).map(Number).sort((a, b) => a - b);
  console.log('  ' + waves.map(w => String(w).padStart(5)).join(''));
  console.log('  ' + waves.map(w => (med(all[w]).toFixed(0) + 's').padStart(5)).join(''));
  const deep = waves.filter(w => w >= 15).flatMap(w => all[w]);
  console.log(`  median over waves >=15: ${med(deep).toFixed(0)}s` +
    (tech ? '   (a geared account is FASTER by design — the lattice paying out)' : `   (target ${BOSS_TTK_TARGET}s)`) + '\n');
}
