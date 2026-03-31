import type { ShapeDefinition } from "./types";
import { MAX_W } from "./types";
import { SHAPES } from "../../config";

export const triangleShape: ShapeDefinition = {
  size(n, labelW) {
    n.w = n.w || Math.max(SHAPES.triangle.minW, Math.min(MAX_W, labelW + SHAPES.triangle.labelPad));
    n.h = n.h || Math.max(SHAPES.triangle.minH, n.w * SHAPES.triangle.aspect);
  },
  renderSVG(rc, n, _palette, opts) {
    const cx = n.x + n.w / 2;
    return [rc.polygon([
      [cx, n.y + 3],
      [n.x + n.w - 3, n.y + n.h - 3],
      [n.x + 3, n.y + n.h - 3],
    ], opts)];
  },
  renderCanvas(rc, _ctx, n, _palette, opts) {
    const cx = n.x + n.w / 2;
    rc.polygon([
      [cx, n.y + 3],
      [n.x + n.w - 3, n.y + n.h - 3],
      [n.x + 3, n.y + n.h - 3],
    ], opts);
  },
};
