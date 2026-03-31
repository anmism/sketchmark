// ============================================================
// sketchmark — SVG Rough Chart Drawing
// Drop this file as src/renderer/svg/roughChartSVG.ts
// and import renderRoughChartSVG into svg/index.ts.
//
// CHANGES TO svg/index.ts:
//   1. Remove the entire `const CL = mkGroup("chart-layer")` block
//   2. Add import at the top:
//        import { renderRoughChartSVG } from './roughChartSVG';
//   3. Replace removed block with:
//        const CL = mkGroup('chart-layer');
//        for (const c of sg.charts) CL.appendChild(renderRoughChartSVG(rc, c, palette, isDark));
//        svg.appendChild(CL);
//
//   Also remove the Chart.js `declare const Chart: any;` at the top of svg/index.ts
//   and the CHART_COLORS array (they live in roughChart.ts now).
// ============================================================

import type { SceneChart } from '../../scene';
import { DiagramPalette } from '../../theme';
import {
  CHART_COLORS,
  chartLayout,
  parseBarLine, parsePie, parseScatter,
  makeValueToY, makeValueToX, yTicks,
  pieArcPath, donutArcPath,
} from '../roughChart';
import { SVG_NS, ROUGH } from '../../config';

const NS = SVG_NS;
const se = (tag: string) => document.createElementNS(NS, tag);

function mkG(id?: string, cls?: string): SVGGElement {
  const g = se('g') as SVGGElement;
  if (id)  g.setAttribute('id', id);
  if (cls) g.setAttribute('class', cls);
  return g;
}

function mkT(
  txt: string, x: number, y: number,
  sz = 10, wt: number | string = 400,
  col = '#4a2e10', anchor = 'middle',
  font = 'system-ui, sans-serif',
): SVGTextElement {
  const t = se('text') as SVGTextElement;
  t.setAttribute('x', String(x));
  t.setAttribute('y', String(y));
  t.setAttribute('text-anchor', anchor);
  t.setAttribute('dominant-baseline', 'middle');
  t.setAttribute('font-family', font);
  t.setAttribute('font-size', String(sz));
  t.setAttribute('font-weight', String(wt));
  t.setAttribute('fill', col);
  t.setAttribute('pointer-events', 'none');
  t.textContent = txt;
  return t;
}

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) & 0xffff;
  return h;
}

// ── Rough.js interface (already declared in svg/index.ts — re-declared here for isolation) ──
interface RoughSVG {
  rectangle(x: number, y: number, w: number, h: number, opts?: any): SVGElement;
  ellipse(cx: number, cy: number, w: number, h: number, opts?: any): SVGElement;
  line(x1: number, y1: number, x2: number, y2: number, opts?: any): SVGElement;
  polygon(pts: [number, number][], opts?: any): SVGElement;
  path(d: string, opts?: any): SVGElement;
}

const BASE: any = { roughness: ROUGH.chartRoughness, bowing: ROUGH.bowing };

// ── Axes ───────────────────────────────────────────────────
function drawAxes(
  rc: RoughSVG, g: SVGGElement, c: SceneChart,
  px: number, py: number, pw: number, ph: number,
  allY: number[], labelCol: string, font = 'system-ui, sans-serif',
): void {
  // Y axis
  g.appendChild(rc.line(px, py, px, py + ph, {
    roughness: 0.4, seed: hashStr(c.id + 'ya'), stroke: labelCol, strokeWidth: 1,
  }));
  // X axis (baseline)
  const baseline = makeValueToY(allY, py, ph)(0);
  g.appendChild(rc.line(px, baseline, px + pw, baseline, {
    roughness: 0.4, seed: hashStr(c.id + 'xa'), stroke: labelCol, strokeWidth: 1,
  }));
  // Y ticks + labels
  const toY = makeValueToY(allY, py, ph);
  for (const tick of yTicks(allY)) {
    const ty = toY(tick);
    if (ty < py - 2 || ty > py + ph + 2) continue;
    g.appendChild(rc.line(px - 3, ty, px, ty, {
      roughness: 0.2, seed: hashStr(c.id + 'yt' + tick), stroke: labelCol, strokeWidth: 0.7,
    }));
    g.appendChild(mkT(fmtNum(tick), px - 5, ty, 9, 400, labelCol, 'end', font));
  }
}

