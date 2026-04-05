// ============================================================
// sketchmark — Animation Engine  (nodes + edges + groups)
// ============================================================

import type { ASTStep, ASTBeat, ASTStepItem } from "../ast/types";
import { ANIMATION, SHAPES, SVG_NS } from "../config";

export type AnimationEventType =
  | "step-change"
  | "step-complete"
  | "animation-reset"
  | "animation-start"
  | "animation-end";
export interface AnimationEvent {
  type: AnimationEventType;
  stepIndex: number;
  step?: ASTStepItem;
  total: number;
}
export type AnimationListener = (e: AnimationEvent) => void;

// ── DOM helpers ───────────────────────────────────────────
const getEl = (svg: SVGSVGElement, id: string) =>
  svg.querySelector(`#${id}`) as SVGGElement | null;
const getNodeEl = (svg: SVGSVGElement, id: string) => getEl(svg, `node-${id}`);
const getGroupEl = (svg: SVGSVGElement, id: string) =>
  getEl(svg, `group-${id}`);
const getEdgeEl = (svg: SVGSVGElement, f: string, t: string) =>
  getEl(svg, `edge-${f}-${t}`);
const getTableEl = (svg: SVGSVGElement, id: string) =>
  getEl(svg, `table-${id}`);
const getNoteEl = (svg: SVGSVGElement, id: string) => getEl(svg, `note-${id}`);
const getChartEl = (svg: SVGSVGElement, id: string) =>
  getEl(svg, `chart-${id}`);
const getMarkdownEl = (svg: SVGSVGElement, id: string) =>
  getEl(svg, `markdown-${id}`);
const POSITIONABLE_SELECTOR = ".ng, .gg, .tg, .ntg, .cg, .mdg";

function resolveNonEdgeDrawEl(svg: SVGSVGElement, target: string): SVGGElement | null {
  return (
    getGroupEl(svg, target) ??
    getTableEl(svg, target) ??
    getNoteEl(svg, target) ??
    getChartEl(svg, target) ??
    getMarkdownEl(svg, target) ??
    getNodeEl(svg, target) ??
    null
  );
}

function hideDrawEl(el: SVGGElement): void {
  if (el.classList.contains("ng")) {
    el.classList.add("hidden");
    return;
  }
  el.classList.add("gg-hidden");
}

function showDrawEl(el: SVGGElement): void {
  el.classList.remove("hidden", "gg-hidden");
}

function resolveEl(svg: SVGSVGElement, target: string): SVGGElement | null {
  // check edge first — target contains connector like "a-->b"
  const edge = parseEdgeTarget(target);
  if (edge) return getEdgeEl(svg, edge.from, edge.to);

  // everything else resolved by prefixed id
  return (
    resolveNonEdgeDrawEl(svg, target) ??
    null
  );
}

function pathLength(p: SVGGeometryElement): number {
  try {
    return p.getTotalLength() || 200;
  } catch {
    return 200;
  }
}

function clearDashOverridesAfter(el: SVGGElement, delayMs: number): void {
  setTimeout(() => {
    el.querySelectorAll<SVGGeometryElement>('path').forEach(p => {
      p.style.strokeDasharray  = '';
      p.style.strokeDashoffset = '';
      p.style.transition       = '';
    });
  }, delayMs);
}

const NODE_DRAW_GUIDE_ATTR = "data-node-draw-guide";
const TEXT_REVEAL_CLIP_ATTR = "data-text-reveal-clip-id";
const GUIDED_NODE_SHAPES = new Set([
  "box",
  "circle",
  "diamond",
  "hexagon",
  "triangle",
  "parallelogram",
  "line",
  "path",
]);

function polygonPath(points: Array<[number, number]>): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ") + " Z";
}

function rectPath(x: number, y: number, w: number, h: number): string {
  return polygonPath([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]);
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return [
    `M ${cx - rx} ${cy}`,
    `A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy}`,
    `A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`,
  ].join(" ");
}

function nodeMetric(el: SVGGElement, key: "x" | "y" | "w" | "h"): number | null {
  const raw = el.dataset[key];
  const n = raw == null ? Number.NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function buildNodeGuidePath(el: SVGGElement): string | null {
  const shape = el.dataset.nodeShape;
  if (!shape || !GUIDED_NODE_SHAPES.has(shape)) return null;

  const x = nodeMetric(el, "x");
  const y = nodeMetric(el, "y");
  const w = nodeMetric(el, "w");
  const h = nodeMetric(el, "h");
  if (x == null || y == null || w == null || h == null) return null;

  switch (shape) {
    case "box":
      return rectPath(x + 1, y + 1, w - 2, h - 2);
    case "circle":
      return ellipsePath(x + w / 2, y + h / 2, (w * 0.88) / 2, (h * 0.88) / 2);
    case "diamond": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const hw = w / 2 - 2;
      return polygonPath([
        [cx, y + 2],
        [cx + hw, cy],
        [cx, y + h - 2],
        [cx - hw, cy],
      ]);
    }
    case "hexagon": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const hw = w / 2 - 2;
      const hw2 = hw * SHAPES.hexagon.inset;
      return polygonPath([
        [cx - hw2, y + 3],
        [cx + hw2, y + 3],
        [cx + hw, cy],
        [cx + hw2, y + h - 3],
        [cx - hw2, y + h - 3],
        [cx - hw, cy],
      ]);
    }
    case "triangle": {
      const cx = x + w / 2;
      return polygonPath([
        [cx, y + 3],
        [x + w - 3, y + h - 3],
        [x + 3, y + h - 3],
      ]);
    }
    case "parallelogram":
      return polygonPath([
        [x + SHAPES.parallelogram.skew, y + 1],
        [x + w - 1, y + 1],
        [x + w - SHAPES.parallelogram.skew, y + h - 1],
        [x + 1, y + h - 1],
      ]);
    case "line": {
      const labelH = el.querySelector("text") ? 20 : 0;
      const lineY = y + (h - labelH) / 2;
      return `M ${x} ${lineY} L ${x + w} ${lineY}`;
    }
    case "path":
      return el.dataset.pathData ?? null;
    default:
      return null;
  }
}

function nodeGuidePathEl(el: SVGGElement): SVGPathElement | null {
  return el.querySelector<SVGPathElement>(`path[${NODE_DRAW_GUIDE_ATTR}="true"]`);
}

function removeNodeGuide(el: SVGGElement): void {
  nodeGuidePathEl(el)?.remove();
}

function nodePaths(el: SVGGElement): SVGGeometryElement[] {
  return Array.from(el.querySelectorAll<SVGGeometryElement>("path")).filter(
    (p) => p.getAttribute(NODE_DRAW_GUIDE_ATTR) !== "true",
  );
}

function nodeText(el: SVGGElement): SVGElement | null {
  return el.querySelector<SVGElement>("text");
}

function nodeStrokeTemplate(el: SVGGElement): SVGGeometryElement | null {
  return (
    nodePaths(el).find((p) => (p.getAttribute("stroke") ?? "") !== "none") ??
    nodePaths(el)[0] ??
    null
  );
}

function clearNodeDrawStyles(el: SVGGElement): void {
  removeNodeGuide(el);
  nodePaths(el).forEach((p) => {
    p.style.strokeDasharray =
      p.style.strokeDashoffset =
      p.style.fillOpacity =
      p.style.transition =
      p.style.opacity =
        "";
  });
  const text = nodeText(el);
  if (text) {
    clearTextReveal(text);
    text.style.opacity = text.style.transition = "";
  }
}

function prepareNodeForDraw(el: SVGGElement): void {
  clearNodeDrawStyles(el);

  const d = buildNodeGuidePath(el);
  const source = nodeStrokeTemplate(el);
  if (!d || !source) {
    prepareForDraw(el);
    return;
  }

  const guide = document.createElementNS(SVG_NS, "path");
  guide.setAttribute("d", d);
  guide.setAttribute("fill", "none");
  guide.setAttribute("stroke", source.getAttribute("stroke") ?? "#000");
  guide.setAttribute("stroke-width", source.getAttribute("stroke-width") ?? "1.8");
  guide.setAttribute("stroke-linecap", "round");
  guide.setAttribute("stroke-linejoin", "round");
  guide.setAttribute(NODE_DRAW_GUIDE_ATTR, "true");
  if (el.dataset.nodeShape === "path") {
    const pathX = nodeMetric(el, "x") ?? 0;
    const pathY = nodeMetric(el, "y") ?? 0;
    guide.setAttribute("transform", `translate(${pathX},${pathY})`);
  }
  guide.style.pointerEvents = "none";

  const len = pathLength(guide);
  guide.style.strokeDasharray = `${len}`;
  guide.style.strokeDashoffset = `${len}`;
  guide.style.transition = "none";

  nodePaths(el).forEach((p) => {
    p.style.opacity = "0";
    p.style.transition = "none";
  });

  const text = nodeText(el);
  if (text) {
    text.style.opacity = "0";
    text.style.transition = "none";
  }

  el.appendChild(guide);
}

