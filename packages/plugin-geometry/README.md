# @sketchmark/plugin-geometry

Lightweight textbook-style geometry for Sketchmark.

This first version keeps the core renderer small by compiling `geo.*` commands into ordinary Sketchmark `circle`, `path`, and `text` nodes. It focuses on drawing and labeling, not solving.

## Install

```bash
npm install sketchmark @sketchmark/plugin-geometry
```

## Usage

```ts
import { render } from "sketchmark";
import { geometry } from "@sketchmark/plugin-geometry";

render({
  container: document.getElementById("diagram")!,
  dsl: `
diagram layout=absolute
title label="Triangle"
geo.point A x=90 y=220
geo.point B x=290 y=220
geo.point C x=190 y=90

geo.triangle tri points=[A,B,C]
geo.segment AB from=A to=B label="c"
geo.segment BC from=B to=C label="a"
geo.segment CA from=C to=A label="b"
end
`.trim(),
  plugins: [geometry()],
});
```

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

- Geometry commands are root-level in `v1`.
- The plugin auto-inserts `layout=absolute` on the `diagram` line if the root diagram does not declare a layout yet.
- If a diagram already declares a layout, it must be `layout=absolute`.
- `geo.ray` renders with a single arrow tip at the extending end.
- `geo.arc` uses degree-based angles with `0` pointing right and `90` pointing up.
- `geo.arc close=none` draws an open arc, `close=chord` closes it with a straight chord, and `close=center` draws a sector.
- Labels are emitted as helper `text` nodes positioned near the geometry primitive.

## Options

```ts
geometry({
  pointRadius: 4,
  pointLabelDx: 10,
  pointLabelDy: -12,
  lineExtend: 80,
  autoAbsoluteLayout: true,
});
```
