// ============================================================
// sketchmark — Canvas Renderer
// Uses rough.js canvas API for hand-drawn rendering
// ============================================================

import type {
  SceneGraph,
  SceneNode,
} from "../../scene";
import { nodeMap, groupMap, tableMap, chartMap } from "../../scene";
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

import {
  hashStr, darkenHex, resolveStyleFont, wrapText, buildFontStr, shapeInnerTextWidth,
  connMeta, resolveEndpoint, getConnPoint, groupDepth, compactPolylinePoints,
  insetPolylineEndpoints, polylineEndpointDirection, polylineLabelPosition,
  polylinePathData, polylineArrowTipPoint,
} from '../shared';
import { getShape } from '../shapes';
import { getBottomLabelCenterY, usesBottomLabelStrip } from "../shapes/label-strip";
import { resolveTypography, computeTextX, computeTextCY } from '../typography';
import { ROUGH, EDGE, NOTE as NOTE_CFG, TITLE, GROUP_LABEL } from '../../config';


interface RoughCanvas {
  rectangle(x: number, y: number, w: number, h: number, opts?: any): void;
  circle(cx: number, cy: number, d: number, opts?: any): void;
  ellipse(cx: number, cy: number, w: number, h: number, opts?: any): void;
  line(x1: number, y1: number, x2: number, y2: number, opts?: any): void;
  polygon(pts: [number, number][], opts?: any): void;
  path(d: string, opts?: any): void;
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

  const shape = getShape(n.shape);
  if (shape) { shape.renderCanvas(rc as any, ctx, n, palette, opts); return; }
  // fallback: box
  rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts);
}

