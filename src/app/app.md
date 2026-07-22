# src/app — browser shell

Purpose: execute the core's decisions in a browser. Owns the frame loop, canvas
rendering, pointer events, DOM overlays, audio synthesis, and localStorage. Contains
no tuning numbers and no game rules — if a change here alters balance or behavior
rather than presentation/plumbing, it belongs in `src/core` instead.

Verified by headless-Chromium smoke test (`npm run build` renders menu + autostarted
gameplay screenshots) and by play; not unit-tested.

## Modules

| File | Purpose |
|------|---------|
| `main.js` | Entry point: boot, mode state machine (`menu / play / levelup / pause / over`), rAF loop with clamped dt, visibility auto-pause |
| `meta.js` | Load/save/versioning of the persistent meta at `pointdefense.meta.v1`; storage failures degrade to in-memory |
| `game.js` | Per-frame simulation orchestration: wave director timing, spawning from the core's spawn plan, tower regen, wave-clear/game-over transitions |
| `enemies.js` | Enemy entity update: movement (slow/knockback), contact resolution, damage/death side-effects (splits, volatile explosions, shields), XP award |
| `weapons.js` | All weapon executors (manual + auto) + projectiles; reads levels/stats from core config, never defines them |
| `input.js` | Pointer events → traces → `core/gestures` classification → weapon triggers; swipe-trail capture; hold ownership |
| `render.js` | Canvas drawing: field grid, entities (shape + variant highlight grammar), tower, beams/lightning/rings, HUD elements drawn on canvas (hp arc, boss bar) |
| `fx.js` | Particles, floating damage numbers, wave announcements, screen shake, hit flashes — capped pools, purely cosmetic |
| `audio.js` | WebAudio synth one-shots (fire, death, nova, levelup, hurt, gameover); lazy AudioContext on first gesture; mute persisted via meta |
| `ui.js` | DOM overlays: menu, tower select, tech tree (branch columns, node states: owned/available/locked), level-up cards, pause, game-over payout |

## Shell-level behaviors (presentation truths)

- **Canvas** fullscreen, DPR-scaled; CSS-pixel coordinate space; `touch-action: none`,
  context-menu suppressed (long-press must not open menus on mobile).
- **The dark neon-arcade look is the single theme** (ADR-0002). Enemy species = hue,
  variant = highlight; player effects live in the cyan/white family to stay separable
  from enemy hues.
- **Performance guards:** particle and damage-number pools are capped; enemy count is
  soft-capped (~240) by pausing the spawn queue, never by dropping queued spawns.
- **Juice:** deaths burst in the enemy's color, tower hits shake + red vignette,
  level-ups pause the sim (cards are DOM, thumb-sized, stacked vertically on narrow
  screens).
- **Failure honesty:** if localStorage is unavailable, the game plays with in-memory
  meta and the menu shows "progress won't persist" — never a silent wipe.
