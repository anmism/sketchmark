import type { ShapeDefinition } from "./types";
import { MIN_W, MAX_W } from "./types";
import { SHAPES } from "../../config";

export const cylinderShape: ShapeDefinition = {
  size(n, labelW) {
    const w = n.w || Math.max(MIN_W, Math.min(MAX_W, labelW));
    n.w = w;
    if (!n.h) {
      if (labelW > w) {
        const fontSize = Number(n.style?.fontSize ?? 14);
        const lines = Math.ceil(labelW / (w - 16));
        n.h = Math.max(SHAPES.cylinder.defaultH, lines * fontSize * 1.5 + 20);
      } else {
        n.h = SHAPES.cylinder.defaultH;
      }
    }
  },
  renderSVG(rc, n, _palette, opts) {
    const cx = n.x + n.w / 2;
    const eH = SHAPES.cylinder.ellipseH;
    return [
      rc.rectangle(n.x + 3, n.y + eH / 2, n.w - 6, n.h - eH, opts),
      rc.ellipse(cx, n.y + eH / 2, n.w - 8, eH, { ...opts, roughness: 0.6 }),
      rc.ellipse(cx, n.y + n.h - eH / 2, n.w - 8, eH, { ...opts, roughness: 0.6, fill: "none" }),
    ];
  },
  renderCanvas(rc, _ctx, n, _palette, opts) {
    const cx = n.x + n.w / 2;
    const eH = SHAPES.cylinder.ellipseH;
    rc.rectangle(n.x + 3, n.y + eH / 2, n.w - 6, n.h - eH, opts);
    rc.ellipse(cx, n.y + eH / 2, n.w - 8, eH, { ...opts, roughness: 0.6 });
    rc.ellipse(cx, n.y + n.h - eH / 2, n.w - 8, eH, { ...opts, roughness: 0.6, fill: "none" });
  },
};
