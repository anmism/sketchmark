import type { RenderOptions, VisualDocument } from "../types";
import { renderToSvg } from "./svg";

export function renderToHtml(document: VisualDocument, options: RenderOptions = {}): string {
  const svg = renderToSvg(document, options);
  const duration = Number(document.canvas.duration ?? 0);
  const background = options.transparent ? "transparent" : "#111827";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sketchmark Kernel Visual</title><style>html,body{margin:0;width:100%;height:100%;background:${background};display:grid;place-items:center}.sketchmark-frame{max-width:100vw;max-height:100vh}</style></head><body><div class="sketchmark-frame" data-duration="${duration}">${svg}</div></body></html>`;
}