function revealNodeInstant(el: SVGGElement): void {
  showDrawEl(el);
  clearNodeDrawStyles(el);
}

// ── Text writing reveal (clipPath) ───────────────────────
function clearTextReveal(textEl: SVGElement, clipId?: string): void {
  const activeClipId = textEl.getAttribute(TEXT_REVEAL_CLIP_ATTR);
  const shouldClearCurrentClip = !clipId || activeClipId === clipId;

  if (shouldClearCurrentClip) {
    textEl.removeAttribute("clip-path");
    textEl.removeAttribute(TEXT_REVEAL_CLIP_ATTR);
  }

  const clipIdToRemove = clipId ?? activeClipId;
  if (clipIdToRemove) {
    textEl.ownerSVGElement?.querySelector(`#${clipIdToRemove}`)?.remove();
  }
}

function animateTextReveal(textEl: SVGElement, delayMs: number, durationMs: number = ANIMATION.textRevealMs): void {
  const ownerSvg = textEl.ownerSVGElement;
  clearTextReveal(textEl);
  if (!ownerSvg) {
    // fallback: just fade
    textEl.style.transition = `opacity ${ANIMATION.textFade}ms ease ${delayMs}ms`;
    textEl.style.opacity = "1";
    return;
  }

  const bbox = (textEl as SVGTextElement).getBBox?.();
  if (!bbox || bbox.width === 0) {
    // fallback if can't measure
    textEl.style.transition = `opacity ${ANIMATION.textFade}ms ease ${delayMs}ms`;
    textEl.style.opacity = "1";
    return;
  }

  let defs = ownerSvg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS(SVG_NS, "defs");
    ownerSvg.insertBefore(defs, ownerSvg.firstChild);
  }

  const clipId = `skm-clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const clipPath = document.createElementNS(SVG_NS, "clipPath");
  clipPath.setAttribute("id", clipId);
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", String(bbox.x - 2));
  rect.setAttribute("y", String(bbox.y - 2));
  rect.setAttribute("width", "0");
  rect.setAttribute("height", String(bbox.height + 4));
  clipPath.appendChild(rect);
  defs.appendChild(clipPath);
  textEl.setAttribute("clip-path", `url(#${clipId})`);
  textEl.setAttribute(TEXT_REVEAL_CLIP_ATTR, clipId);
  textEl.style.opacity = "1";

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      rect.style.transition = `width ${durationMs}ms cubic-bezier(.4,0,.2,1) ${delayMs}ms`;
      rect.setAttribute("width", String(bbox.width + 4));
    }),
  );

  // Cleanup after animation
  setTimeout(() => {
    clearTextReveal(textEl, clipId);
  }, delayMs + durationMs + 50);
}

function animateNodeDraw(
  el: SVGGElement,
  strokeDur: number = ANIMATION.nodeStrokeDur,
  textOnlyDur: number = ANIMATION.textRevealMs,
): void {
  showDrawEl(el);
  const guide = nodeGuidePathEl(el);
  if (!guide) {
    const firstPath = el.querySelector("path");
    const text = nodeText(el);
    if (!firstPath && el.dataset.nodeShape === "text" && text) {
      animateTextReveal(text, 0, textOnlyDur);
      setTimeout(() => {
        clearNodeDrawStyles(el);
      }, textOnlyDur + 80);
      return;
    }
    if (!firstPath?.style.strokeDasharray) prepareForDraw(el);
    animateShapeDraw(el, strokeDur, ANIMATION.nodeStagger);
    const nodePathCount = el.querySelectorAll("path").length;
    clearDashOverridesAfter(el, nodePathCount * ANIMATION.nodeStagger + strokeDur + 120);
    return;
  }

  const roughPaths = nodePaths(el);
  const text = nodeText(el);
  const revealDelay = strokeDur + 30;
  const textDelay = revealDelay + ANIMATION.textDelay;

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      guide.style.transition = `stroke-dashoffset ${strokeDur}ms cubic-bezier(.4,0,.2,1)`;
      guide.style.strokeDashoffset = "0";

      roughPaths.forEach((p) => {
        p.style.transition = `opacity 140ms ease ${revealDelay}ms`;
        p.style.opacity = "1";
      });

      if (text) {
        animateTextReveal(text, textDelay);
      }

      setTimeout(() => {
        clearNodeDrawStyles(el);
      }, textDelay + ANIMATION.textRevealMs + 80);
    }),
  );
}

// ── Arrow connector parser ────────────────────────────────
const ARROW_CONNECTORS = ["<-->", "<->", "-->", "<--", "->", "<-", "---", "--"];

function parseEdgeTarget(
  target: string,
): { from: string; to: string; conn: string } | null {
  for (const conn of ARROW_CONNECTORS) {
    const idx = target.indexOf(conn);
    if (idx !== -1)
      return {
        from: target.slice(0, idx).trim(),
        to: target.slice(idx + conn.length).trim(),
        conn,
      };
  }
  return null;
}

// ── Step flattening helper ────────────────────────────────
function flattenSteps(items: ASTStepItem[]): ASTStep[] {
  const out: ASTStep[] = [];
  for (const item of items) {
    if (item.kind === "beat") out.push(...item.children);
    else out.push(item);
  }
  return out;
}

function forEachPlaybackStep(
  items: ASTStepItem[],
  visit: (step: ASTStep, stepIndex: number) => void,
): void {
  items.forEach((item, stepIndex) => {
    if (item.kind === "beat") {
      item.children.forEach((child) => visit(child, stepIndex));
      return;
    }
    visit(item, stepIndex);
  });
}

// ── Draw target helpers ───────────────────────────────────
export function getDrawTargetEdgeIds(steps: ASTStepItem[]): Set<string> {
  const ids = new Set<string>();
  for (const s of flattenSteps(steps)) {
    if (s.action !== "draw") continue;
    const e = parseEdgeTarget(s.target);
    if (e) ids.add(`edge-${e.from}-${e.to}`);
  }
  return ids;
}
export function getDrawTargetNodeIds(steps: ASTStepItem[]): Set<string> {
  const ids = new Set<string>();
  for (const s of flattenSteps(steps)) {
    if (s.action !== "draw" || parseEdgeTarget(s.target)) continue;
    ids.add(`node-${s.target}`);
  }
  return ids;
}

export function getDrawTargetTableIds(steps: ASTStepItem[]): Set<string> {
  const ids = new Set<string>();
  for (const s of flattenSteps(steps)) {
    if (s.action !== "draw" || parseEdgeTarget(s.target)) continue;
    ids.add(`table-${s.target}`);
  }
  return ids;
}

export function getDrawTargetNoteIds(steps: ASTStepItem[]): Set<string> {
  const ids = new Set<string>();
  for (const s of flattenSteps(steps)) {
    if (s.action !== "draw" || parseEdgeTarget(s.target)) continue;
    ids.add(`note-${s.target}`);
  }
  return ids;
}

export function getDrawTargetChartIds(steps: ASTStepItem[]): Set<string> {
  const ids = new Set<string>();
  for (const s of flattenSteps(steps)) {
    if (s.action !== "draw" || parseEdgeTarget(s.target)) continue;
    ids.add(`chart-${s.target}`);
  }
  return ids;
}

// ── Generic shape-draw helpers (shared by nodes and groups) ──

function prepareForDraw(el: SVGGElement): void {
  el.querySelectorAll<SVGGeometryElement>("path").forEach((p) => {
    const len = pathLength(p);
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    p.style.fillOpacity = "0";
    p.style.transition = "none";
  });
  const text = el.querySelector<SVGElement>("text");
  if (text) {
    text.style.opacity = "0";
    text.style.transition = "none";
  }
}

function revealInstant(el: SVGGElement): void {
  el.querySelectorAll<SVGGeometryElement>("path").forEach((p) => {
    p.style.transition = "none";
    p.style.strokeDashoffset = "0";
    p.style.fillOpacity = "";
    p.style.strokeDasharray = "";
  });
  const text = el.querySelector<SVGElement>("text");
  if (text) {
    text.style.transition = "none";
    text.style.opacity = "";
  }
}

function clearDrawStyles(el: SVGGElement): void {
  el.querySelectorAll<SVGGeometryElement>("path").forEach((p) => {
    p.style.strokeDasharray =
      p.style.strokeDashoffset =
      p.style.fillOpacity =
      p.style.transition =
        "";
  });
  const text = el.querySelector<SVGElement>("text");
  if (text) {
    text.style.opacity = text.style.transition = "";
  }
}

