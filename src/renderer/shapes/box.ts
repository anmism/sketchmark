import type { ShapeDefinition } from "./types";
import { MIN_W, MAX_W } from "./types";

export const boxShape: ShapeDefinition = {
  size(n, labelW) {
    const w = n.w || Math.max(MIN_W, Math.min(MAX_W, labelW));
    n.w = w;
    if (!n.h) {
      // If label overflows width, estimate extra height for wrapped lines
      if (labelW > w) {
        const fontSize = Number(n.style?.fontSize ?? 14);
        const lineH = fontSize * 1.5;
        const lines = Math.ceil(labelW / (w - 16)); // 16px inner padding
        n.h = Math.max(52, lines * lineH + 20);
      } else {
        n.h = 52;
      }
    }
  },
  renderSVG(rc, n, _palette, opts) {
    return [rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts)];
  },
  renderCanvas(rc, _ctx, n, _palette, opts) {
    rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts);
  },
};
