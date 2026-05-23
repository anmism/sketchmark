# Node Test Examples

These scripts exercise Sketchmark from plain Node.js.

Run from the package root:

```bash
npm run build
node examples/node-tests/make-all.cjs
```

Generated files are written to `examples/node-tests/generated/`.

Scripts:

- `01-basic-2d.cjs`: direct 2D primitives.
- `02-animated-follow-2d.cjs`: animation, `circle.follow`, and animated point references.
- `03-builder-flow-2d.cjs`: builder helpers that expand to primitives.
- `04-effects-image-mask-2d.cjs`: gradients, pattern paint, image crop, mask, and effects.
- `05-sequence-2d.cjs`: scenes, sequence clips, fade transitions, and timeline JSON.
- `06-structured-3d.cjs`: structured 3D primitives and Three HTML output.
- `07-deck.cjs`: deck scene with reveal steps and deck HTML output.
- `08-kernel-inspection.cjs`: authoring JSON lowered into the kernel.

