# Geometry Plugin

Source of truth: `packages/plugin-geometry/README.md`.

Use `@sketchmark/plugin-geometry` for textbook-style geometry diagrams.

## Layout Rule

- Geometry commands are root-level in `v1`
- Use `diagram layout=absolute`
- If no layout is declared, the plugin can auto-insert `layout=absolute`

## Supported Commands

- `geo.point <id> x=<n> y=<n> [label="..."] [r=<n>]`
- `geo.segment <id> from=<pointId> to=<pointId> [label="..."]`
- `geo.ray <id> from=<pointId> to=<pointId> [extend=<n>] [label="..."]`
- `geo.line <id> from=<pointId> to=<pointId> [extend=<n>] [label="..."]`
- `geo.circle <id> center=<pointId> r=<n> [label="..."]`
- `geo.arc <id> center=<pointId> r=<n> start=<deg> end=<deg> [close=none|chord|center] [label="..."]`
- `geo.ellipse <id> center=<pointId> rx=<n> ry=<n> [label="..."]`
- `geo.polygon <id> points=[A,B,C,...] [label="..."]`
- `geo.triangle <id> points=[A,B,C] [label="..."]`

## Notes

- `geo.ray` draws a single arrow tip at the extending end
- `geo.arc` uses degrees with `0` to the right and `90` upward
- Labels become helper `text` nodes near the geometry primitive

## Good Pairings

- Use with `@sketchmark/plugin-annotations` for angle arcs, right-angle marks, equal ticks, midpoint marks, and dimension lines
- Use with `@sketchmark/plugin-anchors` when edge attachment clarity matters
