# sketchmark — Next.js example

Minimal working example of sketchmark in a Next.js 15 App Router project.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## File structure

```
src/
  app/
    layout.tsx        ← loads rough.js via <script> tag
    page.tsx          ← server component, uses SketchmarkDiagram
    diagrams.ts       ← DSL strings (no browser APIs, safe anywhere)
  components/
    SketchmarkDiagram.tsx  ← 'use client' component, does the rendering
```

---

## The three Next.js-specific rules

### 1. rough.js goes in layout.tsx as a plain `<script>` tag

```tsx
// src/app/layout.tsx
<script
  src="https://unpkg.com/roughjs@4.6.6/bundled/rough.js"
  async={false}
/>
```

rough.js puts itself on `window.rough`. sketchmark reads it from there.
Do NOT try to `import rough from 'roughjs'` in a module — sketchmark
expects the bundled global, not the ESM build.

`async={false}` makes it load synchronously so it's ready before hydration.

### 2. The render component must be 'use client'

```tsx
// src/components/SketchmarkDiagram.tsx
'use client';
```

sketchmark calls `document.createElement` and `window.rough`.
Both crash during Next.js server rendering (there is no DOM on the server).
`'use client'` tells Next.js to only run this component in the browser.

### 3. sketchmark must be dynamically imported inside useEffect

```tsx
// inside useEffect — never at the top of the file
const { render } = await import('sketchmark');
```

Even with `'use client'`, Next.js still does a server-side pass for the
initial HTML. A top-level `import { render } from 'sketchmark'` would run
on the server and crash. Dynamic import inside `useEffect` only runs in
the browser, after hydration.

### 4. DSL strings must not have leading whitespace

```ts
// ✓ correct
const dsl = `
diagram
box a label="Hello"
box b label="World"
a --> b
end
`.trim();

// ✗ wrong — the spaces before 'box' are part of the string
const dsl = `
  diagram
  box a label="Hello"
  box b label="World"
  a --> b
  end
`.trim();
```

Keep DSL strings in a separate `diagrams.ts` file where you can see
exactly what indentation they have.

---

## Using the component

```tsx
import SketchmarkDiagram from '@/components/SketchmarkDiagram';

// with controls
<SketchmarkDiagram dsl={myDsl} showTitle showControls />

// just the diagram, no buttons
<SketchmarkDiagram dsl={myDsl} showTitle={false} showControls={false} />

// dark theme
<SketchmarkDiagram dsl={myDsl} theme="dark" />
```
