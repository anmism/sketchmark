# Annotations Plugin

Source of truth: `packages/plugin-annotations/src/index.ts` and `packages/plugin-annotations/package.json`.

Use `@sketchmark/plugin-annotations` for geometry-style marks that sit on top of authored absolute-position nodes, geometry points, or graph points.

## Layout Rule

- Annotation commands require `diagram layout=absolute`
- Referenced targets need authored `x` and `y` coordinates

## Supported Commands

- `annot.angle <id> a=<ref> b=<ref> c=<ref> [mode=interior|reflex] [radius=<n>] [label="..."]`
- `annot.right-angle <id> a=<ref> b=<ref> c=<ref> [size=<n>] [label="..."]`
- `annot.equal <id> from=<ref> to=<ref> [count=<n>] [size=<n>] [spacing=<n>] [label="..."]`
- `annot.midpoint <id> from=<ref> to=<ref> [r=<n>] [label="..."]`
- `annot.dimension <id> from=<ref> to=<ref> [offset=<n>] [label="..."]`

## Best Uses

- Geometry classroom diagrams
- Graph callouts when used with `graph.point`
- Distances, congruent sides, angle emphasis, and midpoint markers

## Notes

- Great companion for `@sketchmark/plugin-geometry`
- Also works well with `@sketchmark/plugin-graph` because graph points compile to authored nodes
