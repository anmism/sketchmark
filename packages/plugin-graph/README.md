# @sketchmark/plugin-graph

Lightweight coordinate-plane graphing for Sketchmark.

This package keeps the core renderer small by compiling `graph.*` commands into ordinary Sketchmark `path`, `circle`, and `text` nodes. It focuses on plotting and teaching visuals, not symbolic math or CAS-style solving.

## Install

```bash
npm install sketchmark @sketchmark/plugin-graph
```

## Usage

```ts
import { render } from "sketchmark";
import { graph } from "@sketchmark/plugin-graph";
import { annotations } from "@sketchmark/plugin-annotations";

render({
  container: document.getElementById("diagram")!,
  dsl: `
diagram
title label="Sine Graph"

graph.axes plane x=80 y=60 width=520 height=280 xmin=-6.28 xmax=6.28 ymin=-1.5 ymax=1.5 grid=true xlabel="x" ylabel="y"
graph.plot sinCurve axes=plane expr="sin(x)" label="sin(x)"
graph.point O axes=plane at=[0,0] label="O"
graph.point P axes=plane at=[1.57,1] label="P"

annot.dimension rise from=O to=P label="rise"
end
`.trim(),
  plugins: [graph(), annotations()],
});
```

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

- Graph commands are root-level in `v1`.
- The plugin auto-inserts `layout=absolute` on the `diagram` line if the root diagram does not declare a layout yet.
- If a diagram already declares a layout, it must be `layout=absolute`.
- `graph.point` compiles to a real authored node, so existing `annot.*` commands can target graph points directly.
- `graph.plot`, `graph.tangent`, and `graph.area` support lightweight expression strings like `sin(x)`, `cos(x)`, `x^2`, `sqrt(x)`, and `exp(x)`.
- This is draw-first graphing, not a full symbolic math system.

## Options

```ts
graph({
  autoAbsoluteLayout: true,
  axisStroke: "#2b190d",
  gridStroke: "#cbbba3",
  pointRadius: 4,
  samples: 96,
});
```
