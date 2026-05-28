# Sketchmark Packs

Packs are shareable collections of presets.

This milestone documents the pack contract only. Sketchmark does not load third-party packs yet.

## Folder Shape

```txt
my-pack/
  sketchmark-pack.json
  index.cjs
  presets/
```

## Manifest

```json
{
  "name": "my-pack",
  "version": "1.0.0",
  "sketchmark": ">=2.0.0",
  "presets": [
    {
      "id": "motions.float",
      "kind": "motion",
      "title": "Float"
    }
  ]
}
```

Fields:

- `name`: package name
- `version`: pack version
- `sketchmark`: compatible Sketchmark range
- `presets`: list of exported preset IDs

Preset `kind` should be one of:

- `shape`
- `character`
- `motion`
- `effect`
- `transition`
- `scene`

## Runtime Contract

`index.cjs` should export preset functions:

```js
module.exports = {
  presets: {
    "motions.float": function float({ id, start = 0, duration = 1 }) {
      return {
        timelines: {
          [id]: {
            position: {
              keyframes: [
                { time: start, value: [0, 0], out: { type: "cubicBezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
                { time: start + duration / 2, value: [0, -16], out: { type: "cubicBezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
                { time: start + duration, value: [0, 0] }
              ]
            }
          }
        }
      };
    }
  }
};
```

## Rules

- Packs are authoring code, not kernel schema.
- Pack presets must compile to pure `PresetFragment` objects.
- Pack output must validate as a normal Sketchmark kernel document after application.
- Trusted `.cjs` packs may execute local code. A safer declarative pack format can come later.
- Pack manifests should describe what exists; they should not be copied into `.visual.json`.
