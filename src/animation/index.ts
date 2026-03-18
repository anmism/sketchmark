// ============================================================
// sketchmark — Animation Engine  (nodes + edges + groups)
// ============================================================

import type { ASTStep } from "../ast/types";

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

function pathLength(p: SVGGeometryElement): number {
  try {
    return p.getTotalLength() || 200;
  } catch {
    return 200;
  }
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

function animateShapeDraw(el: SVGGElement, strokeDur = 420, stag = 55): void {
  const paths = Array.from(el.querySelectorAll<SVGGeometryElement>("path"));
  const text = el.querySelector<SVGElement>("text");
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      paths.forEach((p, i) => {
        const sd = i * stag,
          fd = sd + strokeDur - 60;
        p.style.transition = [
          `stroke-dashoffset ${strokeDur}ms cubic-bezier(.4,0,.2,1) ${sd}ms`,
          `fill-opacity 180ms ease ${Math.max(0, fd)}ms`,
        ].join(", ");
        p.style.strokeDashoffset = "0";
        p.style.fillOpacity = "1";
      });
      if (text) {
        const td = paths.length * stag + strokeDur + 80;
        text.style.transition = `opacity 200ms ease ${td}ms`;
        text.style.opacity = "1";
      }
    }),
  );
}

// ── Edge draw helpers ─────────────────────────────────────
function clearEdgeDrawStyles(el: SVGGElement): void {
  el.querySelectorAll<SVGGeometryElement>("path").forEach((p) => {
    p.style.strokeDasharray =
      p.style.strokeDashoffset =
      p.style.opacity =
      p.style.transition =
        "";
  });
}

function animateEdgeDraw(el: SVGGElement, conn: string): void {
  const paths = Array.from(el.querySelectorAll<SVGGeometryElement>("path"));
  if (!paths.length) return;
  const linePath = paths[0];
  const headPaths = paths.slice(1);
  const STROKE_DUR = 360;
  const len = pathLength(linePath);
  const reversed = conn.startsWith("<") && !conn.includes(">");

  linePath.style.strokeDasharray = `${len}`;
  linePath.style.strokeDashoffset = reversed ? `${-len}` : `${len}`;
  linePath.style.transition = "none";
  headPaths.forEach((p) => {
    p.style.opacity = "0";
    p.style.transition = "none";
  });

  el.classList.remove("draw-hidden");
  el.classList.add("draw-reveal");
  el.style.opacity = "1";

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      linePath.style.transition = `stroke-dashoffset ${STROKE_DUR}ms cubic-bezier(.4,0,.2,1)`;
      linePath.style.strokeDashoffset = "0";
      setTimeout(() => {
        headPaths.forEach((p) => {
          p.style.transition = "opacity 120ms ease";
          p.style.opacity = "1";
        });
      }, STROKE_DUR - 40);
    }),
  );
}

