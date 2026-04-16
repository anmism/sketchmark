import type { ShapeDefinition } from "./types";
import { MIN_W } from "./types";
import { getBottomLabelStripHeight } from "./label-strip";

export const lineShape: ShapeDefinition = {
  size(n, labelW) {
    const labelH = getBottomLabelStripHeight(n);
    n.w = n.width ?? Math.max(MIN_W, labelW + 20);
    n.h = n.height ?? (6 + labelH);
  },

  renderSVG(rc, n, _palette, opts) {
    const labelH = getBottomLabelStripHeight(n);
    const lineY = n.y + (n.h - labelH) / 2;
    return [rc.line(n.x, lineY, n.x + n.w, lineY, opts)];
  },

  renderCanvas(rc, _ctx, n, _palette, opts) {
    const labelH = getBottomLabelStripHeight(n);
    const lineY = n.y + (n.h - labelH) / 2;
    rc.line(n.x, lineY, n.x + n.w, lineY, opts);
  },
};
