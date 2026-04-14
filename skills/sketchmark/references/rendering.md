# Rendering And Viewing Sketchmark

Use this reference when the user needs to actually see the diagram rather than only receive DSL.

## Fast Options

### Option 1: Use the npm package in an app

```bash
npm install sketchmark
```

```ts
import { render } from 'sketchmark';

const dsl = `
diagram
box a label="Hello"
box b label="World"
a --> b label="greets"
end
`.trim();

render({
  container: document.getElementById('diagram'),
  dsl,
  renderer: 'svg',
  svgOptions: { showTitle: true, theme: 'light', transparent: true },
});
```

### Option 2: Plain HTML via CDN

```html
<div id="diagram"></div>
<script type="module">
  import { render } from 'https://unpkg.com/sketchmark/dist/index.js';

  const dsl = `
diagram
box client label="Client"
box server label="Server"
client --> server label="HTTP"
end
`.trim();

  render({
    container: document.getElementById('diagram'),
    dsl,
    renderer: 'svg',
    svgOptions: { showTitle: true, interactive: true, theme: 'light', transparent: true },
  });
</script>
```

### Option 3: Use the public examples site

- Live examples: `https://sketchmark.dev/examples`
- Use this when the user wants to explore the visual style quickly before integrating code.

## Viewer Guidance

- Use `renderer: 'svg'` for interactive diagrams and for all animation-step examples.
- Use `showTitle: true` when the diagram has a title and the example should display it.
- Use `transparent: true` when embedding into an existing page background.
- If the example includes `step ...`, mention that playback is available through `instance.anim`.

## Framework Notes

### Vite or vanilla TS

- Mount into a real DOM node such as `document.getElementById('diagram')`.

### Next.js App Router

- Use a client component with `'use client'`.
- Render inside `useEffect` after the container ref exists.

## What To Include In Answers

If the user has never seen Sketchmark before, include:

1. A minimal DSL example
2. A minimal render example
3. Any one crucial gotcha:
   DSL lines must start at column 0 and multiline template literals should end with `.trim()`
