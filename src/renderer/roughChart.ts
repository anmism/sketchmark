// ============================================================
// sketchmark — Rough Chart Math
// Shared data-processing and layout helpers for both renderers.
// No rough.js dependency — pure geometry.
// ============================================================

export const CHART_COLORS = [
  '#378ADD', '#1D9E75', '#D85A30', '#BA7517',
  '#7F77DD', '#D4537E', '#639922', '#E24B4A',
];

// ── Chart plot area ────────────────────────────────────────
export interface ChartLayout {
  px: number;   // plot origin X
  py: number;   // plot origin Y
  pw: number;   // plot width
  ph: number;   // plot height
  titleH: number;
  cx: number;   // chart center X (for pie/donut)
  cy: number;   // chart center Y (for pie/donut)
}

export function chartLayout(c: {
  x: number; y: number; w: number; h: number; title?: string;
}): ChartLayout {
  const titleH = c.title ? 24 : 8;
  const padL = 44, padR = 12, padB = 28, padT = 6;
  const pw = c.w - padL - padR;
  const ph = c.h - titleH - padT - padB;
  return {
    px: c.x + padL,
    py: c.y + titleH + padT,
    pw, ph, titleH,
    cx: c.x + c.w / 2,
    cy: c.y + titleH + padT + ph / 2,
  };
}

// ── Data parsers ───────────────────────────────────────────
export interface BarLineSeries {
  name:   string;
  values: number[];
  color:  string;
}
export interface BarLineData {
  labels: string[];
  series: BarLineSeries[];
}
export function parseBarLine(data: {
  headers: string[];
  rows: (string | number)[][];
}): BarLineData {
  return {
    labels: data.rows.map(r => String(r[0])),
    series: data.headers.slice(1).map((h, si) => ({
      name:   String(h),
      values: data.rows.map(r => Number(r[si + 1])),
      color:  CHART_COLORS[si % CHART_COLORS.length],
    })),
  };
}

export interface PieSegment { label: string; value: number; color: string; }
export interface PieData { segments: PieSegment[]; total: number; }
export function parsePie(data: { rows: (string | number)[][] }): PieData {
  const segments = data.rows.map((r, i) => ({
    label: String(r[0]),
    value: Number(r[1]),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));
  return { segments, total: segments.reduce((s, g) => s + g.value, 0) };
}

export interface ScatterPoint { label: string; x: number; y: number; }
export function parseScatter(data: { rows: (string | number)[][] }): ScatterPoint[] {
  return data.rows.map(r => ({
    label: String(r[0]), x: Number(r[1]), y: Number(r[2]),
  }));
}

// ── Value → pixel mappers ──────────────────────────────────
export function makeValueToY(
  allValues: number[], py: number, ph: number,
): (v: number) => number {
  const lo = Math.min(0, ...allValues);
  const hi = Math.max(...allValues);
  const range = hi - lo || 1;
  return (v: number) => py + ph - ((v - lo) / range) * ph;
}

export function makeValueToX(
  allValues: number[], px: number, pw: number,
): (v: number) => number {
  const lo = Math.min(...allValues);
  const hi = Math.max(...allValues);
  const range = hi - lo || 1;
  return (v: number) => px + ((v - lo) / range) * pw;
}

/** Nice round tick values for a Y axis. */
export function yTicks(allValues: number[]): number[] {
  const lo  = Math.min(0, ...allValues);
  const hi  = Math.max(...allValues);
  const rng = hi - lo || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(rng)));
  const step = rng / mag > 5 ? mag * 2 : rng / mag > 2 ? mag : mag / 2;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 0.01; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  return ticks;
}

// ── SVG arc path helpers ───────────────────────────────────
export function pieArcPath(
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number,
): string {
  const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle),   y2 = cy + r * Math.sin(endAngle);
  const lg = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} Z`;
}

export function donutArcPath(
  cx: number, cy: number, r: number, ir: number,
  startAngle: number, endAngle: number,
): string {
  const x1  = cx + r  * Math.cos(startAngle), y1  = cy + r  * Math.sin(startAngle);
  const x2  = cx + r  * Math.cos(endAngle),   y2  = cy + r  * Math.sin(endAngle);
  const ix1 = cx + ir * Math.cos(endAngle),   iy1 = cy + ir * Math.sin(endAngle);
  const ix2 = cx + ir * Math.cos(startAngle), iy2 = cy + ir * Math.sin(startAngle);
  const lg = endAngle - startAngle > Math.PI ? 1 : 0;
  return (
    `M ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} ` +
    `L ${ix1} ${iy1} A ${ir} ${ir} 0 ${lg} 0 ${ix2} ${iy2} Z`
  );
}