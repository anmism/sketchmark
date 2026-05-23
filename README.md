# Sketchmark

JSON visual language for AI-generated explanations.

The canonical document format is a predictable scene graph of primitives. Higher-level helpers such as `node()`, `flow()`, `packet()`, and `callout()` are builder-time conveniences only: they expand into primitives before validation and rendering.

## Core Principles

- JSON is the source of truth.
- The canonical document contains primitives only.
- Box primitives use top-left `x`, `y`, `width`, and `height`.
- Circles use `cx`, `cy`, and `radius`.
- Lines and arrows use `from` and `to`.
- Missing geometry is an error, not an auto-layout hint.
- No collision avoidance, auto-routing, auto-resize, or hidden object synthesis.
- All computed values come from explicit builders, references, or `follow`.

## Example

```json
{
  "version": 1,
  "canvas": {
    "width": 1280,
    "height": 720,
    "background": "#f8fafc",
    "duration": 8,
    "fps": 30
  },
  "elements": [
    {
      "id": "browser_box",
      "type": "rect",
      "x": 120,
      "y": 160,
      "width": 180,
      "height": 80,
      "radius": 12,
      "fill": "#ffffff",
      "stroke": "#2563eb"
    },
    {
      "id": "browser_label",
      "type": "text",
      "text": "Browser",
      "x": 210,
      "y": 200,
      "align": "center",
      "valign": "middle",
      "fontSize": 18
    }
  ]
}
```

## Builders

```ts
import { scene } from "sketchmark";
import { node, arrow } from "sketchmark/builders";

const browser = node({
  id: "browser",
  label: "Browser",
  x: 120,
  y: 160,
  width: 180,
  height: 80
});

const resolver = node({
  id: "resolver",
  label: "DNS Resolver",
  x: 380,
  y: 160,
  width: 180,
  height: 80
});

export default scene({
  canvas: { width: 1280, height: 720, background: "#f8fafc", duration: 8 },
  elements: [
    ...browser,
    ...resolver,
    arrow({
      id: "query_arrow",
      from: "browser_box.right",
      to: "resolver_box.left",
      stroke: "#2563eb",
      strokeWidth: 3
    })
  ]
});
```

## Exports

Build first:

```bash
npm run build
```

Open a browser preview:

```bash
node bin/sketchmark.cjs preview examples/dns.visual.json
```

The preview opens an inline editor with live render, play/scrub controls, scene/sequence selectors, and a save button for the source JSON.

Render files:

```bash
node bin/sketchmark.cjs render examples/dns.visual.json out.svg
node bin/sketchmark.cjs render examples/dns.visual.json out.html
node bin/sketchmark.cjs render examples/dns.visual.json out.png --time 1.5
node bin/sketchmark.cjs render examples/dns.visual.json transparent.png --transparent
node bin/sketchmark.cjs render examples/dns.visual.json out.pdf
node bin/sketchmark.cjs render examples/dns.visual.json out.mp4 --fps 30 --duration 4
node bin/sketchmark.cjs render examples/dns.visual.json transparent.webm --transparent --fps 30 --duration 4
node bin/sketchmark.cjs lint examples/dns.visual.json
node bin/sketchmark.cjs screenshot-lint examples/dns.visual.json
```

SVG and HTML are built in. PNG/JPG/PDF/MP4/WebM use `sharp`; video also requires `ffmpeg`. Use WebM for transparent video; MP4 is intentionally opaque. Structured Three image/video export uses a deterministic isometric SVG preview adapter, while HTML uses the live Three renderer.

## Browser Player

```ts
import { SketchmarkPlayer, createSketchmarkPlayer } from "sketchmark/player";

const player = new SketchmarkPlayer(document.getElementById("preview")!, {
  document: visualDocument,
  autoplay: true,
  loop: true
});

player.seek(2);
player.pause();
player.setDocument(nextVisualDocument);
await player.download("svg", { title: "visual" });
await player.download("png", { title: "visual" });
await player.download("mp4", { title: "visual" });
player.destroy();
```

The player is UI-free. It renders the primitive JSON document into the supplied element, and its browser export provider can download SVG, PNG, JPG, HTML, JSON, and MP4. MP4 uses WebCodecs/H.264 when available and falls back to WebM if the browser cannot encode MP4.

Project and sequence examples:

```bash
node bin/sketchmark.cjs preview examples/project.visual.json --sequence main
node bin/sketchmark.cjs render examples/project.visual.json out.mp4 --sequence main
node bin/sketchmark.cjs timeline examples/project.visual.json --sequence main --fps 12
node bin/sketchmark.cjs render examples/deck.visual.json deck.html --deck --scene slide
node bin/sketchmark.cjs render examples/deck.visual.json deck.pptx --deck --scene slide
```

Feature catalog:

The `examples/features/` folder contains 21 primitive-first examples covering the main language surface: primitives, references, groups, animation, keyframes, packet follow, path follow, patch-friendly ids, diagrams, charts, scenes, sequences, deck steps, images, structured 3D, and mixed 2D/3D sequences.

Structured Three HTML example:

```bash
node bin/sketchmark.cjs render examples/three-cube.visual.json cube.html
node bin/sketchmark.cjs render examples/three-cube.visual.json cube.png
node bin/sketchmark.cjs render examples/three-cube.visual.json cube.mp4 --duration 2 --fps 24
```

Raw Three escape hatch:

```ts
import { renderRawThreeModuleHtml } from "sketchmark";

const html = renderRawThreeModuleHtml({
  width: 1280,
  height: 720,
  moduleUrl: "./scene.js"
});
```

The module must export `createSketchmarkThreeScene({ canvas, width, height, background })`.

## AI Reference

Use [AI.md](./AI.md) as the compact model-facing reference. It teaches only the primitive JSON surface and points to advanced features without making them default.
