import type { ShapeDefinition } from "./types";
import { MIN_W, MAX_W, SVG_NS } from "./types";

export const imageShape: ShapeDefinition = {
  size(n, labelW) {
    const w = n.w || Math.max(MIN_W, Math.min(MAX_W, labelW));
    n.w = w;
    if (!n.h) {
      if (labelW > w) {
        const fontSize = Number(n.style?.fontSize ?? 14);
        const lines = Math.ceil(labelW / (w - 16));
        n.h = Math.max(52, lines * fontSize * 1.5 + 20);
      } else {
        n.h = 52;
      }
    }
  },

  renderSVG(rc, n, _palette, opts) {
    const s = n.style ?? {};
    if (n.imageUrl) {
      const imgLabelSpace = n.label ? 20 : 0;
      const imgAreaH = n.h - imgLabelSpace;

      const img = document.createElementNS(SVG_NS, "image") as SVGImageElement;
      img.setAttribute("href", n.imageUrl);
      img.setAttribute("x", String(n.x + 1));
      img.setAttribute("y", String(n.y + 1));
      img.setAttribute("width", String(n.w - 2));
      img.setAttribute("height", String(imgAreaH - 2));
      img.setAttribute("preserveAspectRatio", "xMidYMid meet");

      const clipId = `clip-${n.id}`;
      const defs = document.createElementNS(SVG_NS, "defs");
      const clip = document.createElementNS(SVG_NS, "clipPath");
      clip.setAttribute("id", clipId);
      const rect = document.createElementNS(SVG_NS, "rect") as SVGRectElement;
      rect.setAttribute("x", String(n.x + 1));
      rect.setAttribute("y", String(n.y + 1));
      rect.setAttribute("width", String(n.w - 2));
      rect.setAttribute("height", String(imgAreaH - 2));
      rect.setAttribute("rx", "6");
      clip.appendChild(rect);
      defs.appendChild(clip);
      img.setAttribute("clip-path", `url(#${clipId})`);

      const els: SVGElement[] = [defs as unknown as SVGElement, img];
      if (s.stroke) {
        els.push(rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: "none" }));
      }
      return els;
    }
    return [rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: "#e0e0e0", stroke: "#999999" })];
  },

  renderCanvas(rc, ctx, n, _palette, opts) {
    const s = n.style ?? {};
    if (n.imageUrl) {
      const imgLblSpace = n.label ? 20 : 0;
      const imgAreaH = n.h - imgLblSpace;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.save();
        ctx.beginPath();
        const r = 6;
        ctx.moveTo(n.x + r, n.y);
        ctx.lineTo(n.x + n.w - r, n.y);
        ctx.quadraticCurveTo(n.x + n.w, n.y, n.x + n.w, n.y + r);
        ctx.lineTo(n.x + n.w, n.y + imgAreaH - r);
        ctx.quadraticCurveTo(n.x + n.w, n.y + imgAreaH, n.x + n.w - r, n.y + imgAreaH);
        ctx.lineTo(n.x + r, n.y + imgAreaH);
        ctx.quadraticCurveTo(n.x, n.y + imgAreaH, n.x, n.y + imgAreaH - r);
        ctx.lineTo(n.x, n.y + r);
        ctx.quadraticCurveTo(n.x, n.y, n.x + r, n.y);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, n.x + 1, n.y + 1, n.w - 2, imgAreaH - 2);
        ctx.restore();
        if (s.stroke) {
          rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: "none" });
        }
      };
      img.src = n.imageUrl;
    } else {
      rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: "#e0e0e0", stroke: "#999999" });
    }
  },
};
