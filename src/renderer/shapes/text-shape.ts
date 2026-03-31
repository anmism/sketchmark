import type { ShapeDefinition } from "./types";
import { MIN_W } from "./types";

export const textShape: ShapeDefinition = {
  size(n, _labelW) {
    const fontSize = Number(n.style?.fontSize ?? 13);
    const charWidth = fontSize * 0.55;
    const pad = Number(n.style?.padding ?? 8) * 2;

    if (n.width) {
      const approxLines = Math.ceil((n.label.length * charWidth) / (n.width - pad));
      n.w = n.width;
      n.h = n.height ?? Math.max(24, approxLines * fontSize * 1.5 + pad);
    } else {
      const lines = n.label.split("\\n");
      const longest = lines.reduce((a, b) => (a.length > b.length ? a : b), "");
      n.w = Math.max(MIN_W, Math.round(longest.length * charWidth + pad));
      n.h = n.height ?? Math.max(24, lines.length * fontSize * 1.5 + pad);
    }
  },
  renderSVG(_rc, _n, _palette, _opts) {
    return []; // no shape drawn — text only
  },
  renderCanvas(_rc, _ctx, _n, _palette, _opts) {
    // no shape drawn — text only
  },
};