function fmtNum(v: number): string {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k';
  return String(v);
}

// ── Legend row ─────────────────────────────────────────────
function legend(
  g: SVGGElement, labels: string[], colors: string[],
  x: number, y: number, labelCol: string, font = 'system-ui, sans-serif',
): void {
  labels.forEach((lbl, i) => {
    const dot = se('rect') as SVGRectElement;
    dot.setAttribute('x', String(x));
    dot.setAttribute('y', String(y + i * 14));
    dot.setAttribute('width', '8');
    dot.setAttribute('height', '8');
    dot.setAttribute('fill', colors[i % colors.length]);
    dot.setAttribute('rx', '1');
    g.appendChild(dot);
    g.appendChild(mkT(lbl, x + 12, y + i * 14 + 4, 9, 400, labelCol, 'start', font));
  });
}

// ── Public entry ───────────────────────────────────────────
export function renderRoughChartSVG(
  rc: RoughSVG,
  c: SceneChart,
  palette: DiagramPalette,
  isDark: boolean,
): SVGGElement {
  const cg = mkG(`chart-${c.id}`, 'cg');
  const s  = c.style ?? {};

  // style/theme props, falling back to palette
  const bgFill  = String(s.fill   ?? palette.nodeFill);
  const bgStroke = String(s.stroke ?? (isDark ? '#5a4a30' : '#c8b898'));
  const lc      = String(s.color  ?? palette.titleText);
  const cFont   = String(s.font ? `${s.font}, system-ui, sans-serif` : 'system-ui, sans-serif');
  const cFontSize = Number(s.fontSize ?? 12);
  const cFontWeight = s.fontWeight ?? 600;

  if (s.opacity != null) cg.setAttribute('opacity', String(s.opacity));

  // Background box
cg.appendChild(rc.rectangle(c.x, c.y, c.w, c.h, {
    ...BASE, seed: hashStr(c.id),
    fill: bgFill, fillStyle: 'solid',
    stroke: bgStroke, strokeWidth: Number(s.strokeWidth ?? 1.2),
    ...(s.strokeDash ? { strokeLineDash: s.strokeDash } : {}),
  }));

  // Title
  if (c.label) {
    cg.appendChild(mkT(c.label, c.x + c.w / 2, c.y + 14, cFontSize, cFontWeight, lc, 'middle', cFont));
  }

  const { px, py, pw, ph, cx, cy } = chartLayout(c);

  // ── Pie / Donut ──────────────────────────────────────────
  if (c.chartType === 'pie' || c.chartType === 'donut') {
    const { segments, total } = parsePie(c.data);
    const r  = Math.min(c.w * 0.38, (c.h - (c.label ? 24 : 8)) * 0.44);
    const ir = c.chartType === 'donut' ? r * 0.48 : 0;
    const legendX = c.x + 8;
    const legendY = c.y + (c.label ? 28 : 12);

    let angle = -Math.PI / 2;
    for (const seg of segments) {
      const sweep = (seg.value / total) * Math.PI * 2;
      const d = c.chartType === 'donut'
        ? donutArcPath(cx, cy, r, ir, angle, angle + sweep)
        : pieArcPath(cx, cy, r, angle, angle + sweep);
      cg.appendChild(rc.path(d, {
        roughness: 1.0, bowing: 0.5, seed: hashStr(c.id + seg.label),
        fill:      seg.color + 'bb',
        fillStyle: 'solid',
        stroke:    seg.color,
        strokeWidth: 1.4,
      }));
      angle += sweep;
    }

    // Mini legend on left
    legend(
      cg,
      segments.map(s => `${s.label} ${Math.round(s.value / total * 100)}%`),
      segments.map(s => s.color),
      legendX, legendY, lc, cFont,
    );
    return cg;
  }

  // ── Scatter ───────────────────────────────────────────────
  if (c.chartType === 'scatter') {
    const pts = parseScatter(c.data);
    const xs  = pts.map(p => p.x), ys = pts.map(p => p.y);
    const toX = makeValueToX(xs, px, pw);
    const toY = makeValueToY(ys, py, ph);

    // Simple axes (no named ticks — raw data ranges)
    cg.appendChild(rc.line(px, py, px, py + ph, { roughness: 0.4, seed: hashStr(c.id + 'ya'), stroke: lc, strokeWidth: 1 }));
    cg.appendChild(rc.line(px, py + ph, px + pw, py + ph, { roughness: 0.4, seed: hashStr(c.id + 'xa'), stroke: lc, strokeWidth: 1 }));

    pts.forEach((pt, i) => {
      cg.appendChild(rc.ellipse(toX(pt.x), toY(pt.y), 10, 10, {
        roughness: 0.8, seed: hashStr(c.id + pt.label),
        fill:      CHART_COLORS[i % CHART_COLORS.length] + '99',
        fillStyle: 'solid',
        stroke:    CHART_COLORS[i % CHART_COLORS.length],
        strokeWidth: 1.2,
      }));
    });

    legend(cg, pts.map(p => p.label), CHART_COLORS, c.x + 8, c.y + (c.label ? 28 : 12), lc, cFont);
    return cg;
  }

  // ── Bar / Line / Area ─────────────────────────────────────
  const { labels, series } = parseBarLine(c.data);
  const allY    = series.flatMap(s => s.values);
  const toY     = makeValueToY(allY, py, ph);
  const baseline = toY(0);
  const n       = labels.length;

  drawAxes(rc, cg, c, px, py, pw, ph, allY, lc, cFont);

  // X labels
  labels.forEach((lbl, i) => {
    cg.appendChild(mkT(lbl, px + (i + 0.5) * (pw / n), py + ph + 14, 9, 400, lc, 'middle', cFont));
  });

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
        cg.appendChild(rc.rectangle(bx, by, barW, bh, {
          roughness: 1.1, bowing: 0.5,
          seed:      hashStr(c.id + si + i),
          fill:      ser.color + 'bb',
          fillStyle: 'hachure',
          hachureAngle:  -41,
          hachureGap:    4,
          fillWeight:    0.8,
          stroke:    ser.color,
          strokeWidth: 1.2,
        }));
      });
    });

  } else {
    // line / area — x positions evenly spaced
    const stepX = n > 1 ? pw / (n - 1) : 0;

    series.forEach((ser, si) => {
      const pts = ser.values.map((v, i): [number, number] => [
        n > 1 ? px + i * stepX : px + pw / 2,
        toY(v),
      ]);

      // Area fill polygon
      if (c.chartType === 'area') {
        const poly: [number, number][] = [
          [pts[0][0], baseline],
          ...pts,
          [pts[pts.length - 1][0], baseline],
        ];
        cg.appendChild(rc.polygon(poly, {
          roughness: 0.5, seed: hashStr(c.id + 'af' + si),
          fill:      ser.color + '44',
          fillStyle: 'solid',
          stroke:    'none',
        }));
      }

      // Line segments
      for (let i = 0; i < pts.length - 1; i++) {
        cg.appendChild(rc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], {
          roughness: 0.9, bowing: 0.6,
          seed:   hashStr(c.id + si + i),
          stroke: ser.color,
          strokeWidth: 1.8,
        }));
      }

      // Point dots
      pts.forEach(([px2, py2], i) => {
        cg.appendChild(rc.ellipse(px2, py2, 7, 7, {
          roughness: 0.3, seed: hashStr(c.id + 'dot' + si + i),
          fill:      ser.color,
          fillStyle: 'solid',
          stroke:    ser.color,
          strokeWidth: 1,
        }));
      });
    });
  }

  // Multi-series legend
  if (series.length > 1) {
    legend(
      cg,
      series.map(s => s.name),
      series.map(s => s.color),
      px, py - 2, lc, cFont,
    );
  }

  return cg;
}