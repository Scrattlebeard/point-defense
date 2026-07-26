// All canvas drawing. Reads state, never changes it (except cheap cached paths).
// Visual grammar (app.md): enemy species = hue, variant = highlight; player
// effects stay cyan/white; single dark neon theme.
import { TOWERS, WEAPONS, VARIANTS } from '../core/config.js';
import { TAU, clamp, bladeSpine } from '../core/geom.js';
import { hpBarThreshold } from '../core/balance.js';
import { BEAM_REARM } from './weapons/index.js';
import { tube, litDisc, litBar, rimLight, shade, alpha, LIGHT_A } from './neon.js';

/** The Point's drawn hull radius. Exported because the orbit blades are mounted
 *  ON it (core.md orbit row) and a test holds them to it — a blade rooted past the
 *  hull floats, and floating is the thing that read as "not attached". */
export const TOWER_R = 24;

export function poly(ctx, x, y, r, sides, rot) {
  ctx.beginPath();
  if (sides === 0) { ctx.arc(x, y, r, 0, TAU); return; }
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * TAU) / sides;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Vertical diamond path (half-width w, half-height h) — mines, crystals, markers. */
function diamond(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y - h); ctx.lineTo(x + w, y);
  ctx.lineTo(x, y + h); ctx.lineTo(x - w, y);
  ctx.closePath();
}

/** A single upward flame lick — shared by burning ground and burning shapes. */
function flameLick(ctx, x, y, h, style, width = 1.8) {
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
}

export function renderFrame(G) {
  const { ctx, W, H, fx } = G;
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  if (fx && fx.shake > 0) {
    ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  }

  drawGrid(G);
  if (G.S) drawField(G);
  drawFx(G);
  ctx.restore();

  if (fx && fx.flash > 0) {
    ctx.fillStyle = `rgba(255, 60, 70, ${fx.flash})`;
    ctx.fillRect(0, 0, W, H);
  }
}

const SPARKS_ON = typeof location !== 'undefined' && location.search.includes('sparks');

// ?noblur — the A/B switch for the shadowBlur hypothesis (PINS [perf]). Canvas
// shadow blur is the most expensive 2D operation on a mobile GPU (each one forces
// an offscreen blur pass), and this renderer applies it per-enemy: every shape
// currently flashing from a hit, plus every swift one. Measured 2.5 blurred draws
// per frame at wave 14 rising to 7.3 by wave 29 — which is the right SHAPE to
// explain the observed p95 step, and unmeasurable from here because nothing in
// this repo can time a GPU. So it ships as a hatch the device can settle, not as
// a change to a law-governed channel (app.md "the hit pop is a stroke + glow").
let glowOn = typeof location === 'undefined' || !location.search.includes('noblur');
/** Test seam — the hatch must be provably load-bearing, not decorative. */
export function setGlow(on) { glowOn = on; }
function glow(ctx, color, amount) {
  if (!glowOn) return;
  ctx.shadowColor = color;
  ctx.shadowBlur = amount;
}

