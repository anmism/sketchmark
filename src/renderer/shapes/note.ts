import type { ShapeDefinition } from "./types";
import { SVG_NS } from "./types";
import { hashStr } from "../shared";
import { measureTextWidth, buildFontStr } from "../../utils/text-measure";
import { NOTE } from "../../config";
import { DEFAULT_FONT } from "../../fonts";

export const noteShape: ShapeDefinition = {
  idPrefix: "note",
  cssClass: "ntg",

  size(n, _labelW) {
    const fontSize = Number(n.style?.fontSize ?? 12);
    const fontWeight = n.style?.fontWeight ?? 400;
    const fontFamily = String(n.style?.font ?? DEFAULT_FONT);
    const font = buildFontStr(fontSize, fontWeight, fontFamily);

    const lines = n.label.split("\n");
    let maxLineW = 0;
    for (const line of lines) {
      const w = measureTextWidth(line, font);
      if (w > maxLineW) maxLineW = w;
    }
    n.w = n.w || Math.max(NOTE.minW, Math.ceil(maxLineW) + NOTE.padX * 2);
    n.h = n.h || lines.length * NOTE.lineH + NOTE.padY * 2;
    if (n.width && n.w < n.width) n.w = n.width;
    if (n.height && n.h < n.height) n.h = n.height;
  },

  renderSVG(rc, n, palette, opts) {
    const s = n.style ?? {};
    const { x, y, w, h } = n;
    const fold = NOTE.fold;
    const strk = String(s.stroke ?? palette.noteStroke);
    const nStrokeWidth = Number(s.strokeWidth ?? 1.2);

    const body = rc.polygon(
      [[x, y], [x + w - fold, y], [x + w, y + fold], [x + w, y + h], [x, y + h]],
      {
        ...opts,
        stroke: strk,
        strokeWidth: nStrokeWidth,
        ...(s.strokeDash ? { strokeLineDash: s.strokeDash as number[] } : {}),
      },
    );

    const foldEl = rc.polygon(
      [[x + w - fold, y], [x + w, y + fold], [x + w - fold, y + fold]],
      {
        roughness: 0.4,
        seed: hashStr(n.id + "f"),
        fill: palette.noteFold,
        fillStyle: "solid",
        stroke: strk,
        strokeWidth: Math.min(nStrokeWidth, 0.8),
      },
    );

    return [body, foldEl];
  },

  renderCanvas(rc, _ctx, n, palette, opts) {
    const s = n.style ?? {};
    const { x, y, w, h } = n;
    const fold = NOTE.fold;
    const strk = String(s.stroke ?? palette.noteStroke);
    const nStrokeWidth = Number(s.strokeWidth ?? 1.2);

    rc.polygon(
      [[x, y], [x + w - fold, y], [x + w, y + fold], [x + w, y + h], [x, y + h]],
      {
        ...opts,
        stroke: strk,
        strokeWidth: nStrokeWidth,
        ...(s.strokeDash ? { strokeLineDash: s.strokeDash as number[] } : {}),
      },
    );

    rc.polygon(
      [[x + w - fold, y], [x + w, y + fold], [x + w - fold, y + fold]],
      {
        roughness: 0.4,
        seed: hashStr(n.id + "f"),
        fill: palette.noteFold,
        fillStyle: "solid",
        stroke: strk,
        strokeWidth: Math.min(nStrokeWidth, 0.8),
      },
    );
  },
};
