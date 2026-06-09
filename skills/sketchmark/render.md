# Render, Edit, Preview

Use this for validating, rendering, editing, previewing, exporting, and debugging Sketchmark files.
If the goal is a reusable preview another UI or AI agent can mount directly, prefer a self-contained embed HTML over a one-off SVG frame.

## Files

- Kernel document: `path/to/document.visual.json`
- Optional generator script: `path/to/generator.cjs`
- Optional standalone embed output: `path/to/preview.embed.html`
- Optional host iframe page: `path/to/preview.host.html`
- Schema: `schema/visual.schema.json`
- CLI: `bin/sketchmark.cjs`
- Browser export entrypoint: `sketchmark/browser-export`

## Generate

If the project uses a generator script, build first when needed and run that script:

```bash
npm run build
node path/to/generator.cjs
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
node bin/sketchmark.cjs validate path/to/document.visual.json
```

## Render

Render a frame:

```bash
node bin/sketchmark.cjs render path/to/document.visual.json --time 1 --out .tmp/preview.svg
```

Preview/export commands may vary by package version. Check:

```bash
node bin/sketchmark.cjs --help
```

Create a reusable embed in code:

```js
const { renderToEmbedHtml } = require("../dist/src");

const html = renderToEmbedHtml(doc, {
  title: "Agent Preview",
  maxFrames: 180
});
```

Create the same output from a browser host:

```js
import { exportVisualInBrowser } from "sketchmark/browser-export";

await exportVisualInBrowser(doc, {
  format: "embed",
  title: "Agent Preview",
  sourceDocument: doc
});
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
- Embed preview is the preferred agent-friendly output: one HTML string, no server route, play/pause UI, scrubber, and export buttons.
- Embed chrome defaults to a transparent outer background with light/dark-aware translucent controls, so it sits more naturally inside host UIs.
- Current embed exports are `svg`, `png`, `jpg`, `html`, `json`, and `mp4`.
- Mount embed HTML in an `iframe` with `srcdoc` or the equivalent host API.
- Use a generated `.embed.html` file and a host page with an `iframe` as the reference pair when you need parent-child messaging.
- Parent pages can send `sketchmark-play`, `sketchmark-pause`, `sketchmark-show`, and `sketchmark-export` with `postMessage`.
- The embed posts back `sketchmark-rendered` with `title`, `duration`, and `time`.
- Use `maxFrames` to trade file size for smoother motion.
- MP4 export inside the embed requires WebCodecs. Chrome and Edge are the safest targets.
- Editor preview checks property editing and timeline changes.
- Browser export is preferred for web deployments that cannot rely on server `ffmpeg` or `sharp`.

## Debug

- Validate before rendering.
- Lower `maxFrames` if the embed HTML gets too large.
- Browser raster or MP4 export can fail on unsupported browsers or when external images block canvas export.
- Unknown timeline tracks are invalid.
- Timeline curve fields must be objects.
- `cornerRadius` is not kernel; use `clip.d`.
- Text alignment uses `align` and `valign`.
- Image crop uses `source.*`.
- Render the exact failing time.
