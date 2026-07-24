# assets/icons — weapon icon set

One SVG per weapon, named by its `WEAPONS` id in `src/core/config.js`
(`bolt.svg` … `cascade.svg`, 21 total). 48×48 viewBox, self-contained,
carrying their own glow filter.

**Provenance:** authored by the Claude Design agent in the "Point Defense"
design project (`templates/weapon-icons/WeaponIcons.dc.html`), retrieved
2026-07-24 — that template is the upstream; re-retrieve rather than hand-edit
here if the set gets revised. They follow the style layer's register grammar
(`ds-bundle/guidelines/registers.md`): solid cyan fill = player's, warm family
= ordnance/burn, frost's ring is dashed (standing aura register).

**Not yet wired into the game** — candidate consumers are the level-up cards,
pause stats panel and Lattice detail card (see PINS.md). Icon ids are the
seam: any consumer maps `weaponId → assets/icons/<id>.svg`.
