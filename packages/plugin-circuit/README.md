# @sketchmark/plugin-circuit

Primitive circuit diagrams for Sketchmark.

This first release stays draw-focused. It compiles `ckt.*` commands into ordinary Sketchmark groups, `path` nodes, `circle` nodes, and `text` nodes, so the core renderer does not need circuit-specific logic.

## Install

```bash
npm install sketchmark @sketchmark/plugin-circuit
```

## Usage

```ts
import { render } from "sketchmark";
import { circuit } from "@sketchmark/plugin-circuit";

render({
  container: document.getElementById("diagram")!,
  dsl: `
diagram
ckt.port vin x=80 y=140 label="Vin"
ckt.comp r1 kind=resistor x=220 y=140 label="R1" value="10k"
ckt.comp c1 kind=capacitor x=380 y=140 orient=v label="C1" value="100n"
ckt.comp gnd kind=ground x=380 y=260
ckt.port vout x=520 y=140 label="Vout"

ckt.wire w1 from=vin to=r1.left
ckt.wire w2 from=r1.right to=vout
ckt.wire w3 from=r1.right to=c1.top
ckt.wire w4 from=c1.bottom to=gnd.top
end
`.trim(),
  plugins: [circuit()],
});
```

## Supported Commands

- `ckt.comp <id> kind=<resistor|capacitor|inductor|diode|source|ground|switch> x=<n> y=<n> [label="..."] [label-dx=<n>] [label-dy=<n>]`
- `ckt.port <id> x=<n> y=<n> [label="..."] [label-dx=<n>] [label-dy=<n>]`
- `ckt.junction <id> x=<n> y=<n> [label="..."] [label-dx=<n>] [label-dy=<n>]`
- `ckt.wire <id> from=<ref> to=<ref> [mode=straight|hv|vh|auto] [label="..."] [label-dx=<n>] [label-dy=<n>]`

## Notes

- `ckt.comp`, `ckt.port`, and `ckt.junction` use `x` / `y` as their center point in circuit space.
- The plugin auto-inserts `layout absolute` if the diagram does not declare a layout yet.
- If a diagram already declares a layout, it must be `layout absolute`.
- Wire refs can target ports and junctions directly, or component pins like `r1.left`, `r1.right`, `c1.top`, `c1.bottom`, or `d1.anode`.
- This version does not do validation, simulation, or automatic circuit solving.
