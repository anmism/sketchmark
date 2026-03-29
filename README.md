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
  - [Icons](#icon-shape)
  - [Edges](#edges)
  - [Groups](#groups)
  - [Bare Groups](#bare-groups)
  - [Tables](#tables)
  - [Notes](#notes)
  - [Charts](#charts)
  - [Markdown Blocks](#markdown-blocks)
  - [Themes](#themes)
  - [Style Directive](#style-directive)
  - [Typography](#typography)
  - [Animation Steps](#animation-steps)
- [Layout System](#layout-system)
- [Animation System](#animation-system)
- [Theme Palettes](#theme-palettes)
- [Font System](#font-system)
- [API Reference](#api-reference)
- [Export](#export)
- [Examples](#examples)

---

## Installation

```bash
npm install sketchmark
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
  svgOptions: { showTitle: true, interactive: true, transparent: true },
});

// Step through animation
instance.anim.next();
instance.anim.play(800);
```

**CDN / no bundler with import map:**

```html


{ "imports": { "sketchmark": "https://unpkg.com/sketchmark/dist/index.js" } }


  import { render } from 'sketchmark';
  render({
    container: document.getElementById('diagram'),
    dsl: `diagram\nbox a label="Hello"\nbox b label="World"\na --> b`,
  });

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
| `description` | `description "A brief summary"` | Diagram description (metadata) |
| `layout` | `layout row` | Root layout direction: `row`, `column`, `grid` |
| `config gap` | `config gap=60` | Gap between root-level items (default: 80) |
| `config margin` | `config margin=40` | Outer canvas margin (default: 60) |
| `config theme` | `config theme=ocean` | Global palette (see [Theme Palettes](#theme-palettes)) |
| `config font` | `config font=caveat` | Diagram-wide font (see [Font System](#font-system)) |
| `config title-color` | `config title-color=#333` | Title text color |
| `config title-size` | `config title-size=20` | Title font size in px |
| `config title-weight` | `config title-weight=700` | Title font weight |

---

### Node Shapes

```
box           id  label="..." [theme=X] [width=N] [height=N]
circle        id  label="..."
diamond       id  label="..."
hexagon       id  label="..."
triangle      id  label="..."
cylinder      id  label="..."
parallelogram id  label="..."
text          id  label="..."
image         id  label="..." url="https://..."
icon          id  label="..." name="prefix:name"
```

**Common properties:**

| Property | Example | Description |
|---|---|---|
| `label` | `label="API Gateway"` | Display text. Use `\n` for line breaks |
| `theme` | `theme=primary` | Named theme |
| `width` | `width=140` | Override auto-width in px |
| `height` | `height=55` | Override auto-height in px |
| `fill` | `fill="#e8f4ff"` | Background fill color |
| `stroke` | `stroke="#0044cc"` | Border color |
| `stroke-width` | `stroke-width=2` | Border thickness in px |
| `stroke-dash` | `stroke-dash=5,3` | Dashed border pattern (dash, gap) |
| `opacity` | `opacity=0.5` | Element opacity (0 to 1) |
| `color` | `color="#003399"` | Text color |
| `font` | `font=caveat` | Font family or built-in name |
| `font-size` | `font-size=12` | Label font size in px |
| `font-weight` | `font-weight=600` | Font weight |
| `letter-spacing` | `letter-spacing=2` | Letter spacing in px |
| `text-align` | `text-align=left` | `left`, `center`, `right` |
| `vertical-align` | `vertical-align=top` | `top`, `middle`, `bottom` |
| `line-height` | `line-height=1.6` | Line height multiplier |

> **`text` shape:** No border or background. Long labels auto word-wrap. Use `width=` to control the wrap width.

> **`image` shape:** Renders an image clipped to a rounded rect. Requires `url=` property. Label renders below the image. Border only shown when `stroke=` is set.

> **`icon` shape:** Renders an icon from [Iconify](https://iconify.design/) (200,000+ open source icons). Requires `name=` property in `prefix:name` format (e.g. `mdi:database`). Defaults to `mdi` prefix if omitted. Use `color=` to tint the icon. Label renders below the icon. Border only shown when `stroke=` is set. Default size: 48x48.

**Example:**
```
box gateway label="API Gateway" theme=warning width=150 height=55
circle user label="User" fill="#e8f4ff" stroke="#0044cc" color="#003399"
cylinder db label="PostgreSQL" theme=success width=140 height=65
image logo label="Logo" url="https://example.com/logo.png" width=80 height=80
icon db label="Database" name="mdi:database" color="#1976D2"
icon cloud name="mdi:cloud" width=64 height=64
text caption label="This auto-wraps across multiple lines." width=300
```

---

### Icon Shape

Render any of 200,000+ open source vector icons from [Iconify](https://iconify.design/).

```
icon id [label="..."] name="prefix:name" [color="#hex"] [width=N] [height=N]
```

| Property | Example | Description |
|---|---|---|
| `name` | `name="mdi:database"` | Icon identifier in `prefix:name` format. Defaults to `mdi` prefix if omitted |
| `color` | `color="#1976D2"` | Icon tint color |
| `stroke` | `stroke="#333"` | Optional border (not shown by default) |
| `label` | `label="DB"` | Label shown below the icon (defaults to id) |
| `width` | `width=64` | Icon width (default: 48) |
| `height` | `height=64` | Icon height (default: 48) |

Browse available icons at [icon-sets.iconify.design](https://icon-sets.iconify.design/). Common prefixes: `mdi` (Material Design), `lucide`, `heroicons`, `tabler`, `ph` (Phosphor), `ri` (Remix), `carbon`.

**Example:**
```
icon db    label="Database"  name="mdi:database"       color="#1976D2"
icon cloud label="Cloud"     name="mdi:cloud-outline"  color="#FF9800" width=64 height=64
icon lock  name="mdi:lock"   color="#E53935"
icon user  name="lucide:user"
```

---

### Edges

```
fromId  connector  toId  [label="..."] [stroke="#color"] [stroke-width=N]
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

**Edge style properties:**

| Property | Description |
|---|---|
| `label` | Text label on the edge |
| `stroke` | Line and arrowhead color |
| `stroke-width` | Line thickness |
| `color` | Label text color |
| `font` | Label font |
| `font-size` | Label font size |
| `theme` | Apply a named theme to the edge |

**Example:**
```
client  --> gateway  label="HTTPS"
gateway <-> auth     label="verify"
a       --           b
db      ---          replica
api     --> db       stroke="#0044cc" stroke-width=2 theme=primary
```

---

### Groups

Groups are containers that arrange children using a flexbox-style layout.

```
group id [label="..."] [layout=row|column|grid] [gap=N] [padding=N]
      [justify=start|center|end|space-between|space-around]
      [align=start|center|end]
      [columns=N] [width=N] [height=N] [theme=X]
      [font=X] [font-size=N] [letter-spacing=N]
{
  ...children...
}
```

**Properties:**

| Property | Default | Description |
|---|---|---|
| `label` | — | Label at top-left. Omit or `""` for no label and no reserved space |
| `layout` | `column` | `row`, `column`, or `grid` |
| `gap` | `10` | Space between children in px |
| `padding` | `26` | Inner padding in px |
| `justify` | `start` | Main-axis distribution |
| `align` | `start` | Cross-axis alignment |
| `columns` | `1` | Columns when `layout=grid` |
| `width` | auto | Minimum width — enables `justify` |
| `height` | auto | Minimum height |
| `theme` | — | Named theme for border/background |

> **`justify`** requires an explicit `width` larger than total child width to have a visible effect.

**Example:**
```
group services label="Microservices" layout=column gap=16 padding=30 theme=muted
{
  box auth    label="Auth Service"    theme=primary width=140 height=55
  box billing label="Billing Service" theme=primary width=140 height=55
}
```

**Grid:**
```
group icons layout=grid columns=3 gap=20 padding=24
{
  box a label="A" width=100 height=60
  box b label="B" width=100 height=60
  box c label="C" width=100 height=60
}
```

**Space-between with explicit width:**
```
group nav layout=row justify=space-between width=500 padding=20 gap=10
{
  box home    label="Home"    width=80 height=40
  box about   label="About"   width=80 height=40
  box contact label="Contact" width=80 height=40
}
```

---

### Bare Groups

`bare` is a layout-only container — no label, no border, no background, no padding by default. All group layout properties apply.

```
bare id [layout=...] [gap=N] [padding=N] [justify=...] [align=...] [columns=N]
{
  ...children...
}
```

Any explicitly set style overrides the bare defaults:

```
# fully invisible layout container
bare page layout=row gap=60
{
  markdown intro width=340
  """
  # Title
  Some prose here.
  """

  group diagram layout=column gap=20 padding=30 theme=muted
  {
    box a label="A" theme=primary width=130 height=52
  }
}

# bare with a visible border
bare wrapper layout=row gap=20 stroke="#cccccc" padding=16
{
  box x label="X" width=100 height=50
  box y label="Y" width=100 height=50
}
```

---

### Tables

```
table id [label="..."] [theme=X] [font=X] [font-size=N] [text-align=left|center|right]
{
  header  Col1  Col2  Col3
  row     val1  val2  val3
}
```

**Example:**
```
table pricing label="Pricing Plans" font=dm-mono text-align=right
{
  header  Plan        Price   Requests
  row     Free        $0      1k/day
  row     Pro         $29     100k/day
  row     Enterprise  $299    Unlimited
}
```

---

### Notes

Sticky notes with a folded corner.

```
note id label="Single line" [theme=X]
note id label="Line one\nLine two\nLine three"
note id label="..." [width=N] [height=N]
         [font=X] [font-size=N] [letter-spacing=N]
         [text-align=left|center|right]
         [vertical-align=top|middle|bottom]
         [line-height=1.4]
```

**Example:**
```
note n1 label="Rate limited\nto 1000 req/s\nper tenant"
note n2 label="Postgres 16\nwith pg_vector" width=200 height=100 font-size=13
note n3 label="Centered" text-align=center vertical-align=middle width=180 height=80
```

---

### Charts

```
bar-chart     id [label="..."] [width=N] [height=N] [theme=X]
line-chart    id ...
area-chart    id ...
pie-chart     id ...
donut-chart   id ...
scatter-chart id ...

data
[
  ["Label", "Series1", "Series2"],
  ["Jan",   120,       80       ],
  ["Feb",   150,       95       ]
]
```

**Pie / donut:**
```
pie-chart revenue label="Revenue Split" width=280 height=240
data
[
  ["Product A", 42],
  ["Services",  30],
  ["Support",   25]
]
```

---

### Markdown Blocks

Prose content with Markdown-style formatting, rendered inside the diagram layout.

```
markdown id [width=N] [padding=N] [font=X]
            [text-align=left|center|right] [color=X]
"""
# Heading 1
## Heading 2
### Heading 3

Paragraph with **bold** and *italic* text.

Another paragraph.
"""
```

**Supported syntax:**

| Syntax | Result |
|---|---|
| `# text` | H1 heading |
| `## text` | H2 heading |
| `### text` | H3 heading |
| `**text**` | Bold |
| `*text*` | Italic |
| blank line | Vertical spacing |

**Example:**
```
bare page layout=row gap=60
{
  markdown intro width=320 font=caveat padding=0
  """
  # Sketchmark

  A text-based diagram DSL that renders
  **hand-drawn** SVG diagrams.

  ## Animation

  Every element supports *step-by-step*
  animation — **draw**, highlight, fade, move.
  """

  group diagram layout=column gap=20 padding=30 theme=muted
  {
    box parser label="Parser"   theme=primary width=130 height=52
    box scene  label="Scene"    theme=success width=130 height=52
  }
}

parser --> scene label="AST"

step draw intro
step highlight parser
step draw parser-->scene
step highlight scene
end
```

---

### Themes

Define reusable style presets and apply them to any element.

```
theme primary fill="#e8f4ff" stroke="#0044cc" color="#003399"
theme success fill="#e8ffe8" stroke="#007700" color="#004400"
theme warning fill="#fff9e6" stroke="#f0a500" color="#7a5000"
theme danger  fill="#ffe8e8" stroke="#cc0000" color="#900000"
theme muted   fill="#f5f5f5" stroke="#999999" color="#444444"
```

Apply to any element: `box a theme=primary`, `group g theme=muted`, `note n theme=warning`, `a --> b theme=danger`

---

### Style Directive

Apply styles to any element after it's defined, by targeting its id:

```
box a label="Hello"
style a fill="#ff0000" stroke="#cc0000" font-size=16
```

This merges with any existing styles on the element. Useful for separating layout from styling.

---

### Typography

Typography properties work on all text-bearing elements.

| Property | Applies to | Description |
|---|---|---|
| `font` | all | Font family or built-in name |
| `font-size` | all | Font size in px |
| `font-weight` | all | `400`, `500`, `600`, `700` |
| `letter-spacing` | all | Letter spacing in px |
| `text-align` | nodes, notes, table cells, markdown | `left`, `center`, `right` |
| `vertical-align` | nodes, notes | `top`, `middle`, `bottom` |
| `line-height` | nodes, notes, markdown | Multiplier e.g. `1.4` |

```
# diagram-wide font
config font=caveat

# per-element overrides
box title label="Heading"   font=playfair font-size=20 text-align=left
box body  label="Body text" font=system   vertical-align=top
note n    label="Annotation" font=caveat  font-size=13 line-height=1.6
```

---

### Animation Steps

```
step  action  target  [options]
```

All actions work on **all element types** — nodes, groups, tables, notes, charts, and edges.

**Actions:**

| Action | Syntax | Description |
|---|---|---|
| `highlight` | `step highlight id` | Pulsing glow |
| `fade` | `step fade id` | Fade to 22% opacity |
| `unfade` | `step unfade id` | Restore full opacity |
| `draw` | `step draw id` | Stroke-draw reveal |
| `draw` | `step draw a-->b` | Animate edge in |
| `erase` | `step erase id` | Fade to invisible |
| `show` | `step show id` | Make hidden element visible |
| `hide` | `step hide id` | Hide element |
| `pulse` | `step pulse id` | Single brightness flash |
| `color` | `step color id fill="#ff0000"` | Change fill color |
| `move` | `step move id dx=50 dy=0` | Translate by dx/dy px |
| `scale` | `step scale id factor=1.5` | Scale (absolute) |
| `rotate` | `step rotate id deg=45` | Rotate (cumulative) |

**Options:**

| Option | Description |
|---|---|
| `duration=600` | Animation duration in ms |
| `delay=100` | Delay before animation starts in ms |
| `dx=100` | X offset for `move` |
| `dy=-80` | Y offset for `move` |
| `factor=1.5` | Scale multiplier |
| `deg=45` | Rotation degrees |

**Behaviour:**
- `move` — cumulative. `dx=50` twice = 100px total
- `scale` — absolute. `factor=1.0` always resets to normal
- `rotate` — cumulative. `deg=-45` rotates back
- `color` — use `fill=` syntax: `step color id fill="#ff0000"`

**Slide-in entrance:**
```
step move id dx=0 dy=80        # snap below final position
step draw id                    # reveal at offset
step move id dx=0 dy=-80       # animate up into place
```

**Wobble-and-fail:**
```
step rotate id deg=8
step rotate id deg=-8
step rotate id deg=8
step rotate id deg=25           # cumulative = 33°
step fade   id
```

**Edge animations:**
```
step highlight a-->b
step color     a-->b fill="#ff0000"
step fade      a-->b
step move      a-->b dx=0 dy=-20 duration=400
```

---

## Layout System

### Root layout

```
layout row       # items flow left to right (default)
layout column    # items flow top to bottom
layout grid      # grid — set columns with: config columns=N
```

### Group layout

Each group is an independent flex container:

```
group g layout=row justify=space-between width=500 gap=16 padding=20
```

### `justify` values

| Value | Effect |
|---|---|
| `start` | Pack to start (default) |
| `center` | Center in container |
| `end` | Pack to end |
| `space-between` | First at start, last at end, equal gaps between |
| `space-around` | Equal space around each child |

### `align` values

| Value | Effect |
|---|---|
| `start` | Cross-axis start (default) |
| `center` | Cross-axis center |
| `end` | Cross-axis end |

---

## Animation System

```typescript
const { anim } = render({ container, dsl });

anim.next();              // advance one step
anim.prev();              // go back one step
anim.reset();             // return to initial state
anim.goTo(3);             // jump to step index
await anim.play(800);     // auto-play, 800ms per step

anim.currentStep          // current index (-1 = not started)
anim.total                // total step count
anim.canNext              // boolean
anim.canPrev              // boolean

anim.on((event) => {
  // event.type: 'step-change' | 'animation-reset' |
  //             'animation-start' | 'animation-end' | 'step-complete'
});
```

---

## Theme Palettes

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
| `sketch` | Graphite pencil-on-paper |

```
config theme=sketch
```

List all palette names at runtime:

```typescript
import { THEME_NAMES } from 'sketchmark';
// ['light', 'dark', 'ocean', 'forest', 'sunset', 'slate', 'rose', 'midnight', 'sketch']
```

---

## Font System

### Built-in fonts

| Name | Style |
|---|---|
| `caveat` | Hand-drawn, casual |
| `handlee` | Hand-drawn, friendly |
| `indie-flower` | Hand-drawn, playful |
| `patrick-hand` | Hand-drawn, clean |
| `dm-mono` | Monospace, refined |
| `jetbrains` | Monospace, code-like |
| `instrument` | Serif, editorial |
| `playfair` | Serif, elegant |
| `system` | System UI sans-serif |
| `mono` | Courier New |
| `serif` | Georgia |

Built-in fonts load automatically from Google Fonts on first use.

```
config font=caveat              # diagram-wide

box a label="Hand-drawn" font=caveat
box b label="Code style"  font=dm-mono font-size=11
```

### Custom fonts

```typescript
import { registerFont } from 'sketchmark';

// font already loaded in the page via  or @import
registerFont('brand', '"Brand Sans", sans-serif');

// then use in DSL
// config font=brand
// box a font=brand
```

Or pass a full CSS family directly in DSL (must be quoted):

```
box a label="Hello" font="'Pacifico', cursive"
```

---

## API Reference

### `render(options): DiagramInstance`

```typescript
import { render } from 'sketchmark';

const instance = render({
  container:    '#my-div',
  dsl:          '...',
  renderer:     'svg',          // 'svg' (default) | 'canvas'
  injectCSS:    true,
  svgOptions: {
    showTitle:    true,
    interactive:  true,
    roughness:    1.3,
    bowing:       0.7,
    theme:        'light',      // 'light' | 'dark' | 'auto'
    transparent:  false,        // remove background rect
    onNodeClick:  (nodeId) => {},
  },
  canvasOptions: {
    scale:        2,
    roughness:    1.3,
    transparent:  false,
  },
  onNodeClick:  (nodeId) => {},
  onReady:      (anim, svg) => {},
});
```

`theme: 'auto'` follows OS `prefers-color-scheme`. `transparent: true` removes the background so the diagram floats over the page.

**`DiagramInstance`:**

```typescript
instance.scene       // SceneGraph
instance.anim        // AnimationController
instance.svg         // SVGSVGElement
instance.canvas      // HTMLCanvasElement
instance.update(dsl) // re-render with new DSL
instance.exportSVG() // download SVG
instance.exportPNG() // download PNG
```

---

### Pipeline API

```typescript
import { parse, buildSceneGraph, layout, renderToSVG } from 'sketchmark';

const ast   = parse(dslString);
const scene = buildSceneGraph(ast);
layout(scene);
const svg   = renderToSVG(scene, containerEl, options);
```

---

### `parse(dsl: string): DiagramAST`

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

## Export

```typescript
import { exportSVG, exportPNG, exportHTML, getSVGBlob } from 'sketchmark';

exportSVG(svgEl, { filename: 'diagram.svg' });
await exportPNG(svgEl, { filename: 'diagram.png', scale: 2 });
exportHTML(svgEl, dslSource, { filename: 'diagram.html' });

const blob = getSVGBlob(svgEl);
```

Via instance:

```typescript
instance.exportSVG('diagram.svg');
await instance.exportPNG('diagram.png');
```

---

## Examples

### Basic architecture

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
  box auth label="Auth Service" theme=primary width=130 height=50
  box data label="Data Service" theme=primary width=130 height=50
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
step move g1 dx=0 dy=60
step move g2 dx=0 dy=60
step draw g1
step move g1 dx=0 dy=-60 duration=500
step draw g2
step move g2 dx=0 dy=-60 duration=500
step fade b1
step fade b2
step draw lb-->g1
step highlight g1
end
```

---

### Markdown with diagram

```
diagram
layout row
config gap=60

theme primary fill="#e8f4ff" stroke="#0044cc" color="#003399"
theme success fill="#e8ffe8" stroke="#007700" color="#004400"
theme muted   fill="#f5f5f5" stroke="#999999" color="#444444"

bare page layout=row gap=60
{
  markdown intro width=320 font=caveat padding=0
  """
  # Sketchmark

  A text-based diagram DSL that renders
  **hand-drawn** SVG diagrams using rough.js.

  ## Animation

  Every element supports **step-by-step**
  animation — draw, highlight, fade, move.
  """

  group diagram layout=column gap=20 padding=30 theme=muted
  {
    box parser label="Parser"   theme=primary width=130 height=52
    box scene  label="Scene"    theme=success width=130 height=52
    box render label="Renderer" theme=muted   width=130 height=52
  }
}

parser --> scene  label="AST"
scene  --> render label="SceneGraph"

step draw intro
step highlight parser
step draw parser-->scene
step highlight scene
step draw scene-->render
step highlight render
end
```

---

### Charts

```
diagram
layout row
config gap=40

bar-chart revenue label="Monthly Revenue" width=340 height=240
data
[
  ["Month", "2023", "2024"],
  ["Jan",   42000,  58000 ],
  ["Feb",   38000,  61000 ],
  ["Mar",   51000,  67000 ],
  ["Apr",   46000,  72000 ]
]

pie-chart share label="Market Share" width=280 height=240
data
[
  ["Product A", 42],
  ["Product B", 31],
  ["Product C", 27]
]
end
```

---

### Sketch theme

```
diagram
title label="System Architecture"
config theme=sketch
config font=caveat
layout row
config gap=60

group root layout=row gap=60 padding=0
{
  box client  label="Client App"   width=140 height=55
  box gateway label="API Gateway"  width=140 height=55

  group services layout=column gap=16 padding=30
  {
    box auth    label="Auth Service"    width=140 height=55
    box billing label="Billing Service" width=140 height=55
  }

  cylinder db label="PostgreSQL" width=140 height=65
}

client  --> gateway label="HTTPS"
gateway --> auth
gateway --> billing
auth    --> db label="SQL"
billing --> db label="SQL"
end
```

---

## License

MIT