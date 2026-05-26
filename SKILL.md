---
name: sketchmark-animation
description: Create or refactor Sketchmark animation generators and `.visual.json` documents for editor-friendly motion graphics. Use when Codex needs to author `make-*.cjs` files, build reusable motion helpers, add pivot-based rotation or scaling, organize animated scenes with groups, or simplify dense timelines so preview and edit stay fast.
---

# Sketchmark Animation

Build Sketchmark animations as small generator programs that emit clean JSON. Prefer sparse timelines, reusable helper functions, and group-local motion over per-frame sampled state generation.

## Workflow

1. Read one or two nearby Sketchmark examples before writing new motion.
2. Author a `.cjs` generator first, then emit the `.visual.json`.
3. Define top-level composition constants once: `width`, `height`, `duration`, `fps`, font stack, palette, and curve presets.
4. Add small reusable helpers for geometry, elements, groups, and track creation.
5. Build scenes from groups and stable IDs.
6. Use a few meaningful keyframes per property instead of sampling every moment.
7. Preview in the editor and simplify if the JSON becomes large or editing feels slow.

## Use Origin As Anchor

Treat `origin` as the Sketchmark anchor or pivot equivalent.

- Use `origin: [x, y]` to control the point used for rotation and scaling.
- Keep `origin` in the element or group's local coordinates.
- Prefer wrapping related parts in a `group` and animating the group when several children should share the same pivot.
- Animate `origin` only when the pivot itself needs to move over time.
- When a user says "anchor point", implement it with `origin` unless the format has added a separate anchor feature.

Practical rules:

- Rotate a clock hand around its base: place the hand in a group and set the group's `origin` at the pin.
- Rotate a card around a corner: keep the card path local to the group and set the group's `origin` to that corner.
- Rig limbs or props: group the visible shapes, then rotate the group with the `origin` at the joint.

## Author JS Generators Cleanly

Keep generator files generic and parameterized.

- Hard-code only document-wide constants and scene-specific content.
- Pass positions, sizes, colors, timings, and IDs into helpers as parameters.
- Keep helpers pure: return objects, do not mutate shared state in surprising ways.
- Use descriptive helper names such as `pathElement()`, `textElement()`, `groupElement()`, `fadeTrack()`, and `enterTrack()`.
- Keep scene timing in one `scenes` object with `start` and `end`.
- Keep curve presets in one place and reuse them.
- Keep IDs stable and readable so editor selection and timeline edits stay understandable.
- Split repeated visual patterns into helper functions instead of copy-pasting large object literals.

Prefer a structure like:

```js
const width = 1280;
const height = 720;
const duration = 12;
const fps = 30;

const curves = {
  easeOut: { type: "cubicBezier", x1: 0.16, y1: 1, x2: 0.3, y2: 1 }
};

function pathElement(id, d, style = {}) {
  return { id, type: "path", d, ...style };
}

function groupElement(id, x, y, children, extra = {}) {
  return { id, type: "group", x, y, children, ...extra };
}

function moveTrack(from, to, start, end) {
  return {
    keyframes: [
      { time: start, value: from, out: curves.easeOut },
      { time: end, value: to }
    ]
  };
}
```

## Keep Preview Fast

Prefer editor-friendly motion over dense generated timelines.

- Prefer sparse hand-authored keyframes over per-frame or per-step sampled states.
- Avoid compiling hundreds of near-identical state snapshots into timeline tracks unless absolutely necessary.
- Avoid animating decorative background elements continuously if they do not help the story.
- Keep canvas size reasonable while iterating; larger canvases cost more to preview.
- If the generated `.visual.json` grows into multiple megabytes, simplify tracks before adding more detail.

As a rule of thumb, a few strong keyframes with easing are better than many tiny linear corrections.

## Supported Animatable Properties

Use these property names directly in timeline tracks. Keep property names exact.

### Interpolation Rules

- `number`: smooth numeric interpolation
- `point2`: smooth `[x, y]` interpolation
- `color`: smooth color interpolation for plain color strings
- `numberArray`: smooth element-wise interpolation
- `discrete`: value switches at the keyframe; do not expect in-between blending

Practical interpretation:

- Motion values like `x`, `rotation`, `opacity`, `fontSize`, and `effects.blur` interpolate smoothly.
- `origin` and `position` interpolate as 2D points.
- `fill` and `stroke` interpolate smoothly only when they are plain color strings.
- `text`, `lines`, `fontFamily`, `src`, `fit`, `strokeCap`, `strokeJoin`, and `blendMode` are discrete.

### Shared Motion Properties

Available on visible elements unless noted otherwise:

- `position` -> `[x, y]`
- `x`
- `y`
- `rotation`
- `scale`
- `scaleX`
- `scaleY`
- `origin` -> `[x, y]`
- `opacity`
- `blendMode`
- `clip.d`
- `mask.d`
- `mask.opacity`

Element support:

- `path`, `text`, `image`, `group`: all shared motion properties above
- `point`: `position`, `x`, `y`

