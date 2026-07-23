// Per-frame simulation orchestration + wave director. Decisions (composition,
// healing, payout) come from core; this file only sequences them in time.
import { composeWave, rollVariant, pickVariant } from '../core/waves.js';
import { waveCleared } from '../core/state.js';
import { BOSS_NAMES, VARIANTS } from '../core/config.js';
import { spawnEnemy, updateEnemies } from './enemies.js';
import { updateWeapons } from './weapons.js';
import { announce } from './fx.js';
import { sfx } from './audio.js';

const SOFT_CAP = 240; // app.md: pause the queue, never drop spawns

export function resetWaveDirector(G) {
  G.wd = { phase: 'inter', t: 1.4, plan: null, idx: 0, spawnT: 0 };
  G.bossIdx = 0;
}

function directWaves(G, dt) {
  const S = G.S;
  const wd = G.wd;
  if (wd.phase === 'inter') {
    wd.t -= dt;
    if (wd.t <= 0) {
      S.wave++;
      wd.plan = composeWave(S.wave, Math.random);
      wd.idx = 0;
      wd.spawnT = 0.4;
      wd.phase = 'spawn';
      announce(G.fx, `WAVE ${S.wave}`, wd.plan.boss ? '#ff3df0' : '#9fd8ff');
    }
    return;
  }
  if (wd.phase === 'spawn') {
    wd.spawnT -= dt;
    while (wd.spawnT <= 0 && wd.idx < wd.plan.spawns.length) {
      if (S.enemies.length >= SOFT_CAP) { wd.spawnT = 0.5; return; }
      const kind = wd.plan.spawns[wd.idx++];
      if (kind === 'boss') {
        // once the name roster recirculates, every returning noble carries a
        // guaranteed variant, worn as an epithet (core.md "Boss variants")
        const recirc = G.bossIdx >= BOSS_NAMES.length;
        const bv = recirc ? pickVariant(S.wave, Math.random) : null;
        spawnEnemy(G, 'boss', bv);
        const name = BOSS_NAMES[G.bossIdx % BOSS_NAMES.length];
        announce(G.fx,
          bv ? `${name}, THE ${VARIANTS[bv].name.toUpperCase()}` : name,
          '#ff3df0',
          bv ? VARIANTS[bv].desc : 'approaches',
          { sides: 9, color: '#ff3df0', variant: bv });
        G.bossIdx++;
        sfx('boss');
      } else {
        spawnEnemy(G, kind, rollVariant(S.wave, Math.random));
      }
      wd.spawnT += wd.plan.interval;
    }
    if (wd.idx >= wd.plan.spawns.length) wd.phase = 'clear';
    return;
  }
  // 'clear': waiting for the field to empty
  if (S.enemies.length === 0) {
    waveCleared(S);
    announce(G.fx, 'WAVE CLEAR', '#59ff9c');
    wd.phase = 'inter';
    wd.t = 2.2;
  }
}

/** @returns null | 'levelup' | 'over' — the mode transition the shell should take. */
export function updateGame(G, dt) {
  const S = G.S;
  S.time += dt;
  if (S.regen > 0) S.hp = Math.min(S.maxHp, S.hp + S.regen * dt);
  directWaves(G, dt);
  updateEnemies(G, dt);
  updateWeapons(G, dt);
  if (S.hp <= 0) return 'over';
  if (S.pendingLevels > 0) return 'levelup';
  return null;
}
