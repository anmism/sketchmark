# Animation

Use this for timeline creation, motion timing, reveals, transitions, and animated visual states.

## Boundary

- Animation is stored in element-local `timeline.tracks`.
- Track names must be valid animatable properties from `kernel.md`.
- Curves are timeline curve objects.
- Helper functions may exist in generator code, but their output is only kernel timelines.

## Process

1. Create a readable static frame first.
2. Choose which element or group owns each motion.
3. Animate parent groups for broad movement.
4. Animate child elements for local changes.
5. Add keyframes at clear beats.
6. Use explicit curves when timing matters.
7. Validate.
8. Render checkpoint frames at key times.

## Track Selection

- Position: `position`, `x`, `y`.
- Visibility: `opacity`.
- Transform: `rotation`, `scale`, `scaleX`, `scaleY`, `origin`.
- Path drawing: `drawStart`, `drawEnd`.
- Text changes: `text`, `lines`.
- Paint changes: `fill`, `stroke`, paint subproperties.
- Reveal: `clip.d`, `mask.d`, `mask.opacity`.
- Effects: `effects.*`.

## Keyframes

Preferred object form:

```js
{ time: 0, value: [0, 0], out: { type: "cubicBezier", x1: 0.16, y1: 1, x2: 0.3, y2: 1 } }
```

Tuple form:

```js
[0, [0, 0]]
```

## Curves

- `cubicBezier`: smooth timing.
- `graph`: custom normalized timing.
- `hold`: discrete switch.

## Timing

- Use seconds.
- Keep keyframes sorted by time.
- Use short names for curve constants in generator code.
- Use `hold` for instant changes.
- Use multiple sampled keyframes for path or radius style changes because path data is discrete.

## Final Check

- Every animated track exists in `kernel.md`.
- Keyframes are sorted.
- Curve fields contain curve objects.
- The animation still reads at checkpoint frames.
