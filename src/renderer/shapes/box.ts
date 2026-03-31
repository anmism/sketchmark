import type { ShapeDefinition } from "./types";
import { MIN_W, MAX_W } from "./types";

export const boxShape: ShapeDefinition = {
  size(n, labelW) {
    n.w = n.w || Math.max(MIN_W, Math.min(MAX_W, labelW));
    n.h = n.h || 52;
  },
  renderSVG(rc, n, _palette, opts) {
    return [rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts)];
  },
  renderCanvas(rc, _ctx, n, _palette, opts) {
    rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts);
  },
};
