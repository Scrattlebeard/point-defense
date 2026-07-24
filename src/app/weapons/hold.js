// The hold slot (ADR-0004): beam | flamethrower | meteor — one per run.
// wt.holdAim is the channel target (input.js); heat belongs to whichever hold
// weapon channels it (an unowned weapon must not bleed another's heat — see
// the "flamethrower overheats like the beam" test).
import { dist, distToSegment } from '../../core/geom.js';
import { damageEnemy } from '../enemies.js';
import { sfx } from '../audio.js';
import { lvl, stats, EDGE } from './shared.js';

// Overheat lockout releases at this heat level; the HUD gauge draws a notch here
// so the player can see when the beam comes back (core.md beam row).
export const BEAM_REARM = 0.35;

/** Per-frame: whichever hold weapon is owned channels (at most one — the slot). */
export function updateHold(G, dt) {
  updateBeam(G, dt);
  updateFlame(G, dt);
  updateMeteor(G, dt);
}

function updateBeam(G, dt) {
  const S = G.S;
  const wt = G.wt;
  const l = lvl(S, 'beam');
  if (l < 1) { G.beamEnd = null; return; }
  // at max level the beam is always-on, tracking the standing aim (core.md beam row)
  const st = stats(S, 'beam');
  const target = wt.holdAim || (st.alwaysOn ? G.aim : null);
  const beaming = target && !S.overheated;
  let inBeam = null;
  if (beaming) {
    const dx = target.x - G.cx, dy = target.y - G.cy;
    const len = Math.hypot(dx, dy);
    if (len > 4) {
      // clip the beam at the arena wall (app.md): it blooms there, not beyond
      const ux = dx / len, uy = dy / len;
      let t = 1600;
      if (ux > 0) t = Math.min(t, (G.W - EDGE - G.cx) / ux);
      else if (ux < 0) t = Math.min(t, (EDGE - G.cx) / ux);
      if (uy > 0) t = Math.min(t, (G.H - EDGE - G.cy) / uy);
      else if (uy < 0) t = Math.min(t, (EDGE - G.cy) / uy);
      const ex = G.cx + ux * t, ey = G.cy + uy * t;
      G.beamEnd = { x: ex, y: ey, width: st.width };
      inBeam = new Set();
      for (const e of S.enemies) {
        if (!e.dead && distToSegment(e.x, e.y, G.cx, G.cy, ex, ey) <= st.width / 2 + e.r) inBeam.add(e);
      }
      if (st.heatRate > 0) {
        S.heat = Math.min(1, S.heat + st.heatRate * dt);
        if (S.heat >= 1) S.overheated = true;
      }
    } else G.beamEnd = null;
  } else {
    G.beamEnd = null;
    S.heat = Math.max(0, S.heat - 0.45 * dt);
    if (S.overheated && S.heat < BEAM_REARM) S.overheated = false;
  }
  // discrete per-target ticks + exposure ramp (core.md beam row): a shield loses
  // one charge per TICK, never per frame; sustained tracking cooks the target.
  for (const e of S.enemies) {
    if (e.dead) continue;
    if (inBeam && inBeam.has(e)) {
      e.beamHeat = Math.min(1, e.beamHeat + dt / st.rampUp);
      e.beamTick -= dt;
      if (e.beamTick <= 0) {
        damageEnemy(G, e, st.dps * st.tick * (1 + (st.rampMax - 1) * e.beamHeat));
        e.beamTick += st.tick;
      }
    } else if (e.beamHeat > 0) {
      e.beamHeat = Math.max(0, e.beamHeat - dt / 1.5);
      e.beamTick = 0; // re-entry ticks immediately
    }
  }
}