function drawGrid(G) {
  const { ctx, W, H } = G;
  // The floor lights under the Point (app.md "Light has a grammar"): one radial
  // gradient as the stroke style, bright at the tower and guttering out toward the
  // corners. A flat alpha made the arena read as graph paper — this gives it a
  // centre and a horizon for one gradient and no extra draws.
  const gx = G.cx || W / 2, gy = G.cy || H / 2;
  const floor = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.62);
  floor.addColorStop(0, 'rgba(130, 180, 255, 0.135)');
  floor.addColorStop(0.45, 'rgba(110, 150, 230, 0.055)');
  floor.addColorStop(1, 'rgba(90, 120, 200, 0.022)');
  ctx.strokeStyle = floor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 44) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 44) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // grid sparks (app.md): stateless ambient lights crawling the lanes.
  // Menu-only by default — &sparks re-enables in battle (motion read as threat).
  const menuMode = G.mode === 'menu';
  if (!SPARKS_ON && !menuMode) return;
  const peak = menuMode ? 0.7 : 0.3; // brighter under the menu glass
  // Wall-clock on purpose — the room keeps humming through pause and menus.
  const t = performance.now() / 1000;
  const hash = n => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); };
  for (let k = 0; k < 9; k++) {
    const period = 22 + (k % 4) * 5; // seconds per lane crossing — a drift, not a dash
    const phase = t / period + k * 0.37;
    const cycle = Math.floor(phase);
    const p = phase - cycle;
    const h = hash(cycle * 127.1 + k * 311.7); // re-roll lane + direction per pass
    const horiz = k % 2 === 0;
    const span = horiz ? W : H;
    const lanes = Math.max(1, Math.floor((horiz ? H : W) / 44) - 1);
    const lane = (1 + Math.floor(h * lanes)) * 44;
    const dir = h > 0.5 ? 1 : -1;
    const head = dir > 0 ? p * span : (1 - p) * span;
    const tail = head - dir * 34;
    const a = peak * Math.sin(Math.PI * p) ** 2; // gradual fade in/out across the run
    const grad = horiz
      ? ctx.createLinearGradient(tail, 0, head, 0)
      : ctx.createLinearGradient(0, tail, 0, head);
    grad.addColorStop(0, 'rgba(120, 200, 255, 0)');
    grad.addColorStop(1, `rgba(150, 220, 255, ${a})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (horiz) { ctx.moveTo(tail, lane); ctx.lineTo(head, lane); }
    else { ctx.moveTo(lane, tail); ctx.lineTo(lane, head); }
    ctx.stroke();
    ctx.fillStyle = `rgba(200, 238, 255, ${a})`;
    ctx.fillRect((horiz ? head : lane) - 1, (horiz ? lane : head) - 1, 2, 2);
  }
  ctx.lineWidth = 1;
}

function drawField(G) {
  const { ctx, S } = G;

  // frost aura
  if (G.aura) {
    const g = ctx.createRadialGradient(G.cx, G.cy, 10, G.cx, G.cy, G.aura.r);
    g.addColorStop(0, 'rgba(127, 216, 255, 0.02)');
    g.addColorStop(0.85, 'rgba(127, 216, 255, 0.07)');
    g.addColorStop(1, 'rgba(127, 216, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(G.cx, G.cy, G.aura.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(127, 216, 255, 0.14)';
    ctx.setLineDash([6, 10]);
    ctx.beginPath(); ctx.arc(G.cx, G.cy, G.aura.r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);

    // frost oomph (app.md): stationary twinkling crystals, varied sizes, no rim
    // spikes. Stateless — S.time + per-index hash; dim on average by decree.
    const t = S.time;
    const hash = n => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); };
    const crystals = Math.round(G.aura.r / 9); // density scales with aura level
    for (let i = 0; i < crystals; i++) {
      const a = i * 2.399963; // golden angle: even angular spread
      // sqrt → area-uniform radii; inner 24px kept clear of the tower
      const rr = 24 + Math.sqrt(hash(i * 12.9898 + 1)) * (G.aura.r - 34);
      const mx = G.cx + Math.cos(a) * rr, my = G.cy + Math.sin(a) * rr;
      const size = 1.5 + 3 * hash(i * 7.13 + 2);
      // twinkle: long dim rest, brief sharp glint (cubed sine = sparkle not glow)
      const tw = Math.sin(t * (0.9 + 1.8 * hash(i * 3.7 + 3)) + hash(i * 5.1 + 4) * TAU);
      const glint = 0.09 + 0.34 * Math.max(0, tw) ** 3;
      ctx.fillStyle = `rgba(185, 234, 255, ${glint})`;
      diamond(ctx, mx, my, size * 0.6, size);
      ctx.fill();
      // the biggest crystals get a tiny core flash at glint peak
      if (size > 3.4 && tw > 0.92) {
        ctx.fillStyle = `rgba(235, 250, 255, ${0.5 * (tw - 0.92) / 0.08})`;
        ctx.fillRect(mx - 0.8, my - 0.8, 1.6, 1.6);
      }
    }
  }

  // mines — small solid cyan diamonds (player allegiance = fill), blinking core
  // once armed (app.md "Mines & mortar")
  for (const m of S.mines) {
    const armed = m.arm <= 0;
    if (armed) { // a live mine sits in its own pool of light; a dormant one does not
      ctx.fillStyle = 'rgba(159, 243, 255, 0.12)';
      diamond(ctx, m.x, m.y, 8, 10.5);
      ctx.fill();
    }
    ctx.fillStyle = armed ? 'rgba(159, 243, 255, 0.85)' : 'rgba(159, 243, 255, 0.35)';
    diamond(ctx, m.x, m.y, 4.5, 6);
    ctx.fill();
    if (armed && Math.sin(S.time * 6) > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(m.x - 1, m.y - 1, 2, 2);
    }
  }

  // burning ground (flame/meteor scorch) — soft warm circles guttering out,
  // dimmer than nova by decree (app.md "Hold & swipe variants")
  for (const f of S.fires) {
    const a = clamp(f.life / f.max, 0, 1);
    const flick = 0.8 + 0.2 * Math.sin(S.time * 11 + f.x);
    const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.r);
    g.addColorStop(0, `rgba(255, 176, 64, ${0.30 * a * flick})`);
    g.addColorStop(0.7, `rgba(255, 110, 40, ${0.16 * a})`);
    g.addColorStop(1, 'rgba(255, 90, 30, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
    // a few licks of flame, stateless (hash on index-ish coords + time)
    for (let i = 0; i < 3; i++) {
      const fa = (Math.sin(f.x * 0.37 + i * 2.1) * 43758.55) % TAU;
      const rr = f.r * 0.55 * ((Math.sin(f.y * 0.29 + i * 3.7) * 9871.3 % 1 + 1) % 1);
      const hgt = (2 + 3 * ((Math.sin(S.time * (3 + i) + f.x + i) + 1) / 2)) * a;
      const lx = f.x + Math.cos(fa) * rr, ly = f.y + Math.sin(fa) * rr;
      flameLick(ctx, lx, ly, hgt * 2, `rgba(255, 200, 90, ${0.35 * a * flick})`, 1.5);
    }
  }

  // mortar shells & falling meteors — arcing dot with fake height over a
  // ground-shadow telegraph; the meteor is the same grammar, scaled up
  for (const sh of S.shells) {
    const p = Math.min(1, sh.t / sh.flight);
    const met = sh.kind === 'meteor';
    const px = sh.x0 + (sh.tx - sh.x0) * p;
    const py = sh.y0 + (sh.ty - sh.y0) * p;
    const h = met ? (1 - p) * 260 : Math.sin(Math.PI * p) * 110;
    // shadow marks the true impact point as the shell closes in
    ctx.fillStyle = `rgba(255, 210, 77, ${0.10 + 0.25 * p})`;
    ctx.beginPath(); ctx.arc(sh.tx, sh.ty, (met ? 10 : 7) - 3 * p, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255, 210, 77, ${0.2 + 0.3 * p})`;
    ctx.lineWidth = met ? 2 : 1.2;
    ctx.beginPath(); ctx.arc(sh.tx, sh.ty, sh.blast * p, 0, TAU); ctx.stroke();
    // the shell itself, lofted (meteor: fat rock + ember trail, falling straight in)
    if (met) {
      ctx.strokeStyle = 'rgba(255, 150, 60, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px, py - h - 26); ctx.lineTo(px, py - h); ctx.stroke();
      litDisc(ctx, px, py - h, 7 + 3 * p, '#ffb84d');
      ctx.fillStyle = '#fff3d0';
      ctx.beginPath(); ctx.arc(px, py - h, 3, 0, TAU); ctx.fill();
    } else {
      litDisc(ctx, px, py - h, 3 + 1.5 * Math.sin(Math.PI * p), '#ffd24d');
    }
  }

  // meteor charge telegraph — the growing circle IS the blast preview (app.md)
  if (S.weapons.meteor >= 1 && G.wt.metCharge > 0 && G.wt.holdAim) {
    const st = WEAPONS.meteor.stats(S.weapons.meteor);
    const c = G.wt.metCharge;
    const r = st.blast * (st.minBlastFrac + (1 - st.minBlastFrac) * c);
    const pulse = 0.75 + 0.25 * Math.sin(S.time * 9);
    ctx.strokeStyle = `rgba(255, 176, 64, ${(0.35 + 0.45 * c) * pulse})`;
    ctx.lineWidth = 2 + 2 * c;
    ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(G.wt.holdAim.x, G.wt.holdAim.y, r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255, 210, 77, ${0.15 + 0.3 * c})`;
    ctx.beginPath(); ctx.arc(G.wt.holdAim.x, G.wt.holdAim.y, 5 + 9 * c, 0, TAU); ctx.fill();
  }

  // flamethrower cone — warm register, layered haze→body→core (app.md)
  if (G.flameCone) {
    const fc = G.flameCone;
    const flick = 0.85 + 0.15 * Math.sin(S.time * 17);
    const layers = [
      [fc.arc, 'rgba(255, 90, 30, 0.10)'],
      [fc.arc * 0.7, 'rgba(255, 140, 50, 0.16)'],
      [fc.arc * 0.4, `rgba(255, 205, 100, ${0.22 * flick})`],
    ];
    for (const [arc, color] of layers) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(G.cx, G.cy);
      ctx.arc(G.cx, G.cy, fc.range * flick, fc.a - arc, fc.a + arc);
      ctx.closePath();
      ctx.fill();
    }
    // forward-drifting flame particles, stateless
    for (let i = 0; i < 9; i++) {
      const ph = ((S.time * (1.3 + 0.31 * i)) + i * 0.618) % 1;
      const pa = fc.a + Math.sin(i * 12.9898) * fc.arc * 0.8;
      const pr = 20 + ph * (fc.range - 30);
      ctx.fillStyle = `rgba(255, ${170 + i * 8}, 70, ${0.5 * (1 - ph)})`;
      ctx.beginPath();
      ctx.arc(G.cx + Math.cos(pa) * pr, G.cy + Math.sin(pa) * pr, 2 + 3 * ph, 0, TAU);
      ctx.fill();
    }
  }

  // force blades — solid cyan crescents sweeping outward (player fill law)
  for (const bl of S.blades) {
    ctx.save();
    ctx.translate(bl.x, bl.y);
    ctx.rotate(bl.a);
    // thin motion trail
    ctx.strokeStyle = 'rgba(159, 243, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-4, 0); ctx.stroke();
    // crescent: an emissive tube — cyan bloom, white-hot edge
    ctx.lineCap = 'round';
    tube(ctx, () => { ctx.beginPath(); ctx.arc(-6, 0, bl.r, -1.15, 1.15); },
      '#9ff3ff', 4.5, { halo: 8, haloA: 0.22, core: 0.55 });
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  // nova rings — bright and SOLID; frost stays dim and dashed (app.md legibility note)
  for (const ring of S.rings) {
    const a = clamp(1 - ring.r / ring.max, 0, 1);
    tube(ctx, () => { ctx.beginPath(); ctx.arc(G.cx, G.cy, ring.r, 0, TAU); },
      '#9ff3ff', 4, { halo: 10, haloA: 0.22 * a, core: 0.5, coreA: 0.65 * a + 0.2 });
  }

  drawAim(G);

  // force walls — glowing barrier + outward push ticks; brightness = remaining HP
  for (const w of G.walls) {
    const a = clamp(w.hp / w.maxHp, 0, 1);
    const shimmer = 0.7 + 0.3 * Math.sin(S.time * 10 + w.ax);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(77, 232, 255, ${0.2 * a})`;
    ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(w.ax, w.ay); ctx.lineTo(w.bx, w.by); ctx.stroke();
    ctx.strokeStyle = `rgba(159, 243, 255, ${(0.45 + 0.3 * shimmer) * a})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(w.ax, w.ay); ctx.lineTo(w.bx, w.by); ctx.stroke();
    ctx.lineCap = 'butt';
    // outward push ticks along the wall
    ctx.strokeStyle = `rgba(159, 243, 255, ${0.5 * a})`;
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= 5; i++) {
      const px = w.ax + (w.bx - w.ax) * (i / 6);
      const py = w.ay + (w.by - w.ay) * (i / 6);
      const ext = 7 + 3 * Math.sin(S.time * 8 + i);
      ctx.beginPath();
      ctx.moveTo(px + w.nx * 4, py + w.ny * 4);
      ctx.lineTo(px + w.nx * (4 + ext), py + w.ny * (4 + ext));
      ctx.stroke();
    }
    // hp sliver at the wall's midpoint
    const wmx = (w.ax + w.bx) / 2, wmy = (w.ay + w.by) / 2;
    ctx.fillStyle = 'rgba(10, 13, 21, 0.75)';
    ctx.fillRect(wmx - 16, wmy - w.ny * 12 - 2, 32, 4);
    ctx.fillStyle = '#4de8ff';
    ctx.fillRect(wmx - 16, wmy - w.ny * 12 - 2, 32 * a, 4);
  }

  // beam — LOUD: layered glow + surge modulation + counter-flowing dashes (app.md juice)
  if (G.beamEnd) {
    const t = S.time;
    const pulse = 1 + 0.3 * Math.sin(t * 13);
    const surge = 0.75 + 0.25 * Math.sin(t * 23) * Math.sin(t * 3.7);
    const line = () => { ctx.beginPath(); ctx.moveTo(G.cx, G.cy); ctx.lineTo(G.beamEnd.x, G.beamEnd.y); ctx.stroke(); };
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(77, 232, 255, ${0.18 * surge})`;   // outer haze
    ctx.lineWidth = (G.beamEnd.width + 16) * pulse;
    line();
    ctx.strokeStyle = `rgba(120, 240, 255, ${0.45 * surge})`;  // mid sheath
    ctx.lineWidth = (G.beamEnd.width + 4) * (0.7 + 0.3 * pulse);
    line();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 + 0.3 * surge})`; // white core
    ctx.lineWidth = Math.max(2.5, G.beamEnd.width * 0.5 * pulse);
    line();
    // energy flowing outward, fast and chunky
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([22, 26]);
    ctx.lineDashOffset = -((t * 560) % 48);
    line();
    // faint counter-flow shimmer
    ctx.strokeStyle = 'rgba(159, 243, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 40]);
    ctx.lineDashOffset = (t * 300) % 46;
    line();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    ctx.lineCap = 'butt';
    // bloom where the beam meets the arena wall
    const bloom = 10 + 4 * Math.sin(S.time * 15);
    const bg = ctx.createRadialGradient(G.beamEnd.x, G.beamEnd.y, 1, G.beamEnd.x, G.beamEnd.y, bloom + 14);
    bg.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    bg.addColorStop(0.4, 'rgba(120, 240, 255, 0.35)');
    bg.addColorStop(1, 'rgba(120, 240, 255, 0)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(G.beamEnd.x, G.beamEnd.y, bloom + 14, 0, TAU); ctx.fill();
  }

  // arena-wall flares: projectiles dying against the invisible boundary
  if (G.fx) {
    for (const f of G.fx.flares) {
      const a = clamp(1 - f.t / f.life, 0, 1);
      const grow = 1 + f.t * 6;
      // streak along the wall (perpendicular to the inward normal)
      const tx = -f.ny, ty = f.nx;
      const L = 16 * grow;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(120, 240, 255, ${0.5 * a})`;
      ctx.lineWidth = 5 * a + 1;
      ctx.beginPath();
      ctx.moveTo(f.x - tx * L, f.y - ty * L);
      ctx.lineTo(f.x + tx * L, f.y + ty * L);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * a})`;
      ctx.lineWidth = 2 * a + 0.5;
      ctx.beginPath();
      ctx.moveTo(f.x - tx * L * 0.55, f.y - ty * L * 0.55);
      ctx.lineTo(f.x + tx * L * 0.55, f.y + ty * L * 0.55);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  // tesla zaps — under-glow + hot core
  for (const z of S.zaps) {
    const a = 1 - z.t / 0.18;
    for (const [color, width] of [[`rgba(120, 200, 255, ${0.35 * a})`, 6], [`rgba(220, 240, 255, ${0.95 * a})`, 2.5]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i < z.pts.length - 1; i++) {
        const p = z.pts[i], q = z.pts[i + 1];
        ctx.moveTo(p.x, p.y);
        const mx = (p.x + q.x) / 2 + (Math.random() - 0.5) * 18;
        const my = (p.y + q.y) / 2 + (Math.random() - 0.5) * 18;
        ctx.quadraticCurveTo(mx, my, q.x, q.y);
      }
      ctx.stroke();
    }
  }

  // bullets & missiles — emissive: coloured body, white-hot centre. Deliberately
  // NOT a halo pass: bullets are the most numerous player entity on the field and
  // a two-stroke tube on each is the one place this grammar could actually cost
  // something. A hot core alone reads as "lit" at these radii.
  for (const b of S.bullets) {
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.fillStyle = alpha(shade(b.color, 0.85), 0.85);
    ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(0.8, b.r * 0.42), 0, TAU); ctx.fill();
  }
  for (const m of S.missiles) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(Math.atan2(m.vy, m.vx));
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, 3.4); ctx.lineTo(-4, -3.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255, 246, 214, 0.9)';   // hot nose
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(0, 1.5); ctx.lineTo(0, -1.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // caltrops — tiny solid cyan jacks, dim by decree (floor hazard, not signal)
  for (const c of S.caltrops) {
    const blink = 0.45 + 0.2 * Math.sin(S.time * 4 + c.x);
    ctx.strokeStyle = `rgba(159, 243, 255, ${blink})`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const a = k * (TAU / 4) + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + Math.cos(a) * 4.5, c.y + Math.sin(a) * 4.5);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  // boulders — fat solid rolling polygon, player cyan-grey, dust at the rim
  for (const b of S.boulders) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    // a lit rock: the gradient is built in the boulder's OWN rotating frame on
    // purpose — the highlight rides the surface as it rolls, which is what makes
    // the rotation legible at all (a fixed highlight reads as a spinning decal)
    const bg = ctx.createRadialGradient(-b.r * 0.35, -b.r * 0.4, b.r * 0.1, 0, 0, b.r);
    bg.addColorStop(0, shade('#a9ccd6', 0.5));
    bg.addColorStop(0.55, '#a9ccd6');
    bg.addColorStop(1, shade('#a9ccd6', -0.45));
    ctx.fillStyle = bg;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k * TAU) / 7;
      const rr = b.r * (0.85 + 0.15 * Math.sin(k * 5.7)); // craggy, stable per-vertex
      k === 0 ? ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
        : ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(232, 251, 255, 0.5)';
    ctx.beginPath(); ctx.arc(b.r * 0.3, -b.r * 0.25, b.r * 0.22, 0, TAU); ctx.fill();
    ctx.restore();
    // dust flecks trailing the roll
    const sp = Math.hypot(b.vx, b.vy) || 1;
    for (let i = 0; i < 3; i++) {
      const ph = (S.time * 2.1 + i * 0.33) % 1;
      ctx.fillStyle = `rgba(188, 216, 224, ${0.4 * (1 - ph)})`;
      ctx.beginPath();
      ctx.arc(b.x - (b.vx / sp) * (b.r + ph * 22), b.y - (b.vy / sp) * (b.r + ph * 22) + Math.sin(i * 7) * 4, 1.6, 0, TAU);
      ctx.fill();
    }
  }

  // cascade sparks — small white comets with a short tail
  for (const sp of S.sparks) {
    const v = Math.hypot(sp.vx, sp.vy) || 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sp.x - (sp.vx / v) * 14, sp.y - (sp.vy / v) * 14);
    ctx.lineTo(sp.x, sp.y);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 3, 0, TAU); ctx.fill();
  }

  // boomerangs — solid cyan spinning blade, two crossed crescents + motion arc
  // (app.md "Aim ordnance": solid fill = player's; spin+size ≠ any bullet)
  for (const b of S.boomers) {
    ctx.save();
    ctx.translate(b.x, b.y);
    // faint motion arc trailing the velocity
    const va = Math.atan2(b.vy, b.vx);
    ctx.strokeStyle = 'rgba(159, 243, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, b.r + 3, va + Math.PI * 0.6, va + Math.PI * 1.4); ctx.stroke();
    ctx.rotate(b.spin);
    ctx.fillStyle = 'rgba(159, 243, 255, 0.18)';   // the blade's own bloom
    ctx.beginPath(); ctx.arc(0, 0, b.r * 1.05, 0, TAU); ctx.fill();
    for (let k = 0; k < 2; k++) {
      ctx.rotate(k * Math.PI / 2);
      const g = ctx.createLinearGradient(-b.r * 0.3, 0, b.r * 0.3, 0);
      g.addColorStop(0, '#e8fbff'); g.addColorStop(0.55, '#9ff3ff'); g.addColorStop(1, '#4aa8bd');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, -b.r * 0.55, b.r * 0.28, b.r * 0.8, 0, 0, TAU);
      ctx.ellipse(0, b.r * 0.55, b.r * 0.28, b.r * 0.8, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // orbit blades
  if (S.weapons.orbit >= 1) {
    const st = WEAPONS.orbit.stats(S.weapons.orbit);
    // ADR-0022 + the curve pass: the blade is drawn along geom.bladeSpine, the
    // SAME swept centreline the hit test walks. Widths are asymmetric on purpose —
    // a thin honed edge on the leading side, the mass of the blade behind it — and
    // both taper to nothing at the tip. Constant width down a straight spoke is
    // what read as a rod; the taper and the sweep are the whole fix.
    const STEPS = 12, LEAD = 2.6, BACK = 8.6;
    // one silhouette, scaled twice: thin shaft at the hub (0.30), belly around a
    // third of the way out, nothing at the tip. Mounting the blades on the hull
    // made a max-at-root taper untenable — six wide roots at r=22 fuse into a disc.
    const shape = t => (0.30 + 0.70 * Math.sin(Math.PI * Math.pow(t, 0.62))) * (1 - Math.pow(t, 2.6));
    const lead = t => LEAD * shape(t);
    const back = t => BACK * shape(t);
    let bladeGrad = null;
    for (let i = 0; i < st.n; i++) {
      const a = G.wt.orbA + (i * TAU) / st.n;
      const sp = bladeSpine(G.cx, G.cy, a, st.inner, st.outer, st.sweep, STEPS);
      // offset each knot perpendicular to the spine: +normal leads, −normal trails
      const side = (k, w) => {
        const k0 = Math.max(0, k - 1) * 2, k1 = Math.min(STEPS, k + 1) * 2;
        const tx = sp[k1] - sp[k0], ty = sp[k1 + 1] - sp[k0 + 1];
        const m = Math.hypot(tx, ty) || 1;
        return [sp[k * 2] - (ty / m) * w, sp[k * 2 + 1] + (tx / m) * w];
      };
      if (!bladeGrad) {
        // built once, in world space at the Point: light across the blade rather
        // than along it, so the honed edge stays the bright one all the way round
        bladeGrad = ctx.createRadialGradient(G.cx, G.cy, st.inner * 0.4, G.cx, G.cy, st.outer);
        bladeGrad.addColorStop(0, '#eafcff');
        bladeGrad.addColorStop(0.55, '#9ff3ff');
        bladeGrad.addColorStop(1, '#5fb9d4');
      }
      ctx.fillStyle = bladeGrad;
      ctx.beginPath();
      for (let k = 0; k <= STEPS; k++) {          // honed edge, root → tip
        const [x, y] = side(k, lead(k / STEPS));
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let k = STEPS; k >= 0; k--) {          // the back, tip → root
        const [x, y] = side(k, -back(k / STEPS));
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let k = 0; k <= STEPS; k++) {
        const [x, y] = side(k, lead(k / STEPS));
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // turrets
  if (S.weapons.turret >= 1) {
    const st = WEAPONS.turret.stats(S.weapons.turret);
    for (let i = 0; i < st.n; i++) {
      const a = S.time * 0.5 + (i * TAU) / st.n;
      const tx = G.cx + Math.cos(a) * 46;
      const ty = G.cy + Math.sin(a) * 46;
      // a lit box: top-left face bright, bottom-right in shadow (LIGHT_A)
      const g = ctx.createLinearGradient(tx - 4, ty - 4, tx + 4, ty + 4);
      g.addColorStop(0, shade('#ffd24d', 0.55));
      g.addColorStop(0.55, '#ffd24d');
      g.addColorStop(1, shade('#ffd24d', -0.45));
      ctx.fillStyle = g;
      ctx.fillRect(tx - 4, ty - 4, 8, 8);
      ctx.fillStyle = 'rgba(255, 250, 224, 0.75)';
      ctx.fillRect(tx - 4, ty - 4, 8, 1.4);   // the lit top edge
    }
  }

  drawEnemies(G);
  drawTower(G);
  drawTeslaCharge(G); // above the tower: the crackle lives on the core dot
  drawSwipeTrails(G);
  drawBossBar(G);
  drawHeat(G);
}

// crackling build-up around the Point's core dot; state-driven (app.md)
function drawTeslaCharge(G) {
  const { ctx, S } = G;
  const charge = G.wt.teslaCharge || 0;
  if (S.weapons.tesla < 1 || charge < 0.05) return;
  // the core dot glows with the charge
  ctx.fillStyle = `rgba(190, 230, 255, ${0.5 * charge})`;
  ctx.beginPath(); ctx.arc(G.cx, G.cy, 3.5 + 3.5 * charge, 0, TAU); ctx.fill();
  // mini-arcs crackling around the dot, inside the hull's dark inner disc
  const n = Math.round(charge * 5);
  ctx.strokeStyle = `rgba(190, 230, 255, ${0.35 + 0.55 * charge})`;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const r0 = 4.5, r1 = r0 + 2 + 7 * charge * Math.random();
    const rm = (r0 + r1) / 2;
    ctx.beginPath();
    ctx.moveTo(G.cx + Math.cos(a) * r0, G.cy + Math.sin(a) * r0);
    ctx.quadraticCurveTo(
      G.cx + Math.cos(a) * rm + (Math.random() - 0.5) * 5,
      G.cy + Math.sin(a) * rm + (Math.random() - 0.5) * 5,
      G.cx + Math.cos(a) * r1, G.cy + Math.sin(a) * r1);
    ctx.stroke();
  }
}

function drawAim(G) {
  const { ctx, S } = G;
  if (!G.aim || S.weapons.bolt < 1) return;
  // single line: the aimed bolt is always exactly one bolt on it (app.md Aim feedback)
  const a = Math.atan2(G.aim.y - G.cy, G.aim.x - G.cx);
  ctx.setLineDash([3, 7]);
  ctx.strokeStyle = 'rgba(159, 243, 255, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(G.cx + Math.cos(a) * 36, G.cy + Math.sin(a) * 36);
  ctx.lineTo(G.cx + Math.cos(a) * 160, G.cy + Math.sin(a) * 160);
  ctx.stroke();
  ctx.setLineDash([]);
  // reticle: gold crosshair with dark casing — gold is the input register, cyan
  // is fire; must stay findable inside the beam glow (app.md Aim feedback)
  const rx = G.aim.x, ry = G.aim.y;
  for (const [w, c] of [[4, 'rgba(7, 10, 18, 0.85)'], [1.8, 'rgba(255, 210, 77, 0.95)']]) {
    ctx.lineWidth = w;
    ctx.strokeStyle = c;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      ctx.moveTo(rx + Math.cos(a) * 4.5, ry + Math.sin(a) * 4.5);
      ctx.lineTo(rx + Math.cos(a) * 10, ry + Math.sin(a) * 10);
    }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255, 210, 77, 0.95)';
  ctx.beginPath(); ctx.arc(rx, ry, 1.5, 0, TAU); ctx.fill();
  ctx.lineWidth = 1;
}

function drawEnemies(G) {
  const { ctx, S } = G;
  for (const e of S.enemies) {
    const pulse = Math.sin(S.time * 8 + e.rot * 3);

    const has = id => e.variants.includes(id);

    // Wireframe: enemies are outlines, never fills (app.md "fill encodes allegiance"),
    // and now they are NEON outlines — a saturated halo under a whitened core
    // (app.md "Light has a grammar"). The hue stays in the halo, so species colour
    // reads at least as strongly as it did from the old flat stroke.
    //
    // The hit pop and the swift under-glow are the two channels that used to call
    // ctx.shadowBlur PER ENEMY — the standing suspect for the wave-20 p95 step
    // (PINS [perf]), and a cost that scaled with how busy the fight was. Both are now
    // widenings of the halo this shape already draws: same read, no offscreen pass.
    // Pinned by test/render.test.mjs ("blur is a per-frame constant").
    const hit = e.flash > 0;
    const w = (2 + e.r * 0.05) * (hit ? 2.1 : 1);
    const path = () => poly(ctx, e.x, e.y, e.r, e.sides, e.rot);
    // swift stays WHITE-hot (VARIANTS.swift.color) — its channel is whiteness, not
    // width, so it gets its own pale halo under the species tube rather than a
    // fatter hue halo, which would have read as "big" instead of "fast".
    if (has('swift')) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = w + 12;
      path(); ctx.stroke();
    }
    tube(ctx, path, hit ? '#ffffff' : e.color, w, {
      halo: hit ? 13 : 5,
      haloA: hit ? 0.34 : 0.17,
      core: hit ? 0 : 0.34,
    });

    // Outer channels claim successive annulus slots so a stack reads as distinct
    // concentric rings instead of one smudge (app.md "Stacked highlights").
    let slot = e.r + 4;
    if (has('armored')) {
      // plating reads by CONTRAST, not just presence: a mid-grey ring one step
      // outside a bright species hue was the faintest channel on the specimen
      // plate, and armored is the costliest modifier to misread (×2.5 hp).
      // A dark backing stroke separates it from the body colour underneath.
      ctx.strokeStyle = 'rgba(6, 9, 16, 0.9)';
      ctx.lineWidth = 6;
      poly(ctx, e.x, e.y, slot, e.sides, e.rot);
      ctx.stroke();
      ctx.strokeStyle = VARIANTS.armored.color;
      ctx.lineWidth = 3.5;
      poly(ctx, e.x, e.y, slot, e.sides, e.rot);
      ctx.stroke();
      slot += 5;
    }
    if (has('volatile')) {
      ctx.fillStyle = VARIANTS.volatile.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.35 + 0.12 * pulse), 0, TAU); ctx.fill();
    }
    if (has('regen')) {
      // pulsating green plus inside the shape (core.md variants, 2026-07-24);
      // own half-speed phase — a calm breath, not the shared hit-pulse jitter
      const slow = Math.sin(S.time * 4 + e.rot * 3);
      ctx.strokeStyle = VARIANTS.regen.color;
      ctx.lineWidth = 2.5;
      const pr = e.r * (0.42 + 0.1 * slow);
      ctx.beginPath();
      ctx.moveTo(e.x - pr, e.y); ctx.lineTo(e.x + pr, e.y);
      ctx.moveTo(e.x, e.y - pr); ctx.lineTo(e.x, e.y + pr);
      ctx.stroke();
    }
    if (has('shielded') && e.shield > 0) {
      ctx.strokeStyle = VARIANTS.shielded.color;
      ctx.lineWidth = 2.5;
      // arcs cap at 3 drawn segments: a boss carries 12 charges (ADR-0009) and
      // twelve overlapping arcs are a solid ring, not a shield read
      const arcs = Math.min(3, e.shield);
      for (let s = 0; s < arcs; s++) {
        const a0 = S.time * 1.6 + (s * TAU) / arcs;
        ctx.beginPath(); ctx.arc(e.x, e.y, slot + 2, a0, a0 + TAU / 4.2); ctx.stroke();
      }
      slot += 5;
    }

    // Siege telegraph (app.md "A besieger telegraphs its strike"): a shape holding
    // the rim grows a bright spur toward the Point through the last of its cadence,
    // and pops white on the strike itself. The wind-up is the load-bearing half —
    // a tell that arrives with the damage cannot be answered.
    // A GUARDED boss (core.md "Boss signature moves"): sunder's shards are up, or
    // bulwark is planted. Without a tell this reads as "my weapons stopped working"
    // — the player sees small numbers and blames the game, which is the same
    // failure the siege telegraph fixed. Channel: a solid gold double-ring that
    // breathes. Not grey (armored's plate), not blue arcs (shielded), not red
    // dashes (siege), not white (took damage) — the four already spoken for.
    if (e.guard != null && e.guard < 1) {
      const breathe = 0.55 + 0.45 * Math.sin(S.time * 6);
      ctx.strokeStyle = `rgba(255, 209, 102, ${0.45 + 0.4 * breathe})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 9, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 14, 0, TAU); ctx.stroke();
    }
    // An interruptible charge needs a VISIBLE meter, or "shooting it is doing
    // something" is invisible and the move is indistinguishable from the old
    // uninterruptible one (core.md). Two arcs on one ring: how full the charge is
    // (magenta, filling clockwise from the top) and how much resistance is left
    // (white, draining). Channel is free — nothing else draws a partial arc on an
    // enemy; the tower's hp arc is the only other one and it is at the centre.
    if (e.winding && e.windNeed > 0) {
      // A CLOCK DIAL FILLING INSIDE THE SHAPE (Daniel, 2026-07-26; app.md). The
      // timer belongs where the eye already is — on the thing about to hit you —
      // not on the perimeter, where it competed with the annulus channels that
      // variants use. Sweeps clockwise from twelve; damage pushes it back.
      //
      // This bends "enemies are outlines, never fills" (pillar 3) and the bend is
      // bounded so the law still means something: white at low alpha, never a
      // species hue, inset inside the stroke, and only ever during a ~3.3s wind-up.
      // It reads as an overlay on a shape, not as "this shape became friendly".
      // An earlier version drew it OUTSIDE in magenta — the boss's own colour —
      // and was invisible against the shape carrying it; caught on ?specimen=charge.
      const fill = clamp(1 - e.moveT / Math.max(0.001, e.windTell), 0, 1);
      if (fill > 0.001) {
        const rr = e.r * 0.78;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.16 + 0.22 * fill})`;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.arc(e.x, e.y, rr, -Math.PI / 2, -Math.PI / 2 + TAU * fill);
        ctx.closePath();
        ctx.fill();
        // a thin leading edge, so the dial reads as MOVING at a glance rather than
        // as a static wedge — the whole point is that it is a clock
        const a = -Math.PI / 2 + TAU * fill;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr);
        ctx.stroke();
      }
    }
    // Staggered: the charge was broken. A brief gold flicker-ring, distinct from
    // guard's steady breathing double-ring because this one is spinning and short.
    if (e.stun > 0) {
      const sp = S.time * 9;
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const a0 = sp + (i / 3) * TAU;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8, a0, a0 + 0.5); ctx.stroke();
      }
    }
    if (e.sieging || e.strike > 0) {
      // A ring that COLLAPSES onto the attacker as its strike nears, then pops.
      // Drawn around the shape, never toward the Point: an inward spur lands in
      // the busiest pixels on screen (tower glow, hp arc, the other besiegers)
      // and reads as noise. Red-orange and transient, so it cannot be confused
      // with armored's static grey plate or shielded's rotating blue arcs, nor
      // with the white hit-flash, which already means "this took damage".
      const wind = e.sieging ? clamp(1 - e.contactCd / 0.28, 0, 1) : 0;
      if (wind > 0.01 && e.strike <= 0) {
        ctx.strokeStyle = `rgba(255, 92, 108, ${0.25 + 0.6 * wind})`;
        ctx.lineWidth = 1 + 2 * wind;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 14 - 11 * wind, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (e.strike > 0) { // the attacker pops, not just the tower
        ctx.strokeStyle = `rgba(255, 210, 160, ${0.85 * e.strike})`;
        ctx.lineWidth = 2.5;
        poly(ctx, e.x, e.y, e.r + 2 + 7 * (1 - e.strike), e.sides, e.rot);
        ctx.stroke();
      }
    }

    // primed shapes carry a pulsing white diamond — marker, not ring (app.md)
    if (e.primed) {
      const p = 0.6 + 0.4 * Math.sin(S.time * 14);
      const s = 4 + 2 * p;
      const my = e.y - e.r - 10;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.5 * p})`;
      diamond(ctx, e.x, my, s * 0.6, s);
      ctx.fill();
    }

    // burning shapes flicker with small flame licks — the fire IS the damage
    // feedback (app.md wave B: burn numbers are suppressed)
    if (e.burnStacks > 0) {
      for (let i = 0; i < Math.min(4, e.burnStacks); i++) {
        const fa = S.time * (2.2 + i * 0.7) + i * 2.4;
        // on the rim, hot-yellow: the volatile core owns orange-in-the-middle, and
        // sharing that zone+hue made "medic-bomb or on fire?" a live misread (app.md)
        const lx = e.x + Math.cos(fa) * e.r * 0.95;
        const ly = e.y + Math.sin(fa) * e.r * 0.95;
        const hgt = 3 + 3 * ((Math.sin(S.time * (6 + i) + i * 1.7) + 1) / 2);
        flameLick(ctx, lx, ly, hgt * 1.8, `rgba(255, ${210 + i * 10}, 120, 0.75)`);
      }
    }

    // introduction highlight: a fading dashed ring around a first-ever sighting
    if (e.introduce > 0) {
      const a = Math.min(1, e.introduce / 1.5);
      ctx.strokeStyle = e.color;
      ctx.globalAlpha = a * (0.55 + 0.35 * Math.sin(S.time * 9));
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.arc(e.x, e.y, slot + 5 + 2 * pulse, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // hp sliver for shapes that are beefy FOR THIS WAVE (core.md hpBarThreshold)
    if (e.hp < e.maxHp && (e.boss || e.maxHp > hpBarThreshold(S.wave))) {
      const w = e.r * 2;
      ctx.fillStyle = 'rgba(10, 13, 21, 0.7)';
      ctx.fillRect(e.x - e.r, e.y - e.r - 8, w, 3);
      litBar(ctx, e.x - e.r, e.y - e.r - 8, w * clamp(e.hp / e.maxHp, 0, 1), 3, e.color);
    }
  }
}

