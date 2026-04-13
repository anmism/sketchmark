# @sketchmark/plugin-annotations

Lightweight textbook-style marks for Sketchmark.

This first version focuses on geometry-friendly annotations that compile into ordinary Sketchmark nodes after parsing. It complements `@sketchmark/plugin-geometry` without adding new renderer logic to the core bundle.

## Install

```bash
npm install sketchmark @sketchmark/plugin-annotations
```

## Usage

```ts
import { render } from "sketchmark";
import { annotations } from "@sketchmark/plugin-annotations";
import { geometry } from "@sketchmark/plugin-geometry";

render({
  container: document.getElementById("diagram")!,
  dsl: `
diagram
geo.point A x=90 y=220
geo.point B x=290 y=220
geo.point C x=190 y=90

geo.triangle tri points=[A,B,C]
annot.dimension base from=A to=B label="6 cm"
annot.equal eq1 from=A to=C count=1
annot.equal eq2 from=B to=C count=1
annot.angle ang a=A b=C c=B mode=interior label="theta"
annot.angle ref a=A b=C c=B mode=reflex label="360-theta" radius=60
end
`.trim(),
  plugins: [annotations(), geometry()],
});
```

## Supported Commands

- `annot.angle <id> a=<pointId> b=<pointId> c=<pointId> [mode=interior|reflex] [label="..."] [radius=<n>] [label-distance=<n>] [label-dx=<n>] [label-dy=<n>] [invert=true]`
- `annot.right-angle <id> a=<pointId> b=<pointId> c=<pointId> [label="..."] [size=<n>] [label-dx=<n>] [label-dy=<n>] [invert=true]`
- `annot.equal <id> from=<pointId> to=<pointId> [count=<n>] [label="..."] [label-dx=<n>] [label-dy=<n>] [invert=true]`
- `annot.midpoint <id> from=<pointId> to=<pointId> [label="..."] [r=<n>]`
- `annot.dimension <id> from=<pointId> to=<pointId> [label="..."] [offset=<n>] [invert=true]`

## Notes

- `v1` is intended for absolute-positioned, geometry-style diagrams.
- Commands resolve point positions from already-authored nodes, so `diagram layout=absolute` is required.
- Annotation labels are emitted as helper `text` nodes.
- `annot.angle` defaults to `mode=interior`.
- `mode=reflex` draws the major arc between the two rays.
- Exterior angles are best expressed by explicit geometry such as `geo.ray` plus an authored helper point, then annotated as a normal angle.
- `invert=true` is the shared flip control for annotations.
- For legacy `annot.angle` interior behavior, `invert=true` keeps the mark on the same angle and flips between a looser and tighter bend.
- For `annot.right-angle`, `invert=true` keeps the square on the same corner and flips the label inward vs outward.
- For `annot.equal` and `annot.dimension`, `invert=true` flips the mark to the opposite side of the segment.
- For explicit angle modes, prefer `label-distance=<n>` when you want finer label placement control.
- `@sketchmark/plugin-notation` can still run afterward to transform annotation labels too.
