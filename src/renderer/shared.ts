// ============================================================
// sketchmark — Shared Renderer Utilities
//
// Functions used by both SVG and Canvas renderers, extracted
// to eliminate duplication (Phase 1 of SOLID refactoring).
// ============================================================

import type {
  SceneNode,
  SceneGroup,
  SceneTable,
  SceneChart,
} from "../scene";
import type { EdgePoint } from "../ast/types";
import { anchoredConnPoint } from "../layout";
import { resolveFont, loadFont } from "../fonts";

// ── Hash string to seed ───────────────────────────────────────────────────
export function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) & 0xffff;
  return h;
}

// ── Darken a CSS hex colour by `amount` (0–1) ────────────────────────────
export function darkenHex(hex: string, amount = 0.12): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const d = (v: string) => Math.max(0, Math.round(parseInt(v, 16) * (1 - amount)));
  return `#${d(m[1]).toString(16).padStart(2,"0")}${d(m[2]).toString(16).padStart(2,"0")}${d(m[3]).toString(16).padStart(2,"0")}`;
}

// ── Load + resolve font from style or fall back ──────────────────────────
export function resolveStyleFont(
  style: Record<string, unknown>,
  fallback: string,
): string {
  const raw = String(style["font"] ?? "");
  if (!raw) return fallback;
  loadFont(raw);
  return resolveFont(raw);
}

// ── Text measurement (re-exported from utils to keep existing imports working)
export { buildFontStr, measureTextWidth, wrapText } from '../utils/text-measure';

// ── Inner text width per shape (for wrapping inside non-rectangular shapes)
const SHAPE_TEXT_RATIO: Record<string, number> = {
  circle:        0.65,
  diamond:       0.45,
  hexagon:       0.55,
  triangle:      0.40,
};

export function shapeInnerTextWidth(shape: string, w: number, padding: number): number {
  const ratio = SHAPE_TEXT_RATIO[shape];
  if (ratio) return w * ratio;
  return w - padding * 2;
}

// ── Arrow direction from connector ───────────────────────────────────────
export function connMeta(connector: string): {
  arrowAt: "end" | "start" | "both" | "none";
  dashed: boolean;
} {
  if (connector === "--")  return { arrowAt: "none", dashed: false };
  if (connector === "---") return { arrowAt: "none", dashed: true  };
  const bidir = connector.includes("<") && connector.includes(">");
  if (bidir) return { arrowAt: "both", dashed: connector.includes("--") };
  const back   = connector.startsWith("<");
  const dashed = connector.includes("--");
  if (back) return { arrowAt: "start", dashed };
  return { arrowAt: "end", dashed };
}

// ── Generic rect connection point ────────────────────────────────────────
export function rectConnPoint(
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

// ── Resolve an endpoint entity by ID across all maps ─────────────────────
export function resolveEndpoint(
  id:  string,
  nm:  Map<string, SceneNode>,
  tm:  Map<string, SceneTable>,
  gm:  Map<string, SceneGroup>,
  cm:  Map<string, SceneChart>,
): { x: number; y: number; w: number; h: number; shape?: string } | null {
  return nm.get(id) ?? tm.get(id) ?? gm.get(id) ?? cm.get(id) ?? null;
}

// ── Get connection point for any entity ──────────────────────────────────
export function getConnPoint(
  src:   { x: number; y: number; w: number; h: number; shape?: string },
  dstCX: number,
  dstCY: number,
  anchor?: string,
): [number, number] {
  return anchoredConnPoint(src, anchor, dstCX, dstCY);
}

// ── Group depth (for paint order) ────────────────────────────────────────
function segmentLength(a: EdgePoint, b: EdgePoint): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function compactPolylinePoints(points: EdgePoint[]): EdgePoint[] {
  const compacted: EdgePoint[] = [];
  for (const point of points) {
    const previous = compacted[compacted.length - 1];
    if (!previous || segmentLength(previous, point) > 0.01) {
      compacted.push(point);
    }
  }
  return compacted;
}

export function polylinePathData(points: EdgePoint[]): string {
  return points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
}

export function polylineEndpointDirection(
  points: EdgePoint[],
  end: "start" | "end",
): EdgePoint {
  const step = end === "start" ? 1 : -1;
  let index = end === "start" ? 0 : points.length - 1;

  while (index + step >= 0 && index + step < points.length) {
    const from = points[index]!;
    const to = points[index + step]!;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy);
    if (len > 0.01) {
      return end === "start" ? [dx / len, dy / len] : [-dx / len, -dy / len];
    }
    index += step;
  }

  return [1, 0];
}

