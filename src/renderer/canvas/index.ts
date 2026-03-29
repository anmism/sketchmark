// ============================================================
// sketchmark — Canvas Renderer
// Uses rough.js canvas API for hand-drawn rendering
// ============================================================

import type {
  SceneGraph,
  SceneNode,
  SceneEdge,
  SceneGroup,
  SceneTable,
  SceneNote,
  SceneChart,
} from "../../scene";
import { nodeMap, groupMap, tableMap, noteMap, chartMap, markdownMap } from "../../scene";
import { connPoint } from "../../layout";
import { resolvePalette, THEME_CONFIG_KEY } from "../../theme";
import type { DiagramPalette } from "../../theme";
import { resolveFont, loadFont, DEFAULT_FONT } from "../../fonts";
import { drawRoughChartCanvas } from "./roughChartCanvas";
import {
  LINE_FONT_SIZE,
  LINE_FONT_WEIGHT,
  LINE_SPACING,
} from "../../markdown/parser";
import rough from 'roughjs/bin/rough';


interface RoughCanvas {
  rectangle(x: number, y: number, w: number, h: number, opts?: any): void;
  circle(cx: number, cy: number, d: number, opts?: any): void;
  ellipse(cx: number, cy: number, w: number, h: number, opts?: any): void;
  line(x1: number, y1: number, x2: number, y2: number, opts?: any): void;
  polygon(pts: [number, number][], opts?: any): void;
  path(d: string, opts?: any): void;
}

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) & 0xffff;
  return h;
}

export interface CanvasRendererOptions {
  scale?:       number;
  background?:  string;
  roughness?:   number;
  bowing?:      number;
  theme?:       'light' | 'dark' | 'auto';
  animate?:     boolean;
  transparent?: boolean;
}

// ── Small helper: load + resolve font from a style map ────────────────────
function resolveStyleFont(
  style:    Record<string, unknown>,
  fallback: string,
): string {
  const raw = String(style['font'] ?? '');
  if (!raw) return fallback;
  loadFont(raw);
  return resolveFont(raw);
}

// ── Canvas text helpers ────────────────────────────────────────────────────

function drawText(
  ctx:            CanvasRenderingContext2D,
  txt:            string,
  x:              number,
  y:              number,
  sz              = 14,
  wt:             number | string = 500,
  col             = '#1a1208',
  align:          'left' | 'center' | 'right' = 'center',
  font            = 'system-ui, sans-serif',
  letterSpacing?: number,
): void {
  ctx.save();
  ctx.font         = `${wt} ${sz}px ${font}`;
  ctx.fillStyle    = col;
  ctx.textAlign    = align;
  ctx.textBaseline = 'middle';

  if (letterSpacing) {
    // Canvas has no native letter-spacing — draw char by char
    const chars  = txt.split('');
    const totalW = ctx.measureText(txt).width + letterSpacing * (chars.length - 1);
    let startX   = align === 'center' ? x - totalW / 2
                 : align === 'right'  ? x - totalW
                 : x;
    ctx.textAlign = 'left';
    for (const ch of chars) {
      ctx.fillText(ch, startX, y);
      startX += ctx.measureText(ch).width + letterSpacing;
    }
  } else {
    ctx.fillText(txt, x, y);
  }
  ctx.restore();
}

function drawMultilineText(
  ctx:            CanvasRenderingContext2D,
  lines:          string[],
  x:              number,
  cy:             number,
  sz              = 14,
  wt:             number | string = 500,
  col             = '#1a1208',
  align:          'left' | 'center' | 'right' = 'center',
  lineH           = 18,
  font            = 'system-ui, sans-serif',
  letterSpacing?: number,
): void {
  const totalH = (lines.length - 1) * lineH;
  const startY = cy - totalH / 2;
  lines.forEach((line, i) => {
    drawText(ctx, line, x, startY + i * lineH, sz, wt, col, align, font, letterSpacing);
  });
}

// Soft word-wrap for `text` shape nodes
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const charWidth = fontSize * 0.55;
  const maxChars  = Math.floor(maxWidth / charWidth);
  const words     = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

