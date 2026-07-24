// Cosmetic-only: particles, floating text, shake, vignette flash. Capped pools (app.md).
const MAX_PARTS = 350;
const MAX_TEXTS = 60;

export function makeFx() {
  return { parts: [], texts: [], flares: [], shake: 0, flash: 0 };
}

/** Boundary flare: a projectile died against the arena wall at (x,y), normal (nx,ny). */
export function addFlare(fx, x, y, nx, ny) {
  if (fx.flares.length >= 40) return;
  const nl = Math.hypot(nx, ny) || 1;
  fx.flares.push({ x, y, nx: nx / nl, ny: ny / nl, t: 0, life: 0.35 });
}

export function burst(fx, x, y, color, n = 10, spd = 130, life = 0.5, size = 3) {
  for (let i = 0; i < n; i++) {
    if (fx.parts.length >= MAX_PARTS) return;
    const a = Math.random() * Math.PI * 2;
    const v = spd * (0.35 + Math.random() * 0.65);
    fx.parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: life * (0.6 + Math.random() * 0.4), t: 0, color, size: size * (0.6 + Math.random() * 0.8),
    });
  }
}

export function dmgText(fx, x, y, v, { crit = false, color = '#aab6cc' } = {}) {
  if (fx.texts.length >= MAX_TEXTS) return;
  fx.texts.push({
    x: x + (Math.random() * 14 - 7), y, t: 0, life: crit ? 0.8 : 0.55,
    str: String(Math.round(v)) + (crit ? '!' : ''),
    size: crit ? 17 : 12, color: crit ? '#ffd24d' : color, vy: -46,
  });
}

export function announce(fx, str, color = '#9fd8ff', sub = '', icon = null) {
  fx.texts.push({ x: -1, y: -1, t: 0, life: 15, str, sub, icon, size: 19, color, vy: 0, center: true });
}

export function shake(fx, amount) { fx.shake = Math.min(14, fx.shake + amount); }
export function flash(fx, amount) { fx.flash = Math.min(0.5, fx.flash + amount); }

/** Decay camera juice (shake, flash) only. Runs every frame — even with the sim
 * paused behind an overlay — so a frozen field never keeps jittering (app.md). */
export function settleFx(fx, dt) {
  fx.shake = Math.max(0, fx.shake - 26 * dt);
  fx.flash = Math.max(0, fx.flash - 1.1 * dt);
}

export function updateFx(fx, dt) {
  for (const p of fx.parts) {
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.985; p.vy *= 0.985;
  }
  fx.parts = fx.parts.filter(p => p.t < p.life);
  for (const t of fx.texts) { t.t += dt; if (!t.center) t.y += t.vy * dt; }
  fx.texts = fx.texts.filter(t => t.t < t.life);
  for (const f of fx.flares) f.t += dt;
  fx.flares = fx.flares.filter(f => f.t < f.life);
  settleFx(fx, dt);
}
