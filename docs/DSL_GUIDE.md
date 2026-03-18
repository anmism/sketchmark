# DSL Guide — sketchmark

## Design Goals

The DSL is optimised for LLM generation:
- **Minimal tokens** — no closing tags, no braces except groups
- **Deterministic** — same input always produces same diagram
- **Human-readable** — plain English keywords
- **Error-tolerant** — unknown lines are skipped, not fatal

## Shapes

| Shape | Description |
|---|---|
| `box` | Rectangle (default) |
| `circle` | Ellipse / circle |
| `diamond` | Decision / branching |
| `hexagon` | Process step |
| `triangle` | Direction indicator |
| `cylinder` | Database / storage |
| `parallelogram` | Input / output |
| `text` | Label only (no border) |

## Edge Connectors

| Syntax | Meaning |
|---|---|
| `A -> B` | One-way arrow |
| `A <-> B` | Bidirectional |
| `A --> B` | Dashed one-way |
| `A .-> B` | Dotted one-way |
| `A == B` | Thick / emphasis |

## Style Properties

| Property | Example |
|---|---|
| `fill` | `fill=#e8f4ff` |
| `stroke` | `stroke=#185FA5` |
| `color` | `color=#1a1208` (text) |
| `stroke-width` | `stroke-width=2` |
| `opacity` | `opacity=0.7` |
| `font-size` | `font-size=16` |

## Animation Actions

| Action | Effect |
|---|---|
| `highlight` | Glow + pulse on node |
| `draw` | Fade-in edge or node |
| `fade` | Reduce opacity to 22% |
| `unfade` | Restore full opacity |
| `show` / `hide` | Toggle visibility |
| `pulse` | Flash brightness 3× |
| `erase` | Fade out |
