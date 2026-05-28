# Animatable Property Matrix

This matrix defines the kernel animation surface. Unknown timeline tracks are invalid.

Interpolation kinds:

- `number`: numeric interpolation
- `point2`: `[x,y]` interpolation
- `numberArray`: same-length numeric array interpolation
- `color`: hex color interpolation for color strings, otherwise discrete
- `paint`: whole paint value; color strings can interpolate, structured paint switches discretely unless animating supported internals
- `discrete`: previous value until the target keyframe

## Shared Position Tracks

| Property | path | text | image | point | group | Value | Interpolation | Default |
|---|---:|---:|---:|---:|---:|---|---|---|
| `position` | yes | yes | yes | yes | yes | `[x,y]` | `point2` | current `x/y` |
| `x` | yes | yes | yes | yes | yes | number | `number` | `0` |
| `y` | yes | yes | yes | yes | yes | number | `number` | `0` |

## Transform And Visibility

| Property | path | text | image | point | group | Value | Interpolation | Default |
|---|---:|---:|---:|---:|---:|---|---|---|
| `opacity` | yes | yes | yes | yes | yes | number | `number` | `1` |
| `rotation` | yes | yes | yes | no | yes | number | `number` | `0` |
| `scale` | yes | yes | yes | no | yes | number | `number` | `1` |
| `scaleX` | yes | yes | yes | no | yes | number | `number` | `1` |
| `scaleY` | yes | yes | yes | no | yes | number | `number` | `1` |
| `origin` | yes | yes | yes | no | yes | `[x,y]` | `point2` | renderer-derived |
| `blendMode` | yes | yes | yes | no | yes | string | `discrete` | none |

## Path Drawing And Stroke

| Property | path | text | image | point | group | Value | Interpolation | Default |
|---|---:|---:|---:|---:|---:|---|---|---|
| `d` | yes | no | no | no | no | string | `discrete` | required path `d` |
| `stroke` | yes | no | no | no | no | paint | `paint` | none |
| `strokeWidth` | yes | no | no | no | no | number | `number` | `1` |
| `strokeCap` | yes | no | no | no | no | string | `discrete` | renderer default |
| `strokeJoin` | yes | no | no | no | no | string | `discrete` | renderer default |
| `miterLimit` | yes | no | no | no | no | number | `number` | renderer default |
| `dashArray` | yes | no | no | no | no | number array | `numberArray` | none |
| `dashOffset` | yes | no | no | no | no | number | `number` | `0` |
| `drawStart` | yes | no | no | no | no | number | `number` | `0` |
| `drawEnd` | yes | no | no | no | no | number | `number` | `1` |

## Fill Paint

| Property | path | text | image | point | group | Value | Interpolation | Default |
|---|---:|---:|---:|---:|---:|---|---|---|
| `fill` | yes | yes | no | no | no | paint | `paint` | renderer default |

Whole `fill` and `stroke` tracks can switch structured paint values. For smooth gradient or pattern changes, animate the supported nested paint properties below.

## Text

| Property | path | text | image | point | group | Value | Interpolation | Default |
|---|---:|---:|---:|---:|---:|---|---|---|
| `text` | no | yes | no | no | no | string | `discrete` | none |
| `lines` | no | yes | no | no | no | string array | `discrete` | none |
| `align` | no | yes | no | no | no | string | `discrete` | renderer default |
| `valign` | no | yes | no | no | no | string | `discrete` | renderer default |
| `fontFamily` | no | yes | no | no | no | string | `discrete` | renderer default |
| `fontStyle` | no | yes | no | no | no | string | `discrete` | none |
| `fontSize` | no | yes | no | no | no | number | `number` | `16` |
| `lineHeight` | no | yes | no | no | no | number | `number` | `1.2` |
| `letterSpacing` | no | yes | no | no | no | number | `number` | `0` |
| `maxWidth` | no | yes | no | no | no | number | `number` | none |
| `weight` | no | yes | no | no | no | number or string | `discrete` | `400` |

`wrap` is a kernel field but is not currently an animatable property.

## Image

| Property | path | text | image | point | group | Value | Interpolation | Default |
|---|---:|---:|---:|---:|---:|---|---|---|
| `width` | no | no | yes | no | yes | number | `number` | `0` |
| `height` | no | no | yes | no | yes | number | `number` | `0` |
| `src` | no | no | yes | no | no | string | `discrete` | required image `src` |
| `fit` | no | no | yes | no | no | string | `discrete` | renderer default |
| `source.x` | no | no | yes | no | no | number | `number` | `0` |
| `source.y` | no | no | yes | no | no | number | `number` | `0` |
| `source.width` | no | no | yes | no | no | number | `number` | image width |
| `source.height` | no | no | yes | no | no | number | `number` | image height |

