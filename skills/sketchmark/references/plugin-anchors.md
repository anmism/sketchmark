# Anchors Plugin

Source of truth: `packages/plugin-anchors/README.md`.

Use `@sketchmark/plugin-anchors` when normal edges are correct but you need explicit attachment points.

## Syntax

Write edges like:

```text
app@right --> api@left label="request"
api@bottom --> db@top label="query"
```

Supported anchor names:

- `top`
- `right`
- `bottom`
- `left`
- `center`
- `top-left`
- `top-right`
- `bottom-left`
- `bottom-right`

## Notes

- The plugin rewrites only edge definition lines
- It does not rewrite `step draw a-->b` target strings
- You can still write `anchor-from=...` and `anchor-to=...` manually
