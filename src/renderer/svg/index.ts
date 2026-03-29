
// ============================================================
// sketchmark — SVG Renderer  (rough.js hand-drawn)
// ============================================================

import type {
  SceneGraph,
  SceneNode,
  SceneGroup,
  SceneTable,
  SceneNote,
  SceneChart,
} from "../../scene";
import { connPoint } from "../../layout";
import { nodeMap, groupMap, tableMap, noteMap, chartMap ,markdownMap} from "../../scene";
import { renderRoughChartSVG } from "./roughChartSVG";
import { resolvePalette, THEME_CONFIG_KEY } from "../../theme";
import type { DiagramPalette } from "../../theme";
import { resolveFont, loadFont, DEFAULT_FONT } from "../../fonts";
import rough from 'roughjs/bin/rough';

import {
  LINE_FONT_SIZE, LINE_FONT_WEIGHT, LINE_SPACING,
} from '../../markdown/parser';

// declare const rough: { svg(el: SVGSVGElement): RoughSVG };

interface RoughSVG {
  rectangle(
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: RoughOpts,
  ): SVGElement;
  circle(cx: number, cy: number, d: number, opts?: RoughOpts): SVGElement;
  ellipse(
    cx: number,
    cy: number,
    w: number,
    h: number,
    opts?: RoughOpts,
  ): SVGElement;
  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    opts?: RoughOpts,
  ): SVGElement;
  polygon(pts: [number, number][], opts?: RoughOpts): SVGElement;
  path(d: string, opts?: RoughOpts): SVGElement;
}

interface RoughOpts {
  roughness?: number;
  bowing?: number;
  seed?: number;
  fill?: string;
  fillStyle?: string;
  fillWeight?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeLineDash?: number[];
  strokeLineDashOffset?: number;
  hachureAngle?: number;
  hachureGap?: number;
}

const NS = "http://www.w3.org/2000/svg";
const se = (tag: string) => document.createElementNS(NS, tag);

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) & 0xffff;
  return h;
}

const BASE_ROUGH: RoughOpts = { roughness: 1.3, bowing: 0.7 };

/** Darken a CSS hex colour by `amount` (0–1). Falls back to input for non-hex. */
function darkenHex(hex: string, amount = 0.12): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const d = (v: string) => Math.max(0, Math.round(parseInt(v, 16) * (1 - amount)));
  return `#${d(m[1]).toString(16).padStart(2,"0")}${d(m[2]).toString(16).padStart(2,"0")}${d(m[3]).toString(16).padStart(2,"0")}`;
}

// ── Small helper: load + resolve font from style or fall back ─────────────
function resolveStyleFont(
  style: Record<string, unknown>,
  fallback: string,
): string {
  const raw = String(style["font"] ?? "");
  if (!raw) return fallback;
  loadFont(raw);
  return resolveFont(raw);
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const words      = text.split(' ');
  const charsPerPx = fontSize * 0.55;   // approximate
  const maxChars   = Math.floor(maxWidth / charsPerPx);
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
  return lines;
}

// ── SVG text helpers ──────────────────────────────────────────────────────

/**
 * Single-line SVG text element.
 *
 * | param         | maps to SVG attr         |
 * |---------------|--------------------------|
 * txt             | textContent              |
 * x, y            | x, y                     |
 * sz              | font-size                |
 * wt              | font-weight              |
 * col             | fill                     |
 * anchor          | text-anchor              |
 * font            | font-family              |
 * letterSpacing   | letter-spacing           |
 */
function mkText(
  txt: string,
  x: number,
  y: number,
  sz = 14,
  wt: number | string = 500,
  col = "#1a1208",
  anchor = "middle",
  font?: string,
  letterSpacing?: number,
): SVGTextElement {
  const t = se("text") as SVGTextElement;
  t.setAttribute("x", String(x));
  t.setAttribute("y", String(y));
  t.setAttribute("text-anchor", anchor);
  t.setAttribute("dominant-baseline", "middle");
  t.setAttribute(
    "font-family",
    font ?? "var(--font-sans, system-ui, sans-serif)",
  );
  t.setAttribute("font-size", String(sz));
  t.setAttribute("font-weight", String(wt));
  t.setAttribute("fill", col);
  t.setAttribute("pointer-events", "none");
  t.setAttribute("user-select", "none");
  if (letterSpacing != null)
    t.setAttribute("letter-spacing", String(letterSpacing));
  t.textContent = txt;
  return t;
}

/**
 * Multi-line SVG text element using <tspan> per line.
 *
 * | param         | maps to SVG attr         |
 * |---------------|--------------------------|
 * lines           | one <tspan> each         |
 * x               | tspan x                  |
 * cy              | vertical centre of block |
 * sz              | font-size                |
 * wt              | font-weight              |
 * col             | fill                     |
 * anchor          | text-anchor              |
 * lineH           | dy between tspans (px)   |
 * font            | font-family              |
 * letterSpacing   | letter-spacing           |
 */
