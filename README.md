# Sketchmark

A pure 2D render kernel for animated visuals. Documents contain only five element types: `path`, `text`, `image`, `point`, and `group`. Higher-level constructs (rectangles, arrows, charts, etc.) compile down to this format.

## Quick Start

**As a dependency:**
```bash
npm install sketchmark
```

**Starter template:**
```bash
git clone https://github.com/anmism/sketchmark-starter.git
```

**For AI agents:**
```bash
npx skills add anmism/sketchmark --yes
```


## Document Structure

```json
{
  "version": 1,
  "canvas": { "width": 640, "height": 360, "background": "#f8fafc", "duration": 2, "fps": 30 },
  "elements": [...]
}
```

## Usage

```js
const { render, edit, validateVisualDocument } = require("sketchmark");

// Render
const svg = render.svg(doc, { time: 1 });
const html = render.html(doc);
const embed = render.embedHtml(doc, { title: "Preview" });

// Edit
const updated = edit.setProperty(doc, "element-id", "fill", "#22c55e");
```

## CLI

```bash
sketchmark render input.visual.json out.svg
sketchmark render input.visual.json out.mp4
sketchmark preview input.visual.json
sketchmark edit input.visual.json
sketchmark lint input.visual.json
```

Video export requires `sharp` and `ffmpeg`.

## Package Entry Points

| Entry | Purpose |
|-------|---------|
| `sketchmark` | Core kernel: validate, render, edit, keyframes |
| `sketchmark/presets` | Authoring helpers: shapes, motions, effects |
| `sketchmark/editor` | Editor UI |
| `sketchmark/preview` | Preview player |
| `sketchmark/schema` | JSON schema |

## Documentation

See `skills/sketchmark/` for detailed guides:
- `kernel.md` - Element types, properties, paints, effects, timelines
- `design.md` - Composition and visual construction
- `animation.md` - Timeline and motion
- `render.md` - Validation, rendering, export workflows
