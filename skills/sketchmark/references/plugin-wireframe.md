# Wireframe Plugin

Source of truth: `packages/plugin-wireframe/README.md`.

Use `@sketchmark/plugin-wireframe` for low-fidelity UI wireframes built from a small reusable primitive set.

## Supported Commands

- `wf.screen <id> [frame=browser|phone|plain] [items=[...]]`
- `wf.panel <id> [items=[...]]`
- `wf.text <id> [kind=heading|body|caption|label] [lines=<n>] [label="..."]`
- `wf.media <id> [kind=image|avatar|icon]`
- `wf.control <id> [kind=button|input|textarea|select|checkbox|radio]`
- `wf.divider <id> [orientation=horizontal|vertical] [label="..."]`

## Notes

- `wf.screen` and `wf.panel` are visible containers
- `wf.text` can render placeholder bars if no label is given
- `wf.control` stays generic on purpose
- `checkbox` and `radio` labels are laid out as compact inline rows
- Works with normal Sketchmark layouts and absolute positioning
