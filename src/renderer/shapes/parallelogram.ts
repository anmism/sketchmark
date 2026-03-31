import type { ShapeDefinition } from "./types";
import { MIN_W, MAX_W } from "./types";
import { SHAPES } from "../../config";

export const parallelogramShape: ShapeDefinition = {
  size(n, labelW) {
    n.w = n.w || Math.max(MIN_W, Math.min(MAX_W, labelW + SHAPES.parallelogram.labelPad));
    n.h = n.h || SHAPES.parallelogram.defaultH;
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