Image radius is not a kernel field. Use `clip.d`.

## Clip And Mask

| Property | path | text | image | point | group | Value | Interpolation | Default |
|---|---:|---:|---:|---:|---:|---|---|---|
| `clip.d` | yes | yes | yes | no | yes | string | `discrete` | full-plane clip if authored through edit helper |
| `mask.d` | yes | yes | yes | no | yes | string | `discrete` | full-plane mask if authored through edit helper |
| `mask.opacity` | yes | yes | yes | no | yes | number | `number` | `1` |

`clip.d` and `mask.d` are discrete. Smooth-looking path/radius changes must be sampled above the kernel.

## Effects

| Property | path | text | image | point | group | Value | Interpolation | Default |
|---|---:|---:|---:|---:|---:|---|---|---|
| `effects.blur` | yes | yes | yes | no | yes | number | `number` | `0` |
| `effects.brightness` | yes | yes | yes | no | yes | number | `number` | `1` |
| `effects.contrast` | yes | yes | yes | no | yes | number | `number` | `1` |
| `effects.saturate` | yes | yes | yes | no | yes | number | `number` | `1` |
| `effects.hueRotate` | yes | yes | yes | no | yes | number | `number` | `0` |
| `effects.shadow.dx` | yes | yes | yes | no | yes | number | `number` | `0` |
| `effects.shadow.dy` | yes | yes | yes | no | yes | number | `number` | `0` |
| `effects.shadow.blur` | yes | yes | yes | no | yes | number | `number` | `0` |
| `effects.shadow.color` | yes | yes | yes | no | yes | string | `color` | `#000000` |
| `effects.shadow.opacity` | yes | yes | yes | no | yes | number | `number` | `1` |

## Structured Paint Internals

These tracks are valid only when the element currently has the matching structured paint type on the matching root (`fill` or `stroke`).

### Linear Gradient

| Property | path fill | text fill | path stroke | Value | Interpolation |
|---|---:|---:|---:|---|---|
| `fill.from` | yes | yes | no | `[x,y]` | `point2` |
| `fill.to` | yes | yes | no | `[x,y]` | `point2` |
| `stroke.from` | no | no | yes | `[x,y]` | `point2` |
| `stroke.to` | no | no | yes | `[x,y]` | `point2` |

### Radial Gradient

| Property | path fill | text fill | path stroke | Value | Interpolation |
|---|---:|---:|---:|---|---|
| `fill.center` | yes | yes | no | `[x,y]` | `point2` |
| `fill.focus` | yes | yes | no | `[x,y]` | `point2` |
| `fill.radius` | yes | yes | no | number | `number` |
| `stroke.center` | no | no | yes | `[x,y]` | `point2` |
| `stroke.focus` | no | no | yes | `[x,y]` | `point2` |
| `stroke.radius` | no | no | yes | number | `number` |

### Gradient Stops

| Property pattern | path fill | text fill | path stroke | Value | Interpolation |
|---|---:|---:|---:|---|---|
| `fill.stops.N.offset` | yes | yes | no | number | `number` |
| `fill.stops.N.color` | yes | yes | no | string | `color` |
| `stroke.stops.N.offset` | no | no | yes | number | `number` |
| `stroke.stops.N.color` | no | no | yes | string | `color` |

`N` must point to an existing stop. The kernel does not create missing paint stops.

### Pattern

| Property | path fill | text fill | path stroke | Value | Interpolation |
|---|---:|---:|---:|---|---|
| `fill.x` | yes | yes | no | number | `number` |
| `fill.y` | yes | yes | no | number | `number` |
| `fill.width` | yes | yes | no | number | `number` |
| `fill.height` | yes | yes | no | number | `number` |
| `fill.opacity` | yes | yes | no | number | `number` |
| `stroke.x` | no | no | yes | number | `number` |
| `stroke.y` | no | no | yes | number | `number` |
| `stroke.width` | no | no | yes | number | `number` |
| `stroke.height` | no | no | yes | number | `number` |
| `stroke.opacity` | no | no | yes | number | `number` |

## Conflict Warnings

The validator allows but warns for overlapping timeline representations:

- `position` with `x` or `y`
- `scale` with `scaleX` or `scaleY`
- whole paint tracks such as `fill` with nested paint tracks such as `fill.to`

Prefer one representation per property family.

## Authoring Rule

If a desired animation is not in this matrix, do not add a new kernel field casually. Prefer a preset/editor helper that compiles into existing tracks.