function animateShapeDraw(el: SVGGElement, strokeDur: number = ANIMATION.nodeStrokeDur, stag: number = ANIMATION.nodeStagger): void {
  const paths = Array.from(el.querySelectorAll<SVGGeometryElement>("path"));
  const text = el.querySelector<SVGElement>("text");
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      paths.forEach((p, i) => {
        const sd = i * stag,
          fd = sd + strokeDur + ANIMATION.fillFadeOffset;
        p.style.transition = [
          `stroke-dashoffset ${strokeDur}ms cubic-bezier(.4,0,.2,1) ${sd}ms`,
          `fill-opacity 180ms ease ${Math.max(0, fd)}ms`,
        ].join(", ");
        p.style.strokeDashoffset = "0";
        p.style.fillOpacity = "1";
      });
      if (text) {
        const td = paths.length * stag + strokeDur + ANIMATION.textDelay;
        text.style.transition = `opacity ${ANIMATION.textFade}ms ease ${td}ms`;
        text.style.opacity = "1";
      }
    }),
  );
}

// ── Edge draw helpers ─────────────────────────────────────
const EDGE_SHAFT_SELECTOR = '[data-edge-role="shaft"] path';
const EDGE_DECOR_SELECTOR =
  '[data-edge-role="head"], [data-edge-role="label"], [data-edge-role="label-bg"]';

function edgeShaftPaths(el: SVGGElement): SVGGeometryElement[] {
  return Array.from(el.querySelectorAll<SVGGeometryElement>(EDGE_SHAFT_SELECTOR));
}

function edgeDecorEls(el: SVGGElement): SVGElement[] {
  return Array.from(el.querySelectorAll<SVGElement>(EDGE_DECOR_SELECTOR));
}

function prepareEdgeForDraw(el: SVGGElement): void {
  edgeShaftPaths(el).forEach((p) => {
    const len = pathLength(p);
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    p.style.transition = "none";
  });
  edgeDecorEls(el).forEach((part) => {
    part.style.opacity = "0";
    part.style.transition = "none";
  });
}

function revealEdgeInstant(el: SVGGElement): void {
  edgeShaftPaths(el).forEach((p) => {
    p.style.transition = "none";
    p.style.strokeDashoffset = "0";
    p.style.strokeDasharray = "";
  });
  edgeDecorEls(el).forEach((part) => {
    part.style.transition = "none";
    part.style.opacity = "1";
  });
}

function clearEdgeDrawStyles(el: SVGGElement): void {
  edgeShaftPaths(el).forEach((p) => {
    p.style.strokeDasharray =
      p.style.strokeDashoffset =
      p.style.transition =
        "";
  });
  edgeDecorEls(el).forEach((part) => {
    part.style.opacity = part.style.transition = "";
  });
}

function animateEdgeDraw(
  el: SVGGElement,
  conn: string,
  strokeDur: number = ANIMATION.strokeDur,
): void {
  const shaftPaths = edgeShaftPaths(el);
  const decorEls = edgeDecorEls(el);
  if (!shaftPaths.length) return;
  const reversed = conn.startsWith('<') && !conn.includes('>');

  shaftPaths.forEach((p) => {
    const len = pathLength(p);
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = reversed ? `${-len}` : `${len}`;
    p.style.transition = "none";
  });
  decorEls.forEach((part) => {
    part.style.opacity = "0";
    part.style.transition = "none";
  });

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      shaftPaths.forEach((p) => {
        p.style.transition = `stroke-dashoffset ${strokeDur}ms cubic-bezier(.4,0,.2,1)`;
        p.style.strokeDashoffset = "0";
      });
      setTimeout(() => {
        decorEls.forEach((part) => {
          part.style.transition = `opacity ${ANIMATION.arrowReveal}ms ease`;
          part.style.opacity = "1";
        });

        // ── ADD: clear inline dash overrides so SVG attribute
        //    (stroke-dasharray="6,5" for dashed arrows) takes over again
        setTimeout(() => {
          clearEdgeDrawStyles(el);
        }, ANIMATION.dashClear);

      }, Math.max(0, strokeDur - 40));
    }),
  );
}

// ── AnimationController ───────────────────────────────────
export class AnimationController {
  private _step = -1;
  private _pendingStepTimers = new Set<number>();
  private _pendingNarrationTimers = new Set<number>();
  private _transforms = new Map<
    string,
    {
      tx: number;
      ty: number;
      scale: number; // absolute, 1.0 = identity
      rotate: number; // cumulative degrees
    }
  >();
  private _listeners: AnimationListener[] = [];
  readonly drawTargetEdges: Set<string>;
  readonly drawTargetNodes: Set<string>;
  readonly drawTargetGroups: Set<string>;
  readonly drawTargetTables: Set<string>;
  readonly drawTargetNotes: Set<string>;
  readonly drawTargetCharts: Set<string>;
  readonly drawTargetMarkdowns: Set<string>;
  private readonly _drawStepIndexByElementId: Map<string, number>;
  private readonly _parentGroupByElementId: Map<string, string>;
  private readonly _groupDescendantIds: Map<string, Set<string>>;

  // ── Narration caption ──
  private _captionEl: HTMLDivElement | null = null;
  private _captionTextEl: HTMLSpanElement | null = null;
  private _narrationRunId = 0;

  // ── Annotations ──
  private _annotationLayer: SVGGElement | null = null;
  private _annotations: SVGElement[] = [];

  // ── Pointer ──
  private _pointerEl: SVGElement | null = null;
  private _pointerType: 'chalk' | 'dot' | 'hand' | 'none' = 'none';

  // ── TTS ──
  private _tts = false;
  private _speechDone: Promise<void> | null = null;

  get drawTargets(): Set<string> {
    return this.drawTargetEdges;
  }

  constructor(
    private svg: SVGSVGElement,
    public readonly steps: ASTStepItem[],
    private _container?: HTMLElement,
    private _rc?: any,
    private _config?: Record<string, string | number | boolean>,
  ) {
    this.drawTargetEdges = getDrawTargetEdgeIds(steps);
    this.drawTargetNodes = getDrawTargetNodeIds(steps);

    // Groups: non-edge draw steps whose target has a #group-{id} element in the SVG.
    this.drawTargetGroups = new Set<string>();
    this.drawTargetTables = new Set<string>();
    this.drawTargetNotes = new Set<string>();
    this.drawTargetCharts = new Set<string>();
    this.drawTargetMarkdowns = new Set<string>();

    for (const s of flattenSteps(steps)) {
      if (s.action !== "draw" || parseEdgeTarget(s.target)) continue;
      if (resolveNonEdgeDrawEl(svg, s.target)?.id === `group-${s.target}`) {
        this.drawTargetGroups.add(`group-${s.target}`);
        this.drawTargetNodes.delete(`node-${s.target}`);
      }
      if (svg.querySelector(`#table-${s.target}`)) {
        this.drawTargetTables.add(`table-${s.target}`);
        this.drawTargetNodes.delete(`node-${s.target}`);
      }
      if (svg.querySelector(`#note-${s.target}`)) {
        this.drawTargetNotes.add(`note-${s.target}`);
        this.drawTargetNodes.delete(`node-${s.target}`);
      }
      if (svg.querySelector(`#chart-${s.target}`)) {
        this.drawTargetCharts.add(`chart-${s.target}`);
        this.drawTargetNodes.delete(`node-${s.target}`);
      }
      if (svg.querySelector(`#markdown-${s.target}`)) {
        this.drawTargetMarkdowns.add(`markdown-${s.target}`);
        this.drawTargetNodes.delete(`node-${s.target}`);
      }
    }

    this._drawStepIndexByElementId = this._buildDrawStepIndex();
    const { parentGroupByElementId, groupDescendantIds } = this._buildGroupVisibilityIndex();
    this._parentGroupByElementId = parentGroupByElementId;
    this._groupDescendantIds = groupDescendantIds;

    this._clearAll();

    // Init narration caption
    if (this._container) this._initCaption();

    // Init annotation layer
    this._annotationLayer = document.createElementNS(SVG_NS, "g") as SVGGElement;
    this._annotationLayer.setAttribute("id", "annotation-layer");
    this._annotationLayer.style.pointerEvents = "none";
    this.svg.appendChild(this._annotationLayer);

    // Init pointer
    this._pointerType = (this._config?.pointer as string ?? "none") as any;
    if (this._pointerType !== "none") this._initPointer();

    // Init TTS from config: `config tts=on`
    this._tts = this._config?.tts === true || this._config?.tts === "on";
    if (this._tts) this._warmUpSpeech();
  }