// ── Arrow direction ────────────────────────────────────────────────────────
function connMeta(connector: string): {
  arrowAt: 'end' | 'start' | 'both' | 'none';
  dashed:  boolean;
} {
  if (connector === '--')  return { arrowAt: 'none', dashed: false };
  if (connector === '---') return { arrowAt: 'none', dashed: true  };
  const bidir = connector.includes('<') && connector.includes('>');
  if (bidir) return { arrowAt: 'both', dashed: connector.includes('--') };
  const back   = connector.startsWith('<');
  const dashed = connector.includes('--');
  if (back) return { arrowAt: 'start', dashed };
  return { arrowAt: 'end', dashed };
}

// ── Rect connection point ──────────────────────────────────────────────────
function rectConnPoint(
  rx: number, ry: number, rw: number, rh: number,
  ox: number, oy: number,
): [number, number] {
  const cx = rx + rw / 2, cy = ry + rh / 2;
  const dx = ox - cx,     dy = oy - cy;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return [cx, cy];
  const hw = rw / 2 - 2, hh = rh / 2 - 2;
  const tx = Math.abs(dx) > 0.01 ? hw / Math.abs(dx) : 1e9;
  const ty = Math.abs(dy) > 0.01 ? hh / Math.abs(dy) : 1e9;
  const t  = Math.min(tx, ty);
  return [cx + t * dx, cy + t * dy];
}

function resolveEndpoint(
  id:  string,
  nm:  Map<string, SceneNode>,
  tm:  Map<string, SceneTable>,
  gm:  Map<string, SceneGroup>,
  cm:  Map<string, SceneChart>,
  ntm: Map<string, SceneNote>,
): { x: number; y: number; w: number; h: number; shape?: string } | null {
  return nm.get(id) ?? tm.get(id) ?? gm.get(id) ?? cm.get(id) ?? ntm.get(id) ?? null;
}

function getConnPoint(
  src:   { x: number; y: number; w: number; h: number; shape?: string },
  dstCX: number,
  dstCY: number,
): [number, number] {
  if ('shape' in src && (src as SceneNode).shape) {
    return connPoint(src as SceneNode, {
      x: dstCX - 1, y: dstCY - 1, w: 2, h: 2, shape: 'box',
    } as SceneNode);
  }
  return rectConnPoint(src.x, src.y, src.w, src.h, dstCX, dstCY);
}

// ── Group depth ────────────────────────────────────────────────────────────
function groupDepth(g: SceneGroup, gm: Map<string, SceneGroup>): number {
  let d = 0;
  let cur: SceneGroup | undefined = g;
  while (cur?.parentId) { d++; cur = gm.get(cur.parentId); }
  return d;
}

