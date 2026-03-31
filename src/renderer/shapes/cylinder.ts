import type { ShapeDefinition } from "./types";
import { MIN_W, MAX_W } from "./types";
import { SHAPES } from "../../config";

export const cylinderShape: ShapeDefinition = {
  size(n, labelW) {
    n.w = n.w || Math.max(MIN_W, Math.min(MAX_W, labelW));
    n.h = n.h || SHAPES.cylinder.defaultH;
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
