# sketchmark - Vite example

Minimal working example of sketchmark in a Vite project using `SketchmarkEmbed`.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Key points

### 1. Import the reusable widget from sketchmark

```ts
import { SketchmarkEmbed } from "sketchmark";

const embed = new SketchmarkEmbed({
  container: document.getElementById("embed-root") as HTMLElement,
  dsl,
  width: "min(100%, 920px)",
  height: 540,
});
```

The widget includes playback controls and automatically follows the active step inside its fixed frame.

### 2. DSL strings must not be indented

```ts
// correct - no leading spaces on DSL lines
const dsl = `
diagram
box a label="Hello"
box b label="World"
a --> b
end
`.trim();

// wrong - leading spaces cause parse errors
const dsl = `
  diagram
  box a label="Hello"
  box b label="World"
  a --> b
  end
`.trim();
```

### 3. Pass the container element, not a selector string

```ts
// preferred
container: document.getElementById("embed-root") as HTMLElement,

// avoid relying on selector lookup in example apps
container: "#embed-root",
```
