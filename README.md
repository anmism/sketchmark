# sketchmark

A text-based diagram DSL that renders hand-drawn SVG and Canvas diagrams using [rough.js](https://roughjs.com). Write diagrams as plain text, get sketchy, expressive visuals with a full animation system.

```
diagram
title label="System Architecture"

box client  label="Client App"   theme=primary
box gateway label="API Gateway"  theme=warning
box db      label="PostgreSQL"   theme=success

client  --> gateway label="HTTPS"
gateway --> db      label="SQL"

step highlight client
step draw client-->gateway
step highlight gateway
step draw gateway-->db
end
```

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [DSL Reference](#dsl-reference)
  - [Diagram Header](#diagram-header)
  - [Node Shapes](#node-shapes)
  - [Edges](#edges)
  - [Groups](#groups)
  - [Tables](#tables)
  - [Notes](#notes)
  - [Charts](#charts)
  - [Themes](#themes)
  - [Animation Steps](#animation-steps)
- [Layout System](#layout-system)
- [Animation System](#animation-system)
- [Theme Palettes](#theme-palettes)
- [API Reference](#api-reference)
- [Export](#export)
- [Examples](#examples)

---

## Installation

```bash
npm install sketchmark roughjs
```

rough.js is a peer dependency — it must be available at runtime.

---

## Quick Start

**With a bundler (Vite, webpack, Next.js):**

```typescript
import { render } from 'sketchmark';

const instance = render({
  container: document.getElementById('diagram'),
  dsl: `
    diagram
    box a label="Hello"
    box b label="World"
    a --> b label="connects"
  `,
  renderer:   'svg',
  svgOptions: { showTitle: true, interactive: true,transparent: true },
});

// Step through animation
instance.anim.next();
instance.anim.play(800);
```

**CDN / no bundler:**

```html
<script src="https://unpkg.com/roughjs@4.6.6/bundled/rough.js"></script>
<script type="module">
  import { render } from 'https://unpkg.com/sketchmark/dist/index.js';

  render({
    container: document.getElementById('diagram'),
    dsl: `diagram\nbox a label="Hello"\nbox b label="World"\na --> b`,
  });
</script>
```

**CommonJS:**

```javascript
const { parse, buildSceneGraph, layout } = require('sketchmark');
```

---

## DSL Reference

Every diagram starts with `diagram` and ends with `end`.

```
diagram
title label="My Diagram"
layout row
config gap=60

... nodes, edges, groups, steps ...

end
```

### Diagram Header

| Keyword | Example | Description |
|---|---|---|
| `title` | `title label="My Diagram"` | Title shown above the diagram |
| `layout` | `layout row` | Root layout direction: `row`, `column`, `grid` |
| `config gap` | `config gap=60` | Gap between root-level items (default: 80) |
| `config margin` | `config margin=40` | Outer canvas margin (default: 60) |
| `config theme` | `config theme=ocean` | Global palette (see [Theme Palettes](#theme-palettes)) |

---

### Node Shapes

```
box       id  label="..." [theme=X] [width=N] [height=N]
circle    id  label="..."
diamond   id  label="..."
hexagon   id  label="..."
triangle  id  label="..."
cylinder  id  label="..."
parallelogram id label="..."
text      id  label="..."
image     id  label="..." url="https://..."
```

**Common properties:**

| Property | Example | Description |
|---|---|---|
| `label` | `label="API Gateway"` | Display text |
| `theme` | `theme=primary` | Named theme (defined with `theme` keyword) |
| `width` | `width=140` | Override auto-width in px |
| `height` | `height=55` | Override auto-height in px |
| `fill` | `fill="#e8f4ff"` | Background fill color |
| `stroke` | `stroke="#0044cc"` | Border color |
| `color` | `color="#003399"` | Text color |
| `font-size` | `font-size=12` | Label font size |

**Example:**
```
box gateway label="API Gateway" theme=warning width=150 height=55
circle user label="User" fill="#e8f4ff" stroke="#0044cc" color="#003399"
cylinder db label="PostgreSQL" theme=success width=140 height=65
```

---

### Edges

```
fromId  connector  toId  [label="..."]
```

**Connectors:**

| Connector | Arrow | Line |
|---|---|---|
| `->` | end | solid |
| `<-` | start | solid |
| `<->` | both | solid |
| `-->` | end | dashed |
| `<-->` | both | dashed |
| `--` | none | solid |
| `---` | none | dashed |

**Example:**
```
client  --> gateway  label="HTTPS"
gateway <-> auth     label="verify"
db      --- replica  label="sync"
a       ---          b
```

---

### Groups

Groups are containers that arrange children using a flexbox-style layout.

```
group id [label="..."] [layout=row|column|grid] [gap=N] [padding=N]
      [justify=start|center|end|space-between|space-around]
      [align=start|center|end]
      [columns=N]
      [width=N] [height=N]
      [theme=X]
{
  box  child1 label="..."
  box  child2 label="..."
  group nested { ... }
}
```

**Properties:**

| Property | Default | Description |
|---|---|---|
| `layout` | `column` | `row`, `column`, or `grid` |
| `gap` | `10` | Space between children in px |
| `padding` | `26` | Inner padding in px |
| `justify` | `start` | Main-axis distribution of children |
| `align` | `start` | Cross-axis alignment of children |
| `columns` | `1` | Number of columns when `layout=grid` |
| `width` | auto | Minimum width — enables `justify` distribution |
| `height` | auto | Minimum height |
| `theme` | — | Named theme for border/background |

> **Note on `justify`:** Requires an explicit `width` larger than the children's total width to have visible effect. Without extra space, all five values look identical.

**Example:**
```
group services label="Microservices" layout=column gap=16 padding=30 theme=muted
{
  box auth    label="Auth Service"    theme=primary width=140 height=55
  box billing label="Billing Service" theme=primary width=140 height=55
}
```

**Grid layout:**
```
group icons layout=grid columns=3 gap=20 padding=24 width=400
{
  box a label="A"  width=100 height=60
  box b label="B"  width=100 height=60
  box c label="C"  width=100 height=60
  box d label="D"  width=100 height=60
}
```

**Justify example:**
```
group nav layout=row justify=space-between width=500 padding=20 gap=10
{
  box home  label="Home"    width=80 height=40
  box about label="About"   width=80 height=40
  box contact label="Contact" width=80 height=40
}
```

---

### Tables

```
table id [label="..."] [theme=X]
{
  header  Col1  Col2  Col3
  row     val1  val2  val3
  row     val4  val5  val6
}
```

**Example:**
```
table pricing label="Pricing Plans"
{
  header  Plan      Price   Requests
  row     Free      $0      1k/day
  row     Pro       $29     100k/day
  row     Enterprise  $299  Unlimited
}
```

---

### Notes

Single or multiline sticky notes.

```
note id label="Single line note" [theme=X]
note id label="Line one\nLine two\nLine three"
```

---

### Charts

```
bar-chart     id [title="..."] [width=N] [height=N] [theme=X]
line-chart    id ...
area-chart    id ...
pie-chart     id ...
donut-chart   id ...
scatter-chart id ...

data
[
  ["Label", "Series1", "Series2"],
  ["Jan",   120,       80       ],
  ["Feb",   150,       95       ],
  ["Mar",   130,       110      ]
]
```

**Pie / donut data format:**
```
pie-chart revenue title="Revenue Split"
data
[
  ["Product",  45],
  ["Services", 30],
  ["Support",  25]
]
```

**Scatter data format:**
```
scatter-chart perf title="Performance"
data
[
  ["headers", "x", "y"],
  ["Server A", 10, 95],
  ["Server B", 20, 87]
]
```

---

### Themes

Define reusable style presets with `theme`, then apply them to any node or group.

```
theme primary fill="#e8f4ff" stroke="#0044cc" color="#003399"
theme success fill="#e8ffe8" stroke="#007700" color="#004400"
theme warning fill="#fff9e6" stroke="#f0a500" color="#7a5000"
theme danger  fill="#ffe8e8" stroke="#cc0000" color="#900000"
theme muted   fill="#f5f5f5" stroke="#999999" color="#444444"
```

Apply: `box myNode label="..." theme=primary`

---

### Animation Steps

```
step  action  target  [options]
```

**Actions:**

| Action | Syntax | Description |
|---|---|---|
| `highlight` | `step highlight nodeId` | Pulsing glow on a node |
| `fade` | `step fade nodeId` | Fade node to 22% opacity |
| `unfade` | `step unfade nodeId` | Restore full opacity |
| `draw` | `step draw nodeId` | Animate node appearing (stroke-draw) |
| `draw` | `step draw a-->b` | Animate edge appearing |
| `erase` | `step erase nodeId` | Fade element to invisible |
| `show` | `step show nodeId` | Make hidden element visible |
| `hide` | `step hide nodeId` | Hide element |
| `pulse` | `step pulse nodeId` | Single brightness flash |
| `color` | `step color nodeId #ff0000` | Change fill color |
| `move` | `step move nodeId dx=50 dy=0` | Translate by dx/dy px |
| `scale` | `step scale nodeId factor=1.5` | Scale (absolute, 1.0 = normal) |
| `rotate` | `step rotate nodeId deg=45` | Rotate (cumulative degrees) |

**Options:**

| Option | Example | Description |
|---|---|---|
| `duration` | `duration=600` | Animation duration in ms |
| `dx` | `dx=100` | X offset for `move` |
| `dy` | `dy=-80` | Y offset for `move` |
| `factor` | `factor=1.5` | Scale multiplier for `scale` |
| `deg` | `deg=45` | Degrees for `rotate` (cumulative) |

**Notes on `move` / `scale` / `rotate`:**
- `move` is cumulative — `dx=50` twice = 100px total
- `scale` is absolute — `factor=1.5` always means 1.5×, `factor=1.0` resets to normal
- `rotate` is cumulative — `deg=45` twice = 90° total, `deg=-45` rotates back

---

## Layout System

### Root layout

Controls how top-level items (groups, standalone nodes) are arranged:

```
layout row     # left to right (default)
layout column  # top to bottom
layout grid    # grid, use config columns=N
```

### Group layout

Each group is an independent flex container:

```
group g layout=row justify=space-between width=500 gap=16 padding=20
```

### `justify` values

| Value | Effect |
|---|---|
| `start` | Pack children to the start (default) |
| `center` | Center children in the container |
| `end` | Pack children to the end |
| `space-between` | First at start, last at end, equal gaps between |
| `space-around` | Equal space around each child |

> Requires `width` wider than total child width to be visible.

### `align` values

| Value | Effect |
|---|---|
| `start` | Align to the start of the cross-axis (default) |
| `center` | Center on the cross-axis |
| `end` | Align to the end of the cross-axis |

---

## Animation System

The `AnimationController` is returned as `instance.anim` from `render()`.

```typescript
const instance = render({ container, dsl });
const { anim } = instance;

anim.next();              // advance one step
anim.prev();              // go back one step
anim.reset();             // return to initial state
anim.goTo(3);             // jump to specific step index
await anim.play(800);     // auto-play, 800ms per step

anim.currentStep          // current step index (-1 = not started)
anim.total                // total number of steps
anim.canNext              // boolean
anim.canPrev              // boolean

// listen to events
anim.on((event) => {
  // event.type: 'step-change' | 'animation-reset' |
  //             'animation-start' | 'animation-end' | 'step-complete'
  console.log(event.stepIndex, event.step);
});
```

**Slide-in entrance pattern:**
```
step move nodeId dx=0 dy=80      # push below final position
step draw nodeId                  # reveal at offset
step move nodeId dx=0 dy=-80     # animate into final position
```

**Wobble then fail pattern:**
```
step rotate nodeId deg=8
step rotate nodeId deg=-8
step rotate nodeId deg=8
step rotate nodeId deg=25        # cumulative = 33°, looks like toppling
step fade   nodeId
```

---

## Theme Palettes

Set a global palette with `config theme=NAME`. Available palettes:

| Name | Description |
|---|---|
| `light` | Warm parchment (default) |
| `dark` | Dark warm background |
| `ocean` | Cool blues |
| `forest` | Greens |
| `sunset` | Warm oranges and reds |
| `slate` | Cool grays |
| `rose` | Pinks and magentas |
| `midnight` | GitHub-dark style blues |

```
config theme=ocean
```

---

## API Reference

### `render(options): DiagramInstance`

One-call API. Parses DSL, builds scene, lays out, renders, and returns a controller.

```typescript
import { render } from 'sketchmark';

const instance = render({
  container:    '#my-div',        // CSS selector, HTMLElement, or SVGSVGElement
  dsl:          '...',            // DSL source text
  renderer:     'svg',            // 'svg' (default) | 'canvas'
  injectCSS:    true,             // inject animation CSS into <head>
  svgOptions: {
    showTitle:   true,
    interactive: true,            // hover effects + click handlers
    roughness:   1.3,
    bowing:      0.7,
    theme:       'light',         // 'light' | 'dark'
    onNodeClick: (nodeId) => {},
  },
  canvasOptions: {
    scale:       2,               // pixel density
    roughness:   1.3,
  },
  onNodeClick:  (nodeId) => {},
  onReady:      (anim, svg) => {},
});
```

**`DiagramInstance`:**

```typescript
instance.scene       // SceneGraph — all positioned nodes, edges, groups
instance.anim        // AnimationController
instance.svg         // SVGSVGElement (if renderer='svg')
instance.canvas      // HTMLCanvasElement (if renderer='canvas')
instance.update(dsl) // re-render with new DSL
instance.exportSVG() // download as SVG file
instance.exportPNG() // download as PNG file
```

---

### Pipeline API (low-level)

Use these if you need to control each step manually:

```typescript
import { parse, buildSceneGraph, layout, renderToSVG } from 'sketchmark';

const ast   = parse(dslString);        // DSL → AST
const scene = buildSceneGraph(ast);    // AST → SceneGraph
layout(scene);                         // compute x/y positions
const svg   = renderToSVG(scene, containerEl, options);
```

---

### `parse(dsl: string): DiagramAST`

Tokenizes and parses DSL source into an AST.
Throws `ParseError` with line/col information on invalid syntax.

```typescript
import { parse, ParseError } from 'sketchmark';

try {
  const ast = parse(dsl);
} catch (e) {
  if (e instanceof ParseError) {
    console.error(`Line ${e.line}, Col ${e.col}: ${e.message}`);
  }
}
```

---

### `buildSceneGraph(ast): SceneGraph`

Converts AST to a SceneGraph with unpositioned nodes and groups.

---

### `layout(scene): SceneGraph`

Computes x/y positions for all elements. Mutates and returns the SceneGraph.

---

### `renderToSVG(scene, container, options?): SVGSVGElement`

Renders scene to SVG using rough.js.

---

### `renderToCanvas(scene, canvas, options?): void`

Renders scene to an HTML Canvas element using rough.js.

---

## Export

```typescript
import { exportSVG, exportPNG, exportHTML, getSVGBlob } from 'sketchmark';

exportSVG(svgElement, { filename: 'diagram.svg' });
await exportPNG(svgElement, { filename: 'diagram.png', scale: 2 });
exportHTML(svgElement, dslSource, { filename: 'diagram.html' });

// Get blob without downloading
const blob = getSVGBlob(svgElement);
```

Or via the instance:
```typescript
instance.exportSVG('my-diagram.svg');
await instance.exportPNG('my-diagram.png');
```

---

## Examples

### Basic architecture diagram

```
diagram
title label="System Architecture"
layout row
config gap=60

theme primary fill="#e8f4ff" stroke="#0044cc" color="#003399"
theme success fill="#e8ffe8" stroke="#007700" color="#004400"
theme muted   fill="#f5f5f5" stroke="#999999" color="#444444"

box client  label="Client App"  theme=primary width=140 height=55
box gateway label="API Gateway" theme=muted   width=140 height=55

group services label="Services" layout=column gap=16 padding=30 theme=muted
{
  box auth  label="Auth Service" theme=primary width=130 height=50
  box data  label="Data Service" theme=primary width=130 height=50
}

cylinder db label="PostgreSQL" theme=success width=140 height=65

client  --> gateway label="HTTPS"
gateway --> auth
gateway --> data
auth    --> db label="SQL"
data    --> db label="SQL"

end
```

---

### Animated deployment

```
diagram
title label="Blue-Green Deployment"
layout row
config gap=50

theme primary fill="#e8f4ff" stroke="#0044cc" color="#003399"
theme success fill="#e8ffe8" stroke="#007700" color="#004400"
theme muted   fill="#f5f5f5" stroke="#999999" color="#444444"

box lb label="Load Balancer" theme=muted width=150 height=55

group blue label="Blue (live)" layout=column gap=16 padding=26 theme=primary
{
  box b1 label="API v1"    theme=primary width=120 height=50
  box b2 label="Worker v1" theme=primary width=120 height=50
}

group green label="Green (new)" layout=column gap=16 padding=26 theme=success
{
  box g1 label="API v2"    theme=success width=120 height=50
  box g2 label="Worker v2" theme=success width=120 height=50
}

lb --> b1 label="100%"
lb --> g1 label="0%"

step highlight lb
step draw lb-->b1
step highlight b1

# green slides in from below
step move g1 dx=0 dy=60
step move g2 dx=0 dy=60
step draw g1
step move g1 dx=0 dy=-60 duration=500
step draw g2
step move g2 dx=0 dy=-60 duration=500

# traffic shifts
step fade b1
step fade b2
step draw lb-->g1
step highlight g1

end
```

---

### Charts

```
diagram
layout row
config gap=40

bar-chart revenue title="Monthly Revenue" width=340 height=240
data
[
  ["Month", "2023", "2024"],
  ["Jan",   42000,  58000 ],
  ["Feb",   38000,  61000 ],
  ["Mar",   51000,  67000 ],
  ["Apr",   46000,  72000 ]
]

pie-chart share title="Market Share" width=280 height=240
data
[
  ["Product A", 42],
  ["Product B", 31],
  ["Product C", 27]
]

end
```

---

## License

MIT