
// ============================================================
// sketchmark — SVG Renderer  (rough.js hand-drawn)
// ============================================================

import type {
  SceneGraph,
  SceneNode,
} from "../../scene";
import { nodeMap, tableMap, chartMap } from "../../scene";
import { renderRoughChartSVG } from "./roughChartSVG";
import { resolvePalette, THEME_CONFIG_KEY } from "../../theme";
import type { DiagramPalette } from "../../theme";
import { resolveFont, loadFont, DEFAULT_FONT } from "../../fonts";
import rough from 'roughjs/bin/rough';

import {
  LINE_FONT_SIZE, LINE_FONT_WEIGHT, LINE_SPACING,
} from '../../markdown/parser';

import {
  hashStr, darkenHex, resolveStyleFont, wrapText,
  connMeta, resolveEndpoint, getConnPoint, groupDepth,
} from '../shared';
import { getShape } from '../shapes';
import { resolveTypography, computeTextX, computeTextCY } from '../typography';

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

import { SVG_NS, ROUGH, EDGE, NOTE as NOTE_CFG, TITLE, GROUP_LABEL } from "../../config";

const NS = SVG_NS;
const se = (tag: string) => document.createElementNS(NS, tag);

const BASE_ROUGH: RoughOpts = { roughness: ROUGH.roughness, bowing: ROUGH.bowing };

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

  const shape = getShape(n.shape);
  if (shape) return shape.renderSVG(rc as any, n, palette, opts);
  // fallback: box
  return [rc.rectangle(n.x + 1, n.y + 1, n.w - 2, n.h - 2, opts)];
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
  const as = EDGE.arrowSize;
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
    const titleSize = Number(sg.config["title-size"] ?? TITLE.fontSize);
    const titleWeight = Number(sg.config["title-weight"] ?? TITLE.fontWeight);
    svg.appendChild(
      mkText(
        sg.title,
        sg.width / 2,
        TITLE.y,
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
    const gTypo = resolveTypography(
      gs as Record<string, unknown>,
      { fontSize: GROUP_LABEL.fontSize, fontWeight: GROUP_LABEL.fontWeight, textAlign: "left", padding: GROUP_LABEL.padding },
      diagramFont, palette.groupLabel,
    );
    const gTextX = computeTextX(gTypo, g.x, g.w);

    if (g.label) {
      gg.appendChild(
        mkText(
          g.label, gTextX, g.y + gTypo.padding,
          gTypo.fontSize, gTypo.fontWeight, gTypo.textColor,
          gTypo.textAnchor, gTypo.font, gTypo.letterSpacing,
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
  const EL = mkGroup("edge-layer");
  for (const e of sg.edges) {
    const src = resolveEndpoint(e.from, nm, tm, gmMap, cm);
    const dst = resolveEndpoint(e.to, nm, tm, gmMap, cm);
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

    const HEAD = EDGE.headInset;
    const sx1 = arrowAt === "start" || arrowAt === "both" ? x1 + nx * HEAD : x1;
    const sy1 = arrowAt === "start" || arrowAt === "both" ? y1 + ny * HEAD : y1;
    const sx2 = arrowAt === "end" || arrowAt === "both" ? x2 - nx * HEAD : x2;
    const sy2 = arrowAt === "end" || arrowAt === "both" ? y2 - ny * HEAD : y2;

    const shaft = rc.line(sx1, sy1, sx2, sy2, {
      ...BASE_ROUGH,
      roughness: 0.9,
      seed: hashStr(e.from + e.to),
      stroke: ecol,
      strokeWidth: Number(e.style?.strokeWidth ?? 1.6),
      ...(dashed ? { strokeLineDash: EDGE.dashPattern as number[] } : {}),
    });
    shaft.setAttribute("data-edge-role", "shaft");
    eg.appendChild(shaft);

    if (arrowAt === "end" || arrowAt === "both") {
      const endHead = arrowHead(
        rc,
        x2,
        y2,
        Math.atan2(y2 - y1, x2 - x1),
        ecol,
        hashStr(e.to),
      );
      endHead.setAttribute("data-edge-role", "head");
      eg.appendChild(endHead);
    }
    if (arrowAt === "start" || arrowAt === "both") {
      const startHead = arrowHead(
        rc,
        x1,
        y1,
        Math.atan2(y1 - y2, x1 - x2),
        ecol,
        hashStr(e.from + "back"),
      );
      startHead.setAttribute("data-edge-role", "head");
      eg.appendChild(startHead);
    }

    if (e.label) {
      const mx = (x1 + x2) / 2 - ny * EDGE.labelOffset;
      const my = (y1 + y2) / 2 + nx * EDGE.labelOffset;
      const tw = Math.max(e.label.length * 7 + 12, 36);

      const bg = se("rect") as SVGRectElement;
      bg.setAttribute("x", String(mx - tw / 2));
      bg.setAttribute("y", String(my - 8));
      bg.setAttribute("width", String(tw));
      bg.setAttribute("height", "15");
      bg.setAttribute("fill", palette.edgeLabelBg);
      bg.setAttribute("rx", "3");
      bg.setAttribute("opacity", "0.9");
      bg.setAttribute("data-edge-role", "label-bg");
      eg.appendChild(bg);

      // ── Edge label typography ───────────────────────
      // supports: font, font-size, letter-spacing
      // always center-anchored (single line floating on edge)
      const eFontSize = Number(e.style?.fontSize ?? EDGE.labelFontSize);
      const eFont = resolveStyleFont(
        (e.style as Record<string, unknown>) ?? {},
        diagramFont,
      );
      const eLetterSpacing = e.style?.letterSpacing as number | undefined;

      const eFontWeight = e.style?.fontWeight ?? EDGE.labelFontWeight;
      const eLabelColor = String(e.style?.color ?? palette.edgeLabelText);

      const label = mkText(
        e.label,
        mx,
        my,
        eFontSize,
        eFontWeight,
        eLabelColor,
        "middle",
        eFont,
        eLetterSpacing,
      );
      label.setAttribute("data-edge-role", "label");
      eg.appendChild(label);
    }
    EL.appendChild(eg);
  }
  svg.appendChild(EL);

  // ── Nodes ─────────────────────────────────────────────────
  const NL = mkGroup("node-layer");
  for (const n of sg.nodes) {
    const shapeDef = getShape(n.shape);
    const idPrefix = shapeDef?.idPrefix ?? "node";
    const cssClass = shapeDef?.cssClass ?? "ng";
    const ng = mkGroup(`${idPrefix}-${n.id}`, cssClass);
    ng.dataset.nodeShape = n.shape;
    ng.dataset.x = String(n.x);
    ng.dataset.y = String(n.y);
    ng.dataset.w = String(n.w);
    ng.dataset.h = String(n.h);
    if (n.style?.opacity != null) ng.setAttribute("opacity", String(n.style.opacity));

    // ── Static transform (deg, dx, dy, factor) ──────────
    // Uses CSS style.transform so that transform-box:fill-box +
    // transform-origin:center on .ng gives correct center-anchored transforms.
    // The base transform is stored in data-base-transform so the animation
    // controller can restore it after _clearAll() instead of wiping to "".
    const hasTx = n.dx || n.dy || n.deg || (n.factor && n.factor !== 1);
    if (hasTx) {
      const parts: string[] = [];
      if (n.dx || n.dy) parts.push(`translate(${n.dx ?? 0}px,${n.dy ?? 0}px)`);
      if (n.deg) parts.push(`rotate(${n.deg}deg)`);
      if (n.factor && n.factor !== 1) parts.push(`scale(${n.factor})`);
      const tx = parts.join(" ");
      ng.style.transform = tx;
      ng.dataset.baseTransform = tx;
    }

    renderShape(rc, n, palette).forEach((s) => ng.appendChild(s));

    // ── Node / text typography ─────────────────────────
    const isText = n.shape === "text";
    const isNote = n.shape === "note";
    const isMediaShape = n.shape === "icon" || n.shape === "image" || n.shape === "line";
    const typo = resolveTypography(
      n.style as Record<string, unknown>,
      {
        fontSize: isText ? 13 : isNote ? 12 : 14,
        fontWeight: isText || isNote ? 400 : 500,
        textColor: isText ? palette.edgeLabelText : isNote ? palette.noteText : palette.nodeText,
        textAlign: isNote ? "left" : undefined,
        lineHeight: isNote ? 1.4 : undefined,
        padding: isNote ? 12 : undefined,
        verticalAlign: isNote ? "top" : undefined,
      },
      diagramFont,
      palette.nodeText,
    );

    // Note textX accounts for fold corner
    const FOLD = NOTE_CFG.fold;
    const textX = isNote
      ? (typo.textAlign === "right"  ? n.x + n.w - FOLD - typo.padding
       : typo.textAlign === "center" ? n.x + (n.w - FOLD) / 2
       : n.x + typo.padding)
      : computeTextX(typo, n.x, n.w);

    const lines = n.shape === 'text' && !n.label.includes('\n')
      ? wrapText(n.label, n.w - typo.padding * 2, typo.fontSize)
      : n.label.split('\n');

    const textCY = isMediaShape
      ? n.y + n.h - 10
      : isNote
        ? computeTextCY(typo, n.y, n.h, lines.length, FOLD + typo.padding)
        : computeTextCY(typo, n.y, n.h, lines.length);

    if (n.label) {
      ng.appendChild(
        lines.length > 1
          ? mkMultilineText(
              lines, textX, textCY,
              typo.fontSize, typo.fontWeight, typo.textColor,
              typo.textAnchor, typo.lineHeight, typo.font, typo.letterSpacing,
            )
          : mkText(
              n.label, textX, textCY,
              typo.fontSize, typo.fontWeight, typo.textColor,
              typo.textAnchor, typo.font, typo.letterSpacing,
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

  // ── Notes are now rendered as nodes via the shape registry ──

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
