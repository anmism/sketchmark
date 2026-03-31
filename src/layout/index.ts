// ============================================================
// sketchmark — Layout Engine  (Flexbox-style, recursive)
//
// Two-pass algorithm:
//   Pass 1  measure()  bottom-up : computes w, h for every group
//   Pass 2  place()    top-down  : assigns x, y to every item
//
// Each group is a CSS-like flex container:
//   layout=row       → flex-direction: row
//   layout=column    → flex-direction: column   (default)
//   layout=grid      → CSS grid (fixed columns count)
//   align=…          → align-items
//   justify=…        → justify-content
// ============================================================

import type {
  SceneGraph,
  SceneNode,
  SceneGroup,
  SceneTable,
  SceneChart,
} from "../scene";
import type { GroupChildRef } from "../ast/types";
import { nodeMap, groupMap, tableMap, chartMap } from "../scene";

import { markdownMap } from "../scene";
import { calcMarkdownHeight } from "../markdown/parser";
import type { SceneMarkdown } from "../scene";
import { buildEntityMap } from "./entity-rect";
import type { EntityRect } from "./entity-rect";
import { getShape } from "../renderer/shapes";
import { LAYOUT, NODE, TABLE } from "../config";


// ── Node auto-sizing ──────────────────────────────────────
function sizeNode(n: SceneNode): void {
  // User-specified dimensions win
  if (n.width && n.width > 0) n.w = n.width;
  if (n.height && n.height > 0) n.h = n.height;

  const labelW = Math.round(n.label.length * NODE.fontPxPerChar + NODE.basePad);
  const shape = getShape(n.shape);
  if (shape) {
    shape.size(n, labelW);
  } else {
    // fallback for unknown shapes — box-like default
    n.w = n.w || Math.max(90, Math.min(180, labelW));
    n.h = n.h || 52;
  }
}

// ── Table auto-sizing ─────────────────────────────────────
function sizeTable(t: SceneTable): void {
  const { rows, labelH, headerH, rowH } = t;
  if (!rows.length) {
    t.w = 120;
    t.h = labelH + rowH;
    return;
  }

  const numCols = Math.max(...rows.map((r) => r.cells.length));
  const colW = Array(numCols).fill(TABLE.minColW) as number[];

  for (const row of rows) {
    row.cells.forEach((cell, i) => {
      colW[i] = Math.max(colW[i], Math.ceil(cell.length * TABLE.fontPxPerChar) + TABLE.cellPad);
    });
  }

  t.colWidths = colW;
  t.w = colW.reduce((s, w) => s + w, 0);

  const nHeader = rows.filter((r) => r.kind === "header").length;
  const nData = rows.filter((r) => r.kind === "data").length;
  t.h = labelH + nHeader * headerH + nData * rowH;
}
function sizeChart(_c: SceneChart): void {
  // defaults already applied in buildSceneGraph
}

function sizeMarkdown(m: SceneMarkdown): void {
  const pad = Number(m.style?.padding ?? 16);
  m.w = m.width ?? 400;
  m.h = m.height ?? calcMarkdownHeight(m.lines, pad);
}

// ── Item size helpers (entity-map based) ─────────────────
function iW(r: GroupChildRef, em: Map<string, EntityRect>): number {
  return em.get(r.id)!.w;
}

function iH(r: GroupChildRef, em: Map<string, EntityRect>): number {
  return em.get(r.id)!.h;
}

function setPos(r: GroupChildRef, x: number, y: number, em: Map<string, EntityRect>): void {
  const e = em.get(r.id)!;
  e.x = Math.round(x);
  e.y = Math.round(y);
}

