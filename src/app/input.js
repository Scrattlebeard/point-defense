// Pointer events → traces → core gesture classification → weapon triggers.
// Multi-touch: one hold (beam) at a time; other pointers still tap/swipe.
import { newTrace, addPoint, shouldEngageHold, classifyRelease } from '../core/gestures.js';
import { fireBolt, fireShockwave } from './weapons.js';
import { initAudio } from './audio.js';

export function initInput(G, canvas) {
  G.traces = new Map();

  canvas.addEventListener('pointerdown', e => {
    initAudio();
    if (G.mode !== 'play') return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer may be gone */ }
    G.traces.set(e.pointerId, newTrace(e.clientX, e.clientY, G.S.time));
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', e => {
    const tr = G.traces.get(e.pointerId);
    if (tr) addPoint(tr, e.clientX, e.clientY, G.S.time);
  });

  const finish = e => {
    const tr = G.traces.get(e.pointerId);
    if (!tr) return;
    G.traces.delete(e.pointerId);
    if (G.wt.beamOwner === e.pointerId) { G.wt.beamOwner = null; G.wt.beamAim = null; }
    if (G.mode !== 'play') return;
    const g = classifyRelease(tr);
    if (g.type === 'tap') fireBolt(G, g.x, g.y);
    else if (g.type === 'swipe') {
      // graceful degrade (README pillar 1): no shockwave → bolt at the swipe's end
      if (!fireShockwave(G, g.from, g.to)) fireBolt(G, g.to.x, g.to.y);
    }
    // hold: damage already applied while channeling; release just ends it
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault()); // iOS pinch
}

/** Poll per frame while playing: engage/aim the beam. */
export function updateInput(G) {
  const S = G.S;
  const ownsHold = S.weapons.beam >= 1;
  for (const [id, tr] of G.traces) {
    if (!tr.holdEngaged && G.wt.beamOwner === null && shouldEngageHold(tr, S.time, ownsHold)) {
      tr.holdEngaged = true;
      G.wt.beamOwner = id;
    }
    if (tr.holdEngaged && G.wt.beamOwner === id) {
      G.wt.beamAim = { x: tr.x, y: tr.y };
    }
  }
}

export function clearInput(G) {
  G.traces.clear();
  if (G.wt) { G.wt.beamOwner = null; G.wt.beamAim = null; }
}
