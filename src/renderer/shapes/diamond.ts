import type { ShapeDefinition } from "./types";
import { MAX_W } from "./types";
import { SHAPES } from "../../config";

export const diamondShape: ShapeDefinition = {
  size(n, labelW) {
    n.w = n.w || Math.max(SHAPES.diamond.minW, Math.min(MAX_W, labelW + SHAPES.diamond.labelPad));
    if (!n.h) {
      const baseH = Math.max(SHAPES.diamond.minH, n.w * SHAPES.diamond.aspect);
      const innerW = n.w * 0.45;
      if (labelW > innerW) {
        const fontSize = Number(n.style?.fontSize ?? 14);
        const lineH = fontSize * 1.5;
        const lines = Math.ceil(labelW / innerW);
        n.h = Math.max(baseH, lines * lineH + 30);
      } else {
        n.h = baseH;
      }
    }
  },
  renderSVG(rc, n, _palette, opts) {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const hw = n.w / 2 - 2;
    return [rc.polygon([[cx, n.y + 2], [cx + hw, cy], [cx, n.y + n.h - 2], [cx - hw, cy]], opts)];
  },
  renderCanvas(rc, _ctx, n, _palette, opts) {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const hw = n.w / 2 - 2;
    rc.polygon([[cx, n.y + 2], [cx + hw, cy], [cx, n.y + n.h - 2], [cx - hw, cy]], opts);
  },
};