// ── Node shapes ────────────────────────────────────────────────────────────
function renderShape(
  rc:      RoughCanvas,
  ctx:     CanvasRenderingContext2D,
  n:       SceneNode,
  palette: DiagramPalette,
  R:       any,
): void {
  const s      = n.style ?? {};
  const fill   = String(s.fill   ?? palette.nodeFill);
  const stroke = String(s.stroke ?? palette.nodeStroke);
  const opts   = {
    ...R, seed: hashStr(n.id),
    fill, fillStyle: 'solid',
    stroke, strokeWidth: Number(s.strokeWidth ?? 1.9),
    ...(s.strokeDash ? { strokeLineDash: s.strokeDash as number[] } : {}),
  };
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
  const hw = n.w / 2 - 2;

  switch (n.shape) {
    case 'circle':
      rc.ellipse(cx, cy, n.w * 0.88, n.h * 0.88, opts); break;
    case 'diamond':
      rc.polygon([[cx,n.y+2],[cx+hw,cy],[cx,n.y+n.h-2],[cx-hw,cy]], opts); break;
    case 'hexagon': {
      const hw2 = hw * 0.56;
      rc.polygon([
        [cx-hw2,n.y+3],[cx+hw2,n.y+3],[cx+hw,cy],
        [cx+hw2,n.y+n.h-3],[cx-hw2,n.y+n.h-3],[cx-hw,cy],
      ], opts); break;
    }
    case 'triangle':
      rc.polygon([[cx,n.y+3],[n.x+n.w-3,n.y+n.h-3],[n.x+3,n.y+n.h-3]], opts); break;
    case 'cylinder': {
      const eH = 18;
      rc.rectangle(n.x+3, n.y+eH/2, n.w-6, n.h-eH, opts);
      rc.ellipse(cx, n.y+eH/2,     n.w-8, eH, { ...opts, roughness: 0.6 });
      rc.ellipse(cx, n.y+n.h-eH/2, n.w-8, eH, { ...opts, roughness: 0.6, fill: 'none' });
      break;
    }
    case 'parallelogram':
      rc.polygon([
        [n.x+18,n.y+1],[n.x+n.w-1,n.y+1],
        [n.x+n.w-18,n.y+n.h-1],[n.x+1,n.y+n.h-1],
      ], opts); break;
    case 'text':
      break; // no shape drawn
    case 'image': {
      if (n.imageUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          const r = 6;
          ctx.moveTo(n.x+r, n.y);
          ctx.lineTo(n.x+n.w-r, n.y);
          ctx.quadraticCurveTo(n.x+n.w, n.y,     n.x+n.w, n.y+r);
          ctx.lineTo(n.x+n.w, n.y+n.h-r);
          ctx.quadraticCurveTo(n.x+n.w, n.y+n.h, n.x+n.w-r, n.y+n.h);
          ctx.lineTo(n.x+r,   n.y+n.h);
          ctx.quadraticCurveTo(n.x, n.y+n.h, n.x, n.y+n.h-r);
          ctx.lineTo(n.x, n.y+r);
          ctx.quadraticCurveTo(n.x, n.y, n.x+r, n.y);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, n.x+1, n.y+1, n.w-2, n.h-2);
          ctx.restore();
          rc.rectangle(n.x+1, n.y+1, n.w-2, n.h-2, { ...opts, fill: 'none' });
        };
        img.src = n.imageUrl;
      } else {
        rc.rectangle(n.x+1, n.y+1, n.w-2, n.h-2,
          { ...opts, fill: '#e0e0e0', stroke: '#999999' });
      }
      return;
    }
    default:
      rc.rectangle(n.x+1, n.y+1, n.w-2, n.h-2, opts); break;
  }
}

// ── Arrowhead ─────────────────────────────────────────────────────────────
function drawArrowHead(
  rc: RoughCanvas, x: number, y: number,
  angle: number, col: string, seed: number, R: any,
): void {
  const as = 12;
  rc.polygon([
    [x, y],
    [x - as*Math.cos(angle - Math.PI/6.5), y - as*Math.sin(angle - Math.PI/6.5)],
    [x - as*Math.cos(angle + Math.PI/6.5), y - as*Math.sin(angle + Math.PI/6.5)],
  ], { roughness: 0.3, seed, fill: col, fillStyle: 'solid', stroke: col, strokeWidth: 0.8 });
}

