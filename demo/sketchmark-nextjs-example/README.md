# sketchmark - Next.js example

Minimal working example of sketchmark in a Next.js 15 App Router project using `SketchmarkEmbed`.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## File structure

```text
src/
  app/
    layout.tsx
    page.tsx
    diagrams.ts
  components/
    SketchmarkDiagram.tsx
```

---

## The Next.js-specific rules

### 1. The embed host must be a client component

```tsx
'use client';
```

`SketchmarkEmbed` creates DOM nodes and runs browser-only animation logic, so it must mount from a client component.

### 2. Import sketchmark at the top of the client component

```tsx
import { SketchmarkEmbed } from "sketchmark";
```

Because the component is already marked with `'use client'`, a normal import is fine here. The embed should still be created inside `useEffect`, but the module itself does not need dynamic import gymnastics.

### 3. Keep DSL strings flush-left

```ts
const dsl = `
diagram
box a label="Hello"
box b label="World"
a --> b
end
`.trim();
```

Leading spaces become part of the DSL string and can cause parse errors.

---

## Using the component

```tsx
import SketchmarkDiagram from "@/components/SketchmarkDiagram";

<SketchmarkDiagram dsl={myDsl} showTitle showControls height={560} />

<SketchmarkDiagram
  dsl={myDsl}
  showTitle={false}
  showControls={false}
  showExports={false}
  height={220}
/>
```