function mkMultilineText(
  lines: string[],
  x: number,
  cy: number,
  sz = 14,
  wt: number | string = 500,
  col = "#1a1208",
  anchor = "middle",
  lineH = 18,
  font?: string,
  letterSpacing?: number,
): SVGTextElement {
  const t = se("text") as SVGTextElement;
  t.setAttribute("text-anchor", anchor);
  t.setAttribute(
    "font-family",
    font ?? "var(--font-sans, system-ui, sans-serif)",
  );
  t.setAttribute("font-size", String(sz));
  t.setAttribute("font-weight", String(wt));
  t.setAttribute("fill", col);
  t.setAttribute("pointer-events", "none");
  t.setAttribute("user-select", "none");
  if (letterSpacing != null)
    t.setAttribute("letter-spacing", String(letterSpacing));

  // vertically centre the whole block
  const totalH = (lines.length - 1) * lineH;
  const startY = cy - totalH / 2;

  lines.forEach((line, i) => {
    const ts = se("tspan") as SVGTSpanElement;
    ts.setAttribute("x", String(x));
    ts.setAttribute("y", String(startY + i * lineH));
    ts.setAttribute("dominant-baseline", "middle");
    ts.textContent = line;
    t.appendChild(ts);
  });
  return t;
}

function mkGroup(id?: string, cls?: string): SVGGElement {
  const g = se("g") as SVGGElement;
  if (id) g.setAttribute("id", id);
  if (cls) g.setAttribute("class", cls);
  return g;
}

// ── Arrow direction from connector ────────────────────────────────────────
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

// ── Generic rect connection point ─────────────────────────────────────────
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

// ── Group depth (for paint order) ─────────────────────────────────────────
function groupDepth(g: SceneGroup, gm: Map<string, SceneGroup>): number {
  let d = 0;
  let cur: SceneGroup | undefined = g;
  while (cur?.parentId) {
    d++;
    cur = gm.get(cur.parentId);
  }
  return d;
}

