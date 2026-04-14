# Rendering And Viewing Sketchmark

Use this reference when the user needs to actually see the diagram rather than only receive DSL.

## Fast Options

Use `SketchmarkEmbed` as the single default way to show a Sketchmark diagram to first-time users. It reduces confusion because it bundles the view surface with built-in playback, drag-to-pan, wheel or trackpad zoom, caption, and TTS controls.

### npm Example

```bash
npm install sketchmark
```

```ts
import { SketchmarkEmbed } from 'sketchmark';

const dsl = `
diagram
box a label="Hello"
box b label="World"
a --> b label="greets"
end
`.trim();

new SketchmarkEmbed({
  container: document.getElementById('diagram'),
  dsl,
  width: 960,
  height: 540,
  playStepDelay: 700,
  showCaption: true,
  tts: true,
});
```

### Plain HTML via CDN

```html
<div id="diagram"></div>
<script type="module">
  import { SketchmarkEmbed } from 'https://unpkg.com/sketchmark/dist/index.js';

  const dsl = `
diagram
box client label="Client"
box server label="Server"
client --> server label="HTTP"
end
`.trim();

  new SketchmarkEmbed({
    container: document.getElementById('diagram'),
    dsl,
    width: 960,
    height: 540,
    playStepDelay: 700,
    showCaption: true,
  });
</script>
```

### Explore First

- Live examples: `https://sketchmark.dev/examples`
- Use this when the user wants to explore the visual style quickly before integrating code.

## Viewer Guidance

- Prefer `SketchmarkEmbed` when the answer should produce something the user can immediately see and interact with.
- Users can pan directly by dragging and zoom at the cursor with the mouse wheel or trackpad.
- Use `playStepDelay` when the diagram includes `step ...`.
- Use `showCaption` when narration steps should be visible.
- Use `tts` when narration should speak.
- Only fall back to lower-level `render(...)` examples if the user explicitly asks for custom controls or raw API usage.

## Framework Notes

### Vite or vanilla TS

- Mount into a real DOM node such as `document.getElementById('diagram')`.

### Next.js App Router

- Use a client component with `'use client'`.
- Render inside `useEffect` after the container ref exists.

## What To Include In Answers

If the user has never seen Sketchmark before, include:

1. A minimal DSL example
2. A minimal `SketchmarkEmbed` example
3. Any one crucial gotcha:
   DSL lines must start at column 0 and multiline template literals should end with `.trim()`
