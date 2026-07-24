# design-sync notes — Point Defense

- **This is a style-layer-only sync** (2026-07-24). The repo is a canvas game with
  zero DOM components — there is nothing to bundle, so the converter pipeline does
  not apply. The upload layout in `ds-bundle/` is **hand-authored** (the skill's
  off-script path): tokens + chrome CSS + register guidelines + six preview cards.
- **Sources of truth** (re-derive from these when the game's style changes):
  - `styles.css` (repo root) → `ds-bundle/styles.css` chrome classes + `:root` tokens
  - `src/core/config.js` → enemy/variant/tower palettes in `ds-bundle/tokens/`
  - `src/app/app.md` "Shell-level behaviors" → `ds-bundle/guidelines/registers.md`
- **`_ds_sync.json` deliberately omitted** — no converter, no honest anchor; a
  future sync re-verifies everything, which is correct for a set this small.
- Preview verification: headless-Firefox screenshots, eyeballed. Two catches worth
  keeping: a square drawn vertex-up reads as the *mine diamond* register (rotate
  squares π/4), and long `.clvl` text wraps vertically in narrow flex cards.
- Project: "Point Defense", https://claude.ai/design/p/748badd5-66ca-467a-9dbc-655a71ef8703
