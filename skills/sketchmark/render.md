# Render, Edit, Preview

Use this for validating, rendering, editing, previewing, exporting, and debugging Sketchmark files.

## Files

- Generator: `examples/make-*.cjs`
- Kernel document: `examples/*.visual.json`
- Schema: `schema/visual.schema.json`
- CLI: `bin/sketchmark.cjs`

## Generate

```bash
node examples/make-name.cjs
```

## Validate

In code:

```js
const { validateVisualDocument } = require("../dist/src");
const result = validateVisualDocument(doc);
if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join("\n"));
```

With CLI when available:

```bash
node bin/sketchmark.cjs validate examples/name.visual.json
```

## Render

Render a frame:

```bash
node bin/sketchmark.cjs render examples/name.visual.json --time 1 --out .tmp/name.svg
```

Preview/export commands may vary by package version. Check:

```bash
node bin/sketchmark.cjs --help
```

## Edit

For small edits:

1. Find element by `id`.
2. Patch only the needed properties.
3. Preserve unrelated timelines.
4. Validate.
5. Render the changed frame.

For large edits:

1. Update the generator.
2. Regenerate the `.visual.json`.
3. Validate.
4. Render preview frames.

## Preview

- SVG frame preview checks geometry, text, and paint.
- HTML preview checks animation playback when available.
- Editor preview checks property editing and timeline changes.
- Browser export is preferred for web deployments that cannot rely on server `ffmpeg` or `sharp`.

## Debug

- Validate before rendering.
- Unknown timeline tracks are invalid.
- Timeline curve fields must be objects.
- `cornerRadius` is not kernel; use `clip.d`.
- Text alignment uses `align` and `valign`.
- Image crop uses `source.*`.
- Render the exact failing time.