// ── Pass 1: Measure (bottom-up) ───────────────────────────
// Recursively computes w, h for a group from its children's sizes.
function measure(
  g: SceneGroup,
  gm: Map<string, SceneGroup>,
  tm: Map<string, SceneTable>,
  cm: Map<string, SceneChart>,
  mdm: Map<string, SceneMarkdown>,
  em: Map<string, EntityRect>,
): void {
  // Recurse into nested groups first; size tables before reading their dims
  for (const r of g.children) {
    if (r.kind === "group") measure(gm.get(r.id)!, gm, tm, cm, mdm, em);
    if (r.kind === "table") sizeTable(tm.get(r.id)!);
    if (r.kind === "chart") sizeChart(cm.get(r.id)!);
    if (r.kind === "markdown") sizeMarkdown(mdm.get(r.id)!);
  }

  const { padding: pad, gap, columns, layout } = g;
  const kids = g.children;
  const labelH = g.label ? LAYOUT.groupLabelH : 0;

  if (!kids.length) {
    g.w = pad * 2;
    g.h = pad * 2 + labelH;
    if (g.width && g.w < g.width) g.w = g.width;
    if (g.height && g.h < g.height) g.h = g.height;
    return;
  }

  const ws = kids.map((r) => iW(r, em));
  const hs = kids.map((r) => iH(r, em));
  const n = kids.length;

  if (layout === "row") {
    g.w = ws.reduce((s, w) => s + w, 0) + gap * (n - 1) + pad * 2;
    g.h = Math.max(...hs) + pad * 2 + labelH;
  } else if (layout === "grid") {
    const cols = Math.max(1, columns);
    const rows = Math.ceil(n / cols);
    const cellW = Math.max(...ws);
    const cellH = Math.max(...hs);
    g.w = cols * cellW + (cols - 1) * gap + pad * 2;
    g.h = rows * cellH + (rows - 1) * gap + pad * 2 + labelH;
  } else {
    // column (default)
    g.w = Math.max(...ws) + pad * 2;
    g.h = hs.reduce((s, h) => s + h, 0) + gap * (n - 1) + pad * 2 + labelH;
  }

  // Clamp to minWidth / minHeight — this is what gives distribute() free
  // space to work with for justify=center/end/space-between/space-around
  if (g.width && g.w < g.width) g.w = g.width;
  if (g.height && g.h < g.height) g.h = g.height;
}

// ── Justify distribution helper ───────────────────────────
function distribute(
  sizes: number[],
  contentSize: number,
  gap: number,
  justify: SceneGroup["justify"],
): { start: number; gaps: number[] } {
  const n = sizes.length;
  const totalSize = sizes.reduce((s, v) => s + v, 0);
  const gapCount = n - 1;

  switch (justify) {
    case "center": {
      const total = totalSize + gap * gapCount;
      return {
        start: Math.max(0, (contentSize - total) / 2),
        gaps: Array(gapCount).fill(gap),
      };
    }
    case "end": {
      const total = totalSize + gap * gapCount;
      return {
        start: Math.max(0, contentSize - total),
        gaps: Array(gapCount).fill(gap),
      };
    }
    case "space-between": {
      const g2 =
        gapCount > 0
          ? Math.max(gap, (contentSize - totalSize) / gapCount)
          : gap;
      return { start: 0, gaps: Array(gapCount).fill(g2) };
    }
    case "space-around": {
      const space = n > 0 ? (contentSize - totalSize) / n : gap;
      return {
        start: Math.max(0, space / 2),
        gaps: Array(gapCount).fill(Math.max(gap, space)),
      };
    }
    default: // start
      return { start: 0, gaps: Array(gapCount).fill(gap) };
  }
}

