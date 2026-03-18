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
import { nodeMap, groupMap, tableMap, noteMap, chartMap } from "../../scene";
import { connPoint } from "../../layout";
import { resolvePalette, THEME_CONFIG_KEY } from "../../theme";
import type { DiagramPalette } from "../../theme";
import { drawRoughChartCanvas } from "./roughChartCanvas";

declare const rough: { canvas(el: HTMLCanvasElement): RoughCanvas };
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
  scale?: number;
  background?: string;
  roughness?: number;
  bowing?: number;
  theme?: "light" | "dark" | "auto";
  animate?: boolean;
  transparent?: boolean;
}

// ── Arrow direction from connector (mirrors svg/index.ts) ─
function connMeta(connector: string): {
  arrowAt: "end" | "start" | "both" | "none";
  dashed: boolean;
} {
  if (connector === "--") return { arrowAt: "none", dashed: false };
  if (connector === "---") return { arrowAt: "none", dashed: true };
  const bidir = connector.includes("<") && connector.includes(">");
  if (bidir) return { arrowAt: "both", dashed: connector.includes("--") };
  const back = connector.startsWith("<");
  const dashed = connector.includes("--");
  if (back) return { arrowAt: "start", dashed };
  return { arrowAt: "end", dashed };
}

// ── Generic rect connection point ─────────────────────────
function rectConnPoint(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  ox: number,
  oy: number,
): [number, number] {
  const cx = rx + rw / 2,
    cy = ry + rh / 2;
  const dx = ox - cx,
    dy = oy - cy;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return [cx, cy];
  const hw = rw / 2 - 2,
    hh = rh / 2 - 2;
  const tx = Math.abs(dx) > 0.01 ? hw / Math.abs(dx) : 1e9;
  const ty = Math.abs(dy) > 0.01 ? hh / Math.abs(dy) : 1e9;
  const t = Math.min(tx, ty);
  return [cx + t * dx, cy + t * dy];
}

function resolveEndpoint(
  id: string,
  nm: Map<string, SceneNode>,
  tm: Map<string, SceneTable>,
  gm: Map<string, SceneGroup>,
  cm: Map<string, SceneChart>,
  ntm: Map<string, SceneNote>,
): { x: number; y: number; w: number; h: number; shape?: string } | null {
  return (
    nm.get(id) ?? tm.get(id) ?? gm.get(id) ?? cm.get(id) ?? ntm.get(id) ?? null
  );
}

function getConnPoint(
  src: { x: number; y: number; w: number; h: number; shape?: string },
  dstCX: number,
  dstCY: number,
): [number, number] {
  if ("shape" in src && (src as SceneNode).shape) {
    return connPoint(
      src as SceneNode,
      {
        x: dstCX - 1,
        y: dstCY - 1,
        w: 2,
        h: 2,
        shape: "box",
      } as SceneNode,
    );
  }
  return rectConnPoint(src.x, src.y, src.w, src.h, dstCX, dstCY);
}

// ── Group depth (for paint order, outermost first) ────────
function groupDepth(g: SceneGroup, gm: Map<string, SceneGroup>): number {
  let d = 0;
  let cur: SceneGroup | undefined = g;
  while (cur?.parentId) {
    d++;
    cur = gm.get(cur.parentId);
  }
  return d;
}

