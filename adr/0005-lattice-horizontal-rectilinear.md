# ADR-0005: Lattice presentation — horizontal, rectilinear

**Status:** Accepted (2026-07-24). Supersedes exactly one decision inside
ADR-0003 stage 1: the *radial* presentation of the Lattice. The Lattice itself —
sectors, rings-as-cost-tiers, web-not-tree, tap-to-inspect, all data and
purchase rules — stands unchanged.

## Context

Stage 1 shipped the Lattice as a radial SVG web: the Point at center, sector
wedges, ring guides. It was designed at 6 sectors × 57 nodes; ADR-0004's Armory
made it 7 × 70, and the wedges got crowded — staggered radii fighting label
collisions at the seams.

The repo now has a Claude Design project ("Point Defense"). Its
`templates/tech-tree` exploration made the presentation axes *live-switchable
props* — layout: radial / vertical / horizontal; edge style: curved / straight /
rectilinear — so all six combinations could be compared interactively on the
real chrome tokens. Daniel drove the comparison and picked **horizontal +
rectilinear**.

## Decision

- **Columns are rings.** The hub sits at the left; cost tiers advance
  left→right, one column per ring. The progression axis and the cost gradient
  are the same axis, legible at a glance — radial made you compare radii.
- **Sectors are horizontal bands**, top to bottom in the fixed sector order,
  each band's height computed from its most crowded (sector, ring) cell.
  Layout stays computed, never hand-placed (unchanged invariant from stage 1).
- **Edges are right-angle elbows.** Different-column edges run horizontal-first
  with their vertical segment in the gutter *between* columns — never through a
  column of nodes. Near-vertical edges (same column) run vertical-first.
  Any-mode cross-links stay dashed.
- Pan/pinch/zoom, node states, and the detail card carry over untouched.

## Why horizontal + rectilinear

- **One reading axis.** "How deep am I, what does the next tier cost" is a
  left→right scan. This is the question the screen exists to answer.
- **Rectilinear matches the fiction.** The game's visual register is geometry —
  polygons, grids, a rectilinear arena wall. Curved edges read organic; straight
  diagonals cross node fields. Right angles are the game's own grammar
  (a circuit board, which is also what a tech web *is*).
- **Bands scale where wedges didn't.** A band grows downward when a sector
  gains nodes; a wedge only gets denser. The 7th sector cost the radial layout
  its slack.

## Alternatives considered

- **Keep radial** — shipped and charming (the Point-at-center motif), but
  crowding at 7 × 70 and no natural room to grow.
- **Vertical** — portrait-phone friendly, but sector bands become narrow
  columns and long node names lose their baseline room.
- **Curved / straight edges** — rejected on register grounds above.

## Notes

The design template remains upstream in the design project and carries stage-2
concepts deliberately *not* adopted here: per-weapon tabbed trees, multi-rank
nodes, perk toggles, respec. Those are ADR-0003 stage 2/3 material — the
template is reference for that work, not spec.
