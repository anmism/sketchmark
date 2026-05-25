# Sketchmark Kernel Plan

## Current Decision

Sketchmark is being reset to a pure 2D render kernel.

Kernel means the smallest renderable document format, not an AI-facing authoring language. AI and editor tools should eventually consume compounds such as flowcharts, locomotion, charts, callouts, and staged explainers. Those compounds must compile down to this kernel before validation or rendering.

## Canonical Kernel

Allowed top-level fields:

- `version`
- `canvas`
- `elements`

Allowed elements:

- `path`
- `text`
- `image`
- `point`
- `group`

Allowed animation:

- element-local `timeline`
- sparse `keyframes` as legacy `[time,value]` tuples or preferred `{ time, value, in, out, interpolation }` objects
- values: number, string, `[x,y]`
- interpolation `curve` as a normalized graph/cubic/hold primitive
- per-segment curve resolution from keyframe `out`/`interpolation`/`in` before track fallback
- synthetic `position` track for `x/y` elements

Allowed authoring adapters:

- visual keyframe states that compile to element-local timelines
- named ease presets that compile to explicit interpolation curves
- per-element/per-property timing offsets for state-based keyframe compilation
- edit helpers for selecting elements and safely changing properties/keyframes
- these adapters are APIs/scripts, not canonical JSON fields

Explicitly out of kernel for now:

- rect/circle/ellipse/line/arrow/arc/curve/polyline/polygon
- builders and compounds
- scenes, sequences, decks, projects, patch ops
- 3D and raw Three
- expression motion, path following, pose/moment systems

## Why This Tradeoff

The previous direction made the kernel carry too many authoring ideas. That made animation like walking collapse into dense pose math or expression trees, which is hard for AI to predict and hard to reuse for other bodies such as dogs or spiders.

The new direction keeps the kernel boring and stable. Reuse happens above it:

- a dog walk compound owns gait concepts
- a spider walk compound owns limb/contact rules
- a diagram compound owns boxes/arrows/layout
- a chart compound owns scales/data marks

Each compiler emits only paths, text, images, points, groups, and simple element timelines.

The first adapter is state-based keyframing: authors or AI describe what named elements look like at specific times, and the compiler emits the timeline tracks. This matches animation software better than asking AI to invent formulas, paths, or pose math directly. Named easing such as linear/ease-in/ease-out should live as helper presets that emit explicit kernel curves.

## Next Layer Later

After the kernel is stable, add a separate compound layer with clear compiler boundaries. That layer can introduce reusable semantic objects without polluting the render format.

A future `.project` layer can preserve editor/source truth such as rectangles, circles, charts, walks, locks, snapping, selections, and semantic compounds. It should compile to this kernel rather than expanding the kernel into a full editor project file.