  private _buildDrawStepIndex(): Map<string, number> {
    const drawStepIndexByElementId = new Map<string, number>();

    forEachPlaybackStep(this.steps, (step, stepIndex) => {
      if (step.action !== "draw" || parseEdgeTarget(step.target)) return;
      const el = resolveNonEdgeDrawEl(this.svg, step.target);
      if (el && !drawStepIndexByElementId.has(el.id)) {
        drawStepIndexByElementId.set(el.id, stepIndex);
      }
    });

    return drawStepIndexByElementId;
  }

  private _buildGroupVisibilityIndex(): {
    parentGroupByElementId: Map<string, string>;
    groupDescendantIds: Map<string, Set<string>>;
  } {
    const parentGroupByElementId = new Map<string, string>();
    const directChildIdsByGroup = new Map<string, Set<string>>();

    this.svg.querySelectorAll<SVGGElement>(POSITIONABLE_SELECTOR).forEach((el) => {
      const parentGroupId = el.dataset.parentGroup;
      if (!parentGroupId) return;

      const parentGroupElId = `group-${parentGroupId}`;
      parentGroupByElementId.set(el.id, parentGroupElId);
      const children = directChildIdsByGroup.get(parentGroupElId) ?? new Set<string>();
      children.add(el.id);
      directChildIdsByGroup.set(parentGroupElId, children);
    });

    const groupDescendantIds = new Map<string, Set<string>>();
    const visit = (groupElId: string): Set<string> => {
      if (groupDescendantIds.has(groupElId)) return groupDescendantIds.get(groupElId)!;

      const descendants = new Set<string>();
      const directChildren = directChildIdsByGroup.get(groupElId);
      if (directChildren) {
        for (const childId of directChildren) {
          descendants.add(childId);
          if (childId.startsWith("group-")) {
            visit(childId).forEach((nestedId) => descendants.add(nestedId));
          }
        }
      }

      groupDescendantIds.set(groupElId, descendants);
      return descendants;
    };

    this.svg.querySelectorAll<SVGGElement>(".gg").forEach((el) => {
      visit(el.id);
    });

    return { parentGroupByElementId, groupDescendantIds };
  }

  private _hideGroupDescendants(groupElId: string): void {
    const descendants = this._groupDescendantIds.get(groupElId);
    if (!descendants) return;

    for (const descendantId of descendants) {
      const el = getEl(this.svg, descendantId);
      if (el) hideDrawEl(el);
    }
  }

  private _isDeferredForGroupReveal(
    elementId: string,
    stepIndex: number,
    groupElId: string,
  ): boolean {
    let currentId: string | undefined = elementId;

    while (currentId) {
      const firstDrawStep = this._drawStepIndexByElementId.get(currentId);
      if (firstDrawStep != null && firstDrawStep > stepIndex) return true;
      if (currentId === groupElId) break;
      currentId = this._parentGroupByElementId.get(currentId);
    }

    return false;
  }

  private _revealGroupSubtree(groupElId: string, stepIndex: number): void {
    const descendants = this._groupDescendantIds.get(groupElId);
    if (!descendants) return;

    for (const descendantId of descendants) {
      if (this._isDeferredForGroupReveal(descendantId, stepIndex, groupElId)) continue;
      const el = getEl(this.svg, descendantId);
      if (el) showDrawEl(el);
    }
  }

  private _resolveCascadeTargets(target: string): SVGGElement[] {
    const edge = parseEdgeTarget(target);
    if (edge) {
      const el = getEdgeEl(this.svg, edge.from, edge.to);
      return el ? [el] : [];
    }

    const el = resolveEl(this.svg, target);
    if (!el) return [];
    if (!el.id.startsWith("group-")) return [el];

    const ids = new Set<string>([el.id]);
    this._groupDescendantIds.get(el.id)?.forEach((id) => ids.add(id));

    return Array.from(ids)
      .map((id) => getEl(this.svg, id))
      .filter((candidate): candidate is SVGGElement => candidate != null);
  }

  /** The narration caption element — mount it anywhere via `yourContainer.appendChild(anim.captionElement)` */
  get captionElement(): HTMLDivElement | null {
    return this._captionEl;
  }

  /** Enable/disable browser text-to-speech for narrate steps */
  get tts(): boolean { return this._tts; }
  set tts(on: boolean) { this._tts = on; if (!on) this._cancelSpeech(); }

  get currentStep(): number {
    return this._step;
  }
  get total(): number {
    return this.steps.length;
  }
  get canNext(): boolean {
    return this._step < this.steps.length - 1;
  }
  get canPrev(): boolean {
    return this._step >= 0;
  }
  get atEnd(): boolean {
    return this._step === this.steps.length - 1;
  }

