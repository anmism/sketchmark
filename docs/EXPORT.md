# Export Guide

## SVG Export

```ts
import { exportSVG } from 'sketchmark';
exportSVG(svg, { filename: 'my-diagram.svg' });
```

Or via instance:
```ts
instance.exportSVG('my-diagram.svg');
```

## PNG Export

```ts
import { exportPNG } from 'sketchmark';
await exportPNG(svg, {
  filename:   'my-diagram.png',
  scale:      2,           // 2× = retina quality
  background: '#f8f4ea',   // fill colour (default: cream)
});
```

## HTML Export (self-contained)

Embeds SVG + DSL source in a single HTML file:

```ts
import { exportHTML } from 'sketchmark';
exportHTML(svg, dslSource, { filename: 'diagram.html' });
```

## GIF Export (requires gifshot)

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gifshot/0.4.5/gifshot.min.js"></script>
```

```ts
import { exportGIF } from 'sketchmark';
// frames: array of HTMLCanvasElement (one per animation step)
await exportGIF(frames, { fps: 8, filename: 'animation.gif' });
```

## MP4 Export (MediaRecorder / ffmpeg.wasm)

```ts
import { exportMP4 } from 'sketchmark';
const blob = await exportMP4(canvas, 3000, { fps: 30 });
// blob is a WebM video
```

For true MP4 output, pipe the WebM blob through ffmpeg.wasm.
