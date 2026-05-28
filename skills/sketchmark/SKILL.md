---
name: sketchmark
description: Create, refactor, validate, or document Sketchmark kernel visuals, preset generators, and pack-ready authoring helpers. Use when Codex needs to work on `.visual.json`, `make-*.cjs` generators, `sketchmark/presets`, chat-first Sketchmark app generation, or animation timelines while preserving the frozen kernel boundary.
---

# Sketchmark

Sketchmark has three layers:

- `kernel`: the final render format, stored as `.visual.json`
- `presets`: reusable authoring helpers that compile to kernel
- `packs`: shareable collections of presets

Treat the kernel as a small render and animation interchange format. Do not put editor state, AI prompts, semantic objects, or preset metadata into kernel JSON.

## First Decision

Before editing, decide which layer you are touching.

- Kernel work changes `src/`, schema, validation, rendering, timeline resolution, or docs such as `KERNEL_SPEC.md`.
- Preset work changes `src/presets/`, examples, or helpers that output pure kernel fragments.
- Pack work is documentation or trusted authoring code that exports presets.
- App work should generate or refine kernel documents using presets; it should not invent app-only fields inside `.visual.json`.

If a requested feature is authoring convenience, prefer a preset/editor helper that compiles into existing kernel properties.

## Kernel Boundary

Kernel documents allow only these top-level fields:

```json
{
  "version": 1,
  "canvas": { "width": 960, "height": 540, "duration": 2, "fps": 30 },
  "elements": []
}
```

Allowed element types:

- `path`
- `text`
- `image`
- `point`
- `group`

Do not add these to kernel documents:

- `metadata`
- scenes, sequences, deck/page state, or global motion blocks
- editor selection, lock, hidden, guide, snap, or source-object state
- semantic objects such as rectangle, circle, arrow, chart, dog, walk cycle
- image `cornerRadius`

Rectangles, circles, arrows, characters, effects, transitions, and layout scenes belong in presets and compile to `path`, `text`, `image`, `point`, `group`, timelines, clip, mask, paint, and effects.

Rounded images use `clip.d`, not `cornerRadius`.

## Kernel Animation Rules

Animation is element-local:

```js
{
  id: "card",
  type: "group",
  x: 80,
  y: 80,
  children: [],
  timeline: {
    tracks: {
      position: {
        keyframes: [
          { time: 0, value: [80, 120], out: { type: "cubicBezier", x1: 0.16, y1: 1, x2: 0.3, y2: 1 } },
          { time: 0.5, value: [80, 80] }
        ]
      }
    }
  }
}
```

Use object keyframes by default. Tuple keyframes remain legacy-compatible.

Preferred curves:

- `{ type: "graph", points: [[0, 0], [0.5, 0.2], [1, 1]] }`
- `{ type: "cubicBezier", x1, y1, x2, y2 }`
- `{ type: "hold" }`

Do not emit legacy `ease` from new code. It can be read for backward compatibility only.

Unknown timeline tracks are invalid. Check `ANIMATABLE_MATRIX.md` before adding or targeting a property.

## Common Animatable Tracks

Shared tracks:

- `position`, `x`, `y`
- `opacity`
- `rotation`, `scale`, `scaleX`, `scaleY`, `origin`
- `blendMode`
- `clip.d`, `mask.d`, `mask.opacity`

Path tracks:

- `d`
- `fill`, `stroke`
- `strokeWidth`, `strokeCap`, `strokeJoin`, `miterLimit`
- `dashArray`, `dashOffset`
- `drawStart`, `drawEnd`

Text tracks:

- `text`, `lines`
- `align`, `valign`
- `fontFamily`, `fontStyle`, `fontSize`, `lineHeight`, `letterSpacing`, `maxWidth`, `weight`
- `fill`

Image tracks:

- `width`, `height`
- `src`, `fit`
- `source.x`, `source.y`, `source.width`, `source.height`

Effect tracks:

- `effects.blur`
- `effects.brightness`, `effects.contrast`, `effects.saturate`, `effects.hueRotate`
- `effects.shadow.dx`, `effects.shadow.dy`, `effects.shadow.blur`, `effects.shadow.color`, `effects.shadow.opacity`

Structured paint internals:

- linear gradient: `fill.from`, `fill.to`, `stroke.from`, `stroke.to`
- radial gradient: `fill.center`, `fill.focus`, `fill.radius`, `stroke.center`, `stroke.focus`, `stroke.radius`
- stops: `fill.stops.N.offset`, `fill.stops.N.color`, `stroke.stops.N.offset`, `stroke.stops.N.color`
- pattern: `fill.x`, `fill.y`, `fill.width`, `fill.height`, `fill.opacity`, and matching `stroke.*`

Interpolation is numeric for numbers, point-like for `[x,y]`, color-like for plain hex color strings, and discrete for unsupported strings or objects. Path data such as `d` and `clip.d` is discrete; smooth-looking shape morphs or rounded-radius changes must be compiled above the kernel into multiple keyframes.

