import type { ShapeDefinition } from "./types";
import { MIN_W, MAX_W } from "./types";
import { SHAPES } from "../../config";

export const parallelogramShape: ShapeDefinition = {
  size(n, labelW) {
    const w = n.w || Math.max(MIN_W, Math.min(MAX_W, labelW + SHAPES.parallelogram.labelPad));
    n.w = w;
    if (!n.h) {
      if (labelW + SHAPES.parallelogram.labelPad > w) {
        const fontSize = Number(n.style?.fontSize ?? 14);
        const lines = Math.ceil(labelW / (w - SHAPES.parallelogram.labelPad));
        n.h = Math.max(SHAPES.parallelogram.defaultH, lines * fontSize * 1.5 + 20);
      } else {
        n.h = SHAPES.parallelogram.defaultH;
      }
    }
  },
  renderSVG(rc, n, _palette, opts) {
    return [rc.polygon([
      [n.x + SHAPES.parallelogram.skew, n.y + 1], [n.x + n.w - 1, n.y + 1],
      [n.x + n.w - SHAPES.parallelogram.skew, n.y + n.h - 1], [n.x + 1, n.y + n.h - 1],
    ], opts)];
  },
  renderCanvas(rc, _ctx, n, _palette, opts) {
    rc.polygon([
      [n.x + SHAPES.parallelogram.skew, n.y + 1], [n.x + n.w - 1, n.y + 1],
      [n.x + n.w - SHAPES.parallelogram.skew, n.y + n.h - 1], [n.x + 1, n.y + n.h - 1],
    ], opts);
  },
};
