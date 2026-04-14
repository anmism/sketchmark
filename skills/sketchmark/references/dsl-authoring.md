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
diagram layout=row gap=60 margin=40 theme=ocean font=caveat pointer=chalk tts=on
title label="My System"
```

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

- Does every referenced node or group ID exist?
- Are any DSL lines indented?
- Are labels with spaces quoted?
- Are table row cells double-quoted?
- Are `x` and `y` only used inside absolute layout?
- If animation is present, is the example using SVG?
