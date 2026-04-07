# @sketchmark/plugin-anchors

Named edge anchors for Sketchmark.

This plugin keeps the syntax friendly by rewriting endpoint refs like `a@right --> b@left` into ordinary Sketchmark edges with anchor metadata. The core renderer still only sees normal edges.

## Install

```bash
npm install sketchmark @sketchmark/plugin-anchors
```

## Usage

```ts
import { render } from "sketchmark";
import { anchors } from "@sketchmark/plugin-anchors";

render({
  container: document.getElementById("diagram")!,
  dsl: `
diagram
layout row
config gap=48

box app label="App"
box api label="API"
box db label="DB"

app@right --> api@left label="request"
api@bottom --> db@top label="query"
end
`.trim(),
  plugins: [anchors()],
});
```

## Supported Anchors

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

- The plugin rewrites only edge definition lines, not `step draw a-->b` targets.
- It ignores content inside triple-quoted blocks.
- You can still write `anchor-from=...` and `anchor-to=...` manually if you prefer.
