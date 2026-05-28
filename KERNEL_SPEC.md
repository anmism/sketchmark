# Sketchmark Kernel Spec

Version: `1`

Sketchmark kernel documents are a strict 2D render and animation interchange format. The kernel is not an authoring language, editor project file, AI prompt format, or preset scene graph.

The kernel's job is to be:

- renderable
- deterministic
- validatable
- easy for editors and compilers to target
- small enough to keep stable

## Document Shape

Allowed top-level fields:

- `version`: must be `1`
- `canvas`: required
- `elements`: optional array

No other top-level fields are allowed.

```json
{
  "version": 1,
  "canvas": {
    "width": 960,
    "height": 540,
    "background": "#ffffff",
    "duration": 2,
    "fps": 30
  },
  "elements": []
}
```

## Canvas

Required fields:

- `width`: number
- `height`: number

Optional fields:

- `background`: string
- `duration`: non-negative number
- `fps`: positive number

Canvas has no camera, 3D space, scene list, assets map, imports, exports, or global timeline.

## Elements

Allowed element types:

- `path`
- `text`
- `image`
- `point`
- `group`

Common optional fields:

- `id`
- `opacity`
- `fill`
- `stroke`
- `strokeWidth`
- `strokeCap`
- `strokeJoin`
- `miterLimit`
- `dashArray`
- `dashOffset`
- `drawStart`
- `drawEnd`
- `effects`
- `blendMode`
- `rotation`
- `scale`
- `scaleX`
- `scaleY`
- `origin`
- `clip`
- `mask`
- `timeline`

Element IDs must start with a letter or `_` and may contain letters, numbers, `_`, `-`, or `.`. Dot-separated IDs are allowed so authoring layers can generate readable names such as `hero.head`.

Explicitly not allowed:

- editor metadata
- selections
- locks
- guides
- snapping
- scene IDs
- semantic objects
- rectangles/circles/arrows as separate types
- `cornerRadius`

Those belong in editor/project/preset layers and must compile down to kernel fields.

## Path

Required:

- `type: "path"`
- `d`: SVG path data string

Optional:

- `x`
- `y`
- common fields

Path `x/y` are rendered as a translation.

## Text

Required:

- `type: "text"`
- `x`
- `y`

Optional:

- `text`
- `lines`
- `align`: `left`, `center`, `right`
- `valign`: `top`, `middle`, `bottom`
- `fontSize`
- `fontFamily`
- `weight`
- `fontStyle`
- `lineHeight`
- `letterSpacing`
- `maxWidth`
- `wrap`
- common fields

If both `text` and `lines` exist, renderers may prefer explicit `lines`.

## Image

Required:

- `type: "image"`
- `src`
- `x`
- `y`
- `width`
- `height`

Optional:

- `fit`: `fill`, `contain`, `cover`
- `source`: crop rectangle
- common fields

Rounded images are represented with `clip.d`, not `cornerRadius`.

## Point

Required:

- `type: "point"`
- `x`
- `y`

Points are render-neutral anchors. They can be referenced by authoring tools and timelines, but renderers do not draw visible geometry for points.

## Group

Required:

- `type: "group"`
- `x`
- `y`
- `children`

Optional:

- `width`
- `height`
- common fields

Group `x/y` are rendered as group translation. Child coordinates are local to the group.

## Paint

Paint can be:

- color string
- linear gradient
- radial gradient
- pattern

Linear gradient:

```json
{
  "type": "linearGradient",
  "from": [0, 0],
  "to": [100, 0],
  "stops": [[0, "#000000"], [1, "#ffffff"]]
}
```

Radial gradient:

```json
{
  "type": "radialGradient",
  "center": [50, 50],
  "radius": 40,
  "focus": [50, 50],
  "stops": [[0, "#ffffff"], [1, "#000000"]]
}
```

Pattern:

```json
{
  "type": "pattern",
  "src": "image.png",
  "x": 0,
  "y": 0,
  "width": 32,
  "height": 32,
  "fit": "cover",
  "opacity": 1
}
```

## Clip And Mask

Clip:

```json
{
  "type": "path",
  "d": "M 0 0 H 100 V 100 H 0 Z"
}
```

Mask:

```json
{
  "type": "path",
  "d": "M 0 0 H 100 V 100 H 0 Z",
  "opacity": 0.8
}
```

Clip and mask paths use user-space coordinates for the rendered element context. If an editor wants rounded rectangles, arbitrary reveals, or soft masks, it should compile them into these fields.

## Timeline

Animation is element-local.

```json
{
  "timeline": {
    "start": 0,
    "end": 2,
    "tracks": {
      "position": {
        "keyframes": [
          { "time": 0, "value": [10, 20] },
          { "time": 1, "value": [100, 20] }
        ]
      }
    }
  }
}
```

Timeline fields:

- `start`: optional non-negative number
- `end`: optional non-negative number
- `tracks`: map of known animatable property names to track objects

Unknown tracks are invalid.

## Keyframes

Legacy tuple form remains valid:

```json
[0, 100]
```

Preferred object form:

```json
{
  "time": 0,
  "value": 100,
  "out": {
    "type": "cubicBezier",
    "x1": 0,
    "y1": 0,
    "x2": 0.58,
    "y2": 1
  }
}
```

Object keyframe fields:

- `time`: finite seconds
- `value`: JSON-safe timeline value
- `in`: optional curve
- `out`: optional curve
- `interpolation`: optional curve

Keyframes must be sorted by time.

## Curves

Supported curves:

- `graph`
- `cubicBezier`
- `hold`

Graph curve:

```json
{
  "type": "graph",
  "points": [[0, 0], [0.5, 0.2], [1, 1]]
}
```

Graph `x` is normalized time progress. Graph `y` is normalized value progress.

Cubic Bezier:

```json
{
  "type": "cubicBezier",
  "x1": 0.42,
  "y1": 0,
  "x2": 0.58,
  "y2": 1
}
```

Hold:

```json
{
  "type": "hold"
}
```

Segment curve resolution order:

1. previous keyframe `out`
2. previous keyframe `interpolation`
3. next keyframe `in`
4. track `curve`
5. legacy `ease`
6. linear

Named `ease` is legacy compatibility. New authoring tools should emit explicit curves.

## Interpolation Rules

- number to number: numeric interpolation
- `[x,y]` to `[x,y]`: point interpolation
- same-length number arrays: numeric array interpolation
- hex color string to hex color string: color interpolation
- all other string/object values: discrete switch at the target keyframe

Path data such as `d` and `clip.d` is discrete in the kernel. Smooth-looking path/radius changes should be sampled by an authoring compiler into multiple keyframes.

## Determinism Rules

For the same document and time:

- validation result must be stable
- resolved frame must be stable
- SVG output should be stable
- generated schema must match `schema/visual.schema.json`

Renderers should not read editor/project state, ambient AI context, hidden assets maps, or non-kernel fields.

## Versioning

`version: 1` is the frozen kernel line.

Breaking changes require a new document version. Additive features must still preserve deterministic validation and rendering.

## Kernel Boundary

Do not add these to the kernel:

- motion presets such as `rise`, `fadeIn`, `stagger`, `dogWalk`
- project source objects such as rectangles, circles, charts, diagrams
- editor state such as selected, locked, hidden, guides, snapping
- AI prompts or semantic descriptions
- benchmark task metadata

Those belong above the kernel and compile down to this spec.