// ── Node shapes ───────────────────────────────────────────────────────────
function renderShape(
  rc: RoughSVG,
  n: SceneNode,
  palette: DiagramPalette,
): SVGElement[] {
  const s = n.style ?? {};
  const fill = String(s.fill ?? palette.nodeFill);
  const stroke = String(s.stroke ?? palette.nodeStroke);
  const opts: RoughOpts = {
    ...BASE_ROUGH,
    seed: hashStr(n.id),
    fill,
    fillStyle: "solid",
    stroke,
    strokeWidth: Number(s.strokeWidth ?? 1.9),
    ...(s.strokeDash ? { strokeLineDash: s.strokeDash as number[] } : {}),
  };
  const cx = n.x + n.w / 2,
    cy = n.y + n.h / 2;
  const hw = n.w / 2 - 2;

  switch (n.shape) {
    case "circle":
      return [rc.ellipse(cx, cy, n.w * 0.88, n.h * 0.88, opts)];

    case "diamond":
      return [
        rc.polygon(
          [
            [cx, n.y + 2],
            [cx + hw, cy],
            [cx, n.y + n.h - 2],
            [cx - hw, cy],
          ],
          opts,
        ),
      ];

    case "hexagon": {
      const hw2 = hw * 0.56;
      return [
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
        ),
      ];
    }

    case "triangle":
      return [
        rc.polygon(
          [
            [cx, n.y + 3],
            [n.x + n.w - 3, n.y + n.h - 3],
            [n.x + 3, n.y + n.h - 3],
          ],
          opts,
        ),
      ];

    case "parallelogram":
      return [
        rc.polygon(
          [
            [n.x + 18, n.y + 1],
            [n.x + n.w - 1, n.y + 1],
            [n.x + n.w - 18, n.y + n.h - 1],
            [n.x + 1, n.y + n.h - 1],
          ],
          opts,
        ),
      ];

    case "cylinder": {
      const eH = 18;
      return [
        rc.rectangle(n.x + 3, n.y + eH / 2, n.w - 6, n.h - eH, opts),
        rc.ellipse(cx, n.y + eH / 2, n.w - 8, eH, { ...opts, roughness: 0.6 }),
        rc.ellipse(cx, n.y + n.h - eH / 2, n.w - 8, eH, {
          ...opts,
          roughness: 0.6,
          fill: "none",
        }),
      ];
    }

    case "text":
      return [];

    case "icon": {
      if (n.iconName) {
        const [prefix, name] = n.iconName.includes(":")
          ? n.iconName.split(":", 2)
          : ["mdi", n.iconName];
        const iconColor = s.color
          ? encodeURIComponent(String(s.color))
          : encodeURIComponent(String(palette.nodeStroke));
        const iconSize = Math.min(n.w, n.h) - 4;
        const iconUrl = `https://api.iconify.design/${prefix}/${name}.svg?color=${iconColor}&width=${iconSize}&height=${iconSize}`;

        const img = document.createElementNS(NS, "image") as SVGImageElement;
        img.setAttribute("href", iconUrl);
        img.setAttribute("x", String(n.x + 1));
        img.setAttribute("y", String(n.y + 1));
        img.setAttribute("width", String(n.w - 2));
        img.setAttribute("height", String(n.h - 2));
        img.setAttribute("preserveAspectRatio", "xMidYMid meet");
        if (s.opacity != null) img.setAttribute("opacity", String(s.opacity));

        // clip-path for rounded corners (same as image)
        const clipId = `clip-${n.id}`;
        const defs = document.createElementNS(NS, "defs");
        const clip = document.createElementNS(NS, "clipPath");
        clip.setAttribute("id", clipId);
        const rect = document.createElementNS(NS, "rect") as SVGRectElement;
        rect.setAttribute("x", String(n.x + 1));
        rect.setAttribute("y", String(n.y + 1));
        rect.setAttribute("width", String(n.w - 2));
        rect.setAttribute("height", String(n.h - 2));
        rect.setAttribute("rx", "6");
        clip.appendChild(rect);
        defs.appendChild(clip);
        img.setAttribute("clip-path", `url(#${clipId})`);

        // only draw border when stroke is explicitly set
        const els: SVGElement[] = [defs as unknown as SVGElement, img];
        if (s.stroke) {
          els.push(rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, {
            ...opts,
            fill: "none",
          }));
        }
        return els;
      }
      // fallback: placeholder square
      return [
        rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, {
          ...opts,
          fill: "#e0e0e0",
          stroke: "#999999",
        }),
      ];
    }

    case "image": {
      if (n.imageUrl) {
        const img = document.createElementNS(NS, "image") as SVGImageElement;
        img.setAttribute("href", n.imageUrl);
        img.setAttribute("x", String(n.x + 1));
        img.setAttribute("y", String(n.y + 1));
        img.setAttribute("width", String(n.w - 2));
        img.setAttribute("height", String(n.h - 2));
        img.setAttribute("preserveAspectRatio", "xMidYMid meet");

        const clipId = `clip-${n.id}`;
        const defs = document.createElementNS(NS, "defs");
        const clip = document.createElementNS(NS, "clipPath");
        clip.setAttribute("id", clipId);
        const rect = document.createElementNS(NS, "rect") as SVGRectElement;
        rect.setAttribute("x", String(n.x + 1));
        rect.setAttribute("y", String(n.y + 1));
        rect.setAttribute("width", String(n.w - 2));
        rect.setAttribute("height", String(n.h - 2));
        rect.setAttribute("rx", "6");
        clip.appendChild(rect);
        defs.appendChild(clip);
        img.setAttribute("clip-path", `url(#${clipId})`);

        // only draw border when stroke is explicitly set
        const els: SVGElement[] = [defs as unknown as SVGElement, img];
        if (s.stroke) {
          els.push(rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, {
            ...opts,
            fill: "none",
          }));
        }
        return els;
      }
      return [
        rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, {
          ...opts,
          fill: "#e0e0e0",
          stroke: "#999999",
        }),
      ];
    }

    default:
      return [rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts)];
  }
}

// ── Arrowhead ─────────────────────────────────────────────────────────────
function arrowHead(
  rc: RoughSVG,
  x: number,
  y: number,
  angle: number,
  col: string,
  seed: number,
): SVGElement {
  const as = 12;
  return rc.polygon(
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
      roughness: 0.35,
      seed,
      fill: col,
      fillStyle: "solid",
      stroke: col,
      strokeWidth: 0.8,
    },
  );
}

// ── Public API ────────────────────────────────────────────────────────────
export interface SVGRendererOptions {
  roughness?: number;
  bowing?: number;
  showTitle?: boolean;
  interactive?: boolean;
  onNodeClick?: (nodeId: string) => void;
  theme?: "light" | "dark" | "auto";
  transparent?: boolean;
}

