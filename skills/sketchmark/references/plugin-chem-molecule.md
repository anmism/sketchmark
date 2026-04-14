# Chem Molecule Plugin

Source of truth: `packages/plugin-chem-molecule/README.md`.

Use `@sketchmark/plugin-chem-molecule` for lightweight molecule diagrams.

## Layout Rule

- Use `diagram layout=absolute`
- If no layout is declared, the plugin can auto-insert `layout=absolute`

## Supported Commands

- `chem.atom <id> x=<n> y=<n> [element=C] [label="..."] [charge=+]`
- `chem.bond <id> from=<ref> to=<ref> [order=1|2|3|single|double|triple]`
- `chem.ring <id> x=<n> y=<n> [kind=benzene|hexagon|pentagon] [sides=<n>] [radius=<n>] [aromatic=true] [order=alternating] [labels=[...]]`
- `chem.label <id> target=<ref> text="..." [side=top|right|bottom|left|center]`

## Notes

- `chem.atom` uses `x` and `y` as the atom center
- `chem.bond` supports atom refs and ring refs like `ring1.center` or `ring1.v1`
- No valence validation, auto-layout, or reaction solving
