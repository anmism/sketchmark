// ============================================================
// sketchmark — Export System
// SVG, PNG, Canvas, GIF (stub), MP4 (stub)
// ============================================================

import { svgToString } from '../renderer/svg';
import { canvasToPNGBlob } from '../renderer/canvas';
import { EXPORT } from '../config';

export type ExportFormat = 'svg' | 'png' | 'html' | 'canvas' | 'gif' | 'mp4';

export interface ExportOptions {
  filename?: string;
  scale?: number;       // PNG pixel density (default: 2)
  background?: string;  // PNG background colour
  quality?: number;     // JPEG quality 0-1 (if applicable)
}

// ── Trigger browser download ──────────────────────────────
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), EXPORT.revokeDelay);
}

// ── SVG export ────────────────────────────────────────────
export function exportSVG(svg: SVGSVGElement, opts: ExportOptions = {}): void {
  const str  = svgToString(svg);
  const blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
  download(blob, opts.filename ?? 'diagram.svg');
}

export function getSVGString(svg: SVGSVGElement): string {
  return svgToString(svg);
}

export function getSVGBlob(svg: SVGSVGElement): Blob {
  return new Blob([svgToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
}

// ── PNG export (from SVG via Canvas) ─────────────────────
export async function exportPNG(svg: SVGSVGElement, opts: ExportOptions = {}): Promise<void> {
  const dataUrl = await svgToPNGDataURL(svg, opts);
  const res  = await fetch(dataUrl);
  const blob = await res.blob();
  download(blob, opts.filename ?? 'diagram.png');
}

export async function svgToPNGDataURL(
  svg: SVGSVGElement,
  opts: ExportOptions = {}
): Promise<string> {
  const scale = opts.scale ?? EXPORT.pngScale;
  const w = parseFloat(svg.getAttribute('width')  ?? String(EXPORT.fallbackW));
  const h = parseFloat(svg.getAttribute('height') ?? String(EXPORT.fallbackH));

  const canvas = document.createElement('canvas');
  canvas.width  = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = EXPORT.fallbackBg;
    ctx.fillRect(0, 0, w, h);
  }

  const svgStr  = svgToString(svg);
  const blob    = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url     = URL.createObjectURL(blob);

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url); resolve(); };
    img.onerror = reject;
    img.src = url;
  });

  return canvas.toDataURL('image/png');
}

// ── Canvas PNG export ─────────────────────────────────────
export async function exportCanvasPNG(
  canvas: HTMLCanvasElement,
  opts: ExportOptions = {}
): Promise<void> {
  const blob = await canvasToPNGBlob(canvas);
  download(blob, opts.filename ?? 'diagram.png');
}

// ── HTML export (self-contained) ──────────────────────────
export function exportHTML(
  svg: SVGSVGElement,
  dslSource: string,
  opts: ExportOptions = {}
): void {
  const svgStr = svgToString(svg);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>sketchmark export</title>
  <style>
    body { margin: 0; background: ${EXPORT.fallbackBg}; display: flex; flex-direction: column; align-items: center; padding: 2rem; font-family: system-ui, sans-serif; }
    .diagram { max-width: 100%; }
    .dsl { margin-top: 2rem; background: #131008; color: #e0c898; padding: 1rem; border-radius: 8px; font-family: monospace; font-size: 13px; line-height: 1.7; white-space: pre; max-width: 800px; width: 100%; overflow: auto; }
  </style>
</head>
<body>
  <div class="diagram">${svgStr}</div>
  <details class="dsl"><summary style="cursor:pointer;color:#f0c96a">DSL source</summary><pre>${escapeHtml(dslSource)}</pre></details>
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  download(blob, opts.filename ?? 'diagram.html');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── GIF stub (requires gifshot or gif.js at runtime) ──────
export async function exportGIF(
  frames: HTMLCanvasElement[],
  opts: ExportOptions & { fps?: number } = {}
): Promise<void> {
  // gifshot integration point
  throw new Error('GIF export requires gifshot to be loaded. See docs/EXPORT.md for setup.');
}

// ── MP4 stub (requires ffmpeg.wasm or MediaRecorder) ──────
export async function exportMP4(
  canvas: HTMLCanvasElement,
  durationMs: number,
  opts: ExportOptions & { fps?: number } = {}
): Promise<Blob> {
  const fps     = opts.fps ?? EXPORT.defaultFps;
  const stream  = (canvas as any).captureStream?.(fps);
  if (!stream) throw new Error('captureStream not supported in this browser');

  return new Promise<Blob>((resolve, reject) => {
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
    });
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    rec.onerror = reject;
    rec.start();
    setTimeout(() => rec.stop(), durationMs);
  });
}
