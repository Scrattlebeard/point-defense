# src/app — browser shell

Purpose: execute the core's decisions in a browser. Owns the frame loop, canvas
rendering, pointer events, DOM overlays, audio synthesis, and localStorage. Contains
no tuning numbers and no game rules — if a change here alters balance or behavior
rather than presentation/plumbing, it belongs in `src/core` instead.

Verified by headless-Firefox smoke screenshots (menu + autostarted gameplay, plus a
simulated-dpr-2 phone shot — recipes in README quickstart) and by play; not unit-tested.

## Modules

| File | Purpose |
|------|---------|
| `main.js` | Entry point: boot, mode state machine (`menu / play / levelup / pause / over`), rAF loop with clamped dt, visibility auto-pause. **Canvas sizing invariant:** game coordinates are CSS pixels (`G.W/G.H = innerWidth/innerHeight`); the backing store is `×dpr` (capped at 2) with a matching `ctx.setTransform`; and the canvas's *displayed* size must be pinned to the viewport in CSS (`#field { width/height: 100% }`) — a canvas is a replaced element, so `inset: 0` alone does NOT stretch it; `width: auto` resolves to the intrinsic (backing-store) size, which on dpr>1 screens showed only the upper-left `1/dpr²` of the field (2026-07-23, first phone run off the artifact wrapper). **Phone zoom (out):** when `min(innerWidth, innerHeight) < 600`, the world renders at `PHONE_ZOOM = 0.75×` — game coords become `innerWidth/zoom × innerHeight/zoom` (~33% *more* logical field on a phone), the ctx transform carries `dpr·zoom`, and input maps through automatically (it already scales by `G.W/rect.width`). The point: a bare phone viewport (~390×800 logical) was cramped — enemies spawned nearly inside the 280px combat radius with little reaction room; zooming out restores arena. Entities render smaller, which is cheap here because aiming is pointer-follow, not tap-the-enemy. *Recorded assumption:* phone logical field grows vs. the 2026-07-23 playtest baseline (longer travel distances, combat radius covers less of the field) — deliberate; tune `PHONE_ZOOM` via the balance-round-2 pin if it fights the difficulty curve. The breakpoint keys on min-dimension so rotating a phone never re-zooms mid-run. *(First shipped inverted — 1.3× in — 2026-07-23; the ask was arena, not magnification.)* Re-syncs on `resize` (covers orientation change and mobile URL-bar show/hide) |
| `meta.js` | Load/save/versioning of the persistent meta at `pointdefense.meta.v1`; storage failures degrade to in-memory |
| `game.js` | Per-frame simulation orchestration: wave director timing, spawning from the core's spawn plan, tower regen, wave-clear/game-over transitions |
| `enemies.js` | Enemy entity update: movement (slow/knockback), contact resolution, damage/death side-effects (splits, volatile explosions, shields), XP award |
| `weapons.js` | All weapon executors (manual + auto) + projectiles; reads levels/stats from core config, never defines them |
| `input.js` | Pointer events → traces → `core/gestures` classification → weapon triggers; swipe-trail capture; hold ownership. **All pointer coords map through the canvas bounding rect** (origin + scale corrected), never raw `clientX` — embedding pages (the Claude Artifact viewer) may offset or scale the canvas, which desynced the reticle from the host cursor (2026-07-23). The OS cursor is hidden over the field: the reticle is the cursor |
| `render.js` | Canvas drawing: field grid, entities (shape + variant highlight grammar), tower, beams/lightning/rings, HUD elements drawn on canvas (hp arc, boss bar) |
| `fx.js` | Particles, floating damage numbers, announcements, screen shake, hit flashes — capped pools, purely cosmetic. Announcements (wave / debut / boss name) anchor **top-left under the HUD**, linger **15s**, and debut/boss banners carry a **mini specimen icon** (the wireframe shape with its variant highlight) so the banner teaches what to look for (2026-07-23 playtest) |
| `audio.js` | WebAudio synth one-shots (fire, death, nova, levelup, hurt, gameover); lazy AudioContext on first gesture; mute persisted via meta |
| `ui.js` | DOM overlays: menu, tower select, tech tree (branch columns, node states: owned/available/locked), **bestiary** (discovered enemies/variants with wireframe icon canvases; "?" cards for the unmet), **records** (top-10 high scores + achievement grid, locked entries dimmed), level-up cards, pause, game-over payout (with high-score rank when placed), **achievement toasts** (DOM, bottom-center, queued — they must work over any overlay, including menus) |

## Shell-level behaviors (presentation truths)

- **Canvas** fullscreen, DPR-scaled; CSS-pixel coordinate space; `touch-action: none`,
  context-menu suppressed (long-press must not open menus on mobile).
- **The dark neon-arcade look is the single theme** (ADR-0002). Enemy species = hue,
  variant = highlight; player effects live in the cyan/white family to stay separable
  from enemy hues. **Fill encodes allegiance: solid = the player's (tower, bullets,
  blades), outline-only wireframe = threats.** Enemy shapes are strokes, never fills —
  the only filled element on an enemy is the volatile variant's core, which is exactly
  the part that explodes. (2026-07-23 playtest direction.)
- **Performance guards:** particle and damage-number pools are capped; enemy count is
  soft-capped (~240) by pausing the spawn queue, never by dropping queued spawns.