## Presets Layer

The package exposes presets separately:

```js
const {
  applyPresetFragments,
  mergePresetFragments,
  prefixPresetFragment,
  shapes,
  characters,
  motions,
  effects,
  transitions,
  scenes
} = require("sketchmark/presets");
```

Inside this repo before publish, examples can import from built output:

```js
const { applyPresetFragments, shapes, motions } = require("../dist/src/presets");
```

Preset functions return fragments:

```ts
{
  elements?: VisualElement[],
  timelines?: Record<string, Record<string, TimelineTrack>>
}
```

Use `applyPresetFragments(document, fragments)` to produce a pure kernel document. The output must validate as `.visual.json` and must not include preset metadata.

Built-in namespaces:

- `shapes`: rect, roundedRect, ellipse, circle, line, polyline, arrow, regularPolygon, star, speechBubble
- `characters`: stickPerson, talkingHead, simpleDog, simpleSpider, cursorHand, simpleMascot
- `motions`: fadeIn, fadeOut, slideIn, riseIn, scaleIn, pulse, bob, shake, drawOn, stagger
- `effects`: dropShadow, softBlur, glow, dim, tintFill, gradientSweep, roundedImageClip, maskReveal
- `transitions`: crossfade, pushLeft, pushRight, slideUp, wipeLeft, wipeRight, zoomCut, fadeThroughBlack, irisIn, irisOut
- `scenes`: titleCard, lowerThird, captionBubble, comparisonSplit, deviceFrame, gridBackground

Preset rules:

- output only kernel elements and kernel timelines
- use stable, readable IDs
- use dot-namespaced child IDs such as `hero.head` and `dog.frontLeg`
- emit explicit curves, not legacy `ease`
- use `prefixPresetFragment` when reusing the same fragment more than once
- throw clear errors when a timeline targets an unknown element

## Authoring Generators

Prefer generator scripts over hand-writing large JSON:

1. Read one or two nearby `examples/make-*.cjs` files.
2. Write or update a `make-*.cjs` generator.
3. Keep constants near the top: canvas size, duration, fps, palette, font stack, curve presets.
4. Use helpers for paths, text, groups, tracks, and repeated scene structures.
5. Generate `.visual.json`.
6. Validate and render a frame or preview.

Keep generators modular when scenes get long. Split helpers into local modules or small functions, but keep final output as one pure kernel document.

Good generator shape:

```js
const { applyPresetFragments, shapes, motions } = require("../dist/src/presets");

const curves = {
  easeOut: { type: "cubicBezier", x1: 0.16, y1: 1, x2: 0.3, y2: 1 }
};

const doc = {
  version: 1,
  canvas: { width: 960, height: 540, background: "#ffffff", duration: 2, fps: 30 },
  elements: []
};

const visual = applyPresetFragments(doc, [
  shapes.roundedRect({ id: "card", x: 80, y: 80, width: 260, height: 120, radius: 16, fill: "#ffffff" }),
  motions.riseIn({ id: "card", from: [80, 120], to: [80, 80], duration: 0.5, curve: curves.easeOut })
]);

module.exports = visual;
```

## Motion Guidance

Prefer sparse, editor-friendly motion:

- 2-5 meaningful keyframes per property
- parent-group transforms for whole objects
- child-local coordinates near `0,0`
- stable origins for rotation and scale
- explicit hold curves for value switches
- discrete keyframes for text, image source, path `d`, and clip/mask path changes

Avoid:

- per-frame sampled timelines unless compiling an intentionally complex effect
- separate matching tracks on many children when a parent group can move them together
- mixing `position` with `x/y` for the same element
- mixing `scale` with `scaleX/scaleY` unless intentional
- mixing whole `fill`/`stroke` paint tracks with nested paint tracks on the same element

## App Generation

For `sketchmark-app`, keep generation chat-first and kernel-first.

Generated code should return a `VisualDocument`. It may use preset globals made available by the app sandbox, but the final result must be pure kernel JSON.

Do not ask the AI to output:

- non-kernel element types
- project/editor metadata
- top-level `motion`
- scenes or timeline formats not supported by the kernel

The app backend can switch AI providers. Keep provider configuration in environment/backend code, not generated visual documents.

## Validation And Checks

Useful checks:

```sh
npm test
node examples/make-presets-demo.cjs
node examples/make-preset-character-motion.cjs
node bin/sketchmark.cjs render examples/presets-demo.visual.json --time 0 --out /tmp/sketchmark-frame.svg
```

For docs-only changes, tests may be unnecessary. For kernel, preset, schema, renderer, or app generation changes, run the closest validation or full `npm test`.

## When Unsure

Preserve the boundary:

- kernel stays render-focused and deterministic
- presets absorb reusable authoring ideas
- packs share presets
- editor/app layers compile their source state away

If the kernel needs a new field, first ask whether the same result can be represented by existing path, text, image, point, group, transform, paint, clip, mask, effect, or timeline properties.