function drawTower(G) {
  const { ctx, S } = G;
  const color = TOWERS[S.towerId]?.color || '#4de8ff';
  const frac = clamp(S.hp / S.maxHp, 0, 1);
  // hp arc — the track recessed, the fill lit along its length
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.arc(G.cx, G.cy, TOWER_R + 8, 0, TAU); ctx.stroke();
  const hpc = frac > 0.5 ? color : frac > 0.25 ? '#ffb84d' : '#ff5c6c';
  ctx.strokeStyle = hpc;
  ctx.beginPath(); ctx.arc(G.cx, G.cy, TOWER_R + 8, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
  ctx.strokeStyle = alpha(shade(hpc, 0.8), 0.6);   // the shine along the ring
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(G.cx, G.cy, TOWER_R + 6.6, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();

  // The Point is a LIT object, not an emissive one (app.md "Light has a grammar"):
  // it is the one solid thing you stare at for a whole run, and a flat disc was
  // reading as a sticker. Gradient body lit from LIGHT_A, rim crescent where the
  // hull turns into the light, and the core well cut into it with a dark inner
  // wall plus a bounce highlight on the FAR side — which is how a recess catches
  // light, and is what sells it as a hole rather than a dark dot.
  const pulse = 1 + 0.04 * Math.sin(S.time * 3);
  const r = (TOWER_R - 4) * pulse;
  glow(ctx, color, 22); // the tower's own glow — the ONLY shadowBlur left in the
                        // renderer, and still routed through the ?noblur hatch so
                        // the A/B isolates cleanly (PINS [perf])
  // Shading modulates the hull; it must never DIM it. The first cut ran the
  // gradient's base stop at the halfway mark with a 50% sink, which made the outer
  // half of the disc mostly shadow — measured against the old flat fill in a
  // magnified A/B, the Point came out visibly darker than before. Shading a thing
  // you are defending must not make it harder to see: the base colour now holds out
  // to 0.72 and the far edge only falls ~22%.
  litDisc(ctx, G.cx, G.cy, r, color);
  ctx.shadowBlur = 0;
  rimLight(ctx, G.cx, G.cy, r - 1.2, color, 0.9, 2.6);

  const ir = (TOWER_R - 11) * pulse;
  ctx.fillStyle = '#0a0d15';
  ctx.beginPath(); ctx.arc(G.cx, G.cy, ir, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';    // the near wall of the well, in shadow
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(G.cx, G.cy, ir, LIGHT_A - 1.4, LIGHT_A + 1.4); ctx.stroke();
  ctx.strokeStyle = alpha(color, 0.5);       // light bouncing off the far wall
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(G.cx, G.cy, ir - 0.8, LIGHT_A + Math.PI - 1.1, LIGHT_A + Math.PI + 1.1); ctx.stroke();

  litDisc(ctx, G.cx, G.cy, 3.5, shade(color, 0.4), { lift: 0.7, sink: 0.2 });
}

function drawSwipeTrails(G) {
  const { ctx } = G;
  if (!G.traces) return;
  for (const tr of G.traces.values()) {
    if (tr.holdEngaged || tr.pathLen < 12) continue;
    const pts = tr.points;
    ctx.strokeStyle = 'rgba(77, 232, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = Math.max(0, pts.length - 14); i < pts.length; i++) {
      i === 0 || i === Math.max(0, pts.length - 14) ? ctx.moveTo(pts[i].x, pts[i].y) : ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
}

function drawBossBar(G) {
  const { ctx, S, W } = G;
  const boss = S.enemies.find(e => e.boss && !e.dead);
  if (!boss) return;
  const bw = Math.min(W * 0.6, 420);
  const x = (W - bw) / 2, y = 54;
  ctx.fillStyle = 'rgba(10, 13, 21, 0.75)';
  ctx.fillRect(x - 2, y - 2, bw + 4, 10);
  litBar(ctx, x, y, bw * clamp(boss.hp / boss.maxHp, 0, 1), 6, '#ff3df0');
}

// Beam heat gauge (app.md): the overheat lockout must be legible — bar with a
// re-arm notch at BEAM_REARM, flashing OVERHEATED label while locked out.
function drawHeat(G) {
  const { ctx, S, W, H } = G;
  // the gauge serves whichever hot hold weapon is owned (app.md wave B note)
  if ((S.weapons.beam < 1 && S.weapons.flame < 1) || (S.heat <= 0.01 && !S.overheated)) return;
  const bw = 170, bh = 8;
  const x = (W - bw) / 2, y = H - 34;
  ctx.fillStyle = 'rgba(10, 13, 21, 0.65)';
  ctx.fillRect(x - 4, y - 4, bw + 8, bh + 8);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(x, y, bw, bh);
  const flash = S.overheated ? 0.55 + 0.45 * Math.sin(performance.now() / 90) : 1;
  ctx.globalAlpha = flash;
  litBar(ctx, x, y, bw * S.heat, bh, S.overheated ? '#ff5c6c' : '#ffb84d');
  ctx.globalAlpha = 1;
  // re-arm notch: the beam comes back when the fill drains past this line
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillRect(x + bw * BEAM_REARM - 1, y - 2, 2, bh + 4);
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = S.overheated ? '#ff7c88' : 'rgba(255, 210, 130, 0.8)';
  ctx.fillText(S.overheated ? 'OVERHEATED' : 'HEAT', W / 2, y - 9);
  ctx.textAlign = 'left';
}

// mini wireframe specimen for banners: shape + the full variant highlight
// grammar at r≈9, stacks included (core.md Introductions — the regime banner
// teaches the actual stack it is announcing). Same annulus rule as the field.
function drawMiniSpecimen(ctx, x, y, icon) {
  const r = 9;
  const ids = icon.variants || (icon.variant ? [icon.variant] : []);
  const has = id => ids.includes(id);
  // same emissive grammar as the field, or the banner teaches the wrong shape
  const path = () => poly(ctx, x, y, r, icon.sides, -Math.PI / 2);
  if (has('swift')) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 9;
    path(); ctx.stroke();
  }
  tube(ctx, path, icon.color, 1.8, { halo: 4, haloA: 0.2, core: 0.34 });
  let slot = r + 3;
  if (has('armored')) {
    ctx.strokeStyle = 'rgba(6, 9, 16, 0.9)'; ctx.lineWidth = 3.6;
    poly(ctx, x, y, slot, icon.sides, -Math.PI / 2); ctx.stroke();
    ctx.strokeStyle = VARIANTS.armored.color; ctx.lineWidth = 2.2;
    poly(ctx, x, y, slot, icon.sides, -Math.PI / 2); ctx.stroke();
    slot += 3.5;
  }
  if (has('volatile')) {
    ctx.fillStyle = VARIANTS.volatile.color;
    ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, TAU); ctx.fill();
  }
  if (has('regen')) {
    ctx.strokeStyle = VARIANTS.regen.color; ctx.lineWidth = 1.8;
    const pr = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - pr, y); ctx.lineTo(x + pr, y);
    ctx.moveTo(x, y - pr); ctx.lineTo(x, y + pr);
    ctx.stroke();
  }
  if (has('shielded')) {
    ctx.strokeStyle = VARIANTS.shielded.color; ctx.lineWidth = 1.6;
    for (let sg = 0; sg < 3; sg++) {
      const a0 = 0.4 + (sg * TAU) / 3;
      ctx.beginPath(); ctx.arc(x, y, slot + 0.5, a0, a0 + TAU / 4.2); ctx.stroke();
    }
  }
}

function drawFx(G) {
  const { ctx, fx, W, H } = G;
  if (!fx) return;
  for (const p of fx.parts) {
    const a = clamp(1 - p.t / p.life, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  let bannerY = 84; // announcements stack down the top-left, under the HUD (app.md)
  for (const t of fx.texts) {
    const a = clamp(1 - t.t / t.life, 0, 1);
    ctx.globalAlpha = t.center ? Math.min(1, a * 1.6) : a;
    if (t.center) {
      ctx.textAlign = 'left';
      ctx.font = `800 ${t.size}px system-ui, sans-serif`;
      ctx.fillStyle = t.color;
      const scale = 1 + 0.05 * Math.min(1, t.t * 6);
      ctx.save();
      ctx.translate(14, bannerY);
      bannerY += t.sub ? 48 : 30;
      ctx.scale(scale, scale);
      const tx = t.icon ? 32 : 0; // leave room for the specimen icon
      if (t.icon) drawMiniSpecimen(ctx, 12, t.sub ? 2 : -6, t.icon);
      ctx.fillText(t.str, tx, 0);
      if (t.sub) {
        ctx.font = `500 12px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(223, 231, 247, 0.8)';
        ctx.fillText(t.sub, tx + 1, 17);
      }
      ctx.restore();
    } else {
      ctx.textAlign = 'center';
      ctx.font = `700 ${t.size}px system-ui, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
  }
  ctx.globalAlpha = 1;
}
