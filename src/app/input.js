// Pointer events → traces → core gesture classification → weapon triggers.
// Multi-touch: one hold-slot channel at a time; other pointers still tap/swipe.
import { newTrace, addPoint, shouldEngageHold, classifyRelease } from '../core/gestures.js';
import { fireWall, fireBlades, releaseHold } from './weapons/index.js';
import { initAudio } from './audio.js';

export function initInput(G, canvas) {
  G.traces = new Map();

  // Map pointer coords through the canvas rect — origin AND scale corrected.
  // Raw clientX assumes the canvas sits at the viewport origin at 1:1, which
  // embedding pages (artifact viewer) break (app.md input.js).
  const toLocal = e => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return { x: e.clientX, y: e.clientY };
    return { x: (e.clientX - r.left) * (G.W / r.width), y: (e.clientY - r.top) * (G.H / r.height) };
  };

  const setAim = p => { if (G.mode === 'play' && G.wt) G.aim = { x: p.x, y: p.y }; };

  canvas.addEventListener('pointerdown', e => {
    initAudio();
    if (G.mode !== 'play') return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer may be gone */ }
    const p = toLocal(e);
    G.traces.set(e.pointerId, newTrace(p.x, p.y, G.S.time));
    setAim(p);
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', e => {
    const p = toLocal(e);
    const tr = G.traces.get(e.pointerId);
    if (tr) addPoint(tr, p.x, p.y, G.S.time);
    // the aim point follows every pointer position — hover included (core.md "The aim point")
    setAim(p);
  });

  const finish = e => {
    const tr = G.traces.get(e.pointerId);
    if (!tr) return;
    G.traces.delete(e.pointerId);
    if (G.wt.holdOwner === e.pointerId) {
      // meteor: release IS the trigger; beam/flame just stop (core.md Gestures)
      if (G.mode === 'play') releaseHold(G);
      G.wt.holdOwner = null;
      G.wt.holdAim = null;
    }
    if (G.mode !== 'play') return;
    const g = classifyRelease(tr);
    if (g.type === 'tap') G.aim = { x: g.x, y: g.y };
    else if (g.type === 'swipe') {
      // one swipe-slot weapon per run (ADR-0004); graceful degrade (README
      // pillar 1): no swipe weapon → the swipe still re-aims
      if (!fireWall(G, g.from, g.to) && !fireBlades(G, g.from, g.to)) {
        G.aim = { x: g.to.x, y: g.to.y };
      }
    }
    // hold: handled above — channel damage was live; meteor dropped on release
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault()); // iOS pinch
}

/** Poll per frame while playing: engage/aim the hold-slot channel. */
export function updateInput(G) {
  const S = G.S;
  const ownsHold = S.weapons.beam >= 1 || S.weapons.flame >= 1 || S.weapons.meteor >= 1;
  for (const [id, tr] of G.traces) {
    if (!tr.holdEngaged && G.wt.holdOwner === null && shouldEngageHold(tr, S.time, ownsHold)) {
      tr.holdEngaged = true;
      G.wt.holdOwner = id;
    }
    if (tr.holdEngaged && G.wt.holdOwner === id) {
      G.wt.holdAim = { x: tr.x, y: tr.y };
    }
  }
}

export function clearInput(G) {
  G.traces.clear();
  if (G.wt) { G.wt.holdOwner = null; G.wt.holdAim = null; }
}
