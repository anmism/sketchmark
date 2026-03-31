import type { ShapeDefinition } from "./types";
import { SVG_NS } from "./types";
import { hashStr } from "../shared";
import { NOTE } from "../../config";

export const noteShape: ShapeDefinition = {
  idPrefix: "note",
  cssClass: "ntg",

  size(n, _labelW) {
    const lines = n.label.split("\n");
    const maxChars = Math.max(...lines.map((l) => l.length));
    n.w = n.w || Math.max(NOTE.minW, Math.ceil(maxChars * NOTE.fontPxPerChar) + NOTE.padX * 2);
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
