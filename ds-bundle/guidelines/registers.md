# Point Defense — visual register grammar

The game's look is rule-driven, not vibe-driven. Anything designed for this brand
(pages, menus, promo art, docs) should obey the same registers.

## The laws

1. **Dark neon arcade, single theme.** Everything sits on `--bg` (#0a0d15).
   There is no light mode. Panels are `--panel` with 1px `--panel-edge` borders
   and 8–14px radii. Glow is the highlight mechanism — `text-shadow`/`box-shadow`
   in the element's own color — used sparingly, on the few things that matter.

2. **Fill encodes allegiance.** Solid filled shapes belong to the player
   (tower, bullets, blades, mines). Threats are outline-only wireframes —
   an enemy is a stroke, never a fill. The one exception proves the rule: the
   volatile variant's filled core is exactly the part that explodes.

3. **Hue = species, highlight = variant.** Each enemy species owns a hue
   (`--enemy-*`). Modifiers never recolor the shape; they layer a highlight in
   the variant's color: glow (swift), second outline (armored), pulsing plus
   (regen), orbiting arcs (shielded), filled core (volatile).

4. **Player effects live in the cyan/white family** (`--accent`), separable
   from every enemy hue at a glance.

5. **The warm family is ordnance.** Mortar, meteor, fire, burning ground —
   `--accent-warm` and friends. Warm = area danger telegraphs and heat.

6. **Rings are reserved.** Expanding/standing circles belong to nova (bright
   solid expanding), frost aura (dim dashed standing) and intro telegraphs
   only. Other markers must use non-ring shapes (the primed marker is a
   diamond). Never add a new ring-shaped signal.

7. **Gold is the input register** (`--gold`): the reticle, and by extension
   the achievement/celebration accent (toasts). Input feedback must never
   share the cyan fire family — it has to stay findable inside player effects.

8. **Purple is currency.** Shards are always `--shard`, everywhere they appear.

9. **Signal hierarchy is sacred.** Ambience (grid sparks) < floor hazards
   (caltrops) < standing fields (frost, burning ground) < active fire < death
   bursts < boss/announcement moments. Decoration must stay below every
   gameplay signal; nothing ambient may read as a projectile.

## Type

System UI stack (`--font-ui`), generous letterspacing as a brand tell:
titles 0.14em ultra-bold with cyan glow, labels/chips 0.12em, body 0.05em.
Numbers are always `font-variant-numeric: tabular-nums`.

## Voice (for any copy)

Deadpan arcade wit. Short lines, dry lore: "Four right angles, zero right of
way." / "Six sides, all of them rude." Never exclamation-mark hype.
