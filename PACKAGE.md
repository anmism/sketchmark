# Package Map

This file is a quick package-level overview of the current Sketchmark ecosystem in this repo.

All official plugins here follow the same broad pattern:
- they add a small domain-specific DSL surface
- they compile down to ordinary Sketchmark groups, nodes, edges, paths, and text
- they avoid adding heavy renderer-specific logic to the core bundle when possible

## Summary Table

| Library | DSL / nodes it adds | Supports now | Missing / current limits |
| --- | --- | --- | --- |
| `sketchmark` | Core shapes and blocks: `box`, `circle`, `diamond`, `hexagon`, `triangle`, `cylinder`, `parallelogram`, `text`, `image`, `icon`, `note`, `line`, `path`, `group`, `bare`, `table`, charts, markdown, edges, `step ...` | Core diagram DSL, row/column/grid/absolute layout, themes/styles, SVG/Canvas rendering, step-based animation, tables, charts, markdown, anchor metadata, plugin API | No domain-specific solving, no rich math typesetting, no chemistry/circuit validation, no live connected-edge rerouting during move animations |
| `@sketchmark/plugin-notation` | No new node types. Text transform plugin for labels, titles, table/chart text, and `step narrate` | Lightweight TeX-style math, `$...$`, `\\(...\\)`, common Greek/operator commands, `^`, `_`, `\\frac`, `\\sqrt` | Not full LaTeX, no stacked fractions, no matrices/cases/align, no KaTeX/MathJax-grade typesetting |
| `@sketchmark/plugin-anchors` | No new nodes. Edge endpoint syntax like `a@right --> b@left` | Named edge anchors: `top`, `right`, `bottom`, `left`, `center`, corners; cleaner readable edge syntax | Rewrites edge lines only, not `step` targets; no custom anchors, no percentage anchors, no smart path routing by itself |
| `@sketchmark/plugin-annotations` | `annot.angle`, `annot.right-angle`, `annot.equal`, `annot.midpoint`, `annot.dimension` | Geometry-style helper marks, helper labels, `invert=true`, `label-dx`, `label-dy`, angle `mode=interior|reflex` | Best for absolute geometry diagrams; no braces/callouts/general-purpose annotation set yet; no smart collision avoidance; no exterior/straight angle mode in current repo state |
| `@sketchmark/plugin-geometry` | `geo.point`, `geo.segment`, `geo.ray`, `geo.line`, `geo.circle`, `geo.polygon`, `geo.triangle` | Draw-first geometry authoring, textbook-style figures, helper labels, auto `layout absolute` when layout is omitted | Draw only, not solving; no constraints, intersections, theorem proving, symbolic geometry, or automatic construction logic; current `v1` is root-level oriented |
| `@sketchmark/plugin-wireframe` | `wf.screen`, `wf.panel`, `wf.text`, `wf.media`, `wf.control`, `wf.divider` | Primitive-first UI wireframes, browser/phone screens, panels, media blocks, text placeholders, generic controls, compact checkbox/radio rows | No rich compounds like navbar/form/table/card presets yet; not a production UI system; not responsive behavior or design-system-aware |
| `@sketchmark/plugin-circuit` | `ckt.comp`, `ckt.port`, `ckt.junction`, `ckt.wire` | Draw-focused circuit notation, pin refs like `r1.left`, absolute-layout schematic authoring, basic label offsets on labels | No validation, simulation, netlist generation, circuit solving, or automatic layout; `value` placement is still less flexible than `label` placement |
| `@sketchmark/plugin-chem-molecule` | `chem.atom`, `chem.bond`, `chem.ring`, `chem.label` | Draw-focused molecule diagrams, atoms/bonds/rings, simple aromatic rings, ring refs like `ring1.v1` and `ring1.center` | No valence validation, no stereochemistry system, no automatic molecule layout, no reaction authoring/solving, no chemistry rules engine |

## Practical Reading Of The Current Design

| Type | Packages |
| --- | --- |
| Core | `sketchmark` |
| Capability plugins | `@sketchmark/plugin-notation`, `@sketchmark/plugin-anchors`, `@sketchmark/plugin-annotations` |
| Domain plugins | `@sketchmark/plugin-geometry`, `@sketchmark/plugin-wireframe`, `@sketchmark/plugin-circuit`, `@sketchmark/plugin-chem-molecule` |

## Likely Long-Term Consolidation

These are reasonable future directions based on the current package boundaries:

- `@sketchmark/plugin-anchors` could eventually become a core feature, because named connection points are broadly useful across ordinary diagrams.
- `@sketchmark/plugin-annotations` could eventually merge into `@sketchmark/plugin-geometry`, because its current mental model is strongly geometry-oriented.
- `@sketchmark/plugin-notation` is still a good separate package because it changes text authoring rather than shape semantics.
- `@sketchmark/plugin-circuit`, `@sketchmark/plugin-chem-molecule`, and `@sketchmark/plugin-wireframe` are clearer as separate domain packages.

## Rule Of Thumb

- Use `sketchmark` alone when normal diagram shapes and animation are enough.
- Use a plugin when the domain has repeated vocabulary that is nicer than hand-authoring raw `box` / `path` / `text`.
- If a package needs solving, validation, or automatic reasoning, that is usually a sign it should stay out of core.
