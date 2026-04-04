import type { ShapeDefinition } from "./types";
import { MAX_W } from "./types";
import { SHAPES } from "../../config";

export const hexagonShape: ShapeDefinition = {
  size(n, labelW) {
    n.w = n.w || Math.max(SHAPES.hexagon.minW, Math.min(MAX_W, labelW + SHAPES.hexagon.labelPad));
    if (!n.h) {
      const baseH = Math.max(SHAPES.hexagon.minH, n.w * SHAPES.hexagon.aspect);
      const innerW = n.w * 0.55;
      if (labelW > innerW) {
        const fontSize = Number(n.style?.fontSize ?? 14);
        const lineH = fontSize * 1.5;
        const lines = Math.ceil(labelW / innerW);
        n.h = Math.max(baseH, lines * lineH + 20);
      } else {
        n.h = baseH;
      }
    }
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
