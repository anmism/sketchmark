import type { ShapeDefinition } from "./types";
import { MAX_W } from "./types";
import { SHAPES } from "../../config";

export const diamondShape: ShapeDefinition = {
  size(n, labelW) {
    n.w = n.w || Math.max(SHAPES.diamond.minW, Math.min(MAX_W, labelW + SHAPES.diamond.labelPad));
    n.h = n.h || Math.max(SHAPES.diamond.minH, n.w * SHAPES.diamond.aspect);
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
