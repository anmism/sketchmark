import type { ShapeDefinition, RoughOpts } from "./types";
import { SVG_NS } from "./types";
import { getPathIntrinsicSize, getRenderableNodePathData } from "./path-geometry";

export const pathShape: ShapeDefinition = {
  size(n, labelW) {
    const intrinsic = getPathIntrinsicSize(n.pathData);
    const w = n.width ?? Math.max(intrinsic.width, Math.min(300, labelW + 20));
    n.w = w;

    if (!n.h) {
      if (!n.width && !n.height && labelW + 20 > w) {
        const fontSize = Number(n.style?.fontSize ?? 14);
        const lines = Math.ceil(labelW / (w - 20));
        n.h = Math.max(intrinsic.height, lines * fontSize * 1.5 + 20);
      } else {
        n.h = n.height ?? intrinsic.height;
      }
    }
  },

  renderSVG(rc, n, _palette, opts) {
    const d = getRenderableNodePathData(n);
    if (!d) {
      return [rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts)];
    }

    const el = rc.path(d, opts);
    const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
    g.setAttribute("transform", `translate(${n.x},${n.y})`);
    g.appendChild(el);
    return [g as unknown as SVGElement];
  },

  renderCanvas(rc, ctx, n, _palette, opts) {
    const d = getRenderableNodePathData(n);
    if (!d) {
      rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts);
      return;
    }

    ctx.save();
    ctx.translate(n.x, n.y);
    rc.path(d, opts);
    ctx.restore();
  },
};
