# Sketchmark Presets

Presets are Sketchmark's official authoring layer above the render kernel.

They are reusable functions that compile to pure kernel elements and timelines. A preset may create shapes, characters, motion, effects, transitions, or scene fragments, but the final `.visual.json` must still contain only kernel fields.

## Layers

- `kernel`: final render format
- `presets`: reusable helpers that compile to kernel
- `packs`: shareable collections of presets

The root `sketchmark` export remains kernel-focused. Presets live in a separate entrypoint:

```js
const { applyPresetFragments, shapes, motions, effects } = require("sketchmark/presets");
```

When working inside this repo before publish, examples use:

```js
const { applyPresetFragments, shapes } = require("../dist/src/presets");
```

## Fragments

A preset returns a fragment:

```ts
type PresetFragment = {
  elements?: VisualElement[];
  timelines?: Record<string, Record<string, TimelineTrack>>;
};
```

`elements` are appended to the document.

`timelines` are keyed by target element ID and merged into each target's local kernel timeline.

```js
const doc = {
  version: 1,
  canvas: { width: 960, height: 540, duration: 2, fps: 30 },
  elements: []
};

const visual = applyPresetFragments(doc, [
  shapes.roundedRect({
    id: "card",
    x: 80,
    y: 80,
    width: 260,
    height: 120,
    radius: 16,
    fill: "#ffffff",
    stroke: "#cbd5e1"
  }),
  motions.riseIn({
    id: "card",
    from: [80, 120],
    to: [80, 80],
    duration: 0.5
  }),
  effects.dropShadow({
    id: "card",
    dy: 10,
    blur: 24,
    opacity: 0.2
  })
]);
```

The output is a normal kernel document. There is no preset metadata in `.visual.json`.

## Built-In Namespaces

### `shapes`

- `rect`
- `roundedRect`
- `ellipse`
- `circle`
- `line`
- `polyline`
- `arrow`
- `regularPolygon`
- `star`
- `speechBubble`

Shapes compile to `path`, `text`, or `group`.

### `characters`

- `stickPerson`
- `talkingHead`
- `simpleDog`
- `simpleSpider`
- `cursorHand`
- `simpleMascot`

Characters compile to groups with namespaced IDs such as `hero.head` and `dog.frontLeg`.

### `motions`

- `fadeIn`
- `fadeOut`
- `slideIn`
- `riseIn`
- `scaleIn`
- `pulse`
- `bob`
- `shake`
- `drawOn`
- `stagger`

Motions compile to explicit object keyframes and curves. They do not emit legacy `ease` strings.

### `effects`

- `dropShadow`
- `softBlur`
- `glow`
- `dim`
- `tintFill`
- `gradientSweep`
- `roundedImageClip`
- `maskReveal`

Effects compile to existing kernel properties such as `effects.*`, `fill`, `opacity`, `clip.d`, and `mask.d`.

Rounded images are compiled to `clip.d`. Presets must not write `cornerRadius`.

### `transitions`

- `crossfade`
- `pushLeft`
- `pushRight`
- `slideUp`
- `wipeLeft`
- `wipeRight`
- `zoomCut`
- `fadeThroughBlack`
- `irisIn`
- `irisOut`

Transitions coordinate timelines across one or more target elements.

### `scenes`

- `titleCard`
- `lowerThird`
- `captionBubble`
- `comparisonSplit`
- `deviceFrame`
- `gridBackground`

Scenes create reusable layout fragments and may be combined with motions/effects.

## Composition Helpers

```ts
applyPresetFragments(document, fragments, options?)
mergePresetFragments(fragments)
prefixPresetFragment(fragment, prefix)
```

Use `prefixPresetFragment` when reusing the same preset more than once:

```js
const a = prefixPresetFragment(shapes.rect({ id: "box", x: 0, y: 0, width: 40, height: 40 }), "a");
const b = prefixPresetFragment(shapes.rect({ id: "box", x: 50, y: 0, width: 40, height: 40 }), "b");
```

This produces `a.box` and `b.box`.

## Authoring Rules

- Presets must output only kernel elements and timelines.
- Presets must not write editor metadata, scene data, lock state, selection state, assets maps, or project state.
- Presets should emit explicit `graph`, `cubicBezier`, or `hold` curves, not legacy `ease`.
- Presets should use namespaced IDs for generated children.
- If a concept does not map cleanly to the kernel, keep it in preset code and compile it away.
