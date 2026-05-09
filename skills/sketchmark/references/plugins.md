# Official Sketchmark Plugins

Use these plugins when domain-specific syntax is clearer than forcing everything through the core DSL.

## General Rule

- Prefer core Sketchmark nodes, groups, and animation when they are enough.
- Reach for a plugin when the user is working in a specialized notation and readability matters.
- Show both the package import and the `plugins: [...]` usage when giving JS or TS examples.

## Plugin Map

### `@sketchmark/diagram-notation`

- Purpose: lightweight TeX-style math to Unicode conversion for labels and `step narrate`
- Use when: the diagram contains math-heavy labels or narrated formulas
- Read next: [plugin-notation.md](plugin-notation.md)

```ts
import { render } from "@sketchmark/diagram";
import { notation } from '@sketchmark/diagram-notation';

render({
  container,
  dsl,
  plugins: [notation()],
});
```

### `@sketchmark/diagram-geometry`

- Purpose: compile `geo.*` commands into regular Sketchmark nodes
- Use when: authoring textbook-style geometry diagrams
- Read next: [plugin-geometry.md](plugin-geometry.md)

### `@sketchmark/diagram-anchors`

- Purpose: rewrite endpoint refs like `a@right --> b@left` into normal edges with anchor metadata
- Use when: edge attachment points need to be named explicitly
- Read next: [plugin-anchors.md](plugin-anchors.md)

### `@sketchmark/diagram-annotations`

- Purpose: geometry-style marks such as angle arcs, right-angle squares, equal ticks, midpoint marks, and dimension lines
- Use when: the diagram needs classroom-style geometry annotations
- Read next: [plugin-annotations.md](plugin-annotations.md)

### `@sketchmark/diagram-wireframe`

- Purpose: compile primitive UI mockup commands such as `wf.screen`, `wf.panel`, `wf.text`, `wf.media`, `wf.control`, and `wf.divider`
- Use when: sketching low-fidelity UI wireframes
- Read next: [plugin-wireframe.md](plugin-wireframe.md)

### `@sketchmark/diagram-circuit`

- Purpose: compile circuit notation such as `ckt.comp`, `ckt.port`, `ckt.junction`, and `ckt.wire`
- Use when: drawing circuit and electronics diagrams
- Read next: [plugin-circuit.md](plugin-circuit.md)

### `@sketchmark/diagram-molecule`

- Purpose: compile molecule diagrams such as `chem.atom`, `chem.bond`, `chem.ring`, and `chem.label`
- Use when: drawing lightweight chemistry structures
- Read next: [plugin-chem-molecule.md](plugin-chem-molecule.md)

### `@sketchmark/diagram-graph`

- Purpose: compile coordinate-plane graphing commands such as `graph.axes`, `graph.plot`, `graph.point`, `graph.line`, `graph.arrow`, `graph.region`, `graph.tangent`, and `graph.area`
- Use when: graphing functions, points, regions, or tangent visuals
- Read next: [plugin-graph.md](plugin-graph.md)

## Selection Heuristic

- Architecture, flowcharts, explainers: stay in core DSL unless anchors are needed.
- Math text: use `plugin-notation`.
- Geometry classroom diagrams: use `plugin-geometry`, optionally with `plugin-annotations` and `plugin-anchors`.
- UI mockups: use `plugin-wireframe`.
- Circuits: use `plugin-circuit`.
- Molecules: use `plugin-chem-molecule`.
- Coordinate graphs: use `plugin-graph`.