### Path Properties

Use for `path` elements:

- `fill` -> plain color string
- `stroke` -> plain color string
- `strokeWidth`
- `strokeCap`
- `strokeJoin`
- `miterLimit`
- `dashArray` -> number array
- `dashOffset`
- `drawStart`
- `drawEnd`

### Text Properties

Use for `text` elements:

- `fill` -> plain color string
- `text` -> string; use `\n` for multiline text
- `lines` -> string array; one string per rendered line
- `fontFamily`
- `fontSize`
- `lineHeight`
- `letterSpacing`
- `maxWidth`
- `weight`

Multiline guidance:

- Prefer `text` with explicit `\n` when authoring by hand or from a prompt.
- Use `lines` when another system already produces arrays of per-line strings.
- If both `text` and `lines` exist, `lines` takes precedence during rendering.
- Do not rely on `wrap` or `maxWidth` for automatic line breaking; explicit line breaks are more reliable.

### Image Properties

Use for `image` elements:

- `width`
- `height`
- `src`
- `fit`
- `source.x`
- `source.y`
- `source.width`
- `source.height`

### Group Properties

Use for `group` elements:

- `width`
- `height`
- all shared motion properties

### Effects Properties

Available on visible elements: `path`, `text`, `image`, `group`

- `effects.blur`
- `effects.brightness`
- `effects.contrast`
- `effects.saturate`
- `effects.hueRotate`
- `effects.shadow.dx`
- `effects.shadow.dy`
- `effects.shadow.blur`
- `effects.shadow.color`
- `effects.shadow.opacity`

### Gradient Properties

Use these nested properties when `fill` or `stroke` is a structured gradient paint. Do not mix them with plain color animation on the same root.

For linear gradients:

- `fill.from`
- `fill.to`
- `stroke.from`
- `stroke.to`

For radial gradients:

- `fill.center`
- `fill.focus`
- `fill.radius`
- `stroke.center`
- `stroke.focus`
- `stroke.radius`

For gradient stops:

- `fill.stops.0.offset`
- `fill.stops.0.color`
- `fill.stops.1.offset`
- `fill.stops.1.color`
- same pattern for higher stop indices and for `stroke.stops.*`

### Track Conflicts To Avoid

Prefer one representation for the same idea:

- Use `position` or use `x` and `y`, not both.
- Use `scale` or use `scaleX` and `scaleY`, not both, unless you are intentionally overriding with axis-specific tracks.
- Use `fill` as a plain color track or use `fill.*` gradient tracks, not both on the same element.
- Use `stroke` as a plain color track or use `stroke.*` gradient tracks, not both on the same element.

## How To Animate

Prefer small, explicit tracks with 2-5 keyframes.

Example:

```js
timeline: {
  tracks: {
    position: {
      keyframes: [
        { time: 0, value: [120, 200], out: curves.easeOut },
        { time: 1.2, value: [420, 200] }
      ]
    },
    rotation: {
      keyframes: [
        { time: 0, value: 0, out: curves.easeOut },
        { time: 1.2, value: 18 }
      ]
    }
  }
}
```

Use `origin` whenever rotation or scaling should happen around a specific pivot:

```js
groupElement("hand", 400, 240, children, {
  origin: [0, 60],
  timeline: {
    tracks: {
      rotation: {
        keyframes: [
          { time: 0, value: -90 },
          { time: 1, value: 0 }
        ]
      }
    }
  }
})
```

Use discrete animation for content swaps:

```js
text: {
  keyframes: [
    { time: 0, value: "Draft" },
    { time: 1.5, value: "Render" },
    { time: 3, value: "Export" }
  ]
}
```

## Grouping Guidance

Use groups to make motion understandable.

- Group each logical unit: character, bicycle, card, chart, hand, label cluster.
- Keep child shapes near local `0,0` when possible so transforms stay intuitive.
- Apply shared position, rotation, scale, and origin to the parent group.
- Keep unrelated motion in separate groups to avoid accidental coupling.

## Text And Styling

Keep text predictable across preview and export.

- Prefer a consistent local font stack already used by the project.
- Set `fontFamily` explicitly on generated text.
- Reuse text helper functions so size, alignment, and weight stay consistent.
- Use `text` with `\n` or `lines[]` for multiline layouts.
- Animate text with the same sparse-track rule used for shapes.

## Avoid

- Generate animations by sampling the whole timeline into many tiny steps.
- Mix world-space and local-space coordinates inside the same moving rig without a reason.
- Hide pivot logic inside arbitrary magic numbers.
- Bake giant JSON blobs inline in the generator.
- Create one-off helpers whose parameter names only make sense for a single scene.

## Output

When asked to create Sketchmark motion:

1. Produce or update a `make-*.cjs` generator.
2. Keep the code readable enough to edit by hand later.
3. Emit the `.visual.json`.
4. Prefer origin-aware groups for pivoted motion.
5. Prefer sparse timelines that stay responsive in preview and editor.