// ── AnimationController ───────────────────────────────────
export class AnimationController {
  private _step = -1;
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
  readonly drawTargetGroups: Set<string>; // e.g. "group-services"

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
    for (const s of steps) {
      if (s.action !== "draw" || parseEdgeTarget(s.target)) continue;
      if (svg.querySelector(`#group-${s.target}`)) {
        this.drawTargetGroups.add(`group-${s.target}`);
        // Remove from node targets if it was accidentally added
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
      this.next();
      await new Promise<void>((r) => setTimeout(r, msPerStep));
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

  private _clearAll(): void {
    this._transforms.clear();

    // Nodes
    this.svg.querySelectorAll<SVGGElement>(".ng").forEach((el) => {
      el.style.transform = "";
      el.style.transition = "";
      el.classList.remove("hl", "faded", "hidden");
      el.style.opacity = el.style.filter = "";
      if (this.drawTargetNodes.has(el.id)) {
        clearDrawStyles(el);
        prepareForDraw(el);
      } else clearDrawStyles(el);
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
      el.classList.remove("draw-reveal");
      clearEdgeDrawStyles(el);
      el.style.transition = "none";
      if (this.drawTargetEdges.has(el.id)) {
        el.style.opacity = "";
        el.classList.add("draw-hidden");
      } else {
        el.style.opacity = "";
        el.classList.remove("draw-hidden");
        requestAnimationFrame(() => {
          el.style.transition = "";
        });
      }
    });
  }

  private _applyStep(i: number, silent: boolean): void {
    const s = this.steps[i];
    if (!s) return;
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
        this._doDraw(s.target, silent);
        break;
      case "erase":
        this._doErase(s.target);
        break;
      case "show":
        this._doShowHide(s.target, true, silent);
        break;
      case "hide":
        this._doShowHide(s.target, false, silent);
        break;
      case "pulse":
        if (!silent) this._doPulse(s.target);
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

  private _doHighlight(target: string): void {
    this.svg
      .querySelectorAll(".ng.hl")
      .forEach((e) => e.classList.remove("hl"));
    getNodeEl(this.svg, target)?.classList.add("hl");
  }
  private _doFade(target: string, doFade: boolean): void {
    getNodeEl(this.svg, target)?.classList.toggle("faded", doFade);
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
    el.style.transform = parts.join(" ") || "";

    if (silent) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          el.style.transition = "";
        }),
      );
    }
  }

  private _doMove(target: string, step: ASTStep, silent: boolean): void {
    const el = getNodeEl(this.svg, target) ?? getGroupEl(this.svg, target);
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

  private _doScale(target: string, step: ASTStep, silent: boolean): void {
    const el = getNodeEl(this.svg, target) ?? getGroupEl(this.svg, target);
    if (!el) return;
    const cur = this._transforms.get(target) ?? {
      tx: 0,
      ty: 0,
      scale: 1,
      rotate: 0,
    };
    // factor is absolute: scale=1.5 always means 1.5x regardless of current scale
    this._transforms.set(target, { ...cur, scale: step.factor ?? 1 });
    this._writeTransform(el, target, silent, step.duration ?? 350);
  }

  private _doRotate(target: string, step: ASTStep, silent: boolean): void {
    const el = getNodeEl(this.svg, target) ?? getGroupEl(this.svg, target);
    if (!el) return;
    const cur = this._transforms.get(target) ?? {
      tx: 0,
      ty: 0,
      scale: 1,
      rotate: 0,
    };
    // deg is cumulative: rotate deg=45 twice = 90 degrees total
    this._transforms.set(target, {
      ...cur,
      rotate: cur.rotate + (step.deg ?? 0),
    });
    this._writeTransform(el, target, silent, step.duration ?? 400);
  }

  private _doDraw(target: string, silent: boolean): void {
    const edge = parseEdgeTarget(target);

    if (edge) {
      // ── Edge draw ──────────────────────────────────────
      const el = getEdgeEl(this.svg, edge.from, edge.to);
      if (!el) return;
      if (silent) {
        clearEdgeDrawStyles(el);
        el.style.transition = "none";
        el.classList.remove("draw-hidden");
        el.classList.add("draw-reveal");
        el.style.opacity = "1";
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            el.style.transition = "";
          }),
        );
      } else {
        animateEdgeDraw(el, edge.conn);
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
        animateShapeDraw(groupEl, 550, 40);
      }
      return;
    }

    // ── Node draw ──────────────────────────────────────
    const nodeEl = getNodeEl(this.svg, target);
    if (!nodeEl) return;
    if (silent) {
      revealInstant(nodeEl);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => clearDrawStyles(nodeEl)),
      );
    } else {
      const firstPath = nodeEl.querySelector("path");
      if (!firstPath?.style.strokeDasharray) prepareForDraw(nodeEl);
      animateShapeDraw(nodeEl, 420, 55);
    }
  }

  private _doErase(target: string): void {
    const edge = parseEdgeTarget(target);
    const el = edge
      ? getEdgeEl(this.svg, edge.from, edge.to)
      : (getGroupEl(this.svg, target) ?? getNodeEl(this.svg, target));
    if (el) {
      el.style.transition = "opacity 0.4s";
      el.style.opacity = "0";
    }
  }

  private _doShowHide(target: string, show: boolean, silent: boolean): void {
    const el = getNodeEl(this.svg, target);
    if (!el) return;
    el.style.transition = silent ? "none" : "opacity 0.4s";
    el.style.opacity = show ? "1" : "0";
  }

  private _doPulse(target: string): void {
    getNodeEl(this.svg, target)?.animate(
      [
        { filter: "brightness(1)" },
        { filter: "brightness(1.6)" },
        { filter: "brightness(1)" },
      ],
      { duration: 500, iterations: 3 },
    );
  }

  private _doColor(target: string, color: string | undefined): void {
    if (!color) return;
    const shape = getNodeEl(this.svg, target)?.querySelector(
      "rect, ellipse, polygon, path",
    );
    if (shape) (shape as SVGElement).style.fill = color;
  }
}

export const ANIMATION_CSS = `
.ng, .gg { transform-box: fill-box; transform-origin: center; transition: filter 0.3s, opacity 0.35s; }
.ng.hl path, .ng.hl rect, .ng.hl ellipse, .ng.hl polygon { stroke-width: 2.8 !important; }
.ng.hl { animation: ng-pulse 1.4s ease-in-out infinite; }
@keyframes ng-pulse {
  0%, 100% { filter: drop-shadow(0 0 7px rgba(200,84,40,.6)); }
  50%       { filter: drop-shadow(0 0 14px rgba(200,84,40,.9)); }
}
.ng.faded  { opacity: 0.22; }
.ng.hidden { opacity: 0; pointer-events: none; }
.eg.draw-hidden  { opacity: 0; }
.eg.draw-reveal  { opacity: 1; }
.gg.gg-hidden    { opacity: 0; }
`;