// ── Arrowhead ─────────────────────────────────────────────────────────────
function drawArrowHead(
  rc: RoughCanvas, x: number, y: number,
  angle: number, col: string, seed: number, R: any,
): void {
  const as = EDGE.arrowSize;
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
    const raw = String(sg.style?.font ?? sg.config['font'] ?? '');
    if (raw) { loadFont(raw); return resolveFont(raw); }
    return DEFAULT_FONT;
  })();

  // ── Background ───────────────────────────────────────────
  if (!options.transparent) {
    ctx.fillStyle = options.background ?? String(sg.style?.fill ?? palette.background);
    ctx.fillRect(0, 0, sg.width, sg.height);

    const rootStroke = sg.style?.stroke;
    const rootStrokeWidth = Number(sg.style?.strokeWidth ?? 0);
    if (rootStroke && rootStroke !== 'none' && rootStrokeWidth > 0) {
      const inset = rootStrokeWidth / 2;
      ctx.save();
      ctx.strokeStyle = String(rootStroke);
      ctx.lineWidth = rootStrokeWidth;
      ctx.strokeRect(inset, inset, Math.max(0, sg.width - rootStrokeWidth), Math.max(0, sg.height - rootStrokeWidth));
      ctx.restore();
    }
  } else {
    ctx.clearRect(0, 0, sg.width, sg.height);
  }

  const rc = rough.canvas(canvas);
  const R  = { roughness: options.roughness ?? ROUGH.roughness, bowing: options.bowing ?? ROUGH.bowing };

  const nm  = nodeMap(sg);
  const tm  = tableMap(sg);
  const gm  = groupMap(sg);
  const cm  = chartMap(sg);
  // ── Title ────────────────────────────────────────────────
  if (sg.title) {
    const titleSize   = Number(sg.config['title-size']   ?? TITLE.fontSize);
    const titleWeight = Number(sg.config['title-weight'] ?? TITLE.fontWeight);
    const titleColor  = String(sg.config['title-color']  ?? palette.titleText);
    drawText(ctx, sg.title, sg.width / 2, TITLE.y + 2,
      titleSize, titleWeight, titleColor, 'center', diagramFont);
  }

  // ── Groups (outermost first) ─────────────────────────────
  const sortedGroups = [...sg.groups].sort((a, b) => groupDepth(a, gm) - groupDepth(b, gm));
  for (const g of sortedGroups) {
    if (!g.w) continue;
    const gs = g.style ?? {};

    if (gs.opacity != null) ctx.globalAlpha = Number(gs.opacity);

    rc.rectangle(g.x, g.y, g.w, g.h, {
      ...R, roughness: 1.7, bowing: 0.4, seed: hashStr(g.id),
      fill:           String(gs.fill   ?? palette.groupFill),
      fillStyle:      'solid',
      stroke:         String(gs.stroke ?? palette.groupStroke),
      strokeWidth:    Number(gs.strokeWidth ?? 1.2),
      strokeLineDash: (gs as any).strokeDash ?? palette.groupDash,
    });

    if (g.label) {
      const gTypo = resolveTypography(
        gs as Record<string, unknown>,
        { fontSize: GROUP_LABEL.fontSize, fontWeight: GROUP_LABEL.fontWeight, textAlign: "left", padding: GROUP_LABEL.padding },
        diagramFont, palette.groupLabel,
      );
      const gTextX = computeTextX(gTypo, g.x, g.w) + (g.labelDx ?? 0);
      const gTextY = g.y + gTypo.padding + 2 + (g.labelDy ?? 0);
      drawText(ctx, g.label, gTextX, gTextY,
        gTypo.fontSize, gTypo.fontWeight, gTypo.textColor, gTypo.textAlign, gTypo.font, gTypo.letterSpacing);
    }

    if (gs.opacity != null) ctx.globalAlpha = 1;
  }

  // ── Edges ─────────────────────────────────────────────────
  for (const e of sg.edges) {
    const src = resolveEndpoint(e.from, nm, tm, gm, cm);
    const dst = resolveEndpoint(e.to,   nm, tm, gm, cm);
    if (!src || !dst) continue;

    const dstCX = dst.x + dst.w / 2, dstCY = dst.y + dst.h / 2;
    const srcCX = src.x + src.w / 2, srcCY = src.y + src.h / 2;
    const [x1, y1] = getConnPoint(src, dstCX, dstCY, e.fromAnchor);
    const [x2, y2] = getConnPoint(dst, srcCX, srcCY, e.toAnchor);
    const points = compactPolylinePoints(
      e.points?.length && e.points.length >= 2 ? e.points : [[x1, y1], [x2, y2]],
    );

    if (e.style?.opacity != null) ctx.globalAlpha = Number(e.style.opacity);
    const ecol   = String(e.style?.stroke ?? palette.edgeStroke);
    const { arrowAt, dashed } = connMeta(e.connector);

    const HEAD = EDGE.headInset;
    const shaftPoints = insetPolylineEndpoints(points, arrowAt, HEAD);

    rc.path(polylinePathData(shaftPoints), {
      ...R, roughness: 0.9, seed: hashStr(e.from + e.to),
      stroke:      ecol,
      strokeWidth: Number(e.style?.strokeWidth ?? 1.6),
      ...(dashed ? { strokeLineDash: EDGE.dashPattern as number[] } : {}),
    });

    if (arrowAt === 'end'   || arrowAt === 'both') {
      const [endDx, endDy] = polylineEndpointDirection(points, 'end');
      const [endX, endY] = polylineArrowTipPoint(dst, points, 'end');
      drawArrowHead(rc, endX, endY, Math.atan2(endDy, endDx), ecol, hashStr(e.to), R);
    }
    if (arrowAt === 'start' || arrowAt === 'both') {
      const [startDx, startDy] = polylineEndpointDirection(points, 'start');
      const [startX, startY] = polylineArrowTipPoint(src, points, 'start');
      drawArrowHead(rc, startX, startY, Math.atan2(-startDy, -startDx), ecol, hashStr(e.from+'back'), R);
    }

    if (e.label) {
      const { x: mx, y: my } = polylineLabelPosition(
        points,
        EDGE.labelOffset,
        e.labelDx ?? 0,
        e.labelDy ?? 0,
      );

      // ── Edge label: font, font-size, letter-spacing ──
      // always center-anchored (single line)
      const eFontSize      = Number(e.style?.fontSize      ?? EDGE.labelFontSize);
      const eFont          = resolveStyleFont(e.style as Record<string,unknown> ?? {}, diagramFont);
      const eLetterSpacing = e.style?.letterSpacing as number | undefined;

      const eFontWeight    = e.style?.fontWeight ?? EDGE.labelFontWeight;
      const eLabelColor    = String(e.style?.color ?? palette.edgeLabelText);

      ctx.save();
      ctx.font = `${eFontWeight} ${eFontSize}px ${eFont}`;
      const tw = ctx.measureText(e.label).width + 12;
      ctx.restore();

      ctx.fillStyle = palette.edgeLabelBg;
      ctx.fillRect(mx - tw/2, my - 8, tw, 15);
      drawText(ctx, e.label, mx, my + 3,
        eFontSize, eFontWeight, eLabelColor, 'center', eFont, eLetterSpacing);
    }
    ctx.globalAlpha = 1;
  }

  // ── Nodes ─────────────────────────────────────────────────
  for (const n of sg.nodes) {
    if (n.style?.opacity != null) ctx.globalAlpha = Number(n.style.opacity);

    // ── Static transform (deg, dx, dy, factor) ──────────
    // All transforms anchor around the node's visual center.
    const hasTx = n.dx || n.dy || n.deg || (n.factor && n.factor !== 1);
    if (hasTx) {
      ctx.save();
      const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
      // Move to center, apply rotate + scale there, move back
      ctx.translate(cx + (n.dx ?? 0), cy + (n.dy ?? 0));
      if (n.deg) ctx.rotate((n.deg * Math.PI) / 180);
      if (n.factor && n.factor !== 1) ctx.scale(n.factor, n.factor);
      ctx.translate(-cx, -cy);
    }

    renderShape(rc, ctx, n, palette, R);

    // ── Node / text typography ─────────────────────────
    const isText = n.shape === 'text';
    const isNote = n.shape === 'note';
    const usesBottomStrip = usesBottomLabelStrip(n.shape);
    const typo = resolveTypography(
      n.style as Record<string, unknown>,
      {
        fontSize: isText ? 13 : isNote ? 12 : 14,
        fontWeight: isText || isNote ? 400 : 500,
        textColor: isText ? palette.edgeLabelText : isNote ? palette.noteText : palette.nodeText,
        textAlign: isText || isNote ? "left" : undefined,
        lineHeight: isNote ? 1.4 : undefined,
        padding: isText ? 0 : isNote ? 12 : undefined,
        verticalAlign: isNote ? "top" : undefined,
      },
      diagramFont, palette.nodeText,
    );

    // Note textX accounts for fold corner
    const FOLD = NOTE_CFG.fold;
    const textX = isNote
      ? (typo.textAlign === 'right'  ? n.x + n.w - FOLD - typo.padding
       : typo.textAlign === 'center' ? n.x + (n.w - FOLD) / 2
       : n.x + typo.padding)
      : computeTextX(typo, n.x, n.w);

    const fontStr = buildFontStr(typo.fontSize, typo.fontWeight, typo.font);
    const shouldWrap = !usesBottomStrip && !n.label.includes('\n');

    const innerW = shapeInnerTextWidth(n.shape, n.w, typo.padding);
    const rawLines = n.label.split('\n');
    const lines = shouldWrap && rawLines.length === 1
      ? wrapText(n.label, innerW, typo.fontSize, fontStr)
      : rawLines;
    const textCY = usesBottomStrip
      ? getBottomLabelCenterY(n)
      : isNote
        ? computeTextCY(typo, n.y, n.h, lines.length, FOLD + typo.padding)
        : computeTextCY(typo, n.y, n.h, lines.length);
    const labelX = textX + (n.labelDx ?? 0);
    const labelY = textCY + (n.labelDy ?? 0);

    if (n.label) {
      if (lines.length > 1) {
        drawMultilineText(ctx, lines, labelX, labelY,
          typo.fontSize, typo.fontWeight, typo.textColor,
          typo.textAlign, typo.lineHeight, typo.font, typo.letterSpacing);
      } else {
        drawText(ctx, lines[0] ?? '', labelX, labelY,
          typo.fontSize, typo.fontWeight, typo.textColor,
          typo.textAlign, typo.font, typo.letterSpacing);
      }
    }
    if (hasTx) ctx.restore();
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
    const tFontSize      = Number(gs.fontSize      ?? 12);
    const tFont          = resolveStyleFont(gs as Record<string,unknown>, diagramFont);
    const tLetterSpacing = gs.letterSpacing as number | undefined;
    const tStrokeWidth   = Number(gs.strokeWidth   ?? 1.5);
    const tFontWeight    = gs.fontWeight ?? 500;

    if (gs.opacity != null) ctx.globalAlpha = Number(gs.opacity);

    rc.rectangle(t.x, t.y, t.w, t.h, {
      ...R, seed: hashStr(t.id),
      fill, fillStyle: 'solid', stroke: strk, strokeWidth: tStrokeWidth,
      ...(gs.strokeDash ? { strokeLineDash: gs.strokeDash as number[] } : {}),
    });

    rc.line(t.x, t.y+pad, t.x+t.w, t.y+pad, {
      roughness: 0.6, seed: hashStr(t.id+'l'), stroke: strk, strokeWidth: 1,
    });

    // ── Table label: always left-anchored ───────────────
    drawText(ctx, t.label, t.x + 10, t.y + pad/2,
      tFontSize, tFontWeight, textCol, 'left', tFont, tLetterSpacing);

    let rowY = t.y + pad;
    for (const row of t.rows) {
      const rh = row.kind === 'header' ? t.headerH : t.rowH;

      if (row.kind === 'header') {
        ctx.fillStyle = gs.fill ? darkenHex(fill, 0.08) : palette.tableHeaderFill;
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
      const cellFw        = row.kind === 'header' ? 600 : (gs.fontWeight ?? 400);
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
    ctx.globalAlpha = 1;
  }

  // ── Notes are now rendered as nodes via the shape registry ──

  // ── Markdown blocks ────────────────────────────────────────
  // Renders prose with Markdown headings and bold/italic inline spans.
  // Canvas has no native bold-within-a-run, so each run is drawn
  // individually with its own ctx.font setting.
  for (const m of (sg.markdowns ?? [])) {
    const gs        = m.style ?? {};
    const mFont     = resolveStyleFont(gs as Record<string,unknown>, diagramFont);
    const baseColor = String(gs.color ?? palette.nodeText);
    const textAlign = String(gs.textAlign ?? 'left') as 'left'|'center'|'right';
    const PAD       = Number(gs.padding ?? 0);
    const mLetterSpacing = gs.letterSpacing as number | undefined;

    if (gs.opacity != null) ctx.globalAlpha = Number(gs.opacity);

    // Background + border
    if (gs.fill || gs.stroke) {
      rc.rectangle(m.x, m.y, m.w, m.h, {
        ...R, seed: hashStr(m.id),
        fill: String(gs.fill ?? 'none'), fillStyle: 'solid',
        stroke: String(gs.stroke ?? 'none'),
        strokeWidth: Number(gs.strokeWidth ?? 1.2),
        ...(gs.strokeDash ? { strokeLineDash: gs.strokeDash as number[] } : {}),
      });
    }

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

      const ls = mLetterSpacing ?? 0;
      // measure run width including letter-spacing
      const runW = (run: { text: string }) => {
        return ctx.measureText(run.text).width + ls * run.text.length;
      };
      const drawRun = (run: { text: string }, rx: number) => {
        if (ls) {
          for (const ch of run.text) {
            ctx.fillText(ch, rx, lineY);
            rx += ctx.measureText(ch).width + ls;
          }
        } else {
          ctx.fillText(run.text, rx, lineY);
        }
      };

      if (textAlign === 'center' || textAlign === 'right') {
        let totalW = 0;
        for (const run of line.runs) {
          const runStyle  = run.italic ? 'italic ' : '';
          const runWeight = run.bold   ? 700 : fontWeight;
          ctx.font = `${runStyle}${runWeight} ${fontSize}px ${mFont}`;
          totalW  += runW(run);
        }
        let runX = textAlign === 'center' ? anchorX - totalW / 2 : anchorX - totalW;
        ctx.textAlign = 'left';
        for (const run of line.runs) {
          const runStyle  = run.italic ? 'italic ' : '';
          const runWeight = run.bold   ? 700 : fontWeight;
          ctx.font = `${runStyle}${runWeight} ${fontSize}px ${mFont}`;
          drawRun(run, runX);
          runX += runW(run);
        }
      } else {
        let runX = anchorX;
        ctx.textAlign = 'left';
        for (const run of line.runs) {
          const runStyle  = run.italic ? 'italic ' : '';
          const runWeight = run.bold   ? 700 : fontWeight;
          ctx.font = `${runStyle}${runWeight} ${fontSize}px ${mFont}`;
          drawRun(run, runX);
          runX += runW(run);
        }
      }

      ctx.restore();
      y += LINE_SPACING[line.kind];
    }
    ctx.globalAlpha = 1;
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
