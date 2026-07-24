#!/usr/bin/env node
// scripts/calibrate — the death-wave calibration tool (ADR-0003 guardrail 4).
// Runs fresh no-tech robot runs to death and reports the wave/level distribution
// against the onboarding band. Graduated from the 2026-07-24 balance spikes:
// every early-difficulty or player-power change should re-run this before landing.
//
//   node scripts/calibrate.mjs [trials=12]
//
// Band (core.md enemyHpMult note): fresh-run median death wave in [5, 10].
// The robot: perfect 0.2s retargeting, random level picks, no walls/beam —
// roughly a new human. Randomness is inherent; this is a tool, not a test.
import { defaultMeta, newRun, levelChoices, applyChoice } from '../src/core/state.js';
import { makeFx, updateFx } from '../src/app/fx.js';
import { resetWeapons } from '../src/app/weapons/index.js';
import { resetWaveDirector, updateGame } from '../src/app/game.js';
import { nearestEnemy } from '../src/app/enemies.js';

function runToDeath(maxSimSeconds = 1800) {
  const meta = defaultMeta();
  const G = {
    W: 430, H: 900, cx: 215, cy: 450, // phone-shaped: the primary audience
    S: newRun(meta, 'bastion'), fx: makeFx(), meta,
  };
  resetWeapons(G);
  resetWaveDirector(G);
  const dt = 1 / 60;
  let tapT = 0;
  for (let t = 0; t < maxSimSeconds; t += dt) {
    tapT -= dt;
    if (tapT <= 0) {
      const e = nearestEnemy(G.S, G.cx, G.cy);
      if (e) G.aim = { x: e.x, y: e.y };
      tapT = 0.2;
    }
    const sig = updateGame(G, dt);
    updateFx(G.fx, dt);
    if (sig === 'levelup') {
      while (G.S.pendingLevels > 0) {
        const cs = levelChoices(G.S, Math.random);
        applyChoice(G.S, cs[Math.floor(Math.random() * cs.length)]);
        G.S.pendingLevels--;
      }
    }
    if (sig === 'over') {
      return { wave: G.S.wave, lvl: G.S.lvl, kills: G.S.kills, time: Math.round(t) };
    }
  }
  return { wave: G.S.wave, lvl: G.S.lvl, kills: G.S.kills, time: maxSimSeconds, survived: true };
}

const trials = Number(process.argv[2] || 12);
const BAND = [5, 10];
const results = [];
for (let i = 0; i < trials; i++) {
  const r = runToDeath();
  results.push(r);
  console.log(
    `run ${String(i + 1).padStart(2)}: ${r.survived ? 'SURVIVED to' : 'died'} ` +
    `wave ${String(r.wave).padStart(2)} · lvl ${String(r.lvl).padStart(2)} · ` +
    `${r.kills} kills · ${r.time}s`);
}
const waves = results.map(r => r.wave).sort((a, b) => a - b);
const median = waves[Math.floor(trials / 2)];
const inBand = median >= BAND[0] && median <= BAND[1];
console.log(`\nmedian death wave ${median} · range ${waves[0]}–${waves[trials - 1]} · ` +
  `band [${BAND}] → ${inBand ? 'IN BAND ✓' : 'OUT OF BAND ✗'}`);
process.exit(inBand ? 0 : 1);
