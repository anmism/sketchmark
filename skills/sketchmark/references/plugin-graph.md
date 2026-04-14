# Graph Plugin

Source of truth: `packages/plugin-graph/README.md`.

Use `@sketchmark/plugin-graph` for coordinate-plane graphs and calculus-style teaching visuals.

## Layout Rule

- Graph commands are root-level in `v1`
- Use `diagram layout=absolute`
- If no layout is declared, the plugin can auto-insert `layout=absolute`

## Supported Commands

- `graph.axes <id> x=<n> y=<n> width=<n> height=<n> xmin=<n> xmax=<n> ymin=<n> ymax=<n> [grid=true] [ticks=true]`
- `graph.plot <id> axes=<axesId> expr="..." [from=<n>] [to=<n>] [samples=<n>] [label="..."]`
- `graph.point <id> axes=<axesId> at=[x,y] [label="..."] [r=<n>]`
- `graph.label <id> axes=<axesId> at=[x,y] text="..."` or `graph.label <id> target=<pointId> text="..."`
- `graph.line <id> axes=<axesId> from=[x1,y1] to=[x2,y2] [label="..."]`
- `graph.arrow <id> axes=<axesId> from=[x1,y1] to=[x2,y2] [label="..."]`
- `graph.region <id> axes=<axesId> points=[[x1,y1],[x2,y2],...] [label="..."]`
- `graph.tangent <id> axes=<axesId>|plot=<plotId> expr="..."|plot=<plotId> at=<n> [span=<n>] [label="..."]`
- `graph.area <id> axes=<axesId>|plot=<plotId> expr="..."|plot=<plotId> from=<n> to=<n> [baseline=<n>] [label="..."]`

## Notes

- Good for `sin(x)`, `cos(x)`, `x^2`, `sqrt(x)`, and `exp(x)` style expressions
- `graph.point` becomes a real authored node, so `annot.*` commands can target it
- Draw-first graphing, not symbolic solving