export function renderToSVG(
  sg: SceneGraph,
  container: HTMLElement | SVGSVGElement,
  options: SVGRendererOptions = {},
): SVGSVGElement {
  if (typeof rough === "undefined") {
    throw new Error("rough.js is not loaded.");
  }

  const isDark =
    options.theme === "dark" ||
    (options.theme === "auto" &&
      window.matchMedia?.("(prefers-color-scheme:dark)").matches);

  const themeName = String(
    sg.config[THEME_CONFIG_KEY] ?? (isDark ? "dark" : "light"),
  );
  const palette = resolvePalette(themeName);

  // ── Diagram-level font ──────────────────────────────────
  const diagramFont = (() => {
    const raw = String(sg.config["font"] ?? "");
    if (raw) {
      loadFont(raw);
      return resolveFont(raw);
    }
    return DEFAULT_FONT;
  })();

  BASE_ROUGH.roughness = options.roughness ?? 1.3;
  BASE_ROUGH.bowing = options.bowing ?? 0.7;

  let svg: SVGSVGElement;
  if (container instanceof SVGSVGElement) {
    svg = container;
  } else {
    svg = se("svg") as SVGSVGElement;
    container.appendChild(svg);
  }
  svg.innerHTML = "";
  svg.setAttribute("xmlns", NS);
  svg.setAttribute("width", String(sg.width));
  svg.setAttribute("height", String(sg.height));
  svg.setAttribute("viewBox", `0 0 ${sg.width} ${sg.height}`);
  svg.style.fontFamily = "var(--font-sans, system-ui, sans-serif)";

  // ── Background ─────────────────────────────────────────
  if (!options.transparent) {
    const bgRect = se("rect") as SVGRectElement;
    bgRect.setAttribute("x", "0");
    bgRect.setAttribute("y", "0");
    bgRect.setAttribute("width", String(sg.width));
    bgRect.setAttribute("height", String(sg.height));
    bgRect.setAttribute("fill", palette.background);
    svg.appendChild(bgRect);
  }

  const rc = rough.svg(svg);

  // ── Title ────────────────────────────────────────────────
  if (options.showTitle && sg.title) {
    const titleColor = String(sg.config["title-color"] ?? palette.titleText);
    const titleSize = Number(sg.config["title-size"] ?? 18);
    const titleWeight = Number(sg.config["title-weight"] ?? 600);
    svg.appendChild(
      mkText(
        sg.title,
        sg.width / 2,
        26,
        titleSize,
        titleWeight,
        titleColor,
        "middle",
        diagramFont,
      ),
    );
  }

  // ── Groups ───────────────────────────────────────────────
  const gmMap = new Map(sg.groups.map((g) => [g.id, g]));
  const sortedGroups = [...sg.groups].sort(
    (a, b) => groupDepth(a, gmMap) - groupDepth(b, gmMap),
  );

  const GL = mkGroup("grp-layer");
  for (const g of sortedGroups) {
    if (!g.w) continue;
    const gs = g.style ?? {};
    const gg = mkGroup(`group-${g.id}`, "gg");

    if (gs.opacity != null) gg.setAttribute("opacity", String(gs.opacity));

    gg.appendChild(
      rc.rectangle(g.x, g.y, g.w, g.h, {
        ...BASE_ROUGH,
        roughness: 1.7,
        bowing: 0.4,
        seed: hashStr(g.id),
        fill: String(gs.fill ?? palette.groupFill),
        fillStyle: "solid",
        stroke: String(gs.stroke ?? palette.groupStroke),
        strokeWidth: Number(gs.strokeWidth ?? 1.2),
        strokeLineDash: (gs as any).strokeDash ?? palette.groupDash,
      }),
    );

    // ── Group label typography ──────────────────────────
    const gLabelColor = gs.color ? String(gs.color) : palette.groupLabel;
    const gFontSize = Number(gs.fontSize ?? 12);
    const gFontWeight = gs.fontWeight ?? 500;
    const gFont = resolveStyleFont(gs as Record<string, unknown>, diagramFont);
    const gLetterSpacing = gs.letterSpacing as number | undefined;
    const gPad = Number(gs.padding ?? 14);
    const gTextAlign = String(gs.textAlign ?? "left");
    const gAnchorMap: Record<string, "start" | "middle" | "end"> = {
      left: "start",
      center: "middle",
      right: "end",
    };
    const gAnchor = gAnchorMap[gTextAlign] ?? "start";
    const gTextX =
      gTextAlign === "right"
        ? g.x + g.w - gPad
        : gTextAlign === "center"
          ? g.x + g.w / 2
          : g.x + gPad;

   if(g.label){
     gg.appendChild(
       mkText(
         g.label,
         gTextX,
         g.y + gPad,
         gFontSize,
         gFontWeight,
         gLabelColor,
         gAnchor,
         gFont,
         gLetterSpacing,
       ),
     );
   }
    GL.appendChild(gg);
  }
  svg.appendChild(GL);

  // ── Edges ─────────────────────────────────────────────────
  const nm = nodeMap(sg);
  const tm = tableMap(sg);
  const cm = chartMap(sg);
  const ntm = noteMap(sg);

  const EL = mkGroup("edge-layer");
  for (const e of sg.edges) {
    const src = resolveEndpoint(e.from, nm, tm, gmMap, cm, ntm);
    const dst = resolveEndpoint(e.to, nm, tm, gmMap, cm, ntm);
    if (!src || !dst) continue;

    const dstCX = dst.x + dst.w / 2,
      dstCY = dst.y + dst.h / 2;
    const srcCX = src.x + src.w / 2,
      srcCY = src.y + src.h / 2;
    const [x1, y1] = getConnPoint(src, dstCX, dstCY);
    const [x2, y2] = getConnPoint(dst, srcCX, srcCY);

    const eg = mkGroup(`edge-${e.from}-${e.to}`, "eg");
    if (e.style?.opacity != null) eg.setAttribute("opacity", String(e.style.opacity));
    const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) || 1;
    const nx = (x2 - x1) / len,
      ny = (y2 - y1) / len;
    const ecol = String(e.style?.stroke ?? palette.edgeStroke);
    const { arrowAt, dashed } = connMeta(e.connector);

    const HEAD = 13;
    const sx1 = arrowAt === "start" || arrowAt === "both" ? x1 + nx * HEAD : x1;
    const sy1 = arrowAt === "start" || arrowAt === "both" ? y1 + ny * HEAD : y1;
    const sx2 = arrowAt === "end" || arrowAt === "both" ? x2 - nx * HEAD : x2;
    const sy2 = arrowAt === "end" || arrowAt === "both" ? y2 - ny * HEAD : y2;

    eg.appendChild(
      rc.line(sx1, sy1, sx2, sy2, {
        ...BASE_ROUGH,
        roughness: 0.9,
        seed: hashStr(e.from + e.to),
        stroke: ecol,
        strokeWidth: Number(e.style?.strokeWidth ?? 1.6),
        ...(dashed ? { strokeLineDash: [6, 5] } : {}),
      }),
    );

    if (arrowAt === "end" || arrowAt === "both")
      eg.appendChild(
        arrowHead(
          rc,
          x2,
          y2,
          Math.atan2(y2 - y1, x2 - x1),
          ecol,
          hashStr(e.to),
        ),
      );
    if (arrowAt === "start" || arrowAt === "both")
      eg.appendChild(
        arrowHead(
          rc,
          x1,
          y1,
          Math.atan2(y1 - y2, x1 - x2),
          ecol,
          hashStr(e.from + "back"),
        ),
      );

    if (e.label) {
      const mx = (x1 + x2) / 2 - ny * 14;
      const my = (y1 + y2) / 2 + nx * 14;
      const tw = Math.max(e.label.length * 7 + 12, 36);

      const bg = se("rect") as SVGRectElement;
      bg.setAttribute("x", String(mx - tw / 2));
      bg.setAttribute("y", String(my - 8));
      bg.setAttribute("width", String(tw));
      bg.setAttribute("height", "15");
      bg.setAttribute("fill", palette.edgeLabelBg);
      bg.setAttribute("rx", "3");
      bg.setAttribute("opacity", "0.9");
      eg.appendChild(bg);

      // ── Edge label typography ───────────────────────
      // supports: font, font-size, letter-spacing
      // always center-anchored (single line floating on edge)
      const eFontSize = Number(e.style?.fontSize ?? 11);
      const eFont = resolveStyleFont(
        (e.style as Record<string, unknown>) ?? {},
        diagramFont,
      );
      const eLetterSpacing = e.style?.letterSpacing as number | undefined;

      const eFontWeight = e.style?.fontWeight ?? 400;
      const eLabelColor = String(e.style?.color ?? palette.edgeLabelText);

      eg.appendChild(
        mkText(
          e.label,
          mx,
          my,
          eFontSize,
          eFontWeight,
          eLabelColor,
          "middle",
          eFont,
          eLetterSpacing,
        ),
      );
    }
    EL.appendChild(eg);
  }
  svg.appendChild(EL);

  // ── Nodes ─────────────────────────────────────────────────
  const NL = mkGroup("node-layer");
  for (const n of sg.nodes) {
    const ng = mkGroup(`node-${n.id}`, "ng");
    if (n.style?.opacity != null) ng.setAttribute("opacity", String(n.style.opacity));
    renderShape(rc, n, palette).forEach((s) => ng.appendChild(s));

    // ── Node / text typography ─────────────────────────
    // supports: font, font-size, letter-spacing, text-align, line-height
    const fontSize = Number(
      n.style?.fontSize ?? (n.shape === "text" ? 13 : 14),
    );
    const fontWeight = n.style?.fontWeight ?? (n.shape === "text" ? 400 : 500);
    const textColor = String(
      n.style?.color ??
        (n.shape === "text" ? palette.edgeLabelText : palette.nodeText),
    );
    const nodeFont = resolveStyleFont(
      (n.style as Record<string, unknown>) ?? {},
      diagramFont,
    );

    const textAlign = String(n.style?.textAlign ?? "center");
    const anchorMap: Record<string, "start" | "middle" | "end"> = {
      left: "start",
      center: "middle",
      right: "end",
    };
    const textAnchor = anchorMap[textAlign] ?? "middle";

    // line-height is a multiplier (e.g. 1.4 = 140% of font-size)
    const lineHeight = Number(n.style?.lineHeight ?? 1.3) * fontSize;
    const letterSpacing = n.style?.letterSpacing as number | undefined;

    const pad = Number(n.style?.padding ?? 8);

    // x shifts for left / right alignment
    const textX =
      textAlign === "left"
        ? n.x + pad
        : textAlign === "right"
          ? n.x + n.w - pad
          : n.x + n.w / 2;

    const lines = n.shape === 'text' && !n.label.includes('\n')
  ? wrapText(n.label, n.w - pad * 2, fontSize)
  : n.label.split('\n');

    const verticalAlign = String(n.style?.verticalAlign ?? "middle");

    const nodeBodyTop = n.y + pad;
    const nodeBodyBottom = n.y + n.h - pad;
    const nodeBodyMid = n.y + n.h / 2;
    const blockH = (lines.length - 1) * lineHeight;

    const textCY =
      verticalAlign === "top"
        ? nodeBodyTop + blockH / 2
        : verticalAlign === "bottom"
          ? nodeBodyBottom - blockH / 2
          : nodeBodyMid;

    if (n.label) {
      ng.appendChild(
        lines.length > 1
          ? mkMultilineText(
              lines,
              textX,
              textCY,
              fontSize,
              fontWeight,
              textColor,
              textAnchor,
              lineHeight,
              nodeFont,
              letterSpacing,
            )
          : mkText(
              n.label,
              textX,
              textCY,
              fontSize,
              fontWeight,
              textColor,
              textAnchor,
              nodeFont,
              letterSpacing,
            ),
      );
    }

    if (options.interactive) {
      ng.style.cursor = "pointer";
      ng.addEventListener("click", () => options.onNodeClick?.(n.id));
      ng.addEventListener("mouseenter", () => {
        ng.style.filter = "brightness(0.92)";
      });
      ng.addEventListener("mouseleave", () => {
        ng.style.filter = "";
      });
    }
    NL.appendChild(ng);
  }
  svg.appendChild(NL);

  // ── Tables ────────────────────────────────────────────────
  const TL = mkGroup("table-layer");
  for (const t of sg.tables) {
    const tg = mkGroup(`table-${t.id}`, "tg");
    const gs = t.style ?? {};
    const fill = String(gs.fill ?? palette.tableFill);
    const strk = String(gs.stroke ?? palette.tableStroke);
    const textCol = String(gs.color ?? palette.tableText);
    const hdrFill = gs.fill ? darkenHex(fill, 0.08) : palette.tableHeaderFill;
    const hdrText = String(gs.color ?? palette.tableHeaderText);
    const divCol = palette.tableDivider;
    const pad = t.labelH;
    const tStrokeWidth = Number(gs.strokeWidth ?? 1.5);
    const tFontWeight = gs.fontWeight ?? 500;

    // ── Table-level font (applies to label + all cells) ─
    // supports: font, font-size, letter-spacing
    const tFontSize = Number(gs.fontSize ?? 12);
    const tFont = resolveStyleFont(gs as Record<string, unknown>, diagramFont);
    const tLetterSpacing = gs.letterSpacing as number | undefined;

    if (gs.opacity != null) tg.setAttribute("opacity", String(gs.opacity));

    // outer border
    tg.appendChild(
      rc.rectangle(t.x, t.y, t.w, t.h, {
        ...BASE_ROUGH,
        seed: hashStr(t.id),
        fill,
        fillStyle: "solid",
        stroke: strk,
        strokeWidth: tStrokeWidth,
        ...(gs.strokeDash ? { strokeLineDash: gs.strokeDash as number[] } : {}),
      }),
    );

    // label strip separator
    tg.appendChild(
      rc.line(t.x, t.y + pad, t.x + t.w, t.y + pad, {
        roughness: 0.6,
        seed: hashStr(t.id + "l"),
        stroke: strk,
        strokeWidth: 1,
      }),
    );

    // ── Table label: font, font-size, font-weight, letter-spacing (always left) ──
    tg.appendChild(
      mkText(
        t.label,
        t.x + 10,
        t.y + pad / 2,
        tFontSize,
        tFontWeight,
        textCol,
        "start",
        tFont,
        tLetterSpacing,
      ),
    );

    // rows
    let rowY = t.y + pad;
    for (const row of t.rows) {
      const rh = row.kind === "header" ? t.headerH : t.rowH;

      if (row.kind === "header") {
        const hdrBg = se("rect") as SVGRectElement;
        hdrBg.setAttribute("x", String(t.x + 1));
        hdrBg.setAttribute("y", String(rowY + 1));
        hdrBg.setAttribute("width", String(t.w - 2));
        hdrBg.setAttribute("height", String(rh - 1));
        hdrBg.setAttribute("fill", hdrFill);
        tg.appendChild(hdrBg);
      }

      tg.appendChild(
        rc.line(t.x, rowY + rh, t.x + t.w, rowY + rh, {
          roughness: 0.4,
          seed: hashStr(t.id + rowY),
          stroke: row.kind === "header" ? strk : divCol,
          strokeWidth: row.kind === "header" ? 1.2 : 0.6,
        }),
      );

      // ── Cell text: font, font-size, letter-spacing, text-align ──
      // text-align applies to data rows; header is always centered
      const cellAlignProp =
        row.kind === "header" ? "center" : String(gs.textAlign ?? "center");
      const cellAnchorMap: Record<string, "start" | "middle" | "end"> = {
        left: "start",
        center: "middle",
        right: "end",
      };
      const cellAnchor = cellAnchorMap[cellAlignProp] ?? "middle";
      const cellFw = row.kind === "header" ? 600 : (gs.fontWeight ?? 400);
      const cellColor = row.kind === "header" ? hdrText : textCol;

      let cx = t.x;
      row.cells.forEach((cell, i) => {
        const cw = t.colWidths[i] ?? 60;
        // x position shifts with alignment
        const cellX =
          cellAnchor === "start"
            ? cx + 6
            : cellAnchor === "end"
              ? cx + cw - 6
              : cx + cw / 2;

        // ← was missing tg.appendChild — cells were invisible before
        tg.appendChild(
          mkText(
            cell,
            cellX,
            rowY + rh / 2,
            tFontSize,
            cellFw,
            cellColor,
            cellAnchor,
            tFont,
            tLetterSpacing,
          ),
        );

        if (i < row.cells.length - 1) {
          tg.appendChild(
            rc.line(cx + cw, t.y + pad, cx + cw, t.y + t.h, {
              roughness: 0.3,
              seed: hashStr(t.id + "c" + i),
              stroke: divCol,
              strokeWidth: 0.5,
            }),
          );
        }
        cx += cw;
      });

      rowY += rh;
    }

    if (options.interactive) {
      tg.style.cursor = "pointer";
      tg.addEventListener("click", () => options.onNodeClick?.(t.id));
    }
    TL.appendChild(tg);
  }
  svg.appendChild(TL);

  // ── Notes ─────────────────────────────────────────────────
  const NoteL = mkGroup("note-layer");
  for (const n of sg.notes) {
    const ng = mkGroup(`note-${n.id}`, "ntg");
    const gs = n.style ?? {};
    const fill = String(gs.fill ?? palette.noteFill);
    const strk = String(gs.stroke ?? palette.noteStroke);
    const nStrokeWidth = Number(gs.strokeWidth ?? 1.2);
    const fold = 14;
    const { x, y, w, h } = n;

    if (gs.opacity != null) ng.setAttribute("opacity", String(gs.opacity));

    // ── Note typography ─────────────────────────────────
    const nFontSize = Number(gs.fontSize ?? 12);
    const nFontWeight = gs.fontWeight ?? 400;
    const nFont = resolveStyleFont(gs as Record<string, unknown>, diagramFont);
    const nLetterSpacing = gs.letterSpacing as number | undefined;
    const nLineHeight = Number(gs.lineHeight ?? 1.4) * nFontSize;
    const nTextAlign = String(gs.textAlign ?? "left");
    const nPad = Number(gs.padding ?? 12);
    const nAnchorMap: Record<string, "start" | "middle" | "end"> = {
      left: "start",
      center: "middle",
      right: "end",
    };
    const nAnchor = nAnchorMap[nTextAlign] ?? "start";
    const nTextX =
      nTextAlign === "right"
        ? x + w - fold - nPad
        : nTextAlign === "center"
          ? x + (w - fold) / 2
          : x + nPad;

    const nFoldPad = fold + nPad; // text starts below fold + user padding

    ng.appendChild(
      rc.polygon(
        [
          [x, y],
          [x + w - fold, y],
          [x + w, y + fold],
          [x + w, y + h],
          [x, y + h],
        ],
        {
          ...BASE_ROUGH,
          seed: hashStr(n.id),
          fill,
          fillStyle: "solid",
          stroke: strk,
          strokeWidth: nStrokeWidth,
          ...(gs.strokeDash ? { strokeLineDash: gs.strokeDash as number[] } : {}),
        },
      ),
    );

    ng.appendChild(
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
          strokeWidth: Math.min(nStrokeWidth, 0.8),
        },
      ),
    );

    const nVerticalAlign = String(gs.verticalAlign ?? "top");
    const bodyTop = y + nFoldPad;
    const bodyBottom = y + h - nPad;
    const bodyMid = (bodyTop + bodyBottom) / 2;
    const blockH = (n.lines.length - 1) * nLineHeight;
    const blockCY =
      nVerticalAlign === "bottom"
        ? bodyBottom - blockH / 2
        : nVerticalAlign === "middle"
          ? bodyMid
          : bodyTop + blockH / 2;

    if (n.lines.length > 1) {
      ng.appendChild(
        mkMultilineText(
          n.lines,
          nTextX,
          blockCY,
          nFontSize,
          nFontWeight,
          String(gs.color ?? palette.noteText),
          nAnchor,
          nLineHeight,
          nFont,
          nLetterSpacing,
        ),
      );
    } else {
      ng.appendChild(
        mkText(
          n.lines[0] ?? "",
          nTextX,
          blockCY,
          nFontSize,
          nFontWeight,
          String(gs.color ?? palette.noteText),
          nAnchor,
          nFont,
          nLetterSpacing,
        ),
      );
    }

    NoteL.appendChild(ng);
  }
  svg.appendChild(NoteL);

  const MDL  = mkGroup('markdown-layer');
 
  for (const m of sg.markdowns) {
    const mg         = mkGroup(`markdown-${m.id}`, 'mdg');
    const gs         = m.style ?? {};
    const mFont      = resolveStyleFont(gs as Record<string,unknown>, diagramFont);
    const baseColor  = String(gs.color ?? palette.nodeText);
    const textAlign  = String(gs.textAlign ?? 'left');
    const anchor     = textAlign === 'right'  ? 'end'
                     : textAlign === 'center' ? 'middle'
                     : 'start';
    const PAD   = Number(gs.padding ?? 16);
    const mLetterSpacing = gs.letterSpacing as number | undefined;

    if (gs.opacity != null) mg.setAttribute('opacity', String(gs.opacity));

    // Background + border
    if (gs.fill || gs.stroke) {
      mg.appendChild(rc.rectangle(m.x, m.y, m.w, m.h, {
        ...BASE_ROUGH, seed: hashStr(m.id),
        fill: String(gs.fill ?? 'none'), fillStyle: 'solid',
        stroke: String(gs.stroke ?? 'none'),
        strokeWidth: Number(gs.strokeWidth ?? 1.2),
        ...(gs.strokeDash ? { strokeLineDash: gs.strokeDash as number[] } : {}),
      }));
    }

    const textX      = textAlign === 'right'  ? m.x + m.w - PAD
                     : textAlign === 'center' ? m.x + m.w / 2
                     : m.x + PAD;

    let y = m.y + PAD;

    for (const line of m.lines) {
      if (line.kind === 'blank') { y += LINE_SPACING.blank; continue; }
 
      const fontSize   = LINE_FONT_SIZE[line.kind];
      const fontWeight = LINE_FONT_WEIGHT[line.kind];
 
      const t = se('text') as SVGTextElement;
      t.setAttribute('x',                 String(textX));
      t.setAttribute('y',                 String(y + fontSize / 2));
      t.setAttribute('text-anchor',       anchor);
      t.setAttribute('dominant-baseline', 'middle');
      t.setAttribute('font-family',       mFont);
      t.setAttribute('font-size',         String(fontSize));
      t.setAttribute('font-weight',       String(fontWeight));
      t.setAttribute('fill',              baseColor);
      t.setAttribute('pointer-events',    'none');
      t.setAttribute('user-select',       'none');
      if (mLetterSpacing != null) t.setAttribute('letter-spacing', String(mLetterSpacing));
 
      for (const run of line.runs) {
        const span = se('tspan') as SVGTSpanElement;
        span.textContent = run.text;
        if (run.bold)   span.setAttribute('font-weight', '700');
        if (run.italic) span.setAttribute('font-style',  'italic');
        t.appendChild(span);
      }
 
      mg.appendChild(t);
      y += LINE_SPACING[line.kind];
    }
 
    MDL.appendChild(mg);
  }
  svg.appendChild(MDL);

  // ── Charts ────────────────────────────────────────────────
  const CL = mkGroup("chart-layer");
  for (const c of sg.charts) {
    CL.appendChild(renderRoughChartSVG(rc, c, palette, themeName !== "light"));
  }
  svg.appendChild(CL);

  return svg;
}

export function svgToString(svg: SVGSVGElement): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    new XMLSerializer().serializeToString(svg)
  );
}
