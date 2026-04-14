# Notation Plugin

Source of truth: `packages/plugin-notation/package.json` and the main Sketchmark README.

Use `@sketchmark/plugin-notation` when labels or narration contain lightweight TeX-style math and should be converted into nicer Unicode text.

## Best Uses

- Math-heavy node labels
- Formula-rich `step narrate` captions
- Educational diagrams that need symbols without a full math renderer

## Typical Pattern

```ts
import { render } from "sketchmark";
import { notation } from "@sketchmark/plugin-notation";

render({
  container,
  dsl,
  plugins: [notation()],
});
```

## Notes

- The plugin converts lightweight TeX-style math into Unicode-oriented labels and narration
- Keep expectations modest: this is a lightweight notation helper, not a full LaTeX typesetter
