// The weapons seam (weapons.md): reset + the per-frame orchestrator. This file
// is the ONLY place that knows the family call order — and the order is
// behavior-load-bearing (weapons.md "Ordering"). Everything the rest of the
// app or the tests need is exported from here.
import { updateSwipe, fireWall, fireBlades } from './swipe.js';
import { updateHold, releaseHold, BEAM_REARM } from './hold.js';
import { updateBolt, updateAimOrdnance, updateBullets } from './aim.js';
import { updateAuto } from './auto.js';
import { updateField, updateFires } from './field.js';

export { fireWall, fireBlades, releaseHold, BEAM_REARM };

export function resetWeapons(G) {
  G.wt = {
    boltT: 0.3, wallCd: 0,
    orbA: 0, novaT: 2.5, teslaT: 1.2, teslaReady: false, teslaCharge: 0, seekT: 1.6, turretT: 0.8,
    mineT: 1.0, mortT: 1.5,
    scatT: 0.15, burstT: 0.1, burstLeft: 0, burstGapT: 0,
    heavyPhase: 0, heavyPhaseT: 0.1, boomT: 1.4,
    bladeCd: 0, flamePatchT: 0, metCharge: 0, metCd: 0,
    cataT: 2.0, calT: 1.0, cascT: 2.5,
    holdOwner: null, holdAim: null, // one hold-slot weapon per run (ADR-0004)
  };
  G.aim = { x: G.cx, y: G.cy - 160 }; // standing aim point; input moves it
  G.aura = null;
  G.walls = [];
}

export function updateWeapons(G, dt) {
  updateSwipe(G, dt);       // gesture cds, wall siege, blades in flight
  updateFires(G, dt);       // burning ground before new patches drop this frame
  updateBolt(G, dt);
  updateHold(G, dt);        // beam | flame | meteor (the one hold slot)
  updateAuto(G, dt);        // aura first (enemies.js reads it), then the autos
  updateField(G, dt);       // mines, mortar+shells (meteor impacts), exotics
  updateAimOrdnance(G, dt); // scatter, burst, heavy, boomer
  updateBullets(G, dt);     // the pool LAST: every gun's shot moves this frame
}
