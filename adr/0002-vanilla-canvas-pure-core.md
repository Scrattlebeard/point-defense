# ADR-0002: Vanilla Canvas 2D, pure core / impure shell, esbuild single-file dist

- **Date:** 2026-07-23
- **Status:** accepted

## Context

Overnight build of a touch-first tower-defense roguelite. Requirements: tap/swipe/hold
gesture input, geometric-shape rendering, localStorage meta-progression, properly
structured multi-file code, and a shippable build Daniel can open on a phone with zero
install. The box has node 22; no game framework installed.

## Decision

1. **No framework.** Canvas 2D + pointer events + DOM overlays for menus. Geometric
   neon shapes are exactly what Canvas 2D is good at; a framework buys nothing at this
   scope and costs a dependency and a build-time story.
2. **ES modules, split `src/core/` (pure) from `src/app/` (impure).** Core modules are
   DOM-free and deterministic — rng and time injected — so `node --test` exercises all
   decision logic without a browser. The shell owns canvas, DOM, audio, events, and the
   frame loop, and is verified by headless-Chromium smoke tests + play, not unit tests.
3. **esbuild bundling to single-file dist.** `scripts/build.mjs` bundles `src/app/main.js`
   (IIFE, minified) and inlines it plus the CSS into one HTML file. Two flavors:
   `dist/index.html` (full standalone document) and `dist/artifact.html` (body-content
   only, for Claude Artifact publishing where the platform adds the skeleton).
4. **Single-theme visual identity.** The game commits to a dark neon-arcade look by
   design; no light theme. (Menus inherit the same world.)

## Alternatives considered

- **Phaser/PixiJS:** capable, but heavyweight for shapes-and-glow; adds asset/build
  complexity that fights the zero-dependency, single-file goal. Rejected.
- **Single monolithic HTML file as the source of truth:** fastest to start, rejected
  explicitly by the owner — unreviewable, untestable, and the repo workflow (spec >
  test > code) has nowhere to attach.
- **file://-compatible plain scripts with a global namespace:** would allow running
  without a dev server, but gives up real imports and node-importability for tests.
  The dev server is one command; rejected.

## Consequences

- Tests cover the core only; rendering/input bugs are found by running the game
  (headless screenshot smoke test in the build pipeline mitigates).
- `dist/` artifacts are generated; they are committed only as release outputs, never
  edited by hand.
- Adding a runtime dependency later (fonts, sound assets) must preserve the
  single-self-contained-file property of `dist/` or revisit this ADR.
