# @sketchmark/plugin-notation

Lightweight notation support for Sketchmark.

This first version keeps the core renderer lightweight by converting common TeX-style math into Unicode text that Sketchmark can already render inside labels and narration.

## Install

```bash
npm install sketchmark @sketchmark/plugin-notation
```

## Usage

```ts
import { render } from "sketchmark";
import { notation } from "@sketchmark/plugin-notation";

render({
  container: document.getElementById("diagram")!,
  dsl: `
diagram
title label="Right Triangle"
box eq label="$x^2 + y^2 = z^2$"
note hint label="$\\theta = 45^\\circ$"
step narrate "$\\sqrt{2} \\approx 1.414$"
end
`.trim(),
  plugins: [notation()],
});
```

## What v1 supports

- Inline math delimited by `$...$`
- Inline math delimited by `\\(...\\)`
- Common Greek letters and operators such as `\\alpha`, `\\theta`, `\\times`, `\\leq`, `\\rightarrow`
- Simple `^` superscripts and `_` subscripts
- `\\frac{a}{b}` and `\\sqrt{x}`
- Label and narration text transforms across nodes, edges, groups, tables, charts, titles, and `step narrate`

## What v1 does not do

- Full LaTeX layout or fraction stacking
- KaTeX/MathJax-quality typesetting
- Markdown math parsing by default

This package is meant to be a small first plugin package and a good foundation for richer notation later.