// ── Pass 2: Place (top-down) ──────────────────────────────
// Assigns x, y to each child. Assumes g.x / g.y already set by parent.
function place(
  g: SceneGroup,
  gm: Map<string, SceneGroup>,
  em: Map<string, EntityRect>,
): void {
  const { padding: pad, gap, columns, layout, align, justify } = g;
  const labelH = g.label ? LAYOUT.groupLabelH : 0;

  const contentX = g.x + pad;
  const contentY = g.y + labelH + pad;
  const contentW = g.w - pad * 2;
  const contentH = g.h - pad * 2 - labelH;
  const kids = g.children;
  if (!kids.length) return;

  if (layout === "row") {
    const ws = kids.map((r) => iW(r, em));
    const hs = kids.map((r) => iH(r, em));
    const { start, gaps } = distribute(ws, contentW, gap, justify);

    let x = contentX + start;
    for (let i = 0; i < kids.length; i++) {
      let y: number;
      switch (align) {
        case "center":
          y = contentY + (contentH - hs[i]) / 2;
          break;
        case "end":
          y = contentY + contentH - hs[i];
          break;
        default:
          y = contentY;
      }
      setPos(kids[i], x, y, em);
      x += ws[i] + (i < gaps.length ? gaps[i] : 0);
    }
  } else if (layout === "grid") {
    const cols = Math.max(1, columns);
    const cellW = Math.max(...kids.map((r) => iW(r, em)));
    const cellH = Math.max(...kids.map((r) => iH(r, em)));
    kids.forEach((ref, i) => {
      setPos(
        ref,
        contentX + (i % cols) * (cellW + gap),
        contentY + Math.floor(i / cols) * (cellH + gap),
        em,
      );
    });
  } else {
    // column (default)
    const ws = kids.map((r) => iW(r, em));
    const hs = kids.map((r) => iH(r, em));

    const { start, gaps } = distribute(hs, contentH, gap, justify);

    let y = contentY + start;
    for (let i = 0; i < kids.length; i++) {
      let x: number;
      switch (align) {
        case "center":
          x = contentX + (contentW - ws[i]) / 2;
          break;
        case "end":
          x = contentX + contentW - ws[i];
          break;
        default:
          x = contentX;
      }
      setPos(kids[i], x, y, em);
      y += hs[i] + (i < gaps.length ? gaps[i] : 0);
    }
  }

  // Recurse into nested groups
  for (const r of kids) {
    if (r.kind === "group") place(gm.get(r.id)!, gm, em);
  }
}

// ── Edge routing ──────────────────────────────────────────
export function connPoint(n: SceneNode, other: SceneNode): [number, number] {
  const cx = n.x + n.w / 2,
    cy = n.y + n.h / 2;
  const ox = other.x + other.w / 2,
    oy = other.y + other.h / 2;
  const dx = ox - cx,
    dy = oy - cy;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return [cx, cy];
  if (n.shape === "circle") {
    const r = n.w * 0.44,
      len = Math.sqrt(dx * dx + dy * dy);
    return [cx + (dx / len) * r, cy + (dy / len) * r];
  }
  const hw = n.w / 2 - 2,
    hh = n.h / 2 - 2;
  const tx = Math.abs(dx) > 0.01 ? hw / Math.abs(dx) : 1e9;
  const ty = Math.abs(dy) > 0.01 ? hh / Math.abs(dy) : 1e9;
  const t = Math.min(tx, ty);
  return [cx + t * dx, cy + t * dy];
}

// Tables act as rectangular nodes for edge routing
function tableConnPoint(
  t: SceneTable,
  ox: number,
  oy: number,
): [number, number] {
  const cx = t.x + t.w / 2,
    cy = t.y + t.h / 2;
  const dx = ox - cx,
    dy = oy - cy;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return [cx, cy];
  const hw = t.w / 2 - 2,
    hh = t.h / 2 - 2;
  const tx = Math.abs(dx) > 0.01 ? hw / Math.abs(dx) : 1e9;
  const ty = Math.abs(dy) > 0.01 ? hh / Math.abs(dy) : 1e9;
  const tt = Math.min(tx, ty);
  return [cx + tt * dx, cy + tt * dy];
}

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

