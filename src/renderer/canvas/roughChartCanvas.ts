// ============================================================
// sketchmark — Canvas Rough Chart Drawing
// Drop this file as src/renderer/canvas/roughChartCanvas.ts
// and import drawRoughChartCanvas into canvas/index.ts.
//
// CHANGES TO canvas/index.ts:
//   1. Remove the entire `function drawChart(...)` function
//   2. Remove the `declare const Chart: any;` declaration
//   3. Remove the CHART_COLORS array (lives in roughChart.ts now)
//   4. Add import at the top:
//        import { drawRoughChartCanvas } from './roughChartCanvas';
//   5. In the "── Charts ──" section replace:
//        for (const c of sg.charts) drawChart(ctx, c, pal);
//      with:
//        for (const c of sg.charts) drawRoughChartCanvas(rc, ctx, c, pal, R);
// ============================================================

import type { SceneChart } from '../../scene';
import {
  CHART_COLORS,
  chartLayout,
  parseBarLine, parsePie, parseScatter,
  makeValueToY, makeValueToX, yTicks,
} from '../roughChart';

interface RoughCanvas {
  rectangle(x: number, y: number, w: number, h: number, opts?: any): void;
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

function fmtNum(v: number): string {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k';
  return String(v);
}

// ── Pie arc helpers ────────────────────────────────────────
// Canvas renderer draws pie arcs natively (no SVG path needed).
function drawPieArc(
  rc: RoughCanvas, ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, ir: number,
  startAngle: number, endAngle: number,
  color: string, seed: number,
): void {
  // Build polygon approximation of the arc segment for rough.js
  const STEPS = 32;
  const pts: [number, number][] = [];

  if (ir > 0) {
    // Donut: outer arc CCW, inner arc CW
    for (let i = 0; i <= STEPS; i++) {
      const a = startAngle + (endAngle - startAngle) * (i / STEPS);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    for (let i = STEPS; i >= 0; i--) {
      const a = startAngle + (endAngle - startAngle) * (i / STEPS);
      pts.push([cx + ir * Math.cos(a), cy + ir * Math.sin(a)]);
    }
  } else {
    // Pie: center + arc points
    pts.push([cx, cy]);
    for (let i = 0; i <= STEPS; i++) {
      const a = startAngle + (endAngle - startAngle) * (i / STEPS);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }

  rc.polygon(pts, {
    roughness: 1.0, bowing: 0.5, seed,
    fill:      color + 'bb',
    fillStyle: 'solid',
    stroke:    color,
    strokeWidth: 1.4,
  });
}

// ── Axes ───────────────────────────────────────────────────
function drawAxes(
  rc: RoughCanvas, ctx: CanvasRenderingContext2D, c: SceneChart,
  px: number, py: number, pw: number, ph: number,
  allY: number[], labelCol: string, R: any,
): void {
  const toY      = makeValueToY(allY, py, ph);
  const baseline = toY(0);

  // Y axis
  rc.line(px, py, px, py + ph, { ...R, roughness: 0.4, seed: hashStr(c.id + 'ya'), stroke: labelCol, strokeWidth: 1 });
  // X axis (baseline)
  rc.line(px, baseline, px + pw, baseline, { ...R, roughness: 0.4, seed: hashStr(c.id + 'xa'), stroke: labelCol, strokeWidth: 1 });

  // Y ticks + labels
  for (const tick of yTicks(allY)) {
    const ty = toY(tick);
    if (ty < py - 2 || ty > py + ph + 2) continue;
    rc.line(px - 3, ty, px, ty, { roughness: 0.2, seed: hashStr(c.id + 'yt' + tick), stroke: labelCol, strokeWidth: 0.7 });
    ctx.save();
    ctx.font         = '400 9px system-ui, sans-serif';
    ctx.fillStyle    = labelCol;
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(fmtNum(tick), px - 5, ty);
    ctx.restore();
  }
}

// ── Legend ─────────────────────────────────────────────────
function drawLegend(
  ctx: CanvasRenderingContext2D,
  labels: string[], colors: string[],
  x: number, y: number, labelCol: string,
): void {
  ctx.save();
  ctx.font         = '400 9px system-ui, sans-serif';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  labels.forEach((lbl, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x, y + i * 14, 8, 8);
    ctx.fillStyle = labelCol;
    ctx.fillText(lbl, x + 12, y + i * 14 + 4);
  });
  ctx.restore();
}

// ── Public entry ───────────────────────────────────────────
export function drawRoughChartCanvas(
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
  c: SceneChart,
  pal: { nodeFill: string; nodeStroke: string; labelText: string; labelBg: string },
  R: any,
): void {
 const s  = c.style ?? {};

  // Background
 const bgFill   = String(s.fill   ?? pal.nodeFill);
  const bgStroke = String(s.stroke ?? (pal.nodeStroke === 'none' ? '#c8b898' : pal.nodeStroke));
  const lc       = String(s.color  ?? pal.labelText);

  // Background
  rc.rectangle(c.x, c.y, c.w, c.h, {
    ...R, seed: hashStr(c.id),
    fill:      bgFill,
    fillStyle: 'solid',
    stroke:    bgStroke,
    strokeWidth: Number(s.strokeWidth ?? 1.2),
    ...(s.strokeDash ? { strokeLineDash: s.strokeDash } : {}),
  });
  
  // Title
  if (c.title) {
    ctx.save();
    ctx.font         = '600 12px system-ui, sans-serif';
    ctx.fillStyle    = lc;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.title, c.x + c.w / 2, c.y + 14);
    ctx.restore();
  }

  const { px, py, pw, ph, cx, cy } = chartLayout(c);

  // ── Pie / Donut ──────────────────────────────────────────
  if (c.chartType === 'pie' || c.chartType === 'donut') {
    const { segments, total } = parsePie(c.data);
    const r  = Math.min(c.w * 0.38, (c.h - (c.title ? 24 : 8)) * 0.44);
    const ir = c.chartType === 'donut' ? r * 0.48 : 0;
    const legendX = c.x + 8;
    const legendY = c.y + (c.title ? 28 : 12);

    let angle = -Math.PI / 2;
    segments.forEach((seg, i) => {
      const sweep = (seg.value / total) * Math.PI * 2;
      drawPieArc(rc, ctx, cx, cy, r, ir, angle, angle + sweep, seg.color, hashStr(c.id + seg.label + i));
      angle += sweep;
    });

    drawLegend(
      ctx,
      segments.map(s => `${s.label} ${Math.round(s.value / total * 100)}%`),
      segments.map(s => s.color),
      legendX, legendY, lc,
    );
    return;
  }

  // ── Scatter ───────────────────────────────────────────────
  if (c.chartType === 'scatter') {
    const pts = parseScatter(c.data);
    const xs  = pts.map(p => p.x), ys = pts.map(p => p.y);
    const toX = makeValueToX(xs, px, pw);
    const toY = makeValueToY(ys, py, ph);

    rc.line(px, py, px, py + ph, { ...R, roughness: 0.4, seed: hashStr(c.id + 'ya'), stroke: lc, strokeWidth: 1 });
    rc.line(px, py + ph, px + pw, py + ph, { ...R, roughness: 0.4, seed: hashStr(c.id + 'xa'), stroke: lc, strokeWidth: 1 });

    pts.forEach((pt, i) => {
      rc.ellipse(toX(pt.x), toY(pt.y), 10, 10, {
        roughness: 0.8, seed: hashStr(c.id + pt.label),
        fill:      CHART_COLORS[i % CHART_COLORS.length] + '99',
        fillStyle: 'solid',
        stroke:    CHART_COLORS[i % CHART_COLORS.length],
        strokeWidth: 1.2,
      });
    });

    drawLegend(ctx, pts.map(p => p.label), CHART_COLORS, c.x + 8, c.y + (c.title ? 28 : 12), lc);
    return;
  }

  // ── Bar / Line / Area ─────────────────────────────────────
  const { labels, series } = parseBarLine(c.data);
  const allY    = series.flatMap(s => s.values);
  const toY     = makeValueToY(allY, py, ph);
  const baseline = toY(0);
  const n       = labels.length;

  drawAxes(rc, ctx, c, px, py, pw, ph, allY, lc, R);

  // X labels
  ctx.save();
  ctx.font         = '400 9px system-ui, sans-serif';
  ctx.fillStyle    = lc;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  labels.forEach((lbl, i) => {
    ctx.fillText(lbl, px + (i + 0.5) * (pw / n), py + ph + 6);
  });
  ctx.restore();

  if (c.chartType === 'bar') {
    const groupW = pw / n;
    const m      = series.length;
    const barW   = (groupW / m) * 0.72;
    const slip   = (groupW - barW * m) / (m + 1);

    series.forEach((ser, si) => {
      ser.values.forEach((val, i) => {
        const bx = px + i * groupW + slip + si * (barW + slip);
        const by = Math.min(toY(val), baseline);
        const bh = Math.abs(baseline - toY(val)) || 2;
        rc.rectangle(bx, by, barW, bh, {
          roughness: 1.1, bowing: 0.5,
          seed:      hashStr(c.id + si + i),
          fill:      ser.color + 'bb',
          fillStyle: 'hachure',
          hachureAngle: -41,
          hachureGap:   4,
          fillWeight:   0.8,
          stroke:    ser.color,
          strokeWidth: 1.2,
        });
      });
    });

  } else {
    // line / area
    const stepX = n > 1 ? pw / (n - 1) : 0;

    series.forEach((ser, si) => {
      const pts = ser.values.map((v, i): [number, number] => [
        n > 1 ? px + i * stepX : px + pw / 2,
        toY(v),
      ]);

      // Area fill
      if (c.chartType === 'area') {
        const poly: [number, number][] = [
          [pts[0][0], baseline],
          ...pts,
          [pts[pts.length - 1][0], baseline],
        ];
        rc.polygon(poly, {
          roughness: 0.5, seed: hashStr(c.id + 'af' + si),
          fill:      ser.color + '44',
          fillStyle: 'solid',
          stroke:    'none',
        });
      }

      // Lines
      for (let i = 0; i < pts.length - 1; i++) {
        rc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], {
          roughness: 0.9, bowing: 0.6,
          seed:   hashStr(c.id + si + i),
          stroke: ser.color,
          strokeWidth: 1.8,
        });
      }

      // Dots
      pts.forEach(([px2, py2], i) => {
        rc.ellipse(px2, py2, 7, 7, {
          roughness: 0.3, seed: hashStr(c.id + 'dot' + si + i),
          fill:      ser.color,
          fillStyle: 'solid',
          stroke:    ser.color,
          strokeWidth: 1,
        });
      });
    });
  }

  // Multi-series legend
  if (series.length > 1) {
    drawLegend(ctx, series.map(s => s.name), series.map(s => s.color), px, py - 2, lc);
  }
}