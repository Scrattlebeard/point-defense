// Pointer-trace gesture classification. Pure: the shell feeds points and times in,
// decisions come out. Thresholds are the spec (core.md "Gestures").
export const HOLD_TIME = 0.28;  // seconds of stillness before a press becomes a hold
export const HOLD_SLOP = 14;    // px the pointer may wander and still count as "still"
export const SWIPE_MIN = 30;    // px of path length that makes a release a swipe

export function newTrace(x, y, t) {
  return {
    x0: x, y0: y, t0: t, x, y, points: [{ x, y, t }], pathLen: 0, holdEngaged: false,
    // sliding stillness anchor — resets whenever the pointer strays past HOLD_SLOP,
    // so a press that starts in motion can still become a hold once the finger
    // settles (core.md Gestures, 2026-07-24)
    stillX: x, stillY: y, stillT: t,
  };
}

export function addPoint(tr, x, y, t) {
  tr.pathLen += Math.hypot(x - tr.x, y - tr.y);
  tr.x = x; tr.y = y;
  if (Math.hypot(x - tr.stillX, y - tr.stillY) >= HOLD_SLOP) {
    tr.stillX = x; tr.stillY = y; tr.stillT = t;
  }
  if (tr.points.length < 64) tr.points.push({ x, y, t });
}

/** Poll during the gesture; once true the caller sets tr.holdEngaged and owns aiming. */
export function shouldEngageHold(tr, now, ownsHoldWeapon) {
  return ownsHoldWeapon && !tr.holdEngaged && (now - tr.stillT) >= HOLD_TIME;
}

/** On pointer-up. An engaged hold stays a hold no matter how far the aim wandered. */
export function classifyRelease(tr) {
  if (tr.holdEngaged) return { type: 'hold' };
  if (tr.pathLen >= SWIPE_MIN) return { type: 'swipe', from: { x: tr.x0, y: tr.y0 }, to: { x: tr.x, y: tr.y } };
  return { type: 'tap', x: tr.x, y: tr.y };
}
