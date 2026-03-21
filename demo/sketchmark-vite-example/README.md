# sketchmark — Vite example

Minimal working example of sketchmark in a Vite project.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Key points

### 1. rough.js loads via script tag, not import

```html
<!-- index.html — before your module script -->
<script src="https://unpkg.com/roughjs@4.6.6/bundled/rough.js"></script>
```

rough.js puts itself on `window.rough`. sketchmark reads it from there.
If you try to `import rough from 'roughjs'` in your module it won't work
because sketchmark expects the bundled global, not the ESM build.

### 2. DSL string must not be indented

```ts
// ✓ correct — no leading spaces on DSL lines
const dsl = `
diagram
box a label="Hello"
box b label="World"
a --> b
end
`.trim();

// ✗ wrong — leading spaces cause parse errors
render({
  dsl: `diagram
    box a label="Hello"   ← these spaces are part of the string
    box b label="World"
  end`,
});
```

### 3. Pass the container element, not a selector string

```ts
// ✓
container: document.getElementById('diagram') as HTMLElement,

// ✗ — may not work depending on sketchmark version
container: '#diagram',
```
