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
import { connPoint } from "../layout";
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

// ── Soft word-wrap ───────────────────────────────────────────────────────
export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
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
): [number, number] {
  if ("shape" in src && (src as SceneNode).shape) {
    return connPoint(
      src as SceneNode,
      { x: dstCX - 1, y: dstCY - 1, w: 2, h: 2, shape: "box" } as SceneNode,
    );
  }
  return rectConnPoint(src.x, src.y, src.w, src.h, dstCX, dstCY);
}

// ── Group depth (for paint order) ────────────────────────────────────────
export function groupDepth(g: SceneGroup, gm: Map<string, SceneGroup>): number {
  let d = 0;
  let cur: SceneGroup | undefined = g;
  while (cur?.parentId) { d++; cur = gm.get(cur.parentId); }
  return d;
}
