import type { ShapeDefinition } from "./types";
import { SVG_NS } from "./types";
import { getBottomLabelContentHeight, getBottomLabelStripHeight } from "./label-strip";

export const iconShape: ShapeDefinition = {
  size(n, labelW) {
    const iconBase = 48;
    const labelH = getBottomLabelStripHeight(n);
    n.w = n.w || Math.max(iconBase, n.label ? labelW : 0);
    n.h = n.h || (iconBase + labelH);
  },

  renderSVG(rc, n, palette, opts) {
    const s = n.style ?? {};
    if (n.iconName) {
      const [prefix, name] = n.iconName.includes(":")
        ? n.iconName.split(":", 2)
        : ["mdi", n.iconName];
      const iconColor = s.color
        ? encodeURIComponent(String(s.color))
        : encodeURIComponent(String(palette.nodeStroke));
      const iconAreaH = getBottomLabelContentHeight(n);
      const iconSize = Math.min(n.w, iconAreaH) - 4;
      const iconUrl = `https://api.iconify.design/${prefix}/${name}.svg?color=${iconColor}&width=${iconSize}&height=${iconSize}`;

      const img = document.createElementNS(SVG_NS, "image") as SVGImageElement;
      img.setAttribute("href", iconUrl);
      const iconX = n.x + (n.w - iconSize) / 2;
      const iconY = n.y + (iconAreaH - iconSize) / 2;
      img.setAttribute("x", String(iconX));
      img.setAttribute("y", String(iconY));
      img.setAttribute("width", String(iconSize));
      img.setAttribute("height", String(iconSize));
      img.setAttribute("preserveAspectRatio", "xMidYMid meet");
      if (s.opacity != null) img.setAttribute("opacity", String(s.opacity));

      const clipId = `clip-${n.id}`;
      const defs = document.createElementNS(SVG_NS, "defs");
      const clip = document.createElementNS(SVG_NS, "clipPath");
      clip.setAttribute("id", clipId);
      const rect = document.createElementNS(SVG_NS, "rect") as SVGRectElement;
      rect.setAttribute("x", String(iconX));
      rect.setAttribute("y", String(iconY));
      rect.setAttribute("width", String(iconSize));
      rect.setAttribute("height", String(iconSize));
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

  renderCanvas(rc, ctx, n, palette, opts) {
    const s = n.style ?? {};
    if (n.iconName) {
      const [prefix, name] = n.iconName.includes(":")
        ? n.iconName.split(":", 2)
        : ["mdi", n.iconName];
      const iconColor = s.color
        ? encodeURIComponent(String(s.color))
        : encodeURIComponent(String(palette.nodeStroke));
      const iconAreaH = getBottomLabelContentHeight(n);
      const iconSize = Math.min(n.w, iconAreaH) - 4;
      const iconUrl = `https://api.iconify.design/${prefix}/${name}.svg?color=${iconColor}&width=${iconSize}&height=${iconSize}`;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.save();
        if (s.opacity != null) ctx.globalAlpha = Number(s.opacity);
        const iconX = n.x + (n.w - iconSize) / 2;
        const iconY = n.y + (iconAreaH - iconSize) / 2;
        ctx.beginPath();
        const r = 6;
        ctx.moveTo(iconX + r, iconY);
        ctx.lineTo(iconX + iconSize - r, iconY);
        ctx.quadraticCurveTo(iconX + iconSize, iconY, iconX + iconSize, iconY + r);
        ctx.lineTo(iconX + iconSize, iconY + iconSize - r);
        ctx.quadraticCurveTo(iconX + iconSize, iconY + iconSize, iconX + iconSize - r, iconY + iconSize);
        ctx.lineTo(iconX + r, iconY + iconSize);
        ctx.quadraticCurveTo(iconX, iconY + iconSize, iconX, iconY + iconSize - r);
        ctx.lineTo(iconX, iconY + r);
        ctx.quadraticCurveTo(iconX, iconY, iconX + r, iconY);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
        ctx.restore();
        if (s.stroke) {
          rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: "none" });
        }
      };
      img.src = iconUrl;
    } else {
      rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, { ...opts, fill: "#e0e0e0", stroke: "#999999" });
    }
  },
};
