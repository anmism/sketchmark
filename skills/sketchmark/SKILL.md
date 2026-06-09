---
name: sketchmark
description: Entry point for Sketchmark kernel, design, animation, and render/edit/preview guidance. Use when working with Sketchmark `.visual.json`, generators, validation, rendering, timelines, or previews.
---

# Sketchmark

Use the smallest file needed:

- `kernel.md`: valid document shape, element properties, paints, effects, timelines, curves, and animatable tracks.
- `design.md`: broad composition and static visual construction guidance.
- `animation.md`: broad timeline and motion guidance.
- `render.md`: validate, render, edit, preview, export, and debug workflow.

Keep `.visual.json` output pure kernel: `version`, `canvas`, and `elements`.
When working inside this repository, prefer example generator scripts such as `examples/make-*.cjs` over hand-authoring only generated `.visual.json` files.
