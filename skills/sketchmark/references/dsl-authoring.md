# Sketchmark DSL Authoring

## Fast Checklist

- Begin with `diagram`
- End with `end`
- Keep every DSL line at column 0
- Use unique IDs
- Reference existing IDs in edges, groups, and steps
- Use `.trim()` on multiline template literals
- Use `renderer: 'svg'` if animation steps are present

## Diagram Root Properties

The opening `diagram` line can include top-level layout and presentation properties.

```text
diagram [layout=row|column|grid|absolute] [width=N] [height=N] [margin=N] [gap=N] [theme=name] [font=name] [pointer=type] [tts=true|false] [fill="..."] [stroke="..."] [stroke-width=N]
```

Common root properties:

- `layout`: `row`, `column`, `grid`, or `absolute`
- `gap`: space between root items
- `margin`: outer canvas margin
- `columns`: column count for grid layouts
- `theme`: built-in palette such as `light`, `dark`, `ocean`, `forest`, `sunset`, `slate`, `rose`, or `midnight`
- `font`: global font family or preset name
- `pointer`: annotation pointer type such as `chalk`, `dot`, or `hand`
- `tts`: enable narration speech

Example:

```text
diagram layout=row gap=60 margin=40 theme=ocean pointer=chalk tts=on
title label="My System"
```

## Core Shapes

Every node has the form:

```text
<shape> <id> [label="..."] [property=value ...]
```

Supported built-in shapes:

- `box`: rectangle
- `circle`: ellipse
- `diamond`: decision rhombus
- `hexagon`: six-sided polygon
- `triangle`: triangle
- `cylinder`: database drum shape
- `parallelogram`: slanted I/O shape
- `text`: label only, no border
- `image`: URL-loaded image
- `icon`: Iconify icon
- `line`: horizontal rule
- `path`: custom SVG path scaled into `width` and `height`
- `note`: sticky-note shape

Example:

```text
diagram layout=grid columns=3 gap=28
box a label="Box"
circle b label="Circle" width=100
diamond c label="Decision?"
hexagon d label="Hex"
triangle e label="Start"
cylinder f label="DB" height=65
parallelogram g label="I/O"
text h label="Plain text block" width=220
image i label="Logo" url="https://example.com/logo.png" width=120 height=64
icon j label="Settings" name="mdi:cog"
line k label="Section" width=160
path l value="M 0 0 L 50 50 L 100 0 Z" width=100 height=60
note m label="Remember this"
end
```

Common node properties:

- `label`, `width`, `height`
- `x`, `y` for absolute layout
- `theme`, `fill`, `stroke`, `stroke-width`, `color`, `opacity`
- `font-size`, `font-weight`, `font`, `text-align`, `vertical-align`, `line-height`, `letter-spacing`
- `padding`, `dash`
- `url` for `image`
- `name` for `icon`
- `value` for `path`
- `deg`, `dx`, `dy`, `factor` for static transforms

If the user wants something more illustrative than a box, try `image`, `icon`, or `path` before saying the core DSL cannot express it.

## Edges And Connectors

Edges connect node or group IDs:

```text
<from> <connector> <to> [label="..."] [style properties]
```

Supported connectors:

- `->`: forward
- `-->`: forward dashed
- `<-`: backward
- `<--`: backward dashed
- `<->`: bidirectional
- `<-->`: bidirectional dashed
- `--`: plain line
- `---`: dashed plain line

Example:

```text
diagram
box client label="Client"
box server label="Server"
client --> server label="HTTPS" stroke="#cc5500" stroke-width=2
end
```

Edge style properties:

- `label`
- `stroke`
- `stroke-width`
- `color`
- `font-size`
- `font`
- `letter-spacing`

## Core Patterns

### Basic diagram

```text
diagram
box a label="Hello"
box b label="World"
a --> b label="greets"
end
```

### Absolute layout

Use `x` and `y` only when the root or parent group uses `layout=absolute`.

```text
diagram layout=absolute
box start x=40 y=60 label="Start"
box endNode x=240 y=140 label="Finish"
start --> endNode
end
```

### Groups

```text
diagram
box api label="API"
box db label="DB"
group services label="Services" layout=row items=[api,db]
end
```

Group properties:

- `layout=row|column|grid|absolute`
- `gap`, `padding`, `columns`
- `align`, `justify`
- `theme`, `fill`, `stroke`, `stroke-width`
- `x`, `y`, `width`, `height`
- `items=[...]`

`bare` is an alias for a group with no visible border or fill.

## Rich Blocks

### Tables

```text
table stats label="Scores"
{
  header Name Score
  row "Ava" "9"
  row "Noah" "7"
}
```

Notes:

- Table row values use double-quoted strings.
- Tables support the usual style props such as `fill`, `stroke`, `color`, `font-size`, `font`, `text-align`, `letter-spacing`, `theme`, and `opacity`.

### Charts

Supported chart types:

- `bar-chart`
- `line-chart`
- `area-chart`
- `pie-chart`
- `donut-chart`
- `scatter-chart`

Example:

```text
bar-chart sales label="Monthly Sales" width=400 height=280
data
  [["Month", "Revenue"],
   ["Jan", 1200],
   ["Feb", 1500],
   ["Mar", 1100]]
```

### Markdown

```text
markdown explainer width=320
"""
# Energy

Heat moves from **hot** to *cold*.
"""
```

Markdown blocks support headings, bold, italic, blank lines, and the usual text styling props.


### Animation

```text
diagram
box client label="Client"
box server label="Server"
client --> server label="HTTPS"
step draw client
step draw server
step draw client-->server
step narrate "The client talks to the server"
end
```

Supported animation actions:

- `highlight`
- `draw`
- `fade`
- `unfade`
- `erase`
- `show`
- `hide`
- `pulse`
- `move`
- `scale`
- `rotate`
- `color`
- `narrate`
- `circle`
- `underline`
- `crossout`
- `bracket`
- `tick`
- `strikeoff`

Common step forms:

```text
step draw client
step draw client-->server
step highlight api
step fade backend
step show backend duration=400
step move client dx=80 dy=0 duration=500
step scale client factor=1.4 duration=300
step rotate client deg=30 duration=300
step color client fill="#ffcc66"
step narrate "Heat moves from hot to cold"
step circle server
step underline db
step crossout wrong
step bracket leftNode rightNode
step tick answer
step strikeoff draft
```

Useful step options:

- `duration=N`
- `delay=N`
- `pace=slow|fast|pause`
- `dx=N`
- `dy=N`
- `factor=N`
- `deg=N`
- `fill="..."`
- `color="..."`

Parallel steps are supported with `beat { ... }`:

```text
beat {
  step draw sun
  step draw moon
  step narrate "Both appear together"
}
```

## Animation Gotchas

- Any target used by `step draw` starts hidden before playback.
- `beat { ... }` runs child steps in parallel.
- `highlight`, `fade`, `show`, `hide`, and `erase` can target groups, but edges still stay explicit.
- `step draw groupId` reveals the group subtree, except descendants that have their own later draw step.

## Framework Notes

### Vanilla

- Call `render({ container, dsl, renderer: 'svg' })`.

### React or Next.js

- Render on the client.
- Mount into a real element reference.
- In Next.js App Router examples, include `'use client'`.

## Validation Checks

- If you claimed a primitive is unsupported, did you first check the core shapes, rich blocks, and plugins?
- Does every referenced node or group ID exist?
- Are any DSL lines indented?
- Are labels with spaces quoted?
- Are table row cells double-quoted?
- Are `x` and `y` only used inside absolute layout?
- If animation is present, is the example using SVG?