// ── Public API ─────────────────────────────────────────────────────────────
export function renderToCanvas(
  sg:      SceneGraph,
  canvas:  HTMLCanvasElement,
  options: CanvasRendererOptions = {},
): void {
  if (typeof rough === 'undefined') throw new Error('rough.js not loaded');

  const scale = options.scale ?? window.devicePixelRatio ?? 1;
  canvas.width        = sg.width  * scale;
  canvas.height       = sg.height * scale;
  canvas.style.width  = sg.width  + 'px';
  canvas.style.height = sg.height + 'px';

  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // ── Palette ──────────────────────────────────────────────
  const isDark =
    options.theme === 'dark' ||
    (options.theme === 'auto' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme:dark)').matches);
  const themeName = String(sg.config[THEME_CONFIG_KEY] ?? (isDark ? 'dark' : 'light'));
  const palette   = resolvePalette(themeName);

  // ── Diagram-level font ───────────────────────────────────
  const diagramFont = (() => {
    const raw = String(sg.config['font'] ?? '');
    if (raw) { loadFont(raw); return resolveFont(raw); }
    return DEFAULT_FONT;
  })();

  // ── Background ───────────────────────────────────────────
  if (!options.transparent) {
    ctx.fillStyle = options.background ?? palette.background;
    ctx.fillRect(0, 0, sg.width, sg.height);
  } else {
    ctx.clearRect(0, 0, sg.width, sg.height);
  }

  const rc = rough.canvas(canvas);
  const R  = { roughness: options.roughness ?? 1.3, bowing: options.bowing ?? 0.7 };

  const nm  = nodeMap(sg);
  const tm  = tableMap(sg);
  const gm  = groupMap(sg);
  const cm  = chartMap(sg);
  const ntm = noteMap(sg);

  // ── Title ────────────────────────────────────────────────
  if (sg.title) {
    const titleSize   = Number(sg.config['title-size']   ?? 18);
    const titleWeight = Number(sg.config['title-weight'] ?? 600);
    const titleColor  = String(sg.config['title-color']  ?? palette.titleText);
    drawText(ctx, sg.title, sg.width / 2, 28,
      titleSize, titleWeight, titleColor, 'center', diagramFont);
  }

  // ── Groups (outermost first) ─────────────────────────────
  const sortedGroups = [...sg.groups].sort((a, b) => groupDepth(a, gm) - groupDepth(b, gm));
  for (const g of sortedGroups) {
    if (!g.w) continue;
    const gs = g.style ?? {};
    rc.rectangle(g.x, g.y, g.w, g.h, {
      ...R, roughness: 1.7, bowing: 0.4, seed: hashStr(g.id),
      fill:           String(gs.fill   ?? palette.groupFill),
      fillStyle:      'solid',
      stroke:         String(gs.stroke ?? palette.groupStroke),
      strokeWidth:    Number(gs.strokeWidth ?? 1.2),
      strokeLineDash: (gs as any).strokeDash ?? palette.groupDash,
    });

    // ── Group label ──────────────────────────────────────
    // Only render when label has content — empty label = no reserved space
    // supports: font, font-size, letter-spacing (always left-anchored)
    if (g.label) {
      const gFontSize      = Number(gs.fontSize      ?? 12);
      const gFont          = resolveStyleFont(gs as Record<string,unknown>, diagramFont);
      const gLetterSpacing = gs.letterSpacing as number | undefined;
      const gLabelColor    = gs.color ? String(gs.color) : palette.groupLabel;
      drawText(ctx, g.label, g.x + 14, g.y + 16,
        gFontSize, 500, gLabelColor, 'left', gFont, gLetterSpacing);
    }
  }

  // ── Edges ─────────────────────────────────────────────────
  for (const e of sg.edges) {
    const src = resolveEndpoint(e.from, nm, tm, gm, cm, ntm);
    const dst = resolveEndpoint(e.to,   nm, tm, gm, cm, ntm);
    if (!src || !dst) continue;

    const dstCX = dst.x + dst.w / 2, dstCY = dst.y + dst.h / 2;
    const srcCX = src.x + src.w / 2, srcCY = src.y + src.h / 2;
    const [x1, y1] = getConnPoint(src, dstCX, dstCY);
    const [x2, y2] = getConnPoint(dst, srcCX, srcCY);

    const ecol   = String(e.style?.stroke ?? palette.edgeStroke);
    const { arrowAt, dashed } = connMeta(e.connector);
    const len    = Math.sqrt((x2-x1)**2 + (y2-y1)**2) || 1;
    const nx     = (x2-x1)/len, ny = (y2-y1)/len;

    const HEAD = 13;
    const sx1 = arrowAt === 'start' || arrowAt === 'both' ? x1 + nx*HEAD : x1;
    const sy1 = arrowAt === 'start' || arrowAt === 'both' ? y1 + ny*HEAD : y1;
    const sx2 = arrowAt === 'end'   || arrowAt === 'both' ? x2 - nx*HEAD : x2;
    const sy2 = arrowAt === 'end'   || arrowAt === 'both' ? y2 - ny*HEAD : y2;

    rc.line(sx1, sy1, sx2, sy2, {
      ...R, roughness: 0.9, seed: hashStr(e.from + e.to),
      stroke:      ecol,
      strokeWidth: Number(e.style?.strokeWidth ?? 1.6),
      ...(dashed ? { strokeLineDash: [6, 5] } : {}),
    });

    const ang = Math.atan2(y2-y1, x2-x1);
    if (arrowAt === 'end'   || arrowAt === 'both')
      drawArrowHead(rc, x2, y2, ang, ecol, hashStr(e.to), R);
    if (arrowAt === 'start' || arrowAt === 'both')
      drawArrowHead(rc, x1, y1, Math.atan2(y1-y2, x1-x2), ecol, hashStr(e.from+'back'), R);

    if (e.label) {
      const mx = (x1+x2)/2 - ny*14;
      const my = (y1+y2)/2 + nx*14;

      // ── Edge label: font, font-size, letter-spacing ──
      // always center-anchored (single line)
      const eFontSize      = Number(e.style?.fontSize      ?? 11);
      const eFont          = resolveStyleFont(e.style as Record<string,unknown> ?? {}, diagramFont);
      const eLetterSpacing = e.style?.letterSpacing as number | undefined;

      ctx.save();
      ctx.font = `400 ${eFontSize}px ${eFont}`;
      const tw = ctx.measureText(e.label).width + 12;
      ctx.restore();

      ctx.fillStyle = palette.edgeLabelBg;
      ctx.fillRect(mx - tw/2, my - 8, tw, 15);
      drawText(ctx, e.label, mx, my + 3,
        eFontSize, 400, palette.edgeLabelText, 'center', eFont, eLetterSpacing);
    }
  }

  // ── Nodes ─────────────────────────────────────────────────
  for (const n of sg.nodes) {
    if (n.style?.opacity != null) ctx.globalAlpha = Number(n.style.opacity);
    renderShape(rc, ctx, n, palette, R);

    // ── Node / text typography ─────────────────────────
    // supports: font, font-size, letter-spacing, text-align,
    //           vertical-align, line-height, word-wrap (text shape)
    const fontSize      = Number(n.style?.fontSize ?? (n.shape === 'text' ? 13 : 14));
    const fontWeight    = n.style?.fontWeight ?? (n.shape === 'text' ? 400 : 500);
    const textColor     = String(n.style?.color ??
      (n.shape === 'text' ? palette.edgeLabelText : palette.nodeText));
    const nodeFont      = resolveStyleFont(n.style as Record<string,unknown> ?? {}, diagramFont);

    const textAlign     = String(n.style?.textAlign    ?? 'center') as 'left'|'center'|'right';
    const lineHeight    = Number(n.style?.lineHeight   ?? 1.3) * fontSize;
    const letterSpacing = n.style?.letterSpacing as number | undefined;
    const vertAlign     = String(n.style?.verticalAlign ?? 'middle');

    const pad = Number(n.style?.padding ?? 8);

    // x shifts for left/right alignment
    const textX = textAlign === 'left'  ? n.x + pad
                : textAlign === 'right' ? n.x + n.w - pad
                : n.x + n.w / 2;

    // word-wrap for text shape; explicit \n for all others
    const rawLines = n.label.split('\n');
    const lines    = n.shape === 'text' && rawLines.length === 1
      ? wrapText(n.label, n.w - pad * 2, fontSize)
      : rawLines;

    // vertical-align: compute textCY from top/middle/bottom
    const nodeBodyTop    = n.y + pad;
    const nodeBodyBottom = n.y + n.h - pad;
    const blockH         = (lines.length - 1) * lineHeight;
    const textCY =
      vertAlign === 'top'    ? nodeBodyTop    + blockH / 2
      : vertAlign === 'bottom' ? nodeBodyBottom - blockH / 2
      : n.y + n.h / 2;   // middle (default)

    if (lines.length > 1) {
      drawMultilineText(ctx, lines, textX, textCY,
        fontSize, fontWeight, textColor,
        textAlign, lineHeight, nodeFont, letterSpacing);
    } else {
      drawText(ctx, lines[0] ?? '', textX, textCY,
        fontSize, fontWeight, textColor,
        textAlign, nodeFont, letterSpacing);
    }
    if (n.style?.opacity != null) ctx.globalAlpha = 1;
  }

  // ── Tables ────────────────────────────────────────────────
  for (const t of sg.tables) {
    const gs      = t.style ?? {};
    const fill    = String(gs.fill   ?? palette.tableFill);
    const strk    = String(gs.stroke ?? palette.tableStroke);
    const textCol = String(gs.color  ?? palette.tableText);
    const pad     = t.labelH;

    // ── Table-level font ────────────────────────────────
    // supports: font, font-size, letter-spacing
    // cells also support text-align
    const tFontSize      = Number(gs.fontSize      ?? 12);
    const tFont          = resolveStyleFont(gs as Record<string,unknown>, diagramFont);
    const tLetterSpacing = gs.letterSpacing as number | undefined;

    rc.rectangle(t.x, t.y, t.w, t.h, {
      ...R, seed: hashStr(t.id),
      fill, fillStyle: 'solid', stroke: strk, strokeWidth: 1.5,
    });

    rc.line(t.x, t.y+pad, t.x+t.w, t.y+pad, {
      roughness: 0.6, seed: hashStr(t.id+'l'), stroke: strk, strokeWidth: 1,
    });

    // ── Table label: always left-anchored ───────────────
    drawText(ctx, t.label, t.x + 10, t.y + pad/2,
      tFontSize, 500, textCol, 'left', tFont, tLetterSpacing);

    let rowY = t.y + pad;
    for (const row of t.rows) {
      const rh = row.kind === 'header' ? t.headerH : t.rowH;

      if (row.kind === 'header') {
        ctx.fillStyle = palette.tableHeaderFill;
        ctx.fillRect(t.x+1, rowY+1, t.w-2, rh-1);
      }

      rc.line(t.x, rowY+rh, t.x+t.w, rowY+rh, {
        roughness:   0.4, seed: hashStr(t.id+rowY),
        stroke:      row.kind === 'header' ? strk : palette.tableDivider,
        strokeWidth: row.kind === 'header' ? 1.2  : 0.6,
      });

      // ── Cell text ───────────────────────────────────
      // header always centered; data rows respect gs.textAlign
      const cellAlignProp = (row.kind === 'header'
        ? 'center'
        : String(gs.textAlign ?? 'center')) as 'left'|'center'|'right';
      const cellFw        = row.kind === 'header' ? 600 : 400;
      const cellColor     = row.kind === 'header'
        ? String(gs.color ?? palette.tableHeaderText)
        : textCol;

      let cx = t.x;
      row.cells.forEach((cell, i) => {
        const cw    = t.colWidths[i] ?? 60;
        const cellX = cellAlignProp === 'left'  ? cx + 6
                    : cellAlignProp === 'right' ? cx + cw - 6
                    : cx + cw / 2;

        drawText(ctx, cell, cellX, rowY + rh/2,
          tFontSize, cellFw, cellColor,
          cellAlignProp, tFont, tLetterSpacing);

        if (i < row.cells.length - 1) {
          rc.line(cx+cw, t.y+pad, cx+cw, t.y+t.h, {
            roughness: 0.3, seed: hashStr(t.id+'c'+i),
            stroke: palette.tableDivider, strokeWidth: 0.5,
          });
        }
        cx += cw;
      });

      rowY += rh;
    }
  }

  // ── Notes ─────────────────────────────────────────────────
  for (const n of sg.notes) {
    const gs   = n.style ?? {};
    const fill = String(gs.fill   ?? palette.noteFill);
    const strk = String(gs.stroke ?? palette.noteStroke);
    const nStrokeWidth = Number(gs.strokeWidth ?? 1.2);
    const fold = 14;
    const { x, y, w, h } = n;

    if (gs.opacity != null) ctx.globalAlpha = Number(gs.opacity);

    rc.polygon([
      [x,        y],
      [x+w-fold, y],
      [x+w,      y+fold],
      [x+w,      y+h],
      [x,        y+h],
    ], { ...R, seed: hashStr(n.id), fill, fillStyle: 'solid', stroke: strk,
      strokeWidth: nStrokeWidth,
      ...(gs.strokeDash ? { strokeLineDash: gs.strokeDash as number[] } : {}),
    });

    rc.polygon([
      [x+w-fold, y],
      [x+w,      y+fold],
      [x+w-fold, y+fold],
    ], { roughness: 0.4, seed: hashStr(n.id+'f'),
      fill: palette.noteFold, fillStyle: 'solid', stroke: strk,
      strokeWidth: Math.min(nStrokeWidth, 0.8),
    });

    const nFontSize      = Number(gs.fontSize      ?? 12);
    const nFontWeight    = gs.fontWeight ?? 400;
    const nFont          = resolveStyleFont(gs as Record<string,unknown>, diagramFont);
    const nLetterSpacing = gs.letterSpacing as number | undefined;
    const nLineHeight    = Number(gs.lineHeight    ?? 1.4) * nFontSize;
    const nTextAlign     = String(gs.textAlign     ?? 'left') as 'left'|'center'|'right';
    const nVertAlign     = String(gs.verticalAlign ?? 'top');
    const nColor         = String(gs.color         ?? palette.noteText);
    const nPad           = Number(gs.padding       ?? 12);

    const nTextX = nTextAlign === 'right'  ? x + w - fold - nPad
                 : nTextAlign === 'center' ? x + (w - fold) / 2
                 : x + nPad;

    const nFoldPad   = fold + nPad;
    const bodyTop    = y + nFoldPad;
    const bodyBottom = y + h - nPad;
    const blockH     = (n.lines.length - 1) * nLineHeight;
    const blockCY    =
      nVertAlign === 'bottom' ? bodyBottom - blockH / 2
      : nVertAlign === 'middle' ? (bodyTop + bodyBottom) / 2
      : bodyTop + blockH / 2;

    if (n.lines.length > 1) {
      drawMultilineText(ctx, n.lines, nTextX, blockCY,
        nFontSize, nFontWeight, nColor,
        nTextAlign, nLineHeight, nFont, nLetterSpacing);
    } else {
      drawText(ctx, n.lines[0] ?? '', nTextX, blockCY,
        nFontSize, nFontWeight, nColor,
        nTextAlign, nFont, nLetterSpacing);
    }
    if (gs.opacity != null) ctx.globalAlpha = 1;
  }

  // ── Markdown blocks ────────────────────────────────────────
  // Renders prose with Markdown headings and bold/italic inline spans.
  // Canvas has no native bold-within-a-run, so each run is drawn
  // individually with its own ctx.font setting.
  for (const m of (sg.markdowns ?? [])) {
    const mFont     = resolveStyleFont(m.style as Record<string,unknown>, diagramFont);
    const baseColor = String(m.style?.color ?? palette.nodeText);
    const textAlign = String(m.style?.textAlign ?? 'left') as 'left'|'center'|'right';
    const PAD       = Number(m.style?.padding ?? 16);

    const anchorX = textAlign === 'right'  ? m.x + m.w - PAD
                  : textAlign === 'center' ? m.x + m.w / 2
                  : m.x + PAD;

    let y = m.y + PAD;

    for (const line of m.lines) {
      if (line.kind === 'blank') { y += LINE_SPACING.blank; continue; }

      const fontSize   = LINE_FONT_SIZE[line.kind];
      const fontWeight = LINE_FONT_WEIGHT[line.kind];
      const lineY      = y + fontSize / 2;

      // Measure total run width for left-offset when runs mix bold/italic
      // Simple: draw each run consecutively from a computed start x
      ctx.save();
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = baseColor;

      if (textAlign === 'center' || textAlign === 'right') {
        // Measure full line width first
        let totalW = 0;
        for (const run of line.runs) {
          const runStyle  = run.italic ? 'italic ' : '';
          const runWeight = run.bold   ? 700 : fontWeight;
          ctx.font = `${runStyle}${runWeight} ${fontSize}px ${mFont}`;
          totalW  += ctx.measureText(run.text).width;
        }
        let runX = textAlign === 'center' ? anchorX - totalW / 2 : anchorX - totalW;
        ctx.textAlign = 'left';
        for (const run of line.runs) {
          const runStyle  = run.italic ? 'italic ' : '';
          const runWeight = run.bold   ? 700 : fontWeight;
          ctx.font = `${runStyle}${runWeight} ${fontSize}px ${mFont}`;
          ctx.fillText(run.text, runX, lineY);
          runX += ctx.measureText(run.text).width;
        }
      } else {
        // left-aligned — draw runs left to right from anchorX
        let runX = anchorX;
        ctx.textAlign = 'left';
        for (const run of line.runs) {
          const runStyle  = run.italic ? 'italic ' : '';
          const runWeight = run.bold   ? 700 : fontWeight;
          ctx.font = `${runStyle}${runWeight} ${fontSize}px ${mFont}`;
          ctx.fillText(run.text, runX, lineY);
          runX += ctx.measureText(run.text).width;
        }
      }

      ctx.restore();
      y += LINE_SPACING[line.kind];
    }
  }

  // ── Charts ────────────────────────────────────────────────
  for (const c of sg.charts) {
    drawRoughChartCanvas(rc, ctx, c, {
      nodeFill:   palette.chartFill,
      nodeStroke: palette.chartStroke,
      labelText:  palette.chartText,
      labelBg:    palette.edgeLabelBg,
    }, R);
  }
}

// ── Export helpers ─────────────────────────────────────────────────────────
export function canvasToPNGBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}

export function canvasToPNGDataURL(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}