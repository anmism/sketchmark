# Circuit Plugin

Source of truth: `packages/plugin-circuit/README.md` and `packages/plugin-circuit/src/index.ts`.

Use `@sketchmark/plugin-circuit` for circuit and electronics diagrams instead of approximating them with plain boxes and arrows.

## Install And Import

```ts
import { render } from "sketchmark";
import { circuit } from "@sketchmark/plugin-circuit";
```

## Layout Rule

- Circuit commands are draw-first and live best in `diagram layout=absolute`
- If the diagram has no explicit layout yet, the plugin auto-inserts `layout=absolute`
- If the root diagram already declares a layout, it must be `layout=absolute`

## Supported Commands

- `ckt.comp <id> kind=<resistor|capacitor|inductor|diode|source|ground|switch> x=<n> y=<n> [label="..."] [value="..."] [orient=h|v] [label-dx=<n>] [label-dy=<n>]`
- `ckt.port <id> x=<n> y=<n> [label="..."] [side=left|right|top|bottom] [label-dx=<n>] [label-dy=<n>]`
- `ckt.junction <id> x=<n> y=<n> [label="..."] [label-dx=<n>] [label-dy=<n>]`
- `ckt.wire <id> from=<ref> to=<ref> [mode=straight|hv|vh|auto] [label="..."] [label-dx=<n>] [label-dy=<n>]`

## Supported Component Kinds

- `resistor`
- `capacitor`
- `inductor`
- `diode`
- `source`
- `ground`
- `switch`

## Reference Targets

Wire refs can target:

- Ports directly: `vin`
- Junctions directly: `j1`
- Component pins explicitly: `r1.left`, `r1.right`, `c1.top`, `c1.bottom`
- Diode polarity pins: `d1.anode`, `d1.cathode`

Important rule:

- Referencing a component by bare id like `from=r1` is invalid. Components require an explicit pin such as `r1.left`.

Common generated pins:

- All components expose `left`, `right`, `top`, `bottom`, and `center`
- `ground` also exposes `pin`
- `diode` also exposes `anode` and `cathode`

## Wire Routing

- `straight`: direct segment
- `hv`: horizontal then vertical
- `vh`: vertical then horizontal
- `auto`: chooses `straight`, `hv`, or `vh` from the endpoints

## Best Uses

- Kirchhoff's Current Law: use `ckt.junction` for the node where currents split or combine
- Kirchhoff's Voltage Law: use a closed loop with `source`, `resistor`, `capacitor`, or `inductor`
- RC, RL, RLC, diode, and simple switch circuits
- Teaching diagrams where labels and routing matter more than simulation

## Kirchhoff Example

```text
diagram layout=absolute
title label="Kirchhoff's Voltage Law"

ckt.comp src kind=source x=120 y=180 label="Vs"
ckt.comp r1 kind=resistor x=280 y=100 label="R1" value="2 ohm"
ckt.comp r2 kind=resistor x=440 y=180 label="R2" value="4 ohm"
ckt.comp gnd kind=ground x=120 y=300
ckt.junction j1 x=280 y=180 label="A"

ckt.wire w1 from=src.top to=r1.left mode=vh label="I"
ckt.wire w2 from=r1.right to=r2.top mode=hv
ckt.wire w3 from=r2.left to=j1 mode=straight
ckt.wire w4 from=j1 to=src.bottom mode=hv
ckt.wire w5 from=src.bottom to=gnd.pin mode=straight
end
```

For formula-heavy teaching diagrams, combine with `@sketchmark/plugin-notation`.

## Limits

- No simulation or automatic circuit solving
- No validation of Kirchhoff equations by the plugin itself
- Draw-focused, not SPICE-like analysis