- **Aim feedback:** a single faint dashed aim line from the Point toward the aim
  point, plus a small reticle. One line because fans are center-true (core.md bolt
  row) — exactly one bolt flies the line you see; flank bolts are bonuses and the
  auto stream picks its own targets, so drawing their lines would be noise
  pretending to be information.
- **The play area is walled** (2026-07-23): player projectiles die against the
  viewport boundary with a force-field *flare* — a streak of light along the unseen
  wall — instead of silently vanishing; the beam clips at the boundary and blooms
  against it while channeling. **Bullets have no range cap — the wall IS the range**
  (a lifetime remains only as a far-out safety net; the old 1.3s life was a hidden
  ~700px cap that expired short of the border on diagonals). Deliberate gameplay consequence: player fire cannot
  reach shapes that haven't entered the arena yet. Enemies pass the wall freely —
  it's the Point's cage, not theirs.
- **Loadout visibility:** the pause screen is the run's *stats panel* (2026-07-23,
  second playtester: "need better in-game stats and upgrades view" — pause is the
  in-game home for it, one tap away and already sim-frozen): per-weapon rows with
  level pips (`●●●○○`, MAX styled) and a **live stat readout computed from the same
  `WEAPONS.stats` tables the sim uses** — never hand-written numbers that can drift —
  plus run modifiers (dmg/cd/crit/regen) and a run line (wave · kills · time · HP).
  The level-up screen keeps its compact one-line strip of the same, so picks are made
  in context without burying the three cards.
- **Beam heat gauge** (2026-07-23, second playtester: beam triggering "feels wonky" —
  the real culprit was an *illegible lockout*: overheat silently ignores the hold):
  bottom-center canvas bar, visible whenever the beam is owned and heat > 0 or
  overheated. Amber fill, a **notch at the 0.35 re-arm threshold** (core.md beam row)
  so the player can see exactly when the beam comes back, and while overheated the
  bar flashes red under an explicit `OVERHEATED` label. The lockout may cost a
  fight; it must never cost the player their mental model.
- **XP bar prominence** (2026-07-23, second playtester): the top-edge XP bar is
  thick enough to read mid-fight and glows brighter as it approaches full (CSS
  class toggled ≥85%) — the level-up is the run's heartbeat and its approach should
  be felt, not discovered.
- **Aura vs nova legibility:** frost aura = dim *dashed* standing circle; nova = bright
  *solid* expanding ring. They must never share a visual register (2026-07-23 playtest:
  a frost upgrade read as "nova got bigger").
- **Frost oomph** (2026-07-23, in lieu of a balance buff; reworked 2026-07-24 —
  playtest: the drifting motes + rim spikes read as motion and edge clutter): inside
  the aura, a field of **stationary** diamond ice crystals in varied sizes, each
  **twinkling** on its own phase and rate — a long dim rest, then a brief sharp glint
  (cubed sine envelope: a sparkle, not a glow). No drift, no rim crystals — the
  dashed circle alone marks the boundary. Positions are per-index hashes spread by
  golden angle with area-uniform radii, so density scales with aura radius (level)
  and the field re-lays itself smoothly as the aura grows. Stateless (derived from
  `S.time` + per-index hash, no particle arrays) and still *dim on average*: the
  legibility rule above outranks the juice; frost may glitter but never bloom like
  nova, and nothing inside the aura may appear to *move*.
- **Grid sparks** (2026-07-23): **menu-only by default** — the menu overlays a dead
  field, so ambience there is free; in battle extra motion reads as potential threat in
  a game where every moving thing is one (playtest verdict same day: "I like the
  effect" but confusing — the `&sparks` dev hatch re-enables them in-game). Menu mode
  runs them brighter (and the `#menu` overlay is slightly more transparent than the
  shared 0.88) so they survive the glass; gameplay values stay dim. The effect: faint
  lights crawl along the background grid lines —
  a handful at a time, each drifting one full lane slowly (~20–40s per crossing)
  with a short gradient tail and a gradual sin² fade-in/out envelope, lanes re-rolled
  per pass. Stateless (wall-clock derived, like
  the frost motes) and deliberately *ambient*: they keep crawling through pause and
  menus (they're the room, not the sim) and must stay below every gameplay signal —
  dimmer than frost, unreadable as projectiles.
- **Juice:** deaths burst in the enemy's color, tower hits shake + red vignette,
  level-ups pause the sim (cards are DOM, thumb-sized, stacked vertically on narrow
  screens). The beam is *loud*: layered glow (outer haze / mid sheath / white core)
  with visible surge modulation, fast forward-flowing dashes and a faint counter-flow —
  energy in motion, unmistakably on. The tesla coil *telegraphs* via an explicit
  charge state (`wt.teslaCharge` 0→1, maintained by the weapon update — never derived
  from cooldown fields that don't exist before the first shot): crackling mini-arcs
  build around the Point's **core dot** (inside the hull, drawn above the tower),
  visible from the moment the coil is owned and steady-full when charged with no
  target in range. Each discharge bursts at the tower and the first target with a
  small shake.
- **Failure honesty:** if localStorage is unavailable, the game plays with in-memory
  meta and the menu shows "progress won't persist" — never a silent wipe.
- **Reset progress:** menu carries a two-tap reset (arm → confirm within 4s) that
  restores `defaultMeta()` and saves. Deliberate wipes only; no accidental ones.
