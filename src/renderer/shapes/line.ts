import type { ShapeDefinition } from "./types";
import { MIN_W } from "./types";

export const lineShape: ShapeDefinition = {
  size(n, labelW) {
    const labelH = n.label ? 20 : 0;
    n.w = n.width ?? Math.max(MIN_W, labelW + 20);
    n.h = n.height ?? (6 + labelH);
  },

  renderSVG(rc, n, _palette, opts) {
    const labelH = n.label ? 20 : 0;
    const lineY = n.y + (n.h - labelH) / 2;
    return [rc.line(n.x, lineY, n.x + n.w, lineY, opts)];
  },

  renderCanvas(rc, _ctx, n, _palette, opts) {
    const labelH = n.label ? 20 : 0;
    const lineY = n.y + (n.h - labelH) / 2;
    rc.line(n.x, lineY, n.x + n.w, lineY, opts);
  },
};