// ---------- flamethrower (ADR-0004 wave B): cone + burn stacks + ground ----------
function updateFlame(G, dt) {
  const S = G.S;
  const wt = G.wt;
  const l = lvl(S, 'flame');
  const st = l >= 1 ? stats(S, 'flame') : null;
  const target = wt.holdAim || (st?.alwaysOn ? G.aim : null);
  const on = l >= 1 && target && !S.overheated;
  G.flameCone = null;
  if (on) {
    const dx = target.x - G.cx, dy = target.y - G.cy;
    const len = Math.hypot(dx, dy);
    if (len > 4) {
      const base = Math.atan2(dy, dx);
      G.flameCone = { a: base, range: st.range, arc: st.arc }; // render reads this
      if (st.heatRate > 0) {
        S.heat = Math.min(1, S.heat + st.heatRate * dt);
        if (S.heat >= 1) S.overheated = true;
      }
      // per-target cone ticks reuse the beam's tick fields (slot-exclusive, no clash)
      for (const e of S.enemies) {
        if (e.dead) continue;
        const d = dist(e.x, e.y, G.cx, G.cy);
        let da = Math.atan2(e.y - G.cy, e.x - G.cx) - base;
        da = Math.atan2(Math.sin(da), Math.cos(da)); // wrap to [-pi, pi]
        if (d <= st.range + e.r && Math.abs(da) <= st.arc) {
          e.beamTick -= dt;
          if (e.beamTick <= 0) {
            e.beamTick += st.tick;
            damageEnemy(G, e, st.direct, { silent: true });
            e.burnStacks = Math.min(st.maxStacks, e.burnStacks + 1);
            e.burnLeft = st.burnDur;
          }
        }
      }
      // burning ground drops in the cone's mid-far zone (app.md register)
      wt.flamePatchT -= dt;
      if (wt.flamePatchT <= 0 && S.fires.length < 40) {
        wt.flamePatchT += st.patchEvery;
        const fa = base + (Math.random() * 2 - 1) * st.arc * 0.8;
        const fr = st.range * (0.35 + Math.random() * 0.6);
        S.fires.push({
          x: G.cx + Math.cos(fa) * fr, y: G.cy + Math.sin(fa) * fr,
          r: st.patchR, dps: st.patchDps, life: st.patchLife, max: st.patchLife, tickT: 0.2,
        });
      }
    }
  } else if (l >= 1 && st.heatRate > 0) {
    S.heat = Math.max(0, S.heat - 0.45 * dt);
    if (S.overheated && S.heat < BEAM_REARM) S.overheated = false;
  }
  // burn DoT keeps cooking wherever the shape goes (core.md flame row)
  if (l >= 1) {
    for (const e of S.enemies) {
      if (e.dead || e.burnStacks <= 0) continue;
      e.burnLeft -= dt;
      e.burnTick -= dt;
      if (e.burnTick <= 0) {
        e.burnTick += 0.5;
        damageEnemy(G, e, st.burnDps * e.burnStacks * 0.5, { silent: true });
      }
      if (e.burnLeft <= 0) { e.burnStacks = 0; e.burnTick = 0; }
    }
  }
}

// ---------- meteor (ADR-0004 wave B): charge, release, auto-release ----------
function updateMeteor(G, dt) {
  const S = G.S;
  const wt = G.wt;
  if (lvl(S, 'meteor') < 1) return;
  wt.metCd = Math.max(0, wt.metCd - dt);
  const st = stats(S, 'meteor');
  if (wt.holdAim && wt.metCd <= 0) {
    wt.metCharge = Math.min(1, wt.metCharge + dt / st.chargeTime);
    if (wt.metCharge >= 1) releaseHold(G); // auto-release at max (core.md)
  }
}

/** Hold released (input seam or auto at full charge): the meteor drops. */
export function releaseHold(G) {
  const S = G.S;
  const wt = G.wt;
  if (lvl(S, 'meteor') < 1 || wt.metCharge <= 0 || !wt.holdAim) { wt.metCharge = 0; return; }
  const st = stats(S, 'meteor');
  const c = wt.metCharge;
  wt.metCharge = 0;
  wt.metCd = st.cd * S.cdMult;
  S.shells.push({
    kind: 'meteor',
    x0: G.cx, y0: G.cy, tx: wt.holdAim.x, ty: wt.holdAim.y,
    t: 0, flight: st.fall,
    dmg: st.dmg * (st.minDmgFrac + (1 - st.minDmgFrac) * c),
    blast: st.blast * (st.minBlastFrac + (1 - st.minBlastFrac) * c),
    knock: st.knock * (0.4 + 0.6 * c),
    scorch: { dps: st.scorchDps, life: st.scorchLife },
  });
  sfx('seek');
}