// ── Node shapes ───────────────────────────────────────────
function renderShape(
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
  n: SceneNode,
  palette: DiagramPalette,
  R: any,
): void {
  const s = n.style ?? {};
  const fill = String(s.fill ?? palette.nodeFill);
  const stroke = String(s.stroke ?? palette.nodeStroke);
  const opts = {
    ...R,
    seed: hashStr(n.id),
    fill,
    fillStyle: "solid",
    stroke,
    strokeWidth: Number(s.strokeWidth ?? 1.9),
  };
  const cx = n.x + n.w / 2,
    cy = n.y + n.h / 2;
  const hw = n.w / 2 - 2;

  switch (n.shape) {
    case "circle":
      rc.ellipse(cx, cy, n.w * 0.88, n.h * 0.88, opts);
      break;
    case "diamond":
      rc.polygon(
        [
          [cx, n.y + 2],
          [cx + hw, cy],
          [cx, n.y + n.h - 2],
          [cx - hw, cy],
        ],
        opts,
      );
      break;
    case "hexagon": {
      const hw2 = hw * 0.56;
      rc.polygon(
        [
          [cx - hw2, n.y + 3],
          [cx + hw2, n.y + 3],
          [cx + hw, cy],
          [cx + hw2, n.y + n.h - 3],
          [cx - hw2, n.y + n.h - 3],
          [cx - hw, cy],
        ],
        opts,
      );
      break;
    }
    case "triangle":
      rc.polygon(
        [
          [cx, n.y + 3],
          [n.x + n.w - 3, n.y + n.h - 3],
          [n.x + 3, n.y + n.h - 3],
        ],
        opts,
      );
      break;
    case "cylinder": {
      const eH = 18;
      rc.rectangle(n.x + 3, n.y + eH / 2, n.w - 6, n.h - eH, opts);
      rc.ellipse(cx, n.y + eH / 2, n.w - 8, eH, { ...opts, roughness: 0.6 });
      rc.ellipse(cx, n.y + n.h - eH / 2, n.w - 8, eH, {
        ...opts,
        roughness: 0.6,
        fill: "none",
      });
      break;
    }
    case "parallelogram":
      rc.polygon(
        [
          [n.x + 18, n.y + 1],
          [n.x + n.w - 1, n.y + 1],
          [n.x + n.w - 18, n.y + n.h - 1],
          [n.x + 1, n.y + n.h - 1],
        ],
        opts,
      );
      break;
    case "text":
      break; // text nodes: no background shape
    case "image": {
      if (n.imageUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          ctx.save();
          // rounded clip
          ctx.beginPath();
          const r = 6;
          ctx.moveTo(n.x + r, n.y);
          ctx.lineTo(n.x + n.w - r, n.y);
          ctx.quadraticCurveTo(n.x + n.w, n.y, n.x + n.w, n.y + r);
          ctx.lineTo(n.x + n.w, n.y + n.h - r);
          ctx.quadraticCurveTo(n.x + n.w, n.y + n.h, n.x + n.w - r, n.y + n.h);
          ctx.lineTo(n.x + r, n.y + n.h);
          ctx.quadraticCurveTo(n.x, n.y + n.h, n.x, n.y + n.h - r);
          ctx.lineTo(n.x, n.y + r);
          ctx.quadraticCurveTo(n.x, n.y, n.x + r, n.y);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, n.x + 1, n.y + 1, n.w - 2, n.h - 2);
          ctx.restore();
          // border on top
          rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, {
            ...opts,
            fill: "none",
          });
        };
        img.src = n.imageUrl;
      } else {
        // placeholder
        rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, {
          ...opts,
          fill: "#e0e0e0",
          stroke: "#999999",
        });
      }
      return;
    }
    default:
      rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts);
      break;
  }
}

// ── Arrowhead ─────────────────────────────────────────────
function drawArrowHead(
  rc: RoughCanvas,
  x: number,
  y: number,
  angle: number,
  col: string,
  seed: number,
  R: any,
): void {
  const as = 12;
  rc.polygon(
    [
      [x, y],
      [
        x - as * Math.cos(angle - Math.PI / 6.5),
        y - as * Math.sin(angle - Math.PI / 6.5),
      ],
      [
        x - as * Math.cos(angle + Math.PI / 6.5),
        y - as * Math.sin(angle + Math.PI / 6.5),
      ],
    ],
    {
      roughness: 0.3,
      seed,
      fill: col,
      fillStyle: "solid",
      stroke: col,
      strokeWidth: 0.8,
    },
  );
}

