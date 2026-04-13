# @sketchmark/plugin-wireframe

Primitive UI wireframes for Sketchmark.

This plugin keeps the mental model small by compiling a handful of `wf.*` commands into ordinary Sketchmark groups, text, lines, boxes, and circles. It focuses on reusable primitives, not prebuilt app components.

## Install

```bash
npm install sketchmark @sketchmark/plugin-wireframe
```

## Usage

```ts
import { render } from "sketchmark";
import { wireframe } from "@sketchmark/plugin-wireframe";

render({
  container: document.getElementById("diagram")!,
  dsl: `
diagram layout=row gap=28

wf.screen mobile frame=phone width=390 height=640 items=[hero,form]
wf.panel hero label="Hero" items=[cover,title,body,cta] width=300 height=300
wf.media cover kind=image width=260 height=120
wf.text title kind=heading lines=2 width=220
wf.text body kind=body lines=3 width=240
wf.control cta kind=button label="Continue" width=140

wf.panel form label="Sign In" items=[email,password,remember,submit] width=300 height=240
wf.control email kind=input placeholder="Email"
wf.control password kind=input placeholder="Password"
wf.control remember kind=checkbox label="Remember me"
wf.control submit kind=button label="Sign In"
end
`.trim(),
  plugins: [wireframe()],
});
```

## Supported Commands

- `wf.screen <id> [frame=browser|phone|plain] [items=[...]]`
- `wf.panel <id> [items=[...]]`
- `wf.text <id> [kind=heading|body|caption|label] [lines=<n>] [label="..."]`
- `wf.media <id> [kind=image|avatar|icon]`
- `wf.control <id> [kind=button|input|textarea|select|checkbox|radio]`
- `wf.divider <id> [orientation=horizontal|vertical] [label="..."]`

## Notes

- `wf.screen` and `wf.panel` are visible group containers.
- `wf.text` can render authored text, or placeholder bars when no `label` is given.
- `wf.control` stays generic on purpose so compounds like navbars, forms, and cards can be built from a small primitive set.
- `wf.control kind=checkbox|radio` now auto-sizes short labels more tightly and lays them out as compact top-aligned inline rows; use `text-width=` when you want a wider label area.
- The plugin works with normal Sketchmark layouts and absolute positioning.