export function insetPolylineEndpoints(
  points: EdgePoint[],
  arrowAt: "end" | "start" | "both" | "none",
  inset: number,
): EdgePoint[] {
  const next = points.map((point): EdgePoint => [point[0], point[1]]);
  if (next.length < 2) return next;

  if (arrowAt === "start" || arrowAt === "both") {
    const [dx, dy] = polylineEndpointDirection(next, "start");
    next[0] = [next[0]![0] + dx * inset, next[0]![1] + dy * inset];
  }

  if (arrowAt === "end" || arrowAt === "both") {
    const [dx, dy] = polylineEndpointDirection(next, "end");
    const last = next.length - 1;
    next[last] = [next[last]![0] - dx * inset, next[last]![1] - dy * inset];
  }

  return compactPolylinePoints(next);
}

export function polylineLabelPosition(
  points: EdgePoint[],
  offset: number,
  dx = 0,
  dy = 0,
): { x: number; y: number } {
  if (points.length < 2) {
    const [x, y] = points[0] ?? [0, 0];
    return { x: x + dx, y: y + dy };
  }

  const lengths = points.slice(1).map((point, index) => segmentLength(points[index]!, point));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  if (total <= 0.01) {
    const [x, y] = points[0]!;
    return { x: x + dx, y: y + dy };
  }

  let travelled = 0;
  const target = total / 2;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index]!;
    if (travelled + length >= target) {
      const from = points[index]!;
      const to = points[index + 1]!;
      const t = length > 0 ? (target - travelled) / length : 0;
      const ux = (to[0] - from[0]) / length;
      const uy = (to[1] - from[1]) / length;
      return {
        x: from[0] + (to[0] - from[0]) * t - uy * offset + dx,
        y: from[1] + (to[1] - from[1]) * t + ux * offset + dy,
      };
    }
    travelled += length;
  }

  const [x, y] = points[points.length - 1]!;
  return { x: x + dx, y: y + dy };
}

function rectBoundaryPoint(
  entity: { x: number; y: number; w: number; h: number },
  point: EdgePoint,
  direction: EdgePoint,
): EdgePoint {
  const [px, py] = point;
  const [dx, dy] = direction;
  const candidates: number[] = [];
  const minX = entity.x;
  const maxX = entity.x + entity.w;
  const minY = entity.y;
  const maxY = entity.y + entity.h;
  const epsilon = 0.01;

  if (Math.abs(dx) > epsilon) {
    candidates.push((minX - px) / dx, (maxX - px) / dx);
  }
  if (Math.abs(dy) > epsilon) {
    candidates.push((minY - py) / dy, (maxY - py) / dy);
  }

  const valid = candidates
    .filter((t) => t >= -epsilon)
    .map((t) => ({
      t: Math.max(0, t),
      x: px + dx * t,
      y: py + dy * t,
    }))
    .filter(
      ({ x, y }) =>
        x >= minX - epsilon &&
        x <= maxX + epsilon &&
        y >= minY - epsilon &&
        y <= maxY + epsilon,
    )
    .sort((a, b) => a.t - b.t);

  const hit = valid[0];
  return hit ? [hit.x, hit.y] : point;
}

function ellipseBoundaryPoint(
  entity: { x: number; y: number; w: number; h: number },
  point: EdgePoint,
  direction: EdgePoint,
): EdgePoint {
  const [px, py] = point;
  const [dx, dy] = direction;
  const cx = entity.x + entity.w / 2;
  const cy = entity.y + entity.h / 2;
  const rx = Math.max(1, entity.w * 0.44);
  const ry = Math.max(1, entity.h * 0.44);

  const x0 = px - cx;
  const y0 = py - cy;
  const a = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  const b = 2 * ((x0 * dx) / (rx * rx) + (y0 * dy) / (ry * ry));
  const c = (x0 * x0) / (rx * rx) + (y0 * y0) / (ry * ry) - 1;
  const disc = b * b - 4 * a * c;
  if (a <= 0 || disc < 0) return point;

  const sqrt = Math.sqrt(disc);
  const hits = [(-b - sqrt) / (2 * a), (-b + sqrt) / (2 * a)]
    .filter((t) => t >= -0.01)
    .sort((left, right) => left - right);
  const t = Math.max(0, hits[0] ?? 0);
  return [px + dx * t, py + dy * t];
}

export function polylineArrowTipPoint(
  entity: { x: number; y: number; w: number; h: number; shape?: string },
  points: EdgePoint[],
  end: "start" | "end",
): EdgePoint {
  const point = end === "start" ? points[0] : points[points.length - 1];
  if (!point) return [0, 0];

  const [dx, dy] = polylineEndpointDirection(points, end);
  const outward: EdgePoint = end === "start" ? [dx, dy] : [-dx, -dy];
  if (Math.hypot(outward[0], outward[1]) <= 0.01) return point;

  if (entity.shape === "circle") {
    return ellipseBoundaryPoint(entity, point, outward);
  }

  return rectBoundaryPoint(entity, point, outward);
}

export function groupDepth(g: SceneGroup, gm: Map<string, SceneGroup>): number {
  let d = 0;
  let cur: SceneGroup | undefined = g;
  while (cur?.parentId) { d++; cur = gm.get(cur.parentId); }
  return d;
}
