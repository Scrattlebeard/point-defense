// All canvas drawing. Reads state, never changes it (except cheap cached paths).
// Visual grammar (app.md): enemy species = hue, variant = highlight; player
// effects stay cyan/white; single dark neon theme.
import { TOWERS, WEAPONS, VARIANTS } from '../core/config.js';
import { TAU, clamp } from '../core/geom.js';

const TOWER_R = 24;

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

function drawGrid(G) {
  const { ctx, W, H } = G;
  ctx.strokeStyle = 'rgba(110, 150, 230, 0.055)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 44) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 44) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // grid sparks (app.md): stateless ambient lights crawling the lanes.
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
    const a = 0.3 * Math.sin(Math.PI * p) ** 2; // gradual fade in/out across the run
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

    // frost oomph (app.md): stateless ice motes drifting inward + rim crystals.
    // Everything derives from S.time — no particle state, dim by decree.
    const t = S.time;
    const motes = Math.round(G.aura.r / 18); // density scales with aura level
    for (let i = 0; i < motes; i++) {
      const seed = i * 2.399963; // golden angle: even angular spread
      const cycle = 7 + (i % 5); // seconds per inward drift
      const p = ((t / cycle) + i * 0.618) % 1;
      const rr = G.aura.r * (1 - 0.85 * p) - 6;
      if (rr < 22) continue;
      const a = seed + t * 0.05 * (i % 2 ? 1 : -1);
      const mx = G.cx + Math.cos(a) * rr, my = G.cy + Math.sin(a) * rr;
      const size = 2 + (i % 3);
      const glint = 0.14 + 0.12 * Math.sin(t * 2.1 + i * 1.7) + 0.14 * (1 - p);
      ctx.fillStyle = `rgba(180, 232, 255, ${Math.max(0, glint)})`;
      ctx.beginPath();
      ctx.moveTo(mx, my - size); ctx.lineTo(mx + size * 0.6, my);
      ctx.lineTo(mx, my + size); ctx.lineTo(mx - size * 0.6, my);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(170, 228, 255, 0.32)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + t * 0.12;
      const c = Math.cos(a), s2 = Math.sin(a);
      const r0 = G.aura.r - 4, r1 = G.aura.r + 4 + 3 * Math.sin(t * 1.6 + i * 2.1);
      ctx.beginPath();
      ctx.moveTo(G.cx + c * r0, G.cy + s2 * r0);
      ctx.lineTo(G.cx + c * r1, G.cy + s2 * r1);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  // nova rings — bright and SOLID; frost stays dim and dashed (app.md legibility note)
  for (const ring of S.rings) {
    const a = clamp(1 - ring.r / ring.max, 0, 1);
    ctx.strokeStyle = `rgba(159, 243, 255, ${0.65 * a + 0.2})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(G.cx, G.cy, ring.r, 0, TAU); ctx.stroke();
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

  // bullets & missiles
  for (const b of S.bullets) {
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
  }
  for (const m of S.missiles) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(Math.atan2(m.vy, m.vx));
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, 3.4); ctx.lineTo(-4, -3.4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // orbit blades
  if (S.weapons.orbit >= 1) {
    const st = WEAPONS.orbit.stats(S.weapons.orbit);
    for (let i = 0; i < st.n; i++) {
      const a = G.wt.orbA + (i * TAU) / st.n;
      const bx = G.cx + Math.cos(a) * st.radius;
      const by = G.cy + Math.sin(a) * st.radius;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = '#9ff3ff';
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // turrets
  if (S.weapons.turret >= 1) {
    const st = WEAPONS.turret.stats(S.weapons.turret);
    for (let i = 0; i < st.n; i++) {
      const a = S.time * 0.5 + (i * TAU) / st.n;
      const tx = G.cx + Math.cos(a) * 46;
      const ty = G.cy + Math.sin(a) * 46;
      ctx.fillStyle = '#ffd24d';
      ctx.fillRect(tx - 4, ty - 4, 8, 8);
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
  const st = WEAPONS.bolt.stats(S.weapons.bolt);
  const base = Math.atan2(G.aim.y - G.cy, G.aim.x - G.cx);
  ctx.setLineDash([3, 7]);
  ctx.strokeStyle = 'rgba(159, 243, 255, 0.3)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < st.count; i++) {
    const a = base + (i - (st.count - 1) / 2) * 0.11;
    ctx.beginPath();
    ctx.moveTo(G.cx + Math.cos(a) * 36, G.cy + Math.sin(a) * 36);
    ctx.lineTo(G.cx + Math.cos(a) * 160, G.cy + Math.sin(a) * 160);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // reticle at the aim point
  ctx.strokeStyle = 'rgba(159, 243, 255, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(G.aim.x, G.aim.y, 7, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(G.aim.x, G.aim.y, 1.2, 0, TAU); ctx.stroke();
}

function drawEnemies(G) {
  const { ctx, S } = G;
  for (const e of S.enemies) {
    const pulse = Math.sin(S.time * 8 + e.rot * 3);

    // variant under-glow
    if (e.variant === 'swift') {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 14;
    }

    // wireframe: enemies are outlines, never fills (app.md "fill encodes allegiance")
    ctx.lineWidth = 2 + e.r * 0.05;
    ctx.strokeStyle = e.flash > 0 ? '#ffffff' : e.color;
    poly(ctx, e.x, e.y, e.r, e.sides, e.rot);
    ctx.stroke();
    if (e.flash > 0) { ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; ctx.fill(); } // hit pop
    ctx.shadowBlur = 0;

    if (e.variant === 'armored') {
      ctx.strokeStyle = e.vdef.color;
      ctx.lineWidth = 3.5;
      poly(ctx, e.x, e.y, e.r + 4, e.sides, e.rot);
      ctx.stroke();
    }
    if (e.variant === 'volatile') {
      ctx.fillStyle = e.vdef.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.35 + 0.12 * pulse), 0, TAU); ctx.fill();
    }
    if (e.variant === 'regen') {
      ctx.strokeStyle = e.vdef.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4 + 2 * pulse, 0, TAU); ctx.stroke();
    }
    if (e.variant === 'shielded' && e.shield > 0) {
      ctx.strokeStyle = e.vdef.color;
      ctx.lineWidth = 2.5;
      for (let s = 0; s < e.shield; s++) {
        const a0 = S.time * 1.6 + (s * TAU) / 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, a0, a0 + TAU / 4.2); ctx.stroke();
      }
    }

    // introduction highlight: a fading dashed ring around a first-ever sighting
    if (e.introduce > 0) {
      const a = Math.min(1, e.introduce / 1.5);
      ctx.strokeStyle = e.color;
      ctx.globalAlpha = a * (0.55 + 0.35 * Math.sin(S.time * 9));
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 11 + 2 * pulse, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // hp sliver for beefy shapes
    if (e.hp < e.maxHp && (e.boss || e.maxHp > 40)) {
      const w = e.r * 2;
      ctx.fillStyle = 'rgba(10, 13, 21, 0.7)';
      ctx.fillRect(e.x - e.r, e.y - e.r - 8, w, 3);
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - e.r, e.y - e.r - 8, w * clamp(e.hp / e.maxHp, 0, 1), 3);
    }
  }
}

function drawTower(G) {
  const { ctx, S } = G;
  const color = TOWERS[S.towerId]?.color || '#4de8ff';
  const frac = clamp(S.hp / S.maxHp, 0, 1);
  // hp arc
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.arc(G.cx, G.cy, TOWER_R + 8, 0, TAU); ctx.stroke();
  ctx.strokeStyle = frac > 0.5 ? color : frac > 0.25 ? '#ffb84d' : '#ff5c6c';
  ctx.beginPath(); ctx.arc(G.cx, G.cy, TOWER_R + 8, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
  // body
  const pulse = 1 + 0.04 * Math.sin(S.time * 3);
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(G.cx, G.cy, (TOWER_R - 4) * pulse, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0a0d15';
  ctx.beginPath(); ctx.arc(G.cx, G.cy, (TOWER_R - 11) * pulse, 0, TAU); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(G.cx, G.cy, 3.5, 0, TAU); ctx.fill();
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
  ctx.fillStyle = '#ff3df0';
  ctx.fillRect(x, y, bw * clamp(boss.hp / boss.maxHp, 0, 1), 6);
}

function drawHeat(G) {
  const { ctx, S, W, H } = G;
  if (S.weapons.beam < 1 || S.heat <= 0.01) return;
  const bw = 120;
  const x = (W - bw) / 2, y = H - 26 - (window.visualViewport ? 0 : 0);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(x, y, bw, 5);
  ctx.fillStyle = S.overheated ? '#ff5c6c' : '#ffb84d';
  ctx.fillRect(x, y, bw * S.heat, 5);
}

// mini wireframe specimen for banners: shape + variant highlight grammar at r≈9
function drawMiniSpecimen(ctx, x, y, icon) {
  const r = 9;
  const v = icon.variant ? VARIANTS[icon.variant] : null;
  if (icon.variant === 'swift') { ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 8; }
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = icon.color;
  poly(ctx, x, y, r, icon.sides, -Math.PI / 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (!v) return;
  if (icon.variant === 'armored') {
    ctx.strokeStyle = v.color; ctx.lineWidth = 2.2;
    poly(ctx, x, y, r + 3, icon.sides, -Math.PI / 2); ctx.stroke();
  } else if (icon.variant === 'volatile') {
    ctx.fillStyle = v.color;
    ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, TAU); ctx.fill();
  } else if (icon.variant === 'regen') {
    ctx.strokeStyle = v.color; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, TAU); ctx.stroke();
  } else if (icon.variant === 'shielded') {
    ctx.strokeStyle = v.color; ctx.lineWidth = 1.6;
    for (let s = 0; s < 3; s++) {
      const a0 = 0.4 + (s * TAU) / 3;
      ctx.beginPath(); ctx.arc(x, y, r + 3.5, a0, a0 + TAU / 4.2); ctx.stroke();
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