  on(listener: AnimationListener): () => void {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    };
  }
  private emit(type: AnimationEventType): void {
    const e: AnimationEvent = {
      type,
      stepIndex: this._step,
      step: this.steps[this._step],
      total: this.total,
    };
    for (const l of this._listeners) l(e);
  }

  reset(): void {
    this._step = -1;
    this._clearAll();
    this.emit("animation-reset");
  }

  /** Remove caption and annotation layer from the DOM */
  destroy(): void {
    this._clearAll();
    this._captionEl?.remove();
    this._captionEl = null;
    this._captionTextEl = null;
    this._annotationLayer?.remove();
    this._annotationLayer = null;
    this._pointerEl?.remove();
    this._pointerEl = null;
  }

  next(): boolean {
    if (!this.canNext) return false;
    this._step++;
    this._applyStep(this._step, false);
    this.emit("step-change");
    if (!this.canNext) this.emit("animation-end");
    return true;
  }

  prev(): boolean {
    if (!this.canPrev) return false;
    this._step--;
    this._clearAll();
    for (let i = 0; i <= this._step; i++) this._applyStep(i, true);
    this.emit("step-change");
    return true;
  }

  async play(msPerStep = 900): Promise<void> {
    this.emit("animation-start");
    while (this.canNext) {
      const nextStep = this.steps[this._step + 1];
      this.next();
      // Wait for timer AND speech to finish (whichever is longer)
      await Promise.all([
        new Promise<void>((r) =>
          setTimeout(r, this._playbackWaitMs(nextStep, msPerStep)),
        ),
        this._speechDone ?? Promise.resolve(),
      ]);
    }
  }

  goTo(index: number): void {
    index = Math.max(-1, Math.min(this.steps.length - 1, index));
    if (index === this._step) return;
    if (index < this._step) {
      this._step = -1;
      this._clearAll();
    }
    while (this._step < index) {
      this._step++;
      this._applyStep(this._step, true);
    }
    this.emit("step-change");
  }

  private _clearTimerBucket(bucket: Set<number>): void {
    bucket.forEach((id) => window.clearTimeout(id));
    bucket.clear();
  }

  private _clearPendingStepTimers(): void {
    this._clearTimerBucket(this._pendingStepTimers);
  }

  private _cancelNarrationTyping(): void {
    this._narrationRunId += 1;
    this._clearTimerBucket(this._pendingNarrationTimers);
  }

  private _scheduleTimer(
    fn: () => void,
    delayMs: number,
    bucket: Set<number> = this._pendingStepTimers,
  ): void {
    if (delayMs <= 0) {
      fn();
      return;
    }
    const id = window.setTimeout(() => {
      bucket.delete(id);
      fn();
    }, delayMs);
    bucket.add(id);
  }

  private _scheduleStep(fn: () => void, delayMs: number): void {
    this._scheduleTimer(fn, delayMs, this._pendingStepTimers);
  }

  private _stepWaitMs(step: ASTStep, fallbackMs: number): number {
    const delay = Math.max(0, step.delay ?? 0);
    const duration = Math.max(0, step.duration ?? 0);

    // Compute minimum time the step actually needs to finish
    let minNeeded = 0;
    if (step.action === "narrate") {
      const text = step.value ?? "";
      // Typing effect: chars × typeMs + fade buffer
      const typingMs = text.length * ANIMATION.narrationTypeMs + ANIMATION.narrationFadeMs;
      // TTS estimate: ~150ms per word + 500ms buffer for engine latency
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const ttsMs = this._tts ? wordCount * 150 + 500 : 0;
      minNeeded = Math.max(typingMs, ttsMs);
    } else if (step.action === "circle" || step.action === "underline" ||
               step.action === "crossout" || step.action === "bracket" ||
               step.action === "tick" || step.action === "strikeoff") {
      // Annotation guide draw + rough reveal + pointer fade
      minNeeded = ANIMATION.annotationStrokeDur + 120 + 200;
    } else if (step.action === "draw") {
      minNeeded = ANIMATION.nodeStrokeDur + ANIMATION.textRevealMs + 80;
    }

    let wait = delay + Math.max(fallbackMs, duration, minNeeded);
    if (step.pace === "slow") wait *= ANIMATION.paceSlowMul;
    else if (step.pace === "fast") wait *= ANIMATION.paceFastMul;
    else if (step.pace === "pause") wait += ANIMATION.pauseHoldMs;
    return wait;
  }

  private _playbackWaitMs(step: ASTStepItem | undefined, fallbackMs: number): number {
    if (!step) return fallbackMs;
    if (step.kind === "beat") {
      return Math.max(fallbackMs, ...step.children.map((c) => this._stepWaitMs(c, fallbackMs)));
    }
    return this._stepWaitMs(step, fallbackMs);
  }

  private _clearAll(): void {
    this._clearPendingStepTimers();
    this._cancelNarrationTyping();
    this._cancelSpeech();
    this._transforms.clear();

    // Nodes
    this.svg.querySelectorAll<SVGGElement>(".ng").forEach((el) => {
      el.style.transform = el.dataset.baseTransform ?? "";
      el.style.transition = "";
      el.classList.remove("hl", "faded", "hidden");
      el.style.opacity = el.style.filter = "";
      if (this.drawTargetNodes.has(el.id)) {
        prepareNodeForDraw(el);
      } else {
        clearNodeDrawStyles(el);
      }
    });

    // Groups — hide draw-target groups, show the rest
    this.svg.querySelectorAll<SVGGElement>(".gg").forEach((el) => {
      clearDrawStyles(el);
      el.style.transition = "none";
      if (this.drawTargetGroups.has(el.id)) {
        el.style.opacity = "";
        el.classList.add("gg-hidden");
      } else {
        el.style.opacity = "";
        el.classList.remove("gg-hidden");
        requestAnimationFrame(() => {
          el.style.transition = "";
        });
      }
    });

    // Edges
    this.svg.querySelectorAll<SVGGElement>(".eg").forEach((el) => {
      clearEdgeDrawStyles(el);
      el.style.transition = "none";
      el.style.opacity = "";
      if (this.drawTargetEdges.has(el.id)) {
        prepareEdgeForDraw(el);
      } else {
        requestAnimationFrame(() => {
          el.style.transition = "";
        });
      }
    });

    // Tables
    this.svg.querySelectorAll<SVGGElement>(".tg").forEach((el) => {
      clearDrawStyles(el);
      el.style.transition = "none";
      if (this.drawTargetTables.has(el.id)) {
        el.classList.add("gg-hidden");
      } else {
        el.classList.remove("gg-hidden");
        requestAnimationFrame(() => {
          el.style.transition = "";
        });
      }
    });

    // Notes
    this.svg.querySelectorAll<SVGGElement>(".ntg").forEach((el) => {
      clearDrawStyles(el);
      el.style.transition = "none";
      if (this.drawTargetNotes.has(el.id)) {
        el.classList.add("gg-hidden");
      } else {
        el.classList.remove("gg-hidden");
        requestAnimationFrame(() => {
          el.style.transition = "";
        });
      }
    });

    // Charts
    this.svg.querySelectorAll<SVGGElement>(".cg").forEach((el) => {
      clearDrawStyles(el);
      el.style.transition = "none";
      el.style.opacity = "";
      if (this.drawTargetCharts.has(el.id)) {
        el.classList.add("gg-hidden");
      } else {
        el.classList.remove("gg-hidden");
        requestAnimationFrame(() => {
          el.style.transition = "";
        });
      }
    });
    // Markdown
    this.svg.querySelectorAll<SVGGElement>(".mdg").forEach((el) => {
      clearDrawStyles(el);
      el.style.transition = "none";
      el.style.opacity = "";
      if (this.drawTargetMarkdowns.has(el.id)) {
        el.classList.add("gg-hidden");
      } else {
        el.classList.remove("gg-hidden");
        requestAnimationFrame(() => {
          el.style.transition = "";
        });
      }
    });

    this.svg
      .querySelectorAll<SVGGElement>(".tg, .ntg, .cg, .mdg")
      .forEach((el) => {
        el.style.transform = "";
        el.style.transition = "";
        el.style.opacity = "";
        el.classList.remove("hl", "faded");
      });

    for (const groupElId of this.drawTargetGroups) {
      this._hideGroupDescendants(groupElId);
    }

    // Clear narration caption
    if (this._captionEl) {
      this._captionEl.style.opacity = "0";
      if (this._captionTextEl) this._captionTextEl.textContent = "";
    }

    // Clear annotations
    this._annotations.forEach((a) => a.remove());
    this._annotations = [];

    // Clear pointer
    if (this._pointerEl) {
      this._pointerEl.setAttribute("opacity", "0");
      this._pointerEl.style.transition = "none";
    }
  }


  private _applyStep(i: number, silent: boolean): void {
    const item = this.steps[i];
    if (!item) return;

    if (silent) {
      this._runStepItem(item, true);
      return;
    }

    if (item.kind === "beat") {
      for (const child of item.children) {
        const run = () => this._runStep(child, false);
        this._scheduleStep(run, Math.max(0, child.delay ?? 0));
      }
    } else {
      let delayMs = Math.max(0, item.delay ?? 0);
      if (item.pace === "slow") delayMs *= ANIMATION.paceSlowMul;
      else if (item.pace === "fast") delayMs *= ANIMATION.paceFastMul;
      this._scheduleStep(() => this._runStep(item, false), delayMs);
    }
  }

  private _runStepItem(item: ASTStepItem, silent: boolean): void {
    if (item.kind === "beat") {
      for (const child of item.children) this._runStep(child, silent);
    } else {
      this._runStep(item, silent);
    }
  }

  private _runStep(s: ASTStep, silent: boolean): void {
    switch (s.action) {
      case "highlight":
        this._doHighlight(s.target);
        break;
      case "fade":
        this._doFade(s.target, true);
        break;
      case "unfade":
        this._doFade(s.target, false);
        break;
      case "draw":
        this._doDraw(s, silent);
        break;
      case "erase":
        this._doErase(s.target, silent, s.duration);
        break;
      case "show":
        this._doShowHide(s.target, true, silent, s.duration);
        break;
      case "hide":
        this._doShowHide(s.target, false, silent, s.duration);
        break;
      case "pulse":
        if (!silent) this._doPulse(s.target, s.duration);
        break;
      case "color":
        this._doColor(s.target, s.value);
        break;
      case "move":
        this._doMove(s.target, s, silent);
        break;
      case "scale":
        this._doScale(s.target, s, silent);
        break;
      case "rotate":
        this._doRotate(s.target, s, silent);
        break;
      case "narrate":
        this._doNarrate(s.value ?? "", silent);
        break;
      case "circle":
        this._doAnnotationCircle(s.target, silent);
        break;
      case "underline":
        this._doAnnotationUnderline(s.target, silent);
        break;
      case "crossout":
        this._doAnnotationCrossout(s.target, silent);
        break;
      case "bracket":
        this._doAnnotationBracket(s.target, s.target2 ?? "", silent);
        break;
      case "tick":
        this._doAnnotationTick(s.target, silent);
        break;
      case "strikeoff":
        this._doAnnotationStrikeoff(s.target, silent);
        break;
    }
  }

  // ── highlight ────────────────────────────────────────────
  private _doHighlight(target: string): void {
    this.svg
      .querySelectorAll(".ng.hl, .tg.hl, .ntg.hl, .cg.hl, .eg.hl")
      .forEach((e) => e.classList.remove("hl"));
    resolveEl(this.svg, target)?.classList.add("hl");
  }

  // ── fade / unfade ─────────────────────────────────────────
  private _doFade(target: string, doFade: boolean): void {
    for (const el of this._resolveCascadeTargets(target)) {
      el.classList.toggle("faded", doFade);
    }
  }

  private _writeTransform(
    el: SVGGElement,
    target: string,
    silent: boolean,
    duration = 420,
  ): void {
    const t = this._transforms.get(target) ?? {
      tx: 0,
      ty: 0,
      scale: 1,
      rotate: 0,
    };

    const parts: string[] = [];
    if (t.tx !== 0 || t.ty !== 0) parts.push(`translate(${t.tx}px,${t.ty}px)`);
    if (t.rotate !== 0) parts.push(`rotate(${t.rotate}deg)`);
    if (t.scale !== 1) parts.push(`scale(${t.scale})`);

    el.style.transition = silent
      ? "none"
      : `transform ${duration}ms cubic-bezier(.4,0,.2,1)`;
    const base = el.dataset.baseTransform ?? "";
    const anim = parts.join(" ");
    el.style.transform = anim ? `${anim} ${base}`.trim() : base;

    if (silent) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          el.style.transition = "";
        }),
      );
    }
  }

  // ── move ──────────────────────────────────────────────────
  private _doMove(target: string, step: ASTStep, silent: boolean): void {
    const el = resolveEl(this.svg, target);
    if (!el) return;
    const cur = this._transforms.get(target) ?? {
      tx: 0,
      ty: 0,
      scale: 1,
      rotate: 0,
    };
    this._transforms.set(target, {
      ...cur,
      tx: cur.tx + (step.dx ?? 0),
      ty: cur.ty + (step.dy ?? 0),
    });
    this._writeTransform(el, target, silent, step.duration ?? 420);
  }

  // ── scale ─────────────────────────────────────────────────
  private _doScale(target: string, step: ASTStep, silent: boolean): void {
    const el = resolveEl(this.svg, target);
    if (!el) return;
    const cur = this._transforms.get(target) ?? {
      tx: 0,
      ty: 0,
      scale: 1,
      rotate: 0,
    };
    this._transforms.set(target, { ...cur, scale: step.factor ?? 1 });
    this._writeTransform(el, target, silent, step.duration ?? 350);
  }

  // ── rotate ────────────────────────────────────────────────
  private _doRotate(target: string, step: ASTStep, silent: boolean): void {
    const el = resolveEl(this.svg, target);
    if (!el) return;
    const cur = this._transforms.get(target) ?? {
      tx: 0,
      ty: 0,
      scale: 1,
      rotate: 0,
    };
    this._transforms.set(target, {
      ...cur,
      rotate: cur.rotate + (step.deg ?? 0),
    });
    this._writeTransform(el, target, silent, step.duration ?? 400);
  }
  private _doDraw(step: ASTStep, silent: boolean): void {
    const { target } = step;
    const edge = parseEdgeTarget(target);

    if (edge) {
      // ── Edge draw ──────────────────────────────────────
      const el = getEdgeEl(this.svg, edge.from, edge.to);
      if (!el) return;
      if (silent) {
        revealEdgeInstant(el);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            clearEdgeDrawStyles(el);
          }),
        );
      } else {
        animateEdgeDraw(el, edge.conn, step.duration ?? ANIMATION.strokeDur);
      }
      return;
    }

    // Check if target is a group (has #group-{target} element)
    const groupEl = getGroupEl(this.svg, target);
    if (groupEl) {
      showDrawEl(groupEl);
      this._revealGroupSubtree(groupEl.id, this._step);
      // ── Group draw ──────────────────────────────────────
      if (silent) {
        clearDrawStyles(groupEl);
        groupEl.style.transition = "none";
        groupEl.style.opacity = "1";
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            groupEl.style.transition = "";
            clearDrawStyles(groupEl);
          }),
        );
      } else {
        // Groups use slightly longer stroke-draw (bigger box, dashed border = more paths)
        const firstPath = groupEl.querySelector("path");
        if (!firstPath?.style.strokeDasharray) prepareForDraw(groupEl);
        const groupStrokeDur = step.duration ?? ANIMATION.groupStrokeDur;
        animateShapeDraw(groupEl, groupStrokeDur, ANIMATION.groupStagger);

        const pathCount = groupEl.querySelectorAll('path').length;
        const totalMs   = pathCount * ANIMATION.groupStagger + groupStrokeDur + 120;
        clearDashOverridesAfter(groupEl, totalMs);
      }
      return;
    }

    // ── Table ──────────────────────────────────────────────
    const tableEl = getEl(this.svg, `table-${target}`);
    if (tableEl) {
      if (silent) {
        clearDrawStyles(tableEl);
        tableEl.style.transition = "none";
        tableEl.classList.remove("gg-hidden");
        tableEl.style.opacity = "1";
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            tableEl.style.transition = "";
            clearDrawStyles(tableEl);
          }),
        );
      } else {
        tableEl.classList.remove("gg-hidden");
        prepareForDraw(tableEl);
        const tableStrokeDur = step.duration ?? ANIMATION.tableStrokeDur;
        animateShapeDraw(tableEl, tableStrokeDur, ANIMATION.tableStagger);
        const tablePathCount = tableEl.querySelectorAll('path').length;
        clearDashOverridesAfter(tableEl, tablePathCount * ANIMATION.tableStagger + tableStrokeDur + 120);
      }
      return;
    }

    // ── Note ───────────────────────────────────────────────
    const noteEl = getEl(this.svg, `note-${target}`);
    if (noteEl) {
      if (silent) {
        clearDrawStyles(noteEl);
        noteEl.style.transition = "none";
        noteEl.classList.remove("gg-hidden");
        noteEl.style.opacity = "1";
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            noteEl.style.transition = "";
            clearDrawStyles(noteEl);
          }),
        );
      } else {
        noteEl.classList.remove("gg-hidden");
        prepareForDraw(noteEl);
        const noteStrokeDur = step.duration ?? ANIMATION.nodeStrokeDur;
        animateShapeDraw(noteEl, noteStrokeDur, ANIMATION.nodeStagger);
        const notePathCount = noteEl.querySelectorAll('path').length;
        clearDashOverridesAfter(noteEl, notePathCount * ANIMATION.nodeStagger + noteStrokeDur + 120);
      }
      return;
    }

    // ── Chart ──────────────────────────────────────────────
    const chartEl = getEl(this.svg, `chart-${target}`);
    if (chartEl) {
      if (silent) {
        clearDrawStyles(chartEl);
        chartEl.style.transition = "none";
        chartEl.style.opacity = "";
        chartEl.classList.remove("gg-hidden");
        chartEl.style.opacity = "1";
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            chartEl.style.transition = "";
            clearDrawStyles(chartEl);
          }),
        );
      } else {
        chartEl.style.opacity = "0"; // start from 0 explicitly
        chartEl.classList.remove("gg-hidden");
        const chartFade = step.duration ?? ANIMATION.chartFade;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            chartEl.style.transition = `opacity ${chartFade}ms ease`;
            chartEl.style.opacity = "1";
          }),
        );
      }
      return;
    }

    // ── Markdown ──────────────────────────────────────────
    const markdownEl = getMarkdownEl(this.svg, target);
    if (markdownEl) {
      if (silent) {
        markdownEl.style.transition = "none";
        markdownEl.style.opacity = "";
        markdownEl.classList.remove("gg-hidden");
        markdownEl.style.opacity = "1";
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            markdownEl.style.transition = "";
          }),
        );
      } else {
        markdownEl.style.opacity = "0";
        markdownEl.classList.remove("gg-hidden");
        const markdownFade = step.duration ?? ANIMATION.chartFade;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            markdownEl.style.transition = `opacity ${markdownFade}ms ease`;
            markdownEl.style.opacity = "1";
          }),
        );
      }
      return;
    }

    // ── Node draw ──────────────────────────────────────
    const nodeEl = getNodeEl(this.svg, target);
    if (!nodeEl) return;
    showDrawEl(nodeEl);
    if (silent) {
      revealNodeInstant(nodeEl);
    } else {
      if (!nodeGuidePathEl(nodeEl) && !nodeEl.querySelector("path")?.style.strokeDasharray) {
        prepareNodeForDraw(nodeEl);
      }
      animateNodeDraw(
        nodeEl,
        step.duration ?? ANIMATION.nodeStrokeDur,
        step.duration ?? ANIMATION.textRevealMs,
      );
    }
  }

  // ── erase ─────────────────────────────────────────────────
  private _doErase(target: string, silent: boolean, duration: number = 400): void {
    for (const el of this._resolveCascadeTargets(target)) {
      el.style.transition = silent ? "none" : `opacity ${duration}ms`;
      el.style.opacity = "0";
    }
  }

  // ── show / hide ───────────────────────────────────────────
  private _doShowHide(target: string, show: boolean, silent: boolean, duration: number = 400): void {
    for (const el of this._resolveCascadeTargets(target)) {
      if (show) showDrawEl(el);
      el.style.transition = silent ? "none" : `opacity ${duration}ms`;
      el.style.opacity = show ? "1" : "0";
    }
  }

  // ── pulse ─────────────────────────────────────────────────
  private _doPulse(target: string, duration: number = 500): void {
    resolveEl(this.svg, target)?.animate(
      [
        { filter: "brightness(1)" },
        { filter: "brightness(1.6)" },
        { filter: "brightness(1)" },
      ],
      { duration, iterations: 3 },
    );
  }

  // ── color ─────────────────────────────────────────────────
  private _doColor(target: string, color: string | undefined): void {
    if (!color) return;
    const el = resolveEl(this.svg, target);
    if (!el) return;

    // edge — color stroke
    if (parseEdgeTarget(target)) {
      el.querySelectorAll<SVGElement>("path, line, polyline").forEach((p) => {
        p.style.stroke = color;
      });
      el.querySelectorAll<SVGElement>("polygon").forEach((p) => {
        p.style.fill = color;
        p.style.stroke = color;
      });
      return;
    }

    // everything else — color fill
    let hit = false;
    el.querySelectorAll<SVGElement>("path, rect, ellipse, polygon").forEach(
      (c) => {
        const attrFill = c.getAttribute("fill");
        if (attrFill === "none") return;
        if (attrFill === null && c.tagName === "path") return;
        c.style.fill = color;
        hit = true;
      },
    );
    if (!hit) {
      el.querySelectorAll<SVGTextElement>("text").forEach((t) => {
        t.style.fill = color;
      });
    }
  }

  // ── narration ───────────────────────────────────────────
  private _initCaption(): void {
    // Remove any leftover caption from a previous instance
    document.querySelector('.skm-caption')?.remove();

    const cap = document.createElement("div");
    cap.className = "skm-caption";
    cap.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      z-index: 9999; max-width: 600px; width: max-content;
      padding: 10px 24px; box-sizing: border-box;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 15px; line-height: 1.5;
      color: #fde68a; background: #1a1208;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.35);
      opacity: 0; transition: opacity ${ANIMATION.narrationFadeMs}ms ease;
      pointer-events: none; user-select: none;
      text-align: center;
    `;
    const span = document.createElement("span");
    cap.appendChild(span);
    document.body.appendChild(cap);
    this._captionEl = cap;
    this._captionTextEl = span;
  }

  private _doNarrate(text: string, silent: boolean): void {
    if (!this._captionEl || !this._captionTextEl) return;
    this._cancelNarrationTyping();
    this._captionEl.style.opacity = "1";
    if (silent || !text) {
      this._captionTextEl.textContent = text;
      return;
    }

    // Fire TTS as full sentence — play() waits for _speechDone
    if (this._tts && text) this._speak(text);

    // Typing effect
    this._captionTextEl.textContent = "";
    const narrationRunId = this._narrationRunId;
    let charIdx = 0;
    const typeNext = () => {
      if (this._narrationRunId !== narrationRunId || !this._captionTextEl) return;
      if (charIdx < text.length) {
        this._captionTextEl.textContent += text[charIdx++];
        if (charIdx < text.length) {
          this._scheduleTimer(
            typeNext,
            ANIMATION.narrationTypeMs,
            this._pendingNarrationTimers,
          );
        }
      }
    };
    typeNext();
  }

  private _speak(text: string): void {
    if (typeof speechSynthesis === "undefined") return;
    this._cancelSpeech();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.lang = "en-US";
    // Track when speech actually finishes
    this._speechDone = new Promise<void>((resolve) => {
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
    });
    speechSynthesis.speak(utter);
  }

  private _cancelSpeech(): void {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    this._speechDone = null;
  }

  /** Pre-warm the speech engine with a silent utterance to eliminate cold-start delay */
  private _warmUpSpeech(): void {
    if (typeof speechSynthesis === "undefined") return;
    const warm = new SpeechSynthesisUtterance("");
    warm.volume = 0;
    speechSynthesis.speak(warm);
  }

  // ── annotations ─────────────────────────────────────────
  private _nodeMetrics(el: SVGGElement): { x: number; y: number; w: number; h: number } | null {
    const x = parseFloat(el.dataset.x ?? "");
    const y = parseFloat(el.dataset.y ?? "");
    const w = parseFloat(el.dataset.w ?? "");
    const h = parseFloat(el.dataset.h ?? "");
    if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) return null;
    return { x, y, w, h };
  }

  /**
   * Animate an annotation using the same guide-path approach as node draw:
   * 1. Hide the rough.js element (opacity=0)
   * 2. Create a clean single guide path and animate it with stroke-dashoffset
   * 3. Pointer follows the guide path
   * 4. After guide finishes → fade in rough.js element, remove guide
   */
  private _animateAnnotation(roughEl: SVGElement, guideD: string, silent: boolean): void {
    if (silent) return;

    // Hide rough.js element — will be revealed after guide draws
    roughEl.style.opacity = "0";
    roughEl.style.transition = "none";

    // Create a clean guide path
    const guide = document.createElementNS(SVG_NS, "path");
    guide.setAttribute("d", guideD);
    guide.setAttribute("fill", "none");
    guide.setAttribute("stroke", ANIMATION.annotationColor);
    guide.setAttribute("stroke-width", String(ANIMATION.annotationStrokeW));
    guide.setAttribute("stroke-linecap", "round");
    guide.setAttribute("stroke-linejoin", "round");
    guide.style.pointerEvents = "none";
    this._annotationLayer!.appendChild(guide);

    const len = pathLength(guide);
    guide.style.strokeDasharray = `${len}`;
    guide.style.strokeDashoffset = `${len}`;
    guide.style.transition = "none";

    // Pre-position pointer at the start of the guide
    const hasPointer = !!this._pointerEl;
    if (hasPointer) {
      try {
        const startPt = guide.getPointAtLength(0);
        this._pointerEl!.setAttribute("transform", `translate(${startPt.x},${startPt.y})`);
      } catch { /* ignore */ }
      this._pointerEl!.setAttribute("opacity", "1");
      this._pointerEl!.style.transition = "none";
    }

    const dur = ANIMATION.annotationStrokeDur;

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        // Animate guide stroke-dashoffset
        guide.style.transition = `stroke-dashoffset ${dur}ms cubic-bezier(.4,0,.2,1)`;
        guide.style.strokeDashoffset = "0";

        // Animate pointer along guide path
        if (hasPointer) {
          const startTime = performance.now();
          const pointerRef = this._pointerEl!;
          const animate = () => {
            const elapsed = performance.now() - startTime;
            const t = Math.min(elapsed / dur, 1);
            const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            try {
              const pt = guide.getPointAtLength(eased * len);
              pointerRef.setAttribute("transform", `translate(${pt.x},${pt.y})`);
            } catch { /* ignore */ }
            if (t < 1) {
              requestAnimationFrame(animate);
            } else {
              pointerRef.style.transition = `opacity 200ms ease`;
              pointerRef.setAttribute("opacity", "0");
            }
          };
          requestAnimationFrame(animate);
        }

        // After guide finishes: reveal rough.js element, remove guide
        this._scheduleTimer(() => {
          roughEl.style.transition = `opacity 120ms ease`;
          roughEl.style.opacity = "1";
          guide.remove();
        }, dur + 30);
      }),
    );
  }

  private _doAnnotationCircle(target: string, silent: boolean): void {
    const el = resolveEl(this.svg, target);
    if (!el || !this._rc || !this._annotationLayer) return;
    const m = this._nodeMetrics(el);
    if (!m) return;
    const cx = m.x + m.w / 2, cy = m.y + m.h / 2;
    const rx = m.w * 0.65, ry = m.h * 0.65;
    const roughEl = this._rc.ellipse(cx, cy, rx * 2, ry * 2, {
      roughness: 2.0, stroke: ANIMATION.annotationColor,
      strokeWidth: ANIMATION.annotationStrokeW, fill: "none",
      seed: Date.now(),
    });
    this._annotationLayer.appendChild(roughEl);
    this._annotations.push(roughEl);
    // Clean guide path for draw-in animation
    const guideD = ellipsePath(cx, cy, rx, ry);
    this._animateAnnotation(roughEl, guideD, silent);
  }

  private _doAnnotationUnderline(target: string, silent: boolean): void {
    const el = resolveEl(this.svg, target);
    if (!el || !this._rc || !this._annotationLayer) return;
    const m = this._nodeMetrics(el);
    if (!m) return;
    const lineY = m.y + m.h + 4;
    const roughEl = this._rc.line(m.x, lineY, m.x + m.w, lineY, {
      roughness: 1.5, stroke: ANIMATION.annotationColor,
      strokeWidth: ANIMATION.annotationStrokeW, seed: Date.now(),
    });
    this._annotationLayer.appendChild(roughEl);
    this._annotations.push(roughEl);
    // Clean guide path
    const guideD = `M ${m.x} ${lineY} L ${m.x + m.w} ${lineY}`;
    this._animateAnnotation(roughEl, guideD, silent);
  }

  private _doAnnotationCrossout(target: string, silent: boolean): void {
    const el = resolveEl(this.svg, target);
    if (!el || !this._rc || !this._annotationLayer) return;
    const m = this._nodeMetrics(el);
    if (!m) return;
    const pad = 4;
    const roughG = document.createElementNS(SVG_NS, "g") as SVGGElement;
    const line1 = this._rc.line(m.x - pad, m.y - pad, m.x + m.w + pad, m.y + m.h + pad, {
      roughness: 1.5, stroke: ANIMATION.annotationColor,
      strokeWidth: ANIMATION.annotationStrokeW, seed: Date.now(),
    });
    const line2 = this._rc.line(m.x + m.w + pad, m.y - pad, m.x - pad, m.y + m.h + pad, {
      roughness: 1.5, stroke: ANIMATION.annotationColor,
      strokeWidth: ANIMATION.annotationStrokeW, seed: Date.now() + 1,
    });
    roughG.appendChild(line1);
    roughG.appendChild(line2);
    this._annotationLayer.appendChild(roughG);
    this._annotations.push(roughG);
    // Clean guide: two diagonal lines in a single path (pointer draws both)
    const guideD = `M ${m.x - pad} ${m.y - pad} L ${m.x + m.w + pad} ${m.y + m.h + pad} ` +
                   `M ${m.x + m.w + pad} ${m.y - pad} L ${m.x - pad} ${m.y + m.h + pad}`;
    this._animateAnnotation(roughG, guideD, silent);
  }

  private _doAnnotationTick(target: string, silent: boolean): void {
    const el = resolveEl(this.svg, target);
    if (!el || !this._rc || !this._annotationLayer) return;
    const m = this._nodeMetrics(el);
    if (!m) return;

    // Tick mark on the left side of the node, like a teacher's check mark (✓)
    // The tick sits just to the left of the node, vertically centered
    const tickH = m.h * 0.5;                  // total tick height
    const tickW = tickH * 0.7;                // total tick width
    const gap = 8;                            // gap between tick and node

    // Key points of the tick: start (top-left), valley (bottom), end (top-right)
    const endX   = m.x - gap;                 // tip of the long upstroke (closest to node)
    const endY   = m.y + m.h * 0.25;          // top of the long stroke
    const valleyX = endX - tickW * 0.4;       // bottom of the V
    const valleyY = m.y + m.h * 0.75;         // bottom of the V
    const startX  = valleyX - tickW * 0.3;    // top of the short downstroke
    const startY  = valleyY - tickH * 0.3;    // slightly above valley

    const roughG = document.createElementNS(SVG_NS, "g") as SVGGElement;
    // Short down-stroke
    const line1 = this._rc.line(startX, startY, valleyX, valleyY, {
      roughness: 1.5, stroke: ANIMATION.annotationColor,
      strokeWidth: ANIMATION.annotationStrokeW, seed: Date.now(),
    });
    // Long up-stroke
    const line2 = this._rc.line(valleyX, valleyY, endX, endY, {
      roughness: 1.5, stroke: ANIMATION.annotationColor,
      strokeWidth: ANIMATION.annotationStrokeW, seed: Date.now() + 1,
    });
    roughG.appendChild(line1);
    roughG.appendChild(line2);
    this._annotationLayer.appendChild(roughG);
    this._annotations.push(roughG);
    // Guide path: short stroke down then long stroke up (single continuous path)
    const guideD = `M ${startX} ${startY} L ${valleyX} ${valleyY} L ${endX} ${endY}`;
    this._animateAnnotation(roughG, guideD, silent);
  }

  private _doAnnotationStrikeoff(target: string, silent: boolean): void {
    const el = resolveEl(this.svg, target);
    if (!el || !this._rc || !this._annotationLayer) return;
    const m = this._nodeMetrics(el);
    if (!m) return;
    const pad = 6;
    const lineY = m.y + m.h / 2;
    const roughEl = this._rc.line(m.x - pad, lineY, m.x + m.w + pad, lineY, {
      roughness: 1.5, stroke: ANIMATION.annotationColor,
      strokeWidth: ANIMATION.annotationStrokeW, seed: Date.now(),
    });
    this._annotationLayer.appendChild(roughEl);
    this._annotations.push(roughEl);
    const guideD = `M ${m.x - pad} ${lineY} L ${m.x + m.w + pad} ${lineY}`;
    this._animateAnnotation(roughEl, guideD, silent);
  }

  private _doAnnotationBracket(target1: string, target2: string, silent: boolean): void {
    const el1 = resolveEl(this.svg, target1);
    const el2 = resolveEl(this.svg, target2);
    if (!el1 || !el2 || !this._rc || !this._annotationLayer) return;
    const m1 = this._nodeMetrics(el1);
    const m2 = this._nodeMetrics(el2);
    if (!m1 || !m2) return;

    // Bracket on the right side spanning both elements
    const rightX = Math.max(m1.x + m1.w, m2.x + m2.w) + 12;
    const topY = Math.min(m1.y, m2.y);
    const botY = Math.max(m1.y + m1.h, m2.y + m2.h);
    const midY = (topY + botY) / 2;
    const bulge = 16;

    // Draw a curly brace using path
    const guideD = `M ${rightX} ${topY} Q ${rightX + bulge} ${topY} ${rightX + bulge} ${midY - 4} ` +
              `L ${rightX + bulge} ${midY} L ${rightX + bulge * 1.5} ${midY} ` +
              `M ${rightX + bulge} ${midY} L ${rightX + bulge} ${midY + 4} ` +
              `Q ${rightX + bulge} ${botY} ${rightX} ${botY}`;
    const roughEl = this._rc.path(guideD, {
      roughness: 1.2, stroke: ANIMATION.annotationColor,
      strokeWidth: ANIMATION.annotationStrokeW, fill: "none",
      seed: Date.now(),
    });
    this._annotationLayer.appendChild(roughEl);
    this._annotations.push(roughEl);
    this._animateAnnotation(roughEl, guideD, silent);
  }

  // ── pointer ─────────────────────────────────────────────
  private _initPointer(): void {
    if (this._pointerType === "dot") {
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("r", String(ANIMATION.pointerSize));
      circle.setAttribute("fill", ANIMATION.annotationColor);
      circle.setAttribute("opacity", "0");
      circle.style.pointerEvents = "none";
      this.svg.appendChild(circle);
      this._pointerEl = circle;
    } else if (this._pointerType === "chalk") {
      const g = document.createElementNS(SVG_NS, "g");
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("r", "5");
      circle.setAttribute("fill", "#fff");
      circle.setAttribute("stroke", "#1a1208");
      circle.setAttribute("stroke-width", "1.5");
      g.appendChild(circle);
      g.setAttribute("opacity", "0");
      g.style.pointerEvents = "none";
      this.svg.appendChild(g);
      this._pointerEl = g;
    } else if (this._pointerType === "hand") {
      const g = document.createElementNS(SVG_NS, "g");
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", "M5,0 L5,12 L8,9 L11,16 L13,15 L10,8 L14,8 Z");
      path.setAttribute("fill", "#1a1208");
      g.appendChild(path);
      g.setAttribute("opacity", "0");
      g.style.pointerEvents = "none";
      this.svg.appendChild(g);
      this._pointerEl = g;
    }
  }

}

export const ANIMATION_CSS = `
.ng, .gg, .tg, .ntg, .cg, .eg, .mdg {
  transform-box: fill-box;
  transform-origin: center;
  transition: filter 0.3s, opacity 0.35s;
}

/* highlight */
.ng.hl path, .ng.hl rect, .ng.hl ellipse, .ng.hl polygon,
.tg.hl path, .tg.hl rect,
.ntg.hl path, .ntg.hl polygon,
.cg.hl path, .cg.hl rect,
.mdg.hl text,
.eg.hl path, .eg.hl line, .eg.hl polygon { stroke-width: 2.8 !important; }

.ng.hl, .tg.hl, .ntg.hl, .cg.hl, .mdg.hl, .eg.hl {
  animation: ng-pulse 1.4s ease-in-out infinite;
}
@keyframes ng-pulse {
  0%, 100% { filter: drop-shadow(0 0 7px rgba(200,84,40,.6)); }
  50%       { filter: drop-shadow(0 0 14px rgba(200,84,40,.9)); }
}

/* fade */
.ng.faded, .gg.faded, .tg.faded, .ntg.faded,
.cg.faded, .eg.faded, .mdg.faded { opacity: 0.22; }

.ng.hidden { opacity: 0; pointer-events: none; }
.gg.gg-hidden  { opacity: 0; }
.tg.gg-hidden  { opacity: 0; }
.ntg.gg-hidden { opacity: 0; }
.cg.gg-hidden  { opacity: 0; }
.mdg.gg-hidden { opacity: 0; }

/* narration caption */
.skm-caption { pointer-events: none; user-select: none; }
`;
