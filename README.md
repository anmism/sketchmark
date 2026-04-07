# Sketchmark

> Hand-drawn, rough-style diagrams from a plain-text DSL. 
> Live examples: **https://sketchmark.dev/examples**

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Framework Setup](#framework-setup)
   - [Plain HTML (CDN)](#plain-html-cdn)
   - [Vite / Vanilla TS](#vite--vanilla-ts)
   - [Next.js (App Router)](#nextjs-app-router)
4. [DSL Syntax Overview](#dsl-syntax-overview)
5. [Nodes](#nodes)
   - [Shapes](#shapes)
   - [Node Properties](#node-properties)
6. [Edges (Connectors)](#edges-connectors)
7. [Groups](#groups)
8. [Tables](#tables)
9. [Charts](#charts)
10. [Markdown Blocks](#markdown-blocks)
11. [Themes](#themes)
12. [Fonts](#fonts)
13. [Animation System](#animation-system)
    - [Narration](#narration)
    - [Annotations](#annotations)
    - [Parallel Steps (Beat)](#parallel-steps-beat)
    - [Pace](#pace)
    - [Text-to-Speech](#text-to-speech)
    - [Pointer / Cursor](#pointer--cursor)
14. [Config Options](#config-options)
15. [Export](#export)
16. [Supported vs Unsupported Features](#supported-vs-unsupported-features)
17. [Full DSL Reference Table](#full-dsl-reference-table)
18. [Complete Example](#complete-example)

---

## Installation

```bash
npm install sketchmark
```

---

## Quick Start

```javascript
import { render } from 'sketchmark';

const dsl = `
diagram
box a label="Hello"
box b label="World"
a --> b label="greets"
end
`.trim();

const instance = render({
  container: document.getElementById('diagram'),
  dsl,
  renderer: 'svg',
  svgOptions: { showTitle: true, theme: 'light', transparent: true },
});
```

### Reusable UI Widgets

```javascript
import { SketchmarkCanvas, SketchmarkEditor } from 'sketchmark';

const editor = new SketchmarkEditor({
  container: document.getElementById('editor'),
  value: `
diagram
box app label="App"
box api label="API"
app --> api
end
`.trim(),
});

const canvas = new SketchmarkCanvas({
  container: document.getElementById('viewport'),
  showCaption: false,
  tts: true,
});

canvas.bindEditor(editor);
```

```javascript
import { SketchmarkEmbed } from 'sketchmark';

const embed = new SketchmarkEmbed({
  container: document.getElementById('article-embed'),
  dsl,
  width: 960,
  height: 540,
  playStepDelay: 700,
  showCaption: false,
  tts: true,
  fitPadding: 24,
  zoomMin: 0.08,
  zoomMax: 4,
});
```

Use `SketchmarkCanvas` for the full playground-style surface, and `SketchmarkEmbed` for fixed-size embeds that clip overflow, auto-fit large diagrams, and expose built-in zoom, playback, caption, and TTS controls.

---

## Framework Setup

### Plain HTML (CDN)

```html
<!DOCTYPE html>
<html>
<body>
  <div id="diagram"></div>

  <script type="module">
    import { render } from 'https://unpkg.com/sketchmark/dist/index.js';

    const dsl = `
diagram
box a label="Client"
box b label="Server"
a --> b label="HTTP"
end
`.trim();

    const instance = render({
      container: document.getElementById('diagram'),
      dsl,
      renderer: 'svg',
      svgOptions: { showTitle: true, interactive: true, theme: 'light', transparent: true },
    });

    // Animation controls
    const { anim } = instance;
    document.getElementById('btn-next').addEventListener('click', () => anim.next());
    document.getElementById('btn-play').addEventListener('click', () => anim.play(700));
  </script>
</body>
</html>
```

---

### Vite / Vanilla TS

**`src/main.ts`**:

```typescript
import { render } from 'sketchmark';


const dsl = `
diagram
title label="My Architecture"
layout row
config gap=60

box client  label="Client App"   width=140 height=55
box server  label="API Server"   width=140 height=55
cylinder db label="PostgreSQL"   width=140 height=65

client --> server label="HTTPS"
server --> db     label="SQL"

step highlight client
step draw client-->server
step highlight server
step draw server-->db
end
`.trim();

const instance = render({
  container: document.getElementById('diagram') as HTMLElement,
  dsl,
  renderer: 'svg',
  svgOptions: { showTitle: true, interactive: true, theme: 'light', transparent: true },
});

const { anim } = instance;
// Wire up buttons
document.getElementById('btn-next')!.addEventListener('click', () => { anim.next(); });
document.getElementById('btn-play')!.addEventListener('click', async () => { await anim.play(700); });
document.getElementById('btn-reset')!.addEventListener('click', () => { anim.reset(); });
```

---

### Next.js (App Router)

Three rules that **must** all be followed:

**Rule 1 — Component must be `'use client'`**:

```tsx
// src/components/SketchmarkDiagram.tsx
'use client';

import { useEffect, useRef } from 'react';
import { render } from 'sketchmark';

interface Props {
  dsl: string;
  showTitle?: boolean;
  showControls?: boolean;
  theme?: 'light' | 'dark';
}

export default function SketchmarkDiagram({ dsl, showTitle = true, theme = 'light' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = '';
    render({
      container: el,
      dsl,
      renderer: 'svg',
      svgOptions: { showTitle, theme, transparent: true, interactive: true },
    });
  }, [dsl, showTitle, theme]);

  return <div ref={containerRef} />;
}
```

**Rule 3 — DSL strings must never have leading whitespace**:

```typescript
// ✅ Correct — use .trim()
const dsl = `
diagram
box a label="Hello"
box b label="World"
a --> b
end
`.trim();

// ❌ Wrong — leading spaces break the parser
const dsl = `
  diagram
  box a label="Hello"
`.trim();
```
---

## DSL Syntax Overview

Every diagram follows this structure:

```
diagram
[title label="My Title"]
[layout row|column|grid|absolute]
[config key=value ...]
[theme name fill="..." stroke="..." color="..."]

[nodes, edges, groups, tables, charts, markdown blocks]

[step action target ...]
end
```

When `layout=absolute`, authored elements use `x`/`y` coordinates instead of flow layout:

```
diagram
layout absolute
box start  x=40  y=60  label="Start"
box finish x=240 y=140 label="Finish"
start --> finish
end
```

- Lines starting with `#` or `//` are comments.
- All key-value attributes use the `key=value` or `key="quoted value"` syntax.
- The DSL is **whitespace-sensitive** — do not indent lines.

---

## Nodes

### Shapes

Every node has the form:
```
<shape> <id> [label="..."] [property=value ...]
```

| Shape | DSL Keyword | Description | Auto-sizes to |
|-------|-------------|-------------|---------------|
| Box (default) | `box` | Rectangle | label width |
| Circle | `circle` | Ellipse | label width |
| Diamond | `diamond` | Rhombus (decision) | label width + padding |
| Hexagon | `hexagon` | Six-sided polygon | label width + padding |
| Triangle | `triangle` | Triangle | label width + padding |
| Cylinder | `cylinder` | Database drum shape | label width, fixed height 66px |
| Parallelogram | `parallelogram` | Slanted rectangle | label width + skew |
| Text | `text` | Label only, no border | wraps to width |
| Image | `image` | URL-loaded image | label width |
| Icon | `icon` | Iconify icon | 48×48 + label |
| Line | `line` | Horizontal rule | label width |
| Path | `path` | Custom SVG path data | user-specified |
| Note | `note` | Sticky-note shape | line count × line height |

```
# Examples of each shape
box     myBox  label="A Box"        width=140 height=55
circle  myCirc label="A Circle"     width=100
diamond myDia  label="Decision?"    width=150
hexagon myHex  label="Process"
triangle myTri label="Start"
cylinder myDb  label="PostgreSQL"   height=65
parallelogram myPara label="I/O"
text    myTxt  label="Some prose"   width=300
image   myImg  label="Logo"         url="https://example.com/logo.png" width=120 height=60
icon    myIcon label="Settings"     name="mdi:cog"
line    myLine label="Section"      width=200
path    myPath value="M 0 0 L 50 50 L 100 0 Z" width=100 height=60
note    myNote label="Remember this!"
```

---

### Node Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `label` | string | Display text (required) | `label="Hello World"` |
| `width` | number | Override auto-width (px) | `width=140` |
| `height` | number | Override auto-height (px) | `height=55` |
| `x` | number | Authored X position when parent/root uses `layout=absolute` | `x=80` |
| `y` | number | Authored Y position when parent/root uses `layout=absolute` | `y=40` |
| `theme` | string | Named theme preset | `theme=primary` |
| `fill` | CSS color | Background fill color | `fill="#e8f4ff"` |
| `stroke` | CSS color | Border/outline color | `stroke="#0044cc"` |
| `stroke-width` | number | Border thickness | `stroke-width=2` |
| `color` | CSS color | Text color | `color="#003399"` |
| `opacity` | 0–1 | Element opacity | `opacity=0.5` |
| `font-size` | number | Text size in px | `font-size=16` |
| `font-weight` | number/string | Font weight | `font-weight=700` |
| `font` | string | Font name (see Fonts section) | `font=caveat` |
| `text-align` | left/center/right | Horizontal text alignment | `text-align=left` |
| `vertical-align` | top/middle/bottom | Vertical text alignment | `vertical-align=top` |
| `line-height` | number | Line height multiplier | `line-height=1.5` |
| `letter-spacing` | number | Letter spacing in px | `letter-spacing=2` |
| `padding` | number | Inner padding (px) | `padding=12` |
| `dash` | numbers | Stroke dash pattern | `dash="6,3"` |
| `url` | URL string | Image URL (for `image` shape) | `url="https://..."` |
| `name` | string | Iconify icon name (for `icon`) | `name="mdi:cog"` |
| `value` | string | SVG path data (for `path`) | `value="M 0 0 L 50 0"` |
| `deg` | number | Static rotation (degrees) | `deg=45` |
| `dx` | number | Static visual X translation after layout (px) | `dx=20` |
| `dy` | number | Static visual Y translation after layout (px) | `dy=-10` |
| `factor` | number | Static scale factor | `factor=1.2` |

---

## Edges (Connectors)

Edges connect two node/group IDs:

```
<from> <connector> <to> [label="..."] [style properties]
```

### Connector Syntax

| Connector | Direction | Dashed | Arrowhead |
|-----------|-----------|--------|-----------|
| `->` | Forward | No | Single end |
| `-->` | Forward | Yes | Single end |
| `<-` | Backward | No | Single start |
| `<--` | Backward | Yes | Single start |
| `<->` | Bidirectional | No | Both ends |
| `<-->` | Bidirectional | Yes | Both ends |
| `--` | None | No | No arrow |
| `---` | None | Yes | No arrow |

```
# Edge examples
a -> b
a --> b label="Async call"
a <-> b
a <--> b label="Sync"
a -- b                       # line, no arrow
a --- b                      # dashed line, no arrow

# With style overrides
a --> b label="HTTPS" stroke="#cc0000" stroke-width=2 color="#aa0000" font-size=10
```

### Edge Style Properties

| Property | Description |
|----------|-------------|
| `label` | Text label floating on the edge |
| `stroke` | Line color |
| `stroke-width` | Line thickness |
| `color` | Label text color |
| `font-size` | Label font size |
| `font` | Label font family |
| `letter-spacing` | Label letter spacing |

---

## Groups

Groups visually contain one or more nodes, tables, charts, markdown blocks,
or other groups by referencing their ids with `items=[...]`.

```
box a label="Node A"
box b label="Node B"
box c label="Node C"

group inner label="Inner Group" layout=row items=[c]
group outer label="Outer Group" layout=column items=[a,b,inner]
```

General form:

```
group <id> [label="..."] [layout=row|column|grid|absolute] [gap=N] [padding=N]
           [columns=N] [align=start|center|end]
           [justify=start|center|end|space-between|space-around]
           [theme=...] [fill="..."] [stroke="..."] [x=N] [y=N] [width=N] [height=N]
           [items=[id1,id2,...]]
```

- Groups are always declared at the top level.
- `items` order is the visual child order.
- Nested groups are created by referencing another group id from `items=[...]`.
- All authored nodes, groups, tables, charts, and markdown blocks must have explicit ids.

### Group Properties

| Property | Type | Description |
|----------|------|-------------|
| `label` | string | Group title (shown at top) |
| `layout` | row / column / grid / absolute | Child arrangement direction |
| `gap` | number | Space between children (px) |
| `padding` | number | Inner padding (px) |
| `columns` | number | Column count (for `layout=grid`) |
| `align` | start/center/end | Cross-axis alignment (align-items) |
| `justify` | start/center/end/space-between/space-around | Main-axis alignment |
| `x` | number | Authored X position when parent/root uses `layout=absolute` |
| `y` | number | Authored Y position when parent/root uses `layout=absolute` |
| `width` | number | Minimum width override |
| `height` | number | Minimum height override |
| `theme` | string | Named theme preset |
| `fill` | CSS color | Background color |
| `stroke` | CSS color | Border color |
| `stroke-width` | number | Border thickness |

For absolute groups, child `x`/`y` coordinates are relative to the group's inner content box.

#### `bare` keyword

`bare` is an alias for a group with no visible border or fill:

```
box a label="Floating A"
box b label="Floating B"
bare myContainer layout=row items=[a,b]
```

---

## Tables

```
table <id> [label="..."] [x=N] [y=N] [theme=...] [fill="..."] [stroke="..."]
{
  header Col1 Col2 Col3
  row    "Value A" "Value B" "Value C"
  row    "Value D" "Value E" "Value F"
}
```

- `header` rows get a shaded background and bold text.
- `row` rows use regular styling.
- `"value"` must use a double-quoted string literal. 
- Column widths auto-size to content.
- Tables support `fill`, `stroke`, `color`, `font-size`, `font`, `text-align`, `letter-spacing`, `theme`, `opacity` style props (same as nodes).
- Tables also accept `x` and `y` when the parent/root uses `layout=absolute`.

---

## Charts

```
<chart-type> <id> [label="Title"] [x=N] [y=N] [width=N] [height=N] [theme=...] [style props]
data
  [["Category", "Series1", "Series2"],
   ["Jan", 120, 80],
   ["Feb", 150, 90]]
```

### Chart Types

| DSL Keyword | Chart | Notes |
|-------------|-------|-------|
| `bar-chart` | Grouped bar chart | Multiple series supported |
| `line-chart` | Line chart | Multiple series supported |
| `area-chart` | Area/filled line chart | Multiple series supported |
| `pie-chart` | Pie chart | `["Label", value]` rows |
| `donut-chart` | Donut chart | Same data as pie |
| `scatter-chart` | Scatter plot | `["Label", x, y]` rows |

```
# Bar chart example
bar-chart sales label="Monthly Sales" width=400 height=280
data
  [["Month", "Revenue", "Cost"],
   ["Jan", 1200, 800],
   ["Feb", 1500, 900],
   ["Mar", 1100, 750]]

# Pie chart example
pie-chart share label="Market Share" width=300 height=240
data
  [["Company", "Share"],
   ["Alpha", 42],
   ["Beta", 31],
   ["Gamma", 27]]
```

Charts also accept `x` and `y` when the parent/root uses `layout=absolute`.

---

## Markdown Blocks

Renders inline rich text with headings and bold/italic:

```
markdown <id> [x=N] [y=N] [width=N] [height=N] [theme=...] [style props]
"""
# Heading 1
## Heading 2
### Heading 3

Normal paragraph with **bold** and *italic* text.

Another paragraph here.
"""
```

- Triple-quote `"""` delimiters for the content block.
- Supported formatting: `# H1`, `## H2`, `### H3`, `**bold**`, `*italic*`, blank lines.
- Style props: `color`, `font`, `font-size`, `text-align`, `padding`, `fill`, `stroke`, `opacity`, `letter-spacing`.
- Markdown blocks also accept `x` and `y` when the parent/root uses `layout=absolute`.

---

## Themes

### Global Palette Themes

Activate via `config theme=<name>` in the DSL.

| Theme Name | Description |
|------------|-------------|
| `light` | Warm parchment (default) |
| `dark` | Dark warm brown |
| `sketch` | Neutral grey pencil |
| `ocean` | Blue tones |
| `forest` | Green tones |
| `sunset` | Orange/red warm |
| `slate` | Cool blue-grey (like Tailwind) |
| `rose` | Pink/rose |
| `midnight` | GitHub dark-style |

```
# Activate in DSL
config theme=ocean

# Or pass as render option
render({ ..., svgOptions: { theme: 'dark' } });
# 'auto' follows system prefers-color-scheme
render({ ..., svgOptions: { theme: 'auto' } });
```

### Named Custom Themes (per-element)

Define a named theme and apply it to any element with `theme=<name>`:

```
theme primary fill="#e8f4ff" stroke="#0044cc" color="#003399"
theme success fill="#e8ffe8" stroke="#007700" color="#004400"
theme warning fill="#fff9e6" stroke="#f0a500" color="#7a5000"
theme muted   fill="#f5f5f5" stroke="#999999" color="#444444"

box client  label="Client"  theme=primary
box server  label="Server"  theme=warning
cylinder db label="DB"      theme=success
group services label="Services" theme=muted items=[client,server,db]
```

---

## Fonts

Set globally with `config font=<name>` or per-element with `font=<name>`.

| Font Name | Family | Type |
|-----------|--------|------|
| `caveat` | Caveat | Hand-drawn cursive |
| `handlee` | Handlee | Hand-drawn cursive |
| `indie-flower` | Indie Flower | Hand-drawn cursive |
| `patrick-hand` | Patrick Hand | Hand-drawn cursive |
| `dm-mono` | DM Mono | Monospace |
| `jetbrains` | JetBrains Mono | Monospace |
| `instrument` | Instrument Serif | Serif |
| `playfair` | Playfair Display | Serif |
| `system` | system-ui, sans-serif | System (default) |
| `mono` | Courier New | Monospace |
| `serif` | Georgia | Serif |

```
# Global font
config font=caveat

# Per-element font
box a label="Handwritten" font=caveat
box b label="Mono"        font=dm-mono
```

You can also pass any valid CSS font-family string directly.

---

## Animation System

### Step Syntax

```
step <action> <target> [options]
```

- `<target>` is a node/group/table/chart/markdown ID, or an edge in `from-->to` format.
- Steps play in sequence via `anim.next()` or `anim.play(msPerStep)`.

### Animation Actions

| Action | Target | Options | Description |
|--------|--------|---------|-------------|
| `highlight` | node/edge/group | — | Pulsing glow highlight (only one element at a time) |
| `draw` | node/edge/group/table/chart/markdown | `duration=N` | Animated reveal; drawing a group also reveals its subtree unless descendants have their own later draw step |
| `fade` | node/edge/group | — | Fade to 22% opacity |
| `unfade` | node/edge/group | — | Restore from fade |
| `erase` | node/edge/group | `duration=N` | Fade to invisible (opacity 0) |
| `show` | node/edge/group | `duration=N` | Fade to visible |
| `hide` | node/edge/group | `duration=N` | Fade to hidden |
| `pulse` | node/edge/group | `duration=N` | One-shot brightness pulse |
| `move` | node | `dx=N dy=N duration=N` | Translate by (dx, dy) px |
| `scale` | node | `factor=N duration=N` | Scale to factor (absolute) |
| `rotate` | node | `deg=N duration=N` | Rotate by deg (cumulative) |
| `color` | node/edge | `fill="#..."` or `color="#..."` | Change fill/stroke color |
| `narrate` | — | `"text"` | Show a caption with typing effect |
| `circle` | node | — | Draw a rough circle annotation around element |
| `underline` | node | — | Draw a rough underline below element |
| `crossout` | node | — | Draw rough diagonal cross-out lines |
| `bracket` | node node | — | Draw a rough curly brace spanning two elements |
| `tick` | node | — | Draw a tick mark  |
| `strikeoff` | node | — | Draw a strikeoff mark |
### Narration

Show captions like a teacher explaining on a blackboard. The caption appears as a floating bar at the bottom center of the viewport with a typing effect.

```
step narrate "Plants need sunlight to make food"
step narrate "This is the most important step" pace=slow
```

- Caption is rendered as a fixed-position `<div>` on `document.body` (independent of diagram pan/zoom).
- Access via `anim.captionElement` to reparent it anywhere.
- `SketchmarkCanvas` and `SketchmarkEmbed` support `showCaption: false` to hide the caption bar UI.
- Both widget UIs also include a built-in caption toggle button by default.
- Supports built-in browser text-to-speech (see [TTS](#text-to-speech)).

### Annotations

Hand-drawn annotation marks powered by rough.js. A clean guide path draws in first, then the rough sketch fades in. If `config pointer=chalk|dot|hand` is set, a pointer follows the annotation stroke.

```
step circle leaf           # circle around "leaf" node
step underline sun         # underline below "sun" node
step crossout wrong        # X through "wrong" node
step bracket sun leaf      # curly brace spanning "sun" and "leaf"
```

### Parallel Steps (Beat)

Fire multiple steps simultaneously with `beat { }`:

```
beat {
  step draw sun
  step draw co2
  step narrate "Both appear at once"
}
```

- All children fire at the same time.
- Playback waits for the longest child to finish before advancing.
- Beats can contain any step action including `narrate` and annotations.

### Pace

Control timing per step with `pace=slow|fast|pause`:

```
step draw sun pace=slow      # 2× slower
step draw leaf pace=fast     # 2× faster
step narrate "Key point" pace=pause   # extra 1.5s hold after step
```

| Pace | Effect |
|------|--------|
| `slow` | Duration × 2.0 |
| `fast` | Duration × 0.5 |
| `pause` | Adds 1500ms hold |

### Step Options

| Option | Description | Default |
|--------|-------------|---------|
| `duration=N` | Animation duration in ms | varies by type |
| `delay=N` | Delay before this step fires (ms) | 0 |
| `pace=slow\|fast\|pause` | Timing modifier | — |
| `dx=N` | X translation for `move` | 0 |
| `dy=N` | Y translation for `move` | 0 |
| `factor=N` | Scale factor for `scale` | 1 |
| `deg=N` | Rotation degrees for `rotate` | 0 |
| `fill="..."` | New color for `color` action | — |
| `color="..."` | Alias for fill in `color` action | — |

### Animation Examples

```
# Draw edges incrementally
step draw client-->server
step highlight server
step draw server-->db
step highlight db

# Narration with pacing
step narrate "The client sends a request" pace=slow
step draw client-->server
step narrate "The server processes it"

# Annotations
step circle server
step underline db
step bracket server db

# Parallel steps
beat {
  step draw sun
  step draw moon
}

# Move a node
step move myBox dx=100 dy=0 duration=500

# Scale up then back
step scale myBox factor=1.5 duration=300
step scale myBox factor=1   duration=300

# Rotate
step rotate myBox deg=45 duration=400

# Change color
step color myBox fill="#ff0000"

# Show/hide
step hide myBox duration=400
step show myBox duration=400

# Fade background nodes
step fade nodeA
step unfade nodeA

# Pulse a node
step pulse myBox duration=600

# Delay before a step
step highlight server delay=500
```

### JavaScript Animation API

```javascript
const { anim } = render({ ... });

// Properties
anim.total            // number of steps
anim.currentStep      // current step index (-1 = before start)
anim.canNext          // boolean
anim.canPrev          // boolean
anim.atEnd            // boolean
anim.captionElement   // HTMLDivElement | null — the narration caption element
anim.tts              // boolean — text-to-speech enabled/disabled

// Methods
anim.next()                // advance one step (returns bool)
anim.prev()                // go back one step (returns bool)
anim.reset()               // reset to before step 0
anim.goTo(index)           // jump to step N
await anim.play(700)       // play all remaining steps (700ms between)
anim.destroy()             // remove caption, annotations, pointer from DOM

// Toggle TTS programmatically
anim.tts = true;           // enable browser speech
anim.tts = false;          // disable (stops current speech)

// Reparent the narration caption to a custom container
myDiv.appendChild(anim.captionElement);

// UI widgets can suppress the visible caption bar
const embed = new SketchmarkEmbed({ container, dsl, showCaption: false });
embed.setCaptionVisible(true);

// Event listener
const unsub = anim.on((event) => {
  console.log(event.type);      // 'step-change' | 'animation-start' | 'animation-end' | 'animation-reset'
  console.log(event.stepIndex); // number
  console.log(event.step);      // ASTStepItem (ASTStep | ASTBeat)
  console.log(event.total);     // total steps
});
unsub(); // unsubscribe
```

### Text-to-Speech

Enable browser-native speech synthesis for narrate steps. You can drive it from the diagram config or from the JS API. If both are provided, the JS option wins. `SketchmarkCanvas` and `SketchmarkEmbed` also include a built-in TTS toggle button by default.

```
# In DSL
config tts=on
```

```javascript
// Direct render option
const instance = render({ container, dsl, tts: true });

// Widget options
const canvas = new SketchmarkCanvas({ container, dsl, tts: true });
const embed = new SketchmarkEmbed({ container, dsl, tts: true });

// Or toggle at runtime
anim.tts = true;
canvas.setTtsEnabled(false);
embed.setTtsEnabled(true);

// Custom TTS (e.g. ElevenLabs) via event listener
anim.tts = false; // disable built-in
anim.on((e) => {
  if (e.step?.kind === 'step' && e.step.action === 'narrate') {
    myTTSService.speak(e.step.value);
  }
});
```

Speech cancels automatically on `reset()`, `prev()`, `destroy()`, or when a new narrate step fires.

### Pointer / Cursor

Show a pointer that follows annotation strokes (circle, underline, crossout, bracket):

```
config pointer=chalk    # white dot with outline
config pointer=dot      # colored dot
config pointer=hand     # hand cursor
```

The pointer only appears during annotation steps — it follows the guide path as the annotation draws in, then fades out.

### Pre-hidden Elements (Draw Targets)

Any element targeted by a `step draw` action starts **hidden** and only appears when that step fires. Elements NOT targeted by `draw` are always visible.

For groups, this applies to the whole subtree:

- `step draw group1` pre-hides the group and all descendant nodes, nested groups, tables, charts, notes, and markdown blocks.
- When the group step fires, descendants without their own later `draw` step are revealed immediately.
- Descendants with an explicit later `draw` step stay hidden until that later step.
- Edges are still independent; a group draw does not automatically reveal connected edges.

For group targets, these actions also apply recursively to the same subtree:

- `fade` / `unfade`
- `show` / `hide`
- `erase`
- Edges still remain explicit for these actions too.

---

## Config Options

Set in DSL with `config key=value`:

| Key | Description | Default |
|-----|-------------|---------|
| `theme` | Global palette name | `light` |
| `font` | Global font name | `system` |
| `gap` | Space between root-level items (px) | `80` |
| `margin` | Canvas outer margin (px) | `60` |
| `columns` | Column count for `layout=grid` | `1` |
| `title-color` | Diagram title text color | palette default |
| `title-size` | Diagram title font size | `18` |
| `title-weight` | Diagram title font weight | `600` |
| `pointer` | Annotation pointer type | `none` |
| `tts` | Enable browser text-to-speech | `off` |

```
diagram
title label="My System"
layout row
config gap=60
config margin=40
config theme=ocean
config font=caveat
config pointer=chalk
config tts=on
config title-size=24
config title-color="#001f5b"
```

---

## Export

### From JavaScript API

```javascript
const instance = render({ ... });

// SVG file download
instance.exportSVG('my-diagram.svg');

// PNG file download
await instance.exportPNG('my-diagram.png');

// Advanced: get SVG string
import { getSVGString } from 'sketchmark';
const svgString = getSVGString(instance.svg);

// Advanced: get PNG data URL
import { svgToPNGDataURL } from 'sketchmark';
const dataUrl = await svgToPNGDataURL(instance.svg, { scale: 2, background: '#ffffff' });

// Self-contained HTML file
import { exportHTML } from 'sketchmark';
exportHTML(instance.svg, dslSource, { filename: 'diagram.html' });
```

### Export Options

| Option | Type | Description |
|--------|------|-------------|
| `filename` | string | Download filename |
| `scale` | number | PNG pixel density (default: 2 = @2x) |
| `background` | CSS color | PNG background color (default: `#f8f4ea`) |

### Available Export Functions

| Function | Output | Status |
|----------|--------|--------|
| `exportSVG(svg, opts)` | `.svg` file download | ✅ Stable |
| `exportPNG(svg, opts)` | `.png` file download | ✅ Stable |
| `exportHTML(svg, dsl, opts)` | Self-contained `.html` | ✅ Stable |
| `exportCanvasPNG(canvas, opts)` | `.png` from canvas renderer | ✅ Stable |
| `getSVGString(svg)` | SVG string | ✅ Stable |
| `getSVGBlob(svg)` | SVG Blob | ✅ Stable |
| `svgToPNGDataURL(svg, opts)` | PNG data URL string | ✅ Stable |
| `exportGIF(frames, opts)` | GIF (requires gifshot) | ⚠️ Stub only |
| `exportMP4(canvas, dur, opts)` | WebM via MediaRecorder | ⚠️ Stub only |

---

## Supported vs Unsupported Features

### Nodes

Nodes can also opt into authored absolute `x`/`y` positioning when their parent or the root diagram uses `layout=absolute`.

| Feature | Supported | Notes |
|---------|-----------|-------|
| box | ✅ | Default shape |
| circle | ✅ | |
| diamond | ✅ | |
| hexagon | ✅ | |
| triangle | ✅ | |
| cylinder | ✅ | |
| parallelogram | ✅ | |
| text | ✅ | Auto word-wraps |
| image (URL) | ✅ | Cross-origin images |
| icon (Iconify) | ✅ | Uses Iconify API |
| line | ✅ | Horizontal rule with label |
| path (SVG path data) | ✅ | Raw SVG `d` attribute |
| note | ✅ | Sticky-note shape |
| Multiline label (`\n`) | ✅ | Use `\n` in label strings |
| Per-node font override | ✅ | |
| Per-node opacity | ✅ | |
| Per-node static transform (deg/dx/dy/factor) | ✅ | Set at parse time |
| Rounded corners | ❌ | Not configurable |
| Custom SVG shapes | ❌ | Only `path` workaround |
| Rich text inside nodes | ❌ | Plain text only |

### Edges

| Feature | Supported | Notes |
|---------|-----------|-------|
| Single arrow `->` / `-->` | ✅ | |
| Reverse arrow `<-` / `<--` | ✅ | |
| Bidirectional `<->` / `<-->` | ✅ | |
| No arrow `--` / `---` | ✅ | |
| Dashed lines (`--`, `---`, `<-->`) | ✅ | |
| Edge labels | ✅ | |
| Edge color/stroke override | ✅ | |
| Self-loops | ❌ | |
| Curved/bezier edges | ❌ | Straight lines only |
| Waypoints / routing control | ❌ | Auto-routed |
| Multiple edges between same nodes | ✅ | Stack visually |
| Edge from/to groups | ✅ | Uses group center |

### Groups

Groups support `layout=absolute` in addition to flow layouts. In absolute groups, child `x`/`y` coordinates are measured from the group's inner content box.

| Feature | Supported | Notes |
|---------|-----------|-------|
| Nested groups | ✅ | Unlimited depth |
| Row / column / grid layout | ✅ | |
| justify-content variants | ✅ | start, center, end, space-between, space-around |
| align-items variants | ✅ | start, center, end |
| Fixed width/height | ✅ | Minimum size override |
| `bare` (invisible group) | ✅ | |
| Scrolling | ❌ | |

### Charts

| Feature | Supported | Notes |
|---------|-----------|-------|
| Bar chart (grouped) | ✅ | Multiple series |
| Line chart | ✅ | Multiple series |
| Area chart | ✅ | Multiple series |
| Pie chart | ✅ | |
| Donut chart | ✅ | |
| Scatter plot | ✅ | |
| Axes and tick labels | ✅ | Auto-generated Y axis |
| Legend | ✅ | Auto-generated |
| X-axis labels | ✅ | |
| Interactive tooltips | ❌ | |
| Stacked bars | ❌ | |
| Custom colors per series | ❌ | Uses built-in palette |
| Logarithmic scale | ❌ | |

### Animation

| Feature | Supported | Notes |
|---------|-----------|-------|
| highlight | ✅ | Pulsing glow |
| draw (nodes) | ✅ | Guide-path stroke reveal + text writing effect |
| draw (edges) | ✅ | Animated line draw |
| draw (groups) | ✅ | |
| draw (tables) | ✅ | |
| draw (charts) | ✅ | Fade-in |
| draw (markdown) | ✅ | Fade-in |
| fade / unfade | ✅ | |
| show / hide | ✅ | |
| erase | ✅ | |
| pulse | ✅ | |
| move | ✅ | CSS transform translate |
| scale | ✅ | CSS transform scale |
| rotate | ✅ | CSS transform rotate |
| color | ✅ | Dynamic fill/stroke color change |
| narrate | ✅ | Typing-effect captions |
| circle annotation | ✅ | Rough circle around element |
| underline annotation | ✅ | Rough underline below element |
| crossout annotation | ✅ | Rough X through element |
| bracket annotation | ✅ | Rough curly brace spanning two elements |
| pace (slow/fast/pause) | ✅ | Per-step timing control |
| parallel steps (beat) | ✅ | `beat { }` fires children simultaneously |
| pointer / cursor | ✅ | Follows annotation strokes (chalk/dot/hand) |
| text-to-speech | ✅ | Browser `speechSynthesis` API |
| text writing animation | ✅ | Left-to-right clipPath reveal on draw |
| delay per step | ✅ | `delay=N` ms |
| custom duration | ✅ | `duration=N` ms |
| Canvas renderer animation | ❌ | SVG renderer only |
| Click-triggered steps | ❌ | Parsed but not implemented |

### Export

| Feature | Supported |
|---------|-----------|
| SVG download | ✅ |
| PNG download (via canvas) | ✅ |
| HTML (self-contained) | ✅ |
| SVG string / Blob | ✅ |
| GIF | ❌ (stub) |
| MP4/WebM | ❌ (stub) |

---

## Full DSL Reference Table

| Keyword | Category | Example |
|---------|----------|---------|
| `diagram` | Structure | `diagram` |
| `end` | Structure | `end` |
| `title` | Meta | `title label="My Diagram"` |
| `description` | Meta | `description "Some text"` |
| `layout` | Meta | `layout row` / `layout column` / `layout grid` / `layout absolute` |
| `config` | Meta | `config gap=60` |
| `theme` | Styling | `theme primary fill="#e8f4ff" stroke="#0044cc" color="#003399"` |
| `style` | Styling | `style nodeId fill="#ff0" stroke="#000"` |
| `box` | Node | `box myId label="Label" width=120 height=50` |
| `circle` | Node | `circle myId label="Label"` |
| `diamond` | Node | `diamond myId label="Decision?"` |
| `hexagon` | Node | `hexagon myId label="Process"` |
| `triangle` | Node | `triangle myId label="Start"` |
| `cylinder` | Node | `cylinder myId label="DB" height=65` |
| `parallelogram` | Node | `parallelogram myId label="I/O"` |
| `text` | Node | `text myId label="Plain text" width=300` |
| `image` | Node | `image myId label="Logo" url="https://..."` |
| `icon` | Node | `icon myId label="Settings" name="mdi:cog"` |
| `line` | Node | `line myId label="Divider" width=400` |
| `path` | Node | `path myId value="M 0 0 L 100 0 L 50 80 Z"` |
| `note` | Node | `note myId label="Sticky note text"` |
| `->` | Edge | `a -> b label="call"` |
| `-->` | Edge | `a --> b` |
| `<-` | Edge | `a <- b` |
| `<--` | Edge | `a <-- b` |
| `<->` | Edge | `a <-> b` |
| `<-->` | Edge | `a <--> b` |
| `--` | Edge | `a -- b` |
| `---` | Edge | `a --- b` |
| `group` | Group | `group myGroup label="Services" layout=column items=[api,db]` |
| `bare` | Group | `bare myWrap layout=row items=[a,b]` |
| `table` | Table | `table myTable label="Users" { header Name Age }` |
| `bar-chart` | Chart | `bar-chart sales label="Sales" data [...]` |
| `line-chart` | Chart | `line-chart trend data [...]` |
| `pie-chart` | Chart | `pie-chart share data [...]` |
| `donut-chart` | Chart | `donut-chart share data [...]` |
| `scatter-chart` | Chart | `scatter-chart pts data [...]` |
| `area-chart` | Chart | `area-chart filled data [...]` |
| `markdown` | Markdown | `markdown md1 """ # Title ... """` |
| `step highlight` | Animation | `step highlight nodeId` |
| `step draw` | Animation | `step draw nodeId` / `step draw a-->b` |
| `step fade` | Animation | `step fade nodeId` |
| `step unfade` | Animation | `step unfade nodeId` |
| `step erase` | Animation | `step erase nodeId duration=400` |
| `step show` | Animation | `step show nodeId duration=300` |
| `step hide` | Animation | `step hide nodeId duration=300` |
| `step pulse` | Animation | `step pulse nodeId duration=500` |
| `step move` | Animation | `step move nodeId dx=100 dy=0 duration=400` |
| `step scale` | Animation | `step scale nodeId factor=1.5 duration=300` |
| `step rotate` | Animation | `step rotate nodeId deg=90 duration=400` |
| `step color` | Animation | `step color nodeId fill="#ff0000"` |
| `step narrate` | Animation | `step narrate "Caption text" pace=slow` |
| `step circle` | Animation | `step circle nodeId` |
| `step underline` | Animation | `step underline nodeId` |
| `step crossout` | Animation | `step crossout nodeId` |
| `step bracket` | Animation | `step bracket nodeId1 nodeId2` |
| `beat` | Animation | `beat { step draw a \n step draw b }` |
| `pace` | Animation | `step draw nodeId pace=slow\|fast\|pause` |

---

## Complete Example

This example demonstrates most features including narration, annotations, beats, pacing, and pointer:

```
diagram
title label="How the Internet Delivers a Webpage"
layout row
config gap=50
config pointer=chalk
config tts=on

# Define named themes
theme primary fill="#e8f4ff" stroke="#0044cc" color="#003399"
theme success fill="#e8ffe8" stroke="#007700" color="#004400"
theme warning fill="#fff9e6" stroke="#f0a500" color="#7a5000"
theme muted   fill="#f5f5f5" stroke="#999999" color="#444444"

box you     label="You"              theme=warning width=120 height=50
box browser label="Browser"          theme=primary width=120 height=50
box dns     label="DNS\nServer"      theme=muted   width=120 height=55
box server  label="Web\nServer"      theme=success width=120 height=55
box html    label="HTML\nCSS JS"     theme=primary width=120 height=55
box screen  label="Rendered\nPage"   theme=warning width=120 height=55

you     --> browser label="types URL"
browser --> dns     label="lookup"
dns     --> browser label="IP address"
browser --> server  label="request"
server  --> html    label="responds"
html    --> screen  label="renders"

# Animation with narration, annotations, beats, and pacing
step narrate "You type a website address into your browser" pace=slow
step draw you
step draw browser
step draw you-->browser
step underline you
step narrate "The browser asks a DNS server — the internet's phone book"
step draw dns
step draw browser-->dns
step circle dns
step narrate "DNS translates the domain name into an IP address"
step draw dns-->browser
step narrate "Now the browser knows WHERE to go" pace=slow
beat {
  step draw server
  step draw browser-->server
}
step narrate "It sends a request to the web server at that address"
step underline server
step narrate "The server responds with HTML, CSS, and JavaScript" pace=slow
beat {
  step draw html
  step draw server-->html
}
step circle html
step narrate "The browser assembles everything into the page you see"
step draw html-->screen
step draw screen pace=slow
step bracket html screen
step narrate "All of this happens in under a second!" pace=pause
end
```

---

## `render()` API Reference

```typescript
render(options: RenderOptions): DiagramInstance

interface RenderOptions {
  container:      string | HTMLElement | SVGSVGElement; // CSS selector or element
  dsl:            string;                               // DSL source text
  renderer?:      'svg' | 'canvas';                    // default: 'svg'
  injectCSS?:     boolean;                              // inject animation CSS (default: true)
  tts?:           boolean;                              // override diagram TTS config
  svgOptions?:    SVGRendererOptions;
  canvasOptions?: CanvasRendererOptions;
  onNodeClick?:   (nodeId: string) => void;            // click handler
  onReady?:       (anim, svg?) => void;                // callback after render
}

interface SVGRendererOptions {
  roughness?:    number;           // default 1.3
  bowing?:       number;           // default 0.7
  showTitle?:    boolean;          // show diagram title
  interactive?:  boolean;          // enable hover/click
  onNodeClick?:  (id: string) => void;
  theme?:        'light' | 'dark' | 'auto';
  transparent?:  boolean;          // transparent background
}

interface DiagramInstance {
  scene:     SceneGraph;
  anim:      AnimationController;
  svg?:      SVGSVGElement;
  canvas?:   HTMLCanvasElement;
  update:    (dsl: string) => DiagramInstance;  // re-render with new DSL
  exportSVG: (filename?: string) => void;
  exportPNG: (filename?: string) => Promise<void>;
}
```

---

## Important Gotchas

1. **DSL must not be indented** — every DSL line must start at column 0 (no leading spaces/tabs).
2. **Always call `.trim()`** on template literals to strip the leading newline from the opening backtick.
3. **Animation only works with SVG renderer** — the canvas renderer does not support animated steps.
4. **`step draw` makes elements start hidden** — any element you intend to `draw` will be invisible until its step fires.
5. **Node IDs must be unique** — duplicate IDs are silently deduplicated (only first definition kept).
6. **Group children inherit group's coordinate space** — edges can connect across group boundaries using the node/group ID directly.
