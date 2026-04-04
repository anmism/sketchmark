import type { ShapeDefinition } from "./types";
import { MAX_W } from "./types";

export const circleShape: ShapeDefinition = {
  size(n, labelW) {
    n.w = n.w || Math.max(84, Math.min(MAX_W, labelW));
    if (!n.h) {
      if (labelW > n.w) {
        const fontSize = Number(n.style?.fontSize ?? 14);
        const lineH = fontSize * 1.5;
        const innerW = n.w * 0.65;
        const lines = Math.ceil(labelW / innerW);
        n.h = Math.max(n.w, lines * lineH + 30);
      } else {
        n.h = n.w;
      }
    }
  },
  renderSVG(rc, n, _palette, opts) {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    return [rc.ellipse(cx, cy, n.w * 0.88, n.h * 0.88, opts)];
  },
  renderCanvas(rc, _ctx, n, _palette, opts) {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    rc.ellipse(cx, cy, n.w * 0.88, n.h * 0.88, opts);
  },
};
