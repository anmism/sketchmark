# @sketchmark/plugin-chem-molecule

Primitive molecule diagrams for Sketchmark.

This first release stays draw-focused. It compiles `chem.*` commands into ordinary Sketchmark groups, `path` nodes, and `text` nodes, so the core renderer does not need chemistry-specific logic.

## Install

```bash
npm install sketchmark @sketchmark/plugin-chem-molecule
```

## Usage

```ts
import { render } from "sketchmark";
import { chemMolecule } from "@sketchmark/plugin-chem-molecule";

render({
  container: document.getElementById("diagram")!,
  dsl: `
diagram
chem.atom O x=120 y=150 element=O
chem.atom H1 x=70 y=220 element=H
chem.atom H2 x=170 y=220 element=H
chem.bond b1 from=O to=H1
chem.bond b2 from=O to=H2
chem.label water target=O side=top text="Water"
end
`.trim(),
  plugins: [chemMolecule()],
});
```

## Supported Commands

- `chem.atom <id> x=<n> y=<n> [element=C] [label="..."] [charge=+]`
- `chem.bond <id> from=<ref> to=<ref> [order=1|2|3|single|double|triple]`
- `chem.ring <id> x=<n> y=<n> [kind=benzene|hexagon|pentagon] [sides=<n>] [radius=<n>] [aromatic=true] [order=alternating] [labels=[...]]`
- `chem.label <id> target=<ref> text="..." [side=top|right|bottom|left|center]`

## Notes

- `chem.atom` uses `x` / `y` as the atom center and renders text labels by default.
- `chem.bond` supports atom refs directly and ring refs like `ring1.center` or `ring1.v1`.
- The plugin auto-inserts `layout absolute` if the diagram does not declare a layout yet.
- If a diagram already declares a layout, it must be `layout absolute`.
- This version does not do valence validation, automatic molecule layout, or reaction solving.
