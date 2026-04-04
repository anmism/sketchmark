import type { ShapeDefinition } from "./types";
import { wrapText, measureTextWidth, buildFontStr } from "../../utils/text-measure";
import { DEFAULT_FONT } from "../../fonts";

export const textShape: ShapeDefinition = {
  size(n, _labelW) {
    const fontSize = Number(n.style?.fontSize ?? 13);
    const fontWeight = n.style?.fontWeight ?? 400;
    const fontFamily = String(n.style?.font ?? DEFAULT_FONT);
    const font = buildFontStr(fontSize, fontWeight, fontFamily);
    const pad = Number(n.style?.padding ?? 0) * 2;
    const lineHeight = fontSize * 1.5;

    if (n.width) {
      const lines = n.label.includes("\\n")
        ? n.label.split("\\n")
        : wrapText(n.label, Math.max(1, n.width - pad), fontSize, font);
      n.w = n.width;
      n.h = n.height ?? Math.max(24, lines.length * lineHeight + pad);
    } else {
      if (n.label.includes("\\n")) {
        const lines = n.label.split("\\n");
        let maxW = 0;
        for (const line of lines) {
          const w = measureTextWidth(line, font);
          if (w > maxW) maxW = w;
        }
        n.w = Math.ceil(maxW) + pad;
        n.h = n.height ?? Math.max(24, lines.length * lineHeight + pad);
      } else {
        const textW = measureTextWidth(n.label, font);
        n.w = Math.ceil(textW) + pad;
        n.h = n.height ?? Math.max(24, lineHeight + pad);
      }
    }
  },
  renderSVG(_rc, _n, _palette, _opts) {
    return []; // no shape drawn — text only
  },
  renderCanvas(_rc, _ctx, _n, _palette, _opts) {
    // no shape drawn — text only
  },
};
