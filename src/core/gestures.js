// Pointer-trace gesture classification. Pure: the shell feeds points and times in,
// decisions come out. Thresholds are the spec (core.md "Gestures").
export const HOLD_TIME = 0.28;  // seconds before a still press becomes a hold
export const HOLD_SLOP = 14;    // px of displacement allowed while engaging a hold
export const SWIPE_MIN = 30;    // px of path length that makes a release a swipe

export function newTrace(x, y, t) {
  return { x0: x, y0: y, t0: t, x, y, points: [{ x, y, t }], pathLen: 0, maxDisp: 0, holdEngaged: false };
}

export function addPoint(tr, x, y, t) {
  tr.pathLen += Math.hypot(x - tr.x, y - tr.y);
  tr.maxDisp = Math.max(tr.maxDisp, Math.hypot(x - tr.x0, y - tr.y0));
  tr.x = x; tr.y = y;
  if (tr.points.length < 64) tr.points.push({ x, y, t });
}

/** Poll during the gesture; once true the caller sets tr.holdEngaged and owns aiming. */
export function shouldEngageHold(tr, now, ownsHoldWeapon) {
  return ownsHoldWeapon && !tr.holdEngaged && (now - tr.t0) >= HOLD_TIME && tr.maxDisp < HOLD_SLOP;
}

/** On pointer-up. An engaged hold stays a hold no matter how far the aim wandered. */
export function classifyRelease(tr) {
  if (tr.holdEngaged) return { type: 'hold' };
  if (tr.pathLen >= SWIPE_MIN) return { type: 'swipe', from: { x: tr.x0, y: tr.y0 }, to: { x: tr.x, y: tr.y } };
  return { type: 'tap', x: tr.x, y: tr.y };
}
