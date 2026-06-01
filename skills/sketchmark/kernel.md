# Kernel

## Package Entry Points

- `sketchmark`
- `sketchmark/presets`
- `sketchmark/browser-export`
- `sketchmark/editor`
- `sketchmark/schema`
- CLI: `sketchmark`

## Root Kernel Exports

- types
- validate
- normalize
- diagnostics
- schema
- keyframes
- edit
- animatable
- render/svg
- render/html

## Document

- `version`: `1`
- `canvas`: `VisualCanvas`
- `elements`: `VisualElement[]`

## Canvas

- `width`: number
- `height`: number
- `background`: string
- `duration`: number
- `fps`: number

## Element Types

- `path`
- `text`
- `image`
- `point`
- `group`

## Common Element Properties

- `id`: string
- `type`: element type
- `opacity`: number
- `fill`: paint
- `stroke`: paint
- `strokeWidth`: number
- `strokeCap`: `butt | round | square`
- `strokeJoin`: `miter | round | bevel`
- `miterLimit`: number
- `dashArray`: number[]
- `dashOffset`: number
- `drawStart`: number
- `drawEnd`: number
- `effects`: effects
- `blendMode`: string
- `rotation`: number
- `scale`: number
- `scaleX`: number
- `scaleY`: number
- `origin`: `[number, number]`
- `clip`: clip shape
- `mask`: mask shape
- `timeline`: element timeline

## Path Element

- `type`: `"path"`
- `d`: SVG path data string
- `x`: number
- `y`: number
- common properties

## Text Element

- `type`: `"text"`
- `x`: number
- `y`: number
- `text`: string
- `lines`: string[]
- `align`: `left | center | right`
- `valign`: `top | middle | bottom`
- `fontSize`: number
- `fontFamily`: string
- `weight`: number | string
- `fontStyle`: string
- `lineHeight`: number
- `letterSpacing`: number
- `maxWidth`: number
- `wrap`: boolean
- common properties

## Image Element

- `type`: `"image"`
- `src`: string
- `x`: number
- `y`: number
- `width`: number
- `height`: number
- `fit`: `fill | contain | cover`
- `source.x`: number
- `source.y`: number
- `source.width`: number
- `source.height`: number
- `source.imageWidth`: number
- `source.imageHeight`: number
- common properties

## Point Element

- `type`: `"point"`
- `x`: number
- `y`: number
- common properties

## Group Element

- `type`: `"group"`
- `x`: number
- `y`: number
- `width`: number
- `height`: number
- `children`: `VisualElement[]`
- common properties

## Paint

- string color
- linear gradient
- radial gradient
- pattern

## Linear Gradient Paint

- `type`: `"linearGradient"`
- `from`: `[number, number]`
- `to`: `[number, number]`
- `stops`: gradient stops

## Radial Gradient Paint

- `type`: `"radialGradient"`
- `center`: `[number, number]`
- `radius`: number
- `focus`: `[number, number]`
- `stops`: gradient stops

## Pattern Paint

- `type`: `"pattern"`
- `src`: string
- `x`: number
- `y`: number
- `width`: number
- `height`: number
- `fit`: `fill | contain | cover`
- `opacity`: number

## Gradient Stop

- `[offset, color]`
- `{ offset, color }`

## Clip Shape

- `type`: `"path"`
- `d`: SVG path data string

## Mask Shape

- `type`: `"path"`
- `d`: SVG path data string
- `opacity`: number

## Effects

- `blur`: number
- `brightness`: number
- `contrast`: number
- `saturate`: number
- `hueRotate`: number
- `shadow.dx`: number
- `shadow.dy`: number
- `shadow.blur`: number
- `shadow.color`: string
- `shadow.opacity`: number

## Timeline

- `start`: number
- `end`: number
- `tracks`: record of animatable property names to timeline tracks

## Timeline Track

- `keyframes`: timeline keyframes
- `curve`: timeline curve
- `ease`: string

## Keyframe Tuple

- `[time, value]`

## Keyframe Object

- `time`: number
- `value`: timeline value
- `in`: timeline curve
- `out`: timeline curve
- `interpolation`: timeline curve

## Timeline Curve

- `{ type: "graph", points: [number, number][] }`
- `{ type: "cubicBezier", x1: number, y1: number, x2: number, y2: number }`
- `{ type: "hold" }`

## Timeline Values

- number
- string
- `[number, number]`
- number[]
- string[]
- JSON object

## Animatable Common Tracks

- `position`: path, point, text, image, group
- `x`: path, point, text, image, group
- `y`: path, point, text, image, group
- `opacity`: path, point, text, image, group
- `rotation`: path, text, image, group
- `scale`: path, text, image, group
- `scaleX`: path, text, image, group
- `scaleY`: path, text, image, group
- `origin`: path, text, image, group
- `blendMode`: path, text, image, group
- `clip.d`: path, text, image, group
- `mask.d`: path, text, image, group
- `mask.opacity`: path, text, image, group

## Animatable Path Tracks

- `d`
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

## Animatable Text Tracks

- `text`
- `lines`
- `align`
- `valign`
- `fontFamily`
- `fontStyle`
- `fontSize`
- `lineHeight`
- `letterSpacing`
- `maxWidth`
- `weight`
- `fill`

## Animatable Image Tracks

- `width`
- `height`
- `src`
- `fit`
- `source.x`
- `source.y`
- `source.width`
- `source.height`

## Animatable Group Tracks

- `width`
- `height`

## Animatable Effects Tracks

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

## Animatable Paint Tracks

- `fill.x`
- `fill.y`
- `fill.width`
- `fill.height`
- `fill.opacity`
- `fill.from`
- `fill.to`
- `fill.center`
- `fill.focus`
- `fill.radius`
- `fill.stops.N.offset`
- `fill.stops.N.color`
- `stroke.x`
- `stroke.y`
- `stroke.width`
- `stroke.height`
- `stroke.opacity`
- `stroke.from`
- `stroke.to`
- `stroke.center`
- `stroke.focus`
- `stroke.radius`
- `stroke.stops.N.offset`
- `stroke.stops.N.color`
