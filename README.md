# Sketchmark

Sketchmark is currently a **pure 2D render kernel**.

The canonical JSON contains only renderable atoms:

- `path`
- `text`
- `image`
- `point`
- `group`

Everything else, including rectangles, circles, arrows, diagrams, charts, scenes, decks, 3D, and walking cycles, belongs in a future compound layer that compiles down to this kernel.

Kernel reference docs:

- [Kernel Spec](./KERNEL_SPEC.md)
- [Animatable Property Matrix](./ANIMATABLE_MATRIX.md)
- [What Needs Improvement](./WHAT_NEEDS_IMPROVEMENT.md)

## Kernel Document

```json
{
  "version": 1,
  "canvas": {
    "width": 640,
    "height": 360,
    "background": "#f8fafc",
    "duration": 2,
    "fps": 30
  },
  "elements": [
    {
      "id": "line",
      "type": "path",
      "d": "M 80 240 C 180 80 320 280 520 120",
      "fill": "none",
      "stroke": "#111827",
      "strokeWidth": 5,
      "strokeCap": "round"
    },
    {
      "id": "title",
      "type": "text",
      "text": "Render kernel",
      "x": 320,
      "y": 70,
      "align": "center",
      "valign": "middle",
      "fontSize": 28,
      "weight": 800,
      "fill": "#0f172a"
    }
  ]
}
```

Only `version`, `canvas`, and `elements` are canonical top-level fields.

## Timeline

Animation is element-local. Tuple keyframes are still valid, but editor-facing tools should prefer object keyframes because curves live on the outgoing segment:

```json
{
  "id": "label",
  "type": "text",
  "text": "Move",
  "x": 40,
  "y": 80,
  "timeline": {
    "start": 0.5,
    "end": 2,
    "tracks": {
      "position": {
        "keyframes": [
          {
            "time": 0,
            "value": [40, 80],
            "out": {
              "type": "cubicBezier",
              "x1": 0.42,
              "y1": 0,
              "x2": 0.58,
              "y2": 1
            }
          },
          { "time": 1.5, "value": [260, 80] }
        ]
      },
      "opacity": {
        "keyframes": [[0, 0], [0.4, 1]]
      }
    }
  }
}
```

Track values may be numbers, strings, `[x,y]` points, same-length number arrays, string arrays, or JSON objects. Known kernel properties are type-checked more strictly than the broad schema shape. `position` maps to `x/y` for `path`, `point`, `text`, `image`, and `group`. Tracks can also define a fallback interpolation graph:

```json
{
  "keyframes": [[0, [0, 0]], [1, [100, 0]]],
  "curve": {
    "type": "graph",
    "points": [[0, 0], [0.35, 0.08], [0.65, 0.92], [1, 1]]
  }
}
```

The graph maps normalized time progress `x` to normalized value progress `y`. Kernel curves can be `graph`, `cubicBezier`, or `hold`. Segment resolution is: previous keyframe `out`, previous keyframe `interpolation`, next keyframe `in`, track `curve`, legacy `ease`, then linear. Named easing strings are still accepted as compatibility shorthands, but helpers/compounds should prefer emitting explicit curves. There are no expressions, path followers, pose drivers, scenes, or 3D in this kernel pass.

Current known animatable properties include transform/layout (`position`, `x`, `y`, `rotation`, `scale`, `scaleX`, `scaleY`, `origin`, `width`, `height`, `opacity`), path data/drawing/style (`d`, `fill`, `stroke`, `strokeWidth`, caps/joins, `dashArray`, `dashOffset`, `drawStart`, `drawEnd`), text content/layout (`text`, `lines`, `align`, `valign`, `fontStyle`, typography sizing), image `src`/`fit`/`source.*`, clip/mask paths and opacity, filter effects (`effects.*`), whole paint switching, structured gradient internals such as `fill.to` or `fill.stops.0.color`, and pattern internals such as `fill.x`, `fill.width`, or `fill.opacity`.

Unknown timeline tracks are invalid in the frozen kernel. Rounded images should be authored above the kernel and compiled to `clip.d`; `cornerRadius` and editor metadata are intentionally not kernel fields.

## Keyframe Authoring

For AI or editor-style authoring, use visual snapshots and compile them down to kernel timelines:

```ts
import { compileKeyframeStates, timelineCurvePreset } from "sketchmark";

const animated = compileKeyframeStates(document, [
  {
    time: 0,
    set: {
      card: { position: [80, 160], scale: 0.85, opacity: 0 }
    }
  },
  {
    time: 1,
    set: {
      card: {
        position: {
          value: [220, 120],
          curve: timelineCurvePreset("ease-out")
        },
        scale: 1,
        opacity: 1
      }
    }
  }
]);
```

This is an authoring adapter, not a new JSON schema feature. The compiled output is still only kernel elements with local timelines.

## CLI

Build first:

```bash
npm run build
```

Render:

```bash
node bin/sketchmark.cjs render examples/basic.visual.json out.svg
node bin/sketchmark.cjs render examples/timeline.visual.json out.html --time 1
node bin/sketchmark.cjs render examples/timeline.visual.json out.mp4
node bin/sketchmark.cjs render examples/timeline.visual.json out.webm --fps 30
```

Generate the key-pose walking example:

```bash
node examples/make-keypose-walk.cjs
node bin/sketchmark.cjs preview examples/keypose-walk.visual.json
```

Generate the key-pose cyclist example:

```bash
node examples/make-keypose-cycle.cjs
node bin/sketchmark.cjs preview examples/keypose-cycle.visual.json
```

Generate heavier real-world stress scenes:

```bash
node examples/make-stress-city-traffic.cjs
node examples/make-stress-ops-dashboard.cjs
node examples/make-stress-airport-radar.cjs

node bin/sketchmark.cjs preview examples/stress-city-traffic.visual.json
node bin/sketchmark.cjs preview examples/stress-ops-dashboard.visual.json
node bin/sketchmark.cjs preview examples/stress-airport-radar.visual.json
```

These are intentionally dense (many elements/keyframes) to pressure test preview responsiveness.

Preview animated timelines in the browser:

```bash
node bin/sketchmark.cjs preview examples/timeline.visual.json
```

Open the tiny editor:

```bash
node bin/sketchmark.cjs edit examples/keypose-walk.visual.json
```

Lint:

```bash
node bin/sketchmark.cjs lint examples/basic.visual.json
```

Video export is an adapter, not a kernel feature. It samples the document timeline into SVG frames, rasterizes those frames, and hands them to `ffmpeg`. It requires `sharp` and `ffmpeg` to be available in the local environment.

## Public API

```ts
import {
  validateVisualDocument,
  compileKeyframeStates,
  timelineCurvePreset,
  resolveVisualFrame,
  renderToSvg,
  renderToHtml,
  lintVisualDocument
} from "sketchmark";
```

The package intentionally exports no builders, player, project loader, deck/sequence helpers, 3D renderer, or compound compiler for now.
