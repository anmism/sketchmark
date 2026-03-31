import type { ShapeDefinition } from "./types";
import { MAX_W } from "./types";
import { SHAPES } from "../../config";

export const hexagonShape: ShapeDefinition = {
  size(n, labelW) {
    n.w = n.w || Math.max(SHAPES.hexagon.minW, Math.min(MAX_W, labelW + SHAPES.hexagon.labelPad));
    n.h = n.h || Math.max(SHAPES.hexagon.minH, n.w * SHAPES.hexagon.aspect);
  },
  renderSVG(rc, n, _palette, opts) {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const hw = n.w / 2 - 2;
    const hw2 = hw * SHAPES.hexagon.inset;
    return [rc.polygon([
      [cx - hw2, n.y + 3], [cx + hw2, n.y + 3], [cx + hw, cy],
      [cx + hw2, n.y + n.h - 3], [cx - hw2, n.y + n.h - 3], [cx - hw, cy],
    ], opts)];
  },
  renderCanvas(rc, _ctx, n, _palette, opts) {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const hw = n.w / 2 - 2;
    const hw2 = hw * SHAPES.hexagon.inset;
    rc.polygon([
      [cx - hw2, n.y + 3], [cx + hw2, n.y + 3], [cx + hw, cy],
      [cx + hw2, n.y + n.h - 3], [cx - hw2, n.y + n.h - 3], [cx - hw, cy],
    ], opts);
  },
};