export function renderToCanvas(
  sg: SceneGraph,
  canvas: HTMLCanvasElement,
  options: CanvasRendererOptions = {},
): void {
  if (typeof rough === "undefined") throw new Error("rough.js not loaded");

  const scale = options.scale ?? window.devicePixelRatio ?? 1;
  canvas.width = sg.width * scale;
  canvas.height = sg.height * scale;
  canvas.style.width = sg.width + "px";
  canvas.style.height = sg.height + "px";

  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  if (options.transparent) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ── Resolve palette (mirrors SVG renderer) ───────────────
  const isDark =
    options.theme === "dark" ||
    (options.theme === "auto" &&
      window.matchMedia?.("(prefers-color-scheme:dark)").matches);

  const themeName = String(
    sg.config[THEME_CONFIG_KEY] ?? (isDark ? "dark" : "light"),
  );
  const palette = resolvePalette(themeName);

  if (!options.transparent) {
    ctx.fillStyle = options.background ?? palette.background;
    ctx.fillRect(0, 0, sg.width, sg.height);
  }

  const rc = rough.canvas(canvas);
  const R = {
    roughness: options.roughness ?? 1.3,
    bowing: options.bowing ?? 0.7,
  };

  // ── Lookup maps ──────────────────────────────────────────
  const nm = nodeMap(sg);
  const tm = tableMap(sg);
  const gm = groupMap(sg);
  const cm = chartMap(sg);
  const ntm = noteMap(sg);

  // ── Title ────────────────────────────────────────────────
  if (sg.title) {
    ctx.save();
    ctx.font = "600 18px system-ui, sans-serif";
    ctx.fillStyle = palette.titleText;
    ctx.textAlign = "center";
    ctx.fillText(sg.title, sg.width / 2, 28);
    ctx.restore();
  }

  // ── Groups (depth-sorted: outermost first) ────────────────
  const sortedGroups = [...sg.groups].sort(
    (a, b) => groupDepth(a, gm) - groupDepth(b, gm),
  );
  for (const g of sortedGroups) {
    if (!g.w) continue;
    const gs = g.style ?? {};
    rc.rectangle(g.x, g.y, g.w, g.h, {
      ...R,
      roughness: 1.7,
      bowing: 0.4,
      seed: hashStr(g.id),
      fill: String(gs.fill ?? palette.groupFill),
      fillStyle: "solid",
      stroke: String(gs.stroke ?? palette.groupStroke),
      strokeWidth: Number(gs.strokeWidth ?? 1.2),
      strokeLineDash: (gs as any).strokeDash ?? palette.groupDash,
    });
    ctx.save();
    ctx.font = "500 12px system-ui, sans-serif";
    ctx.fillStyle = gs.color ? String(gs.color) : palette.groupLabel;
    ctx.textAlign = "left";
    ctx.fillText(g.label, g.x + 14, g.y + 16);
    ctx.restore();
  }

  // ── Edges ─────────────────────────────────────────────────
  for (const e of sg.edges) {
    const src = resolveEndpoint(e.from, nm, tm, gm, cm, ntm);
    const dst = resolveEndpoint(e.to, nm, tm, gm, cm, ntm);
    if (!src || !dst) continue;

    const dstCX = dst.x + dst.w / 2,
      dstCY = dst.y + dst.h / 2;
    const srcCX = src.x + src.w / 2,
      srcCY = src.y + src.h / 2;
    const [x1, y1] = getConnPoint(src, dstCX, dstCY);
    const [x2, y2] = getConnPoint(dst, srcCX, srcCY);

    const ecol = String(e.style?.stroke ?? palette.edgeStroke);
    const { arrowAt, dashed } = connMeta(e.connector);
    const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) || 1;
    const nx = (x2 - x1) / len,
      ny = (y2 - y1) / len;

    const HEAD = 13;
    const sx1 = arrowAt === "start" || arrowAt === "both" ? x1 + nx * HEAD : x1;
    const sy1 = arrowAt === "start" || arrowAt === "both" ? y1 + ny * HEAD : y1;
    const sx2 = arrowAt === "end" || arrowAt === "both" ? x2 - nx * HEAD : x2;
    const sy2 = arrowAt === "end" || arrowAt === "both" ? y2 - ny * HEAD : y2;

    rc.line(sx1, sy1, sx2, sy2, {
      ...R,
      roughness: 0.9,
      seed: hashStr(e.from + e.to),
      stroke: ecol,
      strokeWidth: Number(e.style?.strokeWidth ?? 1.6),
      ...(dashed ? { strokeLineDash: [6, 5] } : {}),
    });

    const ang = Math.atan2(y2 - y1, x2 - x1);
    if (arrowAt === "end" || arrowAt === "both")
      drawArrowHead(rc, x2, y2, ang, ecol, hashStr(e.to), R);
    if (arrowAt === "start" || arrowAt === "both")
      drawArrowHead(
        rc,
        x1,
        y1,
        Math.atan2(y1 - y2, x1 - x2),
        ecol,
        hashStr(e.from + "back"),
        R,
      );

    if (e.label) {
      const mx = (x1 + x2) / 2 - ny * 14;
      const my = (y1 + y2) / 2 + nx * 14;
      ctx.save();
      ctx.font = "400 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      const tw = ctx.measureText(e.label).width + 12;
      ctx.fillStyle = palette.edgeLabelBg;
      ctx.fillRect(mx - tw / 2, my - 8, tw, 15);
      ctx.fillStyle = palette.edgeLabelText;
      ctx.fillText(e.label, mx, my + 3);
      ctx.restore();
    }
  }

  // ── Nodes ─────────────────────────────────────────────────
  for (const n of sg.nodes) {
    renderShape(rc, ctx, n, palette, R);
    const s = n.style ?? {};
    const fontSize = Number(s.fontSize ?? (n.shape === "text" ? 13 : 14));
    const fontWeight = s.fontWeight ?? (n.shape === "text" ? 400 : 500);
    const textColor = String(
      s.color ??
        (n.shape === "text" ? palette.edgeLabelText : palette.nodeText),
    );
    ctx.save();
    ctx.font = `${fontWeight} ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = n.label.split("\n");
    if (lines.length === 1) {
      ctx.fillText(n.label, n.x + n.w / 2, n.y + n.h / 2);
    } else {
      const lineH = fontSize * 1.35;
      const startY = n.y + n.h / 2 - ((lines.length - 1) * lineH) / 2;
      lines.forEach((line, i) => {
        ctx.fillText(line, n.x + n.w / 2, startY + i * lineH);
      });
    }
    ctx.restore();
  }

  // ── Tables ────────────────────────────────────────────────
  for (const t of sg.tables) {
    const gs = t.style ?? {};
    const fill = String(gs.fill ?? palette.tableFill);
    const strk = String(gs.stroke ?? palette.tableStroke);
    const textCol = String(gs.color ?? palette.tableText);
    const pad = t.labelH;

    // Outer border
    rc.rectangle(t.x, t.y, t.w, t.h, {
      ...R,
      seed: hashStr(t.id),
      fill,
      fillStyle: "solid",
      stroke: strk,
      strokeWidth: 1.5,
    });

    // Label strip separator
    rc.line(t.x, t.y + pad, t.x + t.w, t.y + pad, {
      roughness: 0.6,
      seed: hashStr(t.id + "l"),
      stroke: strk,
      strokeWidth: 1,
    });

    // Label text
    ctx.save();
    ctx.font = "500 12px system-ui, sans-serif";
    ctx.fillStyle = textCol;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(t.label, t.x + 10, t.y + pad / 2);
    ctx.restore();

    // Rows
    let rowY = t.y + pad;
    for (const row of t.rows) {
      const rh = row.kind === "header" ? t.headerH : t.rowH;

      // Header background
      if (row.kind === "header") {
        ctx.fillStyle = palette.tableHeaderFill;
        ctx.fillRect(t.x + 1, rowY + 1, t.w - 2, rh - 1);
      }

      // Row separator
      rc.line(t.x, rowY + rh, t.x + t.w, rowY + rh, {
        roughness: 0.4,
        seed: hashStr(t.id + rowY),
        stroke: row.kind === "header" ? strk : palette.tableDivider,
        strokeWidth: row.kind === "header" ? 1.2 : 0.6,
      });

      // Cell text + column separators
      let cx = t.x;
      row.cells.forEach((cell, i) => {
        const cw = t.colWidths[i] ?? 60;
        const fw = row.kind === "header" ? 600 : 400;
        ctx.save();
        ctx.font = `${fw} 12px system-ui, sans-serif`;
        ctx.fillStyle =
          row.kind === "header" ? palette.tableHeaderText : textCol;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(cell, cx + cw / 2, rowY + rh / 2);
        ctx.restore();

        if (i < row.cells.length - 1) {
          rc.line(cx + cw, t.y + pad, cx + cw, t.y + t.h, {
            roughness: 0.3,
            seed: hashStr(t.id + "c" + i),
            stroke: palette.tableDivider,
            strokeWidth: 0.5,
          });
        }
        cx += cw;
      });

      rowY += rh;
    }
  }

  // ── Notes ─────────────────────────────────────────────────
  for (const n of sg.notes) {
    const gs = n.style ?? {};
    const fill = String(gs.fill ?? palette.noteFill);
    const strk = String(gs.stroke ?? palette.noteStroke);
    const fold = 14;
    const { x, y, w, h } = n;

    // Note body (folded corner polygon)
    rc.polygon(
      [
        [x, y],
        [x + w - fold, y],
        [x + w, y + fold],
        [x + w, y + h],
        [x, y + h],
      ],
      {
        ...R,
        seed: hashStr(n.id),
        fill,
        fillStyle: "solid",
        stroke: strk,
        strokeWidth: 1.2,
      },
    );

    // Folded corner triangle
    rc.polygon(
      [
        [x + w - fold, y],
        [x + w, y + fold],
        [x + w - fold, y + fold],
      ],
      {
        roughness: 0.4,
        seed: hashStr(n.id + "f"),
        fill: palette.noteFold,
        fillStyle: "solid",
        stroke: strk,
        strokeWidth: 0.8,
      },
    );

    // Text lines
    ctx.save();
    ctx.font = "400 12px system-ui, sans-serif";
    ctx.fillStyle = String(gs.color ?? palette.noteText);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    n.lines.forEach((line, i) => {
      ctx.fillText(line, x + 12, y + 12 + i * 20 + 10);
    });
    ctx.restore();
  }

  // ── Charts ────────────────────────────────────────────────
  for (const c of sg.charts) {
    drawRoughChartCanvas(
      rc,
      ctx,
      c,
      {
        nodeFill: palette.chartFill,
        nodeStroke: palette.chartStroke,
        labelText: palette.chartText,
        labelBg: palette.edgeLabelBg,
      },
      R,
    );
  }
}

// ── Export canvas to PNG blob ─────────────────────────────
export function canvasToPNGBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });
}

export function canvasToPNGDataURL(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}
