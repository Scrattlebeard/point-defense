# Point Defense — style layer

This is a **style-only design system**: tokens, chrome CSS and register rules for
the Point Defense game brand (a canvas tower-defense roguelite). There is **no
component bundle** — the game renders on canvas. Build your own markup and style
it with the vocabulary below. Read `guidelines/registers.md` before designing
anything; it holds the rules that make output feel like this game.

## Setup

Dark theme only. Put everything on `--bg`; never introduce a light surface.
All tokens live in `tokens/point-defense.css` (imported by `styles.css`).
Font: the `--font-ui` system stack — no webfonts.

## Styling idiom

CSS custom properties + a small set of real chrome classes. No utility
framework. The class vocabulary (all defined in `styles.css`):

- **Text:** `.title` (+ inner `.accent` span), `.tagline`, `.dim`, `.warn`,
  `.fallen`, `.shards`
- **Surfaces:** `.overlay` (glass), `.card` (with `.chead`/`.cname`/`.clvl`/
  `.cdesc`/`.newmark`), `.bcard` (bestiary card: `.bhead`/`.bname`/`.bstats`/
  `.blore`, `.unknown` state), `.toast`
- **Buttons:** bare `button` is styled; sizes `.big`/`.small`; intents
  `.primary`/`.danger`; layout `.btnrow`
- **Labels:** `.chip` with intent classes `AIM`/`TAP`/`SWIPE`/`HOLD` (cyan),
  `AUTO` (green), `PASSIVE` (dim)

Key tokens: `--bg --panel --panel-edge --ink --dim --accent --accent-warm
--danger --shard --gold --auto`, enemy hues `--enemy-grunt/dart/tank/splitter/
elite/boss`, variant colors `--variant-swift/armored/regen/shielded/volatile`,
towers `--tower-bastion/tempest/warden/lance`.

## Hard rules (see guidelines/registers.md for the full grammar)

- Solid fill = player's; threats are wireframe outlines.
- Player effects are cyan/white; warm colors mean ordnance/area danger.
- Gold = input/celebration; purple = currency; rings are reserved signals.
- Letterspacing is the type tell: 0.14em titles, 0.12em labels, tabular numbers.

## Example

```html
<div class="overlay">
  <div class="title">POINT <span class="accent">DEFENSE</span></div>
  <div class="tagline">The shapes are coming.</div>
  <div class="card">
    <div class="chead"><span class="chip HOLD">HOLD</span>
      <span class="cname">Flamethrower</span> <span class="clvl">Lv 2</span></div>
    <div class="cdesc">Heavy stacking burn. Leaves burning ground.</div>
  </div>
  <div class="btnrow">
    <button class="big primary">DEPLOY</button>
    <button class="big danger">RETREAT</button>
  </div>
</div>
```
