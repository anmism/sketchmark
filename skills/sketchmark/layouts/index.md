# Layout References

Use these files when the user asks for better layout quality, cleaner diagram composition, or a prompt that makes the model plan structure before writing DSL.

## Pick One Base Layout

- [sequence-pipeline.md](sequence-pipeline.md): ordered stages, workflows, request paths, handoffs
- [tiers-and-lanes.md](tiers-and-lanes.md): layered systems, swimlanes, responsibilities, stack diagrams
- [hub-and-spoke.md](hub-and-spoke.md): one central service, team, or platform with multiple satellites
- [grid-and-matrix.md](grid-and-matrix.md): peer sets, catalogs, comparison boards, small multiples
- [compare-and-fork.md](compare-and-fork.md): before and after, option A vs option B, split decision paths
- [cycle-and-loop.md](cycle-and-loop.md): recurring processes, feedback systems, closed loops
- [absolute-canvas.md](absolute-canvas.md): spatial diagrams, maps, clustered canvases, plugin-heavy scenes

Choose one dominant archetype first. Add a secondary pattern only if the story clearly needs it.

## Primitive-First Method

1. Reduce the brief to structure:
   - What is the main story: sequence, layers, comparison, center-plus-satellites, loop, or spatial map?
   - How many primary items must be visible at once?
   - Does order matter, or just grouping?
2. Choose the root layout:
   - `row`, `column`, or `grid` for most diagrams
   - `absolute` only for spatial meaning, radial placement, or plugin requirements
3. Build the skeleton with `group` and `bare`.
4. Fill the skeleton with leaf primitives:
   - `box`, `circle`, `diamond`, `cylinder`, `parallelogram`, `text`, `note`, `line`, `path`, `icon`, `image`
5. Add edges after the containers and nodes already read clearly.
6. Fix crowding with `gap`, `padding`, `columns`, grouping, or label offsets before changing the whole layout mode.

## Prompt Template

```text
Plan the Sketchmark diagram before writing DSL.

Choose exactly one base layout archetype from:
- sequence-pipeline
- tiers-lanes
- hub-spoke
- grid-matrix
- compare-fork
- cycle-loop
- absolute-canvas

Work in this order:
1. Summarize the diagram story in one sentence.
2. Name the chosen layout archetype and why it fits.
3. Describe the root `diagram layout` and the `group` or `bare` skeleton.
4. List the leaf primitives to use for each role.
5. Mention any likely spacing or label-offset fixes.
6. Output final Sketchmark DSL using core primitives and groups, not compound plugin commands, unless an official plugin is clearly required.
```

## Repair Order

- If the diagram is too flat, add grouping before adding decoration.
- If the diagram is too wide, stack sections vertically before shrinking every node.
- If labels collide, try `gap`, `padding`, `label-dx`, or `label-dy` before switching to `absolute`.
- If the diagram mixes too many stories, split it into one dominant archetype plus a small supporting group.
- If a plugin command would hide the structure, stay with primitives unless the plugin is the actual subject of the diagram.
