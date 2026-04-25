---
name: sketchmark
description: Create, edit, review, and explain Sketchmark diagrams written in the Sketchmark DSL. Use when an agent needs to turn ideas into plain-text diagrams, plan or improve diagram layout, fix Sketchmark syntax, add or adjust nodes, edges, groups, tables, charts, markdown blocks, animation steps, or choose and use official Sketchmark plugins such as notation, geometry, anchors, annotations, wireframe, circuit, chem-molecule, and graph.
---

# Sketchmark

Author valid, copy-pasteable Sketchmark DSL that matches the current public API and examples.

## Workflow

1. Identify whether the task is core Sketchmark DSL or plugin-specific Sketchmark DSL.
2. Choose a layout archetype before authoring nodes. Start from the layout references and express the structure with `group`, `bare`, and core shapes before considering compounds or plugins.
3. Sketch the layout skeleton first, then place leaf primitives inside it.
4. Write DSL with every line starting at column 0. Do not indent diagram lines.
5. Start diagrams with `diagram` and end them with `end`.
6. Keep IDs unique and reuse exact IDs in edges, groups, and animation targets.
7. Prefer core primitives first. Use an official plugin only when it clearly makes the diagram easier to author or easier to read.
8. If the task includes animation, prefer `SketchmarkEmbed` and remember that any `step draw` target starts hidden until its draw step runs.
9. If the task includes framework examples, make them minimal and valid for the target framework.
10. If the user needs to see the result, provide a minimal `SketchmarkEmbed` path, not just raw DSL.
11. Before saying a visual element is unsupported, check the core shapes and rich block types in `references/dsl-authoring.md`, then check `references/plugins.md`.

## Authoring Rules

- Always call `.trim()` on multiline JS or TS template literals that contain Sketchmark DSL.
- Keep example DSL left-aligned inside template literals. Leading whitespace breaks parsing.
- Use quoted strings for labels with spaces and for table row cell values.
- Treat `group` and `bare` as layout primitives. Use them to build the skeleton before adding edges or plugin commands.
- Prefer leaf primitives such as `box`, `circle`, `diamond`, `cylinder`, `parallelogram`, `text`, `note`, `icon`, `image`, `line`, and `path` over compound presets when the user is asking for a better layout.
- Use `x` and `y` only when the root diagram or parent group uses `layout=absolute`.
- Prefer `layout=row`, `layout=column`, or `layout=grid` first. Switch to `layout=absolute` only when spatial placement is part of the meaning or a plugin requires it.
- If a diagram feels crowded, adjust the layout archetype, group boundaries, `gap`, `padding`, `columns`, or node count before reaching for manual coordinates.
- Treat group `items=[...]` order as visual order.
- Use `label-dx` and `label-dy` explicitly for overlapping-label issues before changing the overall layout.
- For `step bracket`, provide two targets. For `step narrate`, provide a quoted string.
- Remember that core Sketchmark supports more than `box`, including `circle`, `diamond`, `hexagon`, `triangle`, `cylinder`, `parallelogram`, `text`, `image`, `icon`, `line`, `path`, `note`, `table`, `markdown`, and charts.
- Remember that the animation system also includes annotation-style actions such as `circle`, `underline`, `crossout`, `bracket`, `tick`, and `strikeoff`, not just `draw` and `highlight`.
- Prefer direct, readable examples over exhaustive demos unless the user explicitly wants a full showcase.

## Integration Rules

- If the user needs a viewable result, prefer `SketchmarkEmbed` as the single default rendering path.
- For animated examples, use `SketchmarkEmbed`. Do not default to manual `instance.anim` wiring unless the user explicitly asks for low-level API control.
- For React and Next.js client components, render only on the client into a real DOM node.
- For Next.js App Router examples, include `'use client'`.
- If you mention an official plugin, show the corresponding package import.
- If the user is new to Sketchmark, show one clear path to view the diagram: `SketchmarkEmbed`.

## Read On Demand

- Read [layouts/index.md](layouts/index.md) when the user asks for a better layout, cleaner composition, or a prompt that makes the model plan the layout before writing DSL.
- Read [layouts/sequence-pipeline.md](layouts/sequence-pipeline.md) for ordered flows, handoffs, and left-to-right process diagrams.
- Read [layouts/tiers-and-lanes.md](layouts/tiers-and-lanes.md) for layered systems, swimlanes, and stacked responsibility bands.
- Read [layouts/hub-and-spoke.md](layouts/hub-and-spoke.md) for a central platform, service, or actor with satellites around it.
- Read [layouts/grid-and-matrix.md](layouts/grid-and-matrix.md) for catalogs, comparisons, feature grids, and peer sets.
- Read [layouts/compare-and-fork.md](layouts/compare-and-fork.md) for before-and-after, two-track, and branching decision diagrams.
- Read [layouts/cycle-and-loop.md](layouts/cycle-and-loop.md) for recurring systems, feedback loops, and circular processes.
- Read [layouts/absolute-canvas.md](layouts/absolute-canvas.md) for freeform canvases, maps, cluster diagrams, and plugin-driven absolute scenes.
- Read [references/dsl-authoring.md](references/dsl-authoring.md) for compact syntax patterns and validation checks.
- Read [references/rendering.md](references/rendering.md) when the user needs to run or view the diagram.
- Read [references/plugins.md](references/plugins.md) when the task may be better expressed with an official plugin.
- After choosing a plugin, read the matching per-plugin reference such as `references/plugin-circuit.md` or `references/plugin-geometry.md` before claiming the plugin lacks support.

## Quality Bar

- Produce examples that can be pasted directly into docs or code with minimal cleanup.
- Keep examples consistent with the package name `sketchmark` and the official plugin package names.
- Default to a recognizable layout archetype instead of a generic scatter of nodes.
- Make the structure legible from the group skeleton alone, before the viewer reads labels.
- Call out any likely gotcha if the user is mixing animation, absolute layout, or framework rendering.
- Do not assume the agent has access to the repo README. Include any essential syntax or rendering detail directly in the answer when a first-time user would need it.
