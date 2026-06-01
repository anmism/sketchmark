# Design

Use this for composition, layout, typography, visual hierarchy, and static visual construction.

## Boundary

- Output kernel elements only: `path`, `text`, `image`, `point`, `group`.
- Higher-level objects compile to kernel elements.
- Keep authoring helper names out of `.visual.json`.

## Process

1. Set `canvas.width`, `canvas.height`, optional `background`, `duration`, and `fps`.
2. Define reusable constants in generator code: colors, font family, spacing, stroke widths.
3. Build from back to front: background, large groups, content, details.
4. Use `group` for local coordinate systems.
5. Use `path` for shape geometry.
6. Use `text` for all labels and copy.
7. Use `image` only with explicit size and fit.
8. Validate the document.
9. Render at least one preview frame.

## Layout

- Use explicit `x` and `y`.
- Use groups to move related elements together.
- Use consistent margins and spacing.
- Keep important content inside the canvas.
- Prefer stable dimensions over inferred layout.

## Text

- Set `align` and `valign`.
- Set `fontSize`, `lineHeight`, `weight`, and `fill`.
- Use `text` with newlines or `lines` for multiline text.
- Use `maxWidth` and `wrap` only when supported by the renderer path being used.

## Shapes

- Rectangle: `path`.
- Rounded rectangle: `path`.
- Circle/ellipse: `path`.
- Arrow: `path`.
- Divider: `path` with `stroke`.
- Clip/reveal shape: `clip.d` or `mask.d`.

## Images

- Set `src`, `x`, `y`, `width`, `height`.
- Use `fit`.
- Use `source.*` for cropping.
- Use `clip.d` for rounded or custom image boundaries.

## Final Check

- No non-kernel element types.
- No metadata or editor state.
- All visual objects have explicit position and size.
- Text is readable in the target canvas.
