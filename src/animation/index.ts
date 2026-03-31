// ============================================================
// sketchmark — Animation Engine  (nodes + edges + groups)
// ============================================================

import type { ASTStep } from "../ast/types";
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
  step?: ASTStep;
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

function resolveEl(svg: SVGSVGElement, target: string): SVGGElement | null {
  // check edge first — target contains connector like "a-->b"
  const edge = parseEdgeTarget(target);
  if (edge) return getEdgeEl(svg, edge.from, edge.to);

  // everything else resolved by prefixed id
  return (
    getNodeEl(svg, target) ??
    getGroupEl(svg, target) ??
    getTableEl(svg, target) ??
    getNoteEl(svg, target) ??
    getChartEl(svg, target) ??
    getMarkdownEl(svg, target) ??
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
  clearNodeDrawStyles(el);
}

function animateNodeDraw(el: SVGGElement, strokeDur: number = ANIMATION.nodeStrokeDur): void {
  const guide = nodeGuidePathEl(el);
  if (!guide) {
    const firstPath = el.querySelector("path");
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
        text.style.transition = `opacity ${ANIMATION.textFade}ms ease ${textDelay}ms`;
        text.style.opacity = "1";
      }

      setTimeout(() => {
        clearNodeDrawStyles(el);
      }, textDelay + ANIMATION.textFade + 40);
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

// ── Draw target helpers ───────────────────────────────────
export function getDrawTargetEdgeIds(steps: ASTStep[]): Set<string> {
  const ids = new Set<string>();
  for (const s of steps) {
    if (s.action !== "draw") continue;
    const e = parseEdgeTarget(s.target);
    if (e) ids.add(`edge-${e.from}-${e.to}`);
  }
  return ids;
}
export function getDrawTargetNodeIds(steps: ASTStep[]): Set<string> {
  const ids = new Set<string>();
  for (const s of steps) {
    if (s.action !== "draw" || parseEdgeTarget(s.target)) continue;
    ids.add(`node-${s.target}`);
  }
  return ids;
}

// after getDrawTargetNodeIds
export function getDrawTargetTableIds(steps: ASTStep[]): Set<string> {
  const ids = new Set<string>();
  for (const s of steps) {
    if (s.action !== "draw" || parseEdgeTarget(s.target)) continue;
    ids.add(`table-${s.target}`);
  }
  return ids;
}

export function getDrawTargetNoteIds(steps: ASTStep[]): Set<string> {
  const ids = new Set<string>();
  for (const s of steps) {
    if (s.action !== "draw" || parseEdgeTarget(s.target)) continue;
    ids.add(`note-${s.target}`);
  }
  return ids;
}

export function getDrawTargetChartIds(steps: ASTStep[]): Set<string> {
  const ids = new Set<string>();
  for (const s of steps) {
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

  get drawTargets(): Set<string> {
    return this.drawTargetEdges;
  }

  constructor(
    private svg: SVGSVGElement,
    public readonly steps: ASTStep[],
  ) {
    this.drawTargetEdges = getDrawTargetEdgeIds(steps);
    this.drawTargetNodes = getDrawTargetNodeIds(steps);

    // Groups: non-edge draw steps whose target has a #group-{id} element in the SVG.
    // We detect this at construction time (after render) so we correctly distinguish
    // a group ID from a node ID without needing extra metadata.
    this.drawTargetGroups = new Set<string>();
    this.drawTargetTables = new Set<string>();
    this.drawTargetNotes = new Set<string>();
    this.drawTargetCharts = new Set<string>();
    this.drawTargetMarkdowns = new Set<string>();

    for (const s of steps) {
      if (s.action !== "draw" || parseEdgeTarget(s.target)) continue;
      if (svg.querySelector(`#group-${s.target}`)) {
        this.drawTargetGroups.add(`group-${s.target}`);
        // Remove from node targets if it was accidentally added
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

    this._clearAll();
  }

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
      await new Promise<void>((r) =>
        setTimeout(r, this._playbackWaitMs(nextStep, msPerStep)),
      );
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

  private _clearPendingStepTimers(): void {
    this._pendingStepTimers.forEach((id) => window.clearTimeout(id));
    this._pendingStepTimers.clear();
  }

  private _scheduleStep(fn: () => void, delayMs: number): void {
    if (delayMs <= 0) {
      fn();
      return;
    }
    const id = window.setTimeout(() => {
      this._pendingStepTimers.delete(id);
      fn();
    }, delayMs);
    this._pendingStepTimers.add(id);
  }

  private _playbackWaitMs(step: ASTStep | undefined, fallbackMs: number): number {
    if (!step) return fallbackMs;
    const delay = Math.max(0, step.delay ?? 0);
    const duration = Math.max(0, step.duration ?? 0);
    return delay + Math.max(fallbackMs, duration);
  }

  private _clearAll(): void {
    this._clearPendingStepTimers();
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
  }

  private _applyStep(i: number, silent: boolean): void {
    const s = this.steps[i];
    if (!s) return;
    const run = () => this._runStep(s, silent);
    if (silent) {
      run();
      return;
    }
    this._scheduleStep(run, Math.max(0, s.delay ?? 0));
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
        this._doErase(s.target, s.duration);
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
    resolveEl(this.svg, target)?.classList.toggle("faded", doFade);
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
      // ── Group draw ──────────────────────────────────────
      if (silent) {
        clearDrawStyles(groupEl);
        groupEl.style.transition = "none";
        groupEl.classList.remove("gg-hidden");
        groupEl.style.opacity = "1";
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            groupEl.style.transition = "";
            clearDrawStyles(groupEl);
          }),
        );
      } else {
        groupEl.classList.remove("gg-hidden");
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
    if (silent) {
      revealNodeInstant(nodeEl);
    } else {
      if (!nodeGuidePathEl(nodeEl) && !nodeEl.querySelector("path")?.style.strokeDasharray) {
        prepareNodeForDraw(nodeEl);
      }
      animateNodeDraw(nodeEl, step.duration ?? ANIMATION.nodeStrokeDur);
    }
  }

  // ── erase ─────────────────────────────────────────────────
  private _doErase(target: string, duration: number = 400): void {
    const el = resolveEl(this.svg, target); // handles edges too now
    if (el) {
      el.style.transition = `opacity ${duration}ms`;
      el.style.opacity = "0";
    }
  }

  // ── show / hide ───────────────────────────────────────────
  private _doShowHide(target: string, show: boolean, silent: boolean, duration: number = 400): void {
    const el = resolveEl(this.svg, target);
    if (!el) return;
    el.style.transition = silent ? "none" : `opacity ${duration}ms`;
    el.style.opacity = show ? "1" : "0";
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
`;