function routeEdges(sg: SceneGraph): void {
  const nm = nodeMap(sg);
  const tm = tableMap(sg);
  const gm = groupMap(sg);
  const cm = chartMap(sg);

  // Resolve any endpoint id → a simple {x,y,w,h} rect + shape hint
  // Notes are now nodes (shape='note'), so nodeMap covers them.
  type Resolved = {
    x: number;
    y: number;
    w: number;
    h: number;
    shape?: string;
  };
  function resolve(id: string): Resolved | null {
    const n = nm.get(id);
    if (n) return n;
    const t = tm.get(id);
    if (t) return t;
    const g = gm.get(id);
    if (g) return g;
    const c = cm.get(id);
    if (c) return c;
    return null;
  }

  function connPt(
    src: Resolved,
    dstCX: number,
    dstCY: number,
  ): [number, number] {
    // SceneNode has a .shape field; use the existing connPoint for it
    if ("shape" in src && (src as any).shape) {
      return connPoint(
        src as any,
        {
          x: dstCX - 1,
          y: dstCY - 1,
          w: 2,
          h: 2,
          shape: "box",
        } as any,
      );
    }
    return rectConnPoint(src.x, src.y, src.w, src.h, dstCX, dstCY);
  }

  for (const e of sg.edges) {
    const src = resolve(e.from);
    const dst = resolve(e.to);
    if (!src || !dst) {
      e.points = [];
      continue;
    }

    const dstCX = dst.x + dst.w / 2,
      dstCY = dst.y + dst.h / 2;
    const srcCX = src.x + src.w / 2,
      srcCY = src.y + src.h / 2;

    e.points = [connPt(src, dstCX, dstCY), connPt(dst, srcCX, srcCY)];
  }
}

function computeBounds(sg: SceneGraph, margin: number): void {
  const allX = [
    ...sg.nodes.map((n) => n.x + n.w),
    ...sg.groups.filter((g) => g.w).map((g) => g.x + g.w),
    ...sg.tables.map((t) => t.x + t.w),
    ...sg.charts.map((c) => c.x + c.w),
    ...sg.markdowns.map((m) => m.x + m.w),
  ];

  const allY = [
    ...sg.nodes.map((n) => n.y + n.h),
    ...sg.groups.filter((g) => g.h).map((g) => g.y + g.h),
    ...sg.tables.map((t) => t.y + t.h),
    ...sg.charts.map((c) => c.y + c.h),
    ...sg.markdowns.map((m) => m.y + m.h),
  ];
  sg.width = (allX.length ? Math.max(...allX) : 400) + margin;
  sg.height = (allY.length ? Math.max(...allY) : 300) + margin;
}

// ── Public entry point ────────────────────────────────────
export function layout(sg: SceneGraph): SceneGraph {
  const GAP_MAIN = Number(sg.config["gap"] ?? LAYOUT.gap);
  const MARGIN = Number(sg.config["margin"] ?? LAYOUT.margin);

  const gm = groupMap(sg);
  const tm = tableMap(sg);
  const cm = chartMap(sg);
  const mdm = markdownMap(sg);

  // 1. Size all nodes and tables
  sg.nodes.forEach(sizeNode);
  sg.tables.forEach(sizeTable);

  sg.charts.forEach(sizeChart);
  sg.markdowns.forEach(sizeMarkdown);

  // Build unified entity map (all entities have x,y,w,h — map holds direct refs)
  const em = buildEntityMap(sg);

  // 2. Identify root vs nested items
  const nestedGroupIds = new Set<string>(
    sg.groups.flatMap((g) =>
      g.children.filter((c) => c.kind === "group").map((c) => c.id),
    ),
  );
  const groupedNodeIds = new Set<string>(
    sg.groups.flatMap((g) =>
      g.children.filter((c) => c.kind === "node").map((c) => c.id),
    ),
  );
  const groupedTableIds = new Set<string>(
    sg.groups.flatMap((g) =>
      g.children.filter((c) => c.kind === "table").map((c) => c.id),
    ),
  );
  const groupedChartIds = new Set<string>(
    sg.groups.flatMap((g) =>
      g.children.filter((c) => c.kind === "chart").map((c) => c.id),
    ),
  );

  const groupedMarkdownIds = new Set<string>(
    sg.groups.flatMap((g) =>
      g.children.filter((c) => c.kind === "markdown").map((c) => c.id),
    ),
  );

  const rootGroups = sg.groups.filter((g) => !nestedGroupIds.has(g.id));
  const rootNodes = sg.nodes.filter((n) => !groupedNodeIds.has(n.id));
  const rootTables = sg.tables.filter((t) => !groupedTableIds.has(t.id));
  const rootCharts = sg.charts.filter((c) => !groupedChartIds.has(c.id));
  const rootMarkdowns = sg.markdowns.filter(
    (m) => !groupedMarkdownIds.has(m.id),
  );

  // 3. Measure root groups bottom-up
  for (const g of rootGroups) measure(g, gm, tm, cm, mdm, em);

  // 4. Build root order
  //    sg.rootOrder preserves DSL declaration order.
  //    Fall back: groups, then nodes, then tables.
  const rootOrder = sg.rootOrder?.length
    ? sg.rootOrder
    : [
        ...rootGroups.map((g) => ({ kind: "group" as const, id: g.id })),
        ...rootNodes.map((n) => ({ kind: "node" as const, id: n.id })),
        ...rootTables.map((t) => ({ kind: "table" as const, id: t.id })),
        ...rootCharts.map((c) => ({ kind: "chart" as const, id: c.id })),
        ...rootMarkdowns.map((m) => ({ kind: "markdown" as const, id: m.id })),
      ];

  // 5. Root-level layout
  //    sg.layout:
  //      'row'    → items flow left to right  (default)
  //      'column' → items flow top to bottom
  //      'grid'   → config columns=N grid
  const rootLayout = (sg.layout ?? "row") as string;
  const rootCols = Number(sg.config["columns"] ?? 1);
  const useGrid = rootLayout === "grid" && rootCols > 0;
  const useColumn = rootLayout === "column";

  if (useGrid) {
    // ── Grid: per-row heights, per-column widths (no wasted space) ──
    const cols = rootCols;
    const rows = Math.ceil(rootOrder.length / cols);

    const colWidths: number[] = Array(cols).fill(0);
    const rowHeights: number[] = Array(rows).fill(0);

    rootOrder.forEach((ref, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const e = em.get(ref.id)!;
      colWidths[col] = Math.max(colWidths[col], e.w);
      rowHeights[row] = Math.max(rowHeights[row], e.h);
    });

    const colX: number[] = [];
    let cx = MARGIN;
    for (let c = 0; c < cols; c++) {
      colX.push(cx);
      cx += colWidths[c] + GAP_MAIN;
    }

    const rowY: number[] = [];
    let ry = MARGIN;
    for (let r = 0; r < rows; r++) {
      rowY.push(ry);
      ry += rowHeights[r] + GAP_MAIN;
    }

    rootOrder.forEach((ref, idx) => {
      const e = em.get(ref.id)!;
      e.x = colX[idx % cols];
      e.y = rowY[Math.floor(idx / cols)];
    });
  } else {
    // ── Row or Column linear flow ──────────────────────────
    let pos = MARGIN;
    for (const ref of rootOrder) {
      const e = em.get(ref.id)!;
      e.x = useColumn ? MARGIN : pos;
      e.y = useColumn ? pos : MARGIN;
      pos += (useColumn ? e.h : e.w) + GAP_MAIN;
    }
  }

  // 6. Place children within each root group (top-down, recursive)
  for (const g of rootGroups) place(g, gm, em);

  // 7. Route edges and compute canvas size
  routeEdges(sg);

  computeBounds(sg, MARGIN);
  return sg;
}
