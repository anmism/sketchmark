import { render } from "../render";
import { EventEmitter, clamp } from "../utils";
import {
  injectStyleOnce,
  normalizeNewlines,
  resolveContainer,
  toError,
  type ContainerTarget,
} from "./shared";
import type { DiagramInstance } from "../render";
import type { ASTStepItem } from "../ast/types";
import type { SVGRendererOptions } from "../renderer/svg";
import type { CanvasRendererOptions } from "../renderer/canvas";
import type { SketchmarkEditor } from "./editor";
import type { SketchmarkPlugin } from "../plugins";

const CANVAS_STYLE_ID = "sketchmark-canvas-ui";
const CANVAS_CSS = `
.skm-canvas{display:flex;flex-direction:column;width:100%;height:100%;min-height:320px;overflow:hidden;border:1px solid #caba98;border-radius:10px;background:#f8f4ea;color:#3a2010;font-family:"Courier New",monospace}
.skm-canvas__animbar{display:flex;align-items:center;gap:6px;padding:6px 10px;background:#eee7d8;border-bottom:1px solid #caba98;flex-shrink:0;flex-wrap:wrap}
.skm-canvas__status{min-width:96px;text-align:center;color:#6a4820;font-size:11px}
.skm-canvas__label{color:#8a6040;font-size:11px;font-style:italic}
.skm-canvas__spacer{flex:1}
.skm-canvas__stats{color:#9a7848;font-size:10px}
.skm-canvas__button{border:1px solid #caba98;background:#f5eedd;color:#3a2010;border-radius:6px;padding:4px 9px;font:inherit;font-size:11px;cursor:pointer;transition:background .12s ease,border-color .12s ease,color .12s ease}
.skm-canvas__button:hover:not(:disabled){background:#c8a060;border-color:#c8a060;color:#fff}
.skm-canvas__button.is-active{background:#c8a060;border-color:#c8a060;color:#fff}
.skm-canvas__button:disabled{opacity:.45;cursor:default}
.skm-canvas__error{display:none;padding:8px 12px;background:#280a0a;border-bottom:1px solid #5a1818;color:#f07070;font-size:11px;line-height:1.4;white-space:pre-wrap;flex-shrink:0}
.skm-canvas__error.is-visible{display:block}
.skm-canvas__viewport{position:relative;flex:1;overflow:hidden;background:#f8f4ea;cursor:grab;touch-action:none}
.skm-canvas__viewport.is-panning{cursor:grabbing}
.skm-canvas--dark .skm-canvas__viewport{background:#12100a}
.skm-canvas__grid{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.skm-canvas__world{position:absolute;top:0;left:0;transform-origin:0 0;}
.skm-canvas__controls{position:absolute;right:14px;bottom:14px;display:flex;flex-direction:column;align-items:center;gap:4px;z-index:2}
.skm-canvas__zoom{min-width:40px;text-align:center;color:#8a6040;font-size:10px}
.skm-canvas__minimap{position:absolute;left:14px;bottom:14px;width:120px;height:80px;background:rgba(255,248,234,.94);border:1px solid #caba98;border-radius:6px;overflow:hidden;z-index:2}
.skm-canvas__minimap canvas{width:100%;height:100%;display:block}
.skm-canvas__minimap-viewport{position:absolute;border:1.5px solid #c85428;background:rgba(200,84,40,.08);pointer-events:none}
.skm-canvas--hide-anim .skm-canvas__animbar,.skm-canvas--hide-controls .skm-canvas__controls,.skm-canvas--hide-minimap .skm-canvas__minimap{display:none}
`;

type CanvasTheme = "light" | "dark";

export interface SketchmarkCanvasOptions {
  container: ContainerTarget;
  dsl?: string;
  plugins?: readonly SketchmarkPlugin[];
  renderer?: "svg" | "canvas";
  theme?: CanvasTheme;
  autoFit?: boolean;
  preserveViewOnRender?: boolean;
  fitPadding?: number;
  zoomMin?: number;
  zoomMax?: number;
  playStepDelay?: number;
  showAnimationBar?: boolean;
  showControls?: boolean;
  showMinimap?: boolean;
  showCaption?: boolean;
  tts?: boolean;
  svgOptions?: SVGRendererOptions;
  canvasOptions?: CanvasRendererOptions;
  onNodeClick?: (nodeId: string) => void;
  onRender?: (instance: DiagramInstance, canvas: SketchmarkCanvas) => void;
}

export interface SketchmarkCanvasViewChange {
  panX: number;
  panY: number;
  zoom: number;
  canvas: SketchmarkCanvas;
}

export interface SketchmarkCanvasEvents extends Record<string, unknown> {
  render: { instance: DiagramInstance; canvas: SketchmarkCanvas };
  error: { error: Error; canvas: SketchmarkCanvas };
  stepchange: { stepIndex: number; step?: ASTStepItem; canvas: SketchmarkCanvas };
  viewchange: SketchmarkCanvasViewChange;
}

export interface SketchmarkCanvasBindEditorOptions {
  renderOnRun?: boolean;
  renderOnChange?: boolean;
  mirrorErrors?: boolean;
  initialRender?: boolean;
}

let canvasUid = 0;

export class SketchmarkCanvas {
  readonly root: HTMLDivElement;
  readonly viewport: HTMLDivElement;
  readonly diagramWrap: HTMLDivElement;
  readonly errorElement: HTMLDivElement;
  readonly minimapCanvas: HTMLCanvasElement;
  instance: DiagramInstance | null = null;

  private readonly emitter = new EventEmitter<SketchmarkCanvasEvents>();
  private readonly options: SketchmarkCanvasOptions;
  private readonly world: HTMLDivElement;
  private readonly zoomLabel: HTMLSpanElement;
  private readonly stepDisplay: HTMLSpanElement;
  private readonly stepLabel: HTMLSpanElement;
  private readonly statsLabel: HTMLSpanElement;
  private readonly minimapIndicator: HTMLDivElement;
  private readonly playButton: HTMLButtonElement;
  private readonly prevButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly captionButton: HTMLButtonElement;
  private readonly ttsButton: HTMLButtonElement;
  private readonly gridPattern: SVGPatternElement;
  private readonly gridDot: SVGCircleElement;
  private readonly renderer: "svg" | "canvas";

  private dsl = "";
  private theme: CanvasTheme;
  private showCaption = true;
  private ttsOverride: boolean | null = null;
  private panX = 60;
  private panY = 60;
  private zoom = 1;
  private isPanning = false;
  private panMoved = false;
  private activePointerId: number | null = null;
  private lastPX = 0;
  private lastPY = 0;
  private suppressClickUntil = 0;
  private hasRenderedOnce = false;
  private playInFlight = false;
  private minimapToken = 0;
  private animUnsub: (() => void) | null = null;
  private editorCleanup: (() => void) | null = null;
  private mirroredEditor: SketchmarkEditor | null = null;

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target;
    if (target instanceof Element && target.closest(".skm-canvas__controls, .skm-canvas__minimap")) return;
    this.isPanning = true;
    this.panMoved = false;
    this.activePointerId = event.pointerId;
    this.lastPX = event.clientX;
    this.lastPY = event.clientY;
    try {
      this.viewport.setPointerCapture(event.pointerId);
    } catch {
      // ignore pointer capture failures
    }
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (!this.isPanning) return;
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;
    const dx = event.clientX - this.lastPX;
    const dy = event.clientY - this.lastPY;
    if (!this.panMoved && Math.abs(dx) + Math.abs(dy) > 4) {
      this.panMoved = true;
      this.viewport.classList.add("is-panning");
    }
    if (this.panMoved) {
      this.panX += dx;
      this.panY += dy;
      this.applyTransform();
    }
    this.lastPX = event.clientX;
    this.lastPY = event.clientY;
  };

  private readonly onStopPanning = (event?: PointerEvent) => {
    if (this.activePointerId !== null && event?.pointerId != null && event.pointerId !== this.activePointerId) return;
    if (this.panMoved) this.suppressClickUntil = performance.now() + 180;
    if (this.activePointerId !== null && this.viewport.hasPointerCapture?.(this.activePointerId)) {
      try {
        this.viewport.releasePointerCapture(this.activePointerId);
      } catch {
        // ignore pointer capture release failures
      }
    }
    this.activePointerId = null;
    this.isPanning = false;
    this.panMoved = false;
    this.viewport.classList.remove("is-panning");
  };

  private readonly onViewportClick = (event: MouseEvent) => {
    if (performance.now() <= this.suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  private readonly onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const rect = this.viewport.getBoundingClientRect();
    const pivotX = event.clientX - rect.left;
    const pivotY = event.clientY - rect.top;
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    this.zoomTo(this.zoom * factor, pivotX, pivotY);
  };

  constructor(options: SketchmarkCanvasOptions) {
    this.options = options;
    this.renderer = options.renderer ?? "svg";
    this.theme = options.theme ?? "light";
    this.showCaption = options.showCaption !== false;
    this.ttsOverride = typeof options.tts === "boolean" ? options.tts : null;
    this.dsl = normalizeNewlines(options.dsl ?? "");
    injectStyleOnce(CANVAS_STYLE_ID, CANVAS_CSS);

    const host = resolveContainer(options.container);
    host.innerHTML = "";

    this.root = document.createElement("div");
    this.root.className = "skm-canvas";
    this.root.classList.toggle("skm-canvas--dark", this.theme === "dark");
    this.root.classList.toggle("skm-canvas--hide-anim", options.showAnimationBar === false);
    this.root.classList.toggle("skm-canvas--hide-controls", options.showControls === false);
    this.root.classList.toggle("skm-canvas--hide-minimap", options.showMinimap === false);

    const patternId = `skm-grid-${++canvasUid}`;
    this.root.innerHTML = `
      <div class="skm-canvas__animbar">
        <button type="button" class="skm-canvas__button" data-action="reset">Reset</button>
        <button type="button" class="skm-canvas__button" data-action="prev">Prev</button>
        <span class="skm-canvas__status">No steps</span>
        <button type="button" class="skm-canvas__button" data-action="next">Next</button>
        <button type="button" class="skm-canvas__button" data-action="play">Play</button>
        <button type="button" class="skm-canvas__button" data-action="toggle-caption">Caption On</button>
        <button type="button" class="skm-canvas__button" data-action="toggle-tts">TTS Off</button>
        <span class="skm-canvas__label"></span>
        <span class="skm-canvas__spacer"></span>
        <span class="skm-canvas__stats"></span>
      </div>
      <div class="skm-canvas__error"></div>
      <div class="skm-canvas__viewport">
        <svg class="skm-canvas__grid" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs><pattern id="${patternId}" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="0.9" fill="rgba(170,145,100,0.38)"></circle></pattern></defs>
          <rect width="100%" height="100%" fill="url(#${patternId})"></rect>
        </svg>
        <div class="skm-canvas__world"><div class="skm-canvas__diagram"></div></div>
        <div class="skm-canvas__controls">
          <button type="button" class="skm-canvas__button" data-action="fit">Fit</button>
          <button type="button" class="skm-canvas__button" data-action="reset-view">Reset</button>
          <button type="button" class="skm-canvas__button" data-action="zoom-in">+</button>
          <span class="skm-canvas__zoom">100%</span>
          <button type="button" class="skm-canvas__button" data-action="zoom-out">-</button>
        </div>
        <div class="skm-canvas__minimap"><canvas width="120" height="80"></canvas><div class="skm-canvas__minimap-viewport"></div></div>
      </div>`;

    this.errorElement = this.root.querySelector(".skm-canvas__error") as HTMLDivElement;
    this.viewport = this.root.querySelector(".skm-canvas__viewport") as HTMLDivElement;
    this.world = this.root.querySelector(".skm-canvas__world") as HTMLDivElement;
    this.diagramWrap = this.root.querySelector(".skm-canvas__diagram") as HTMLDivElement;
    this.zoomLabel = this.root.querySelector(".skm-canvas__zoom") as HTMLSpanElement;
    this.stepDisplay = this.root.querySelector(".skm-canvas__status") as HTMLSpanElement;
    this.stepLabel = this.root.querySelector(".skm-canvas__label") as HTMLSpanElement;
    this.statsLabel = this.root.querySelector(".skm-canvas__stats") as HTMLSpanElement;
    this.minimapCanvas = this.root.querySelector(".skm-canvas__minimap canvas") as HTMLCanvasElement;
    this.minimapIndicator = this.root.querySelector(".skm-canvas__minimap-viewport") as HTMLDivElement;
    this.playButton = this.root.querySelector('[data-action="play"]') as HTMLButtonElement;
    this.prevButton = this.root.querySelector('[data-action="prev"]') as HTMLButtonElement;
    this.nextButton = this.root.querySelector('[data-action="next"]') as HTMLButtonElement;
    this.resetButton = this.root.querySelector('[data-action="reset"]') as HTMLButtonElement;
    this.captionButton = this.root.querySelector('[data-action="toggle-caption"]') as HTMLButtonElement;
    this.ttsButton = this.root.querySelector('[data-action="toggle-tts"]') as HTMLButtonElement;
    this.gridPattern = this.root.querySelector(`#${patternId}`) as SVGPatternElement;
    this.gridDot = this.gridPattern.querySelector("circle") as SVGCircleElement;

    this.root.querySelector('[data-action="fit"]')?.addEventListener("click", () => this.fitContent());
    this.root.querySelector('[data-action="reset-view"]')?.addEventListener("click", () => this.resetView());
    this.root.querySelector('[data-action="zoom-in"]')?.addEventListener("click", () => this.zoomTo(this.zoom * 1.2, this.viewport.clientWidth / 2, this.viewport.clientHeight / 2));
    this.root.querySelector('[data-action="zoom-out"]')?.addEventListener("click", () => this.zoomTo(this.zoom * 0.8, this.viewport.clientWidth / 2, this.viewport.clientHeight / 2));
    this.resetButton.addEventListener("click", () => this.resetAnimation());
    this.prevButton.addEventListener("click", () => this.prevStep());
    this.nextButton.addEventListener("click", () => this.nextStep());
    this.playButton.addEventListener("click", () => void this.play());
    this.captionButton.addEventListener("click", () => this.setCaptionVisible(!this.showCaption));
    this.ttsButton.addEventListener("click", () => this.setTtsEnabled(!this.getTtsEnabled()));

    this.viewport.addEventListener("pointerdown", this.onPointerDown);
    this.viewport.addEventListener("pointermove", this.onPointerMove);
    this.viewport.addEventListener("pointerup", this.onStopPanning);
    this.viewport.addEventListener("pointercancel", this.onStopPanning);
    this.viewport.addEventListener("lostpointercapture", this.onStopPanning);
    this.viewport.addEventListener("click", this.onViewportClick, true);
    this.viewport.addEventListener("wheel", this.onWheel, { passive: false });

    host.appendChild(this.root);
    this.applyTransform();
    this.syncAnimationUi();
    if (this.dsl.trim()) this.render();
  }

  getDsl(): string {
    return this.dsl;
  }

  setDsl(dsl: string, renderNow = false): void {
    this.dsl = normalizeNewlines(dsl);
    if (renderNow) this.render();
  }

  setCaptionVisible(visible: boolean): void {
    this.showCaption = visible;
    this.applyCaptionVisibility(this.instance);
    this.syncToggleUi();
  }

  setTtsEnabled(enabled: boolean): void {
    this.ttsOverride = enabled;
    this.applyTtsSetting(this.instance);
    this.syncToggleUi();
  }

  bindEditor(editor: SketchmarkEditor, options: SketchmarkCanvasBindEditorOptions = {}): () => void {
    this.editorCleanup?.();
    const renderOnRun = options.renderOnRun !== false;
    const renderOnChange = options.renderOnChange === true;
    const mirrorErrors = options.mirrorErrors !== false;
    const initialRender = options.initialRender !== false;
    this.mirroredEditor = mirrorErrors ? editor : null;
    const unsubs: Array<() => void> = [];
    if (renderOnRun) unsubs.push(editor.on("run", ({ value }) => this.render(value)));
    if (renderOnChange) unsubs.push(editor.on("change", ({ value }) => this.render(value)));
    if (initialRender) this.render(editor.getValue());
    this.editorCleanup = () => {
      unsubs.forEach((unsub) => unsub());
      this.mirroredEditor = null;
      this.editorCleanup = null;
    };
    return this.editorCleanup;
  }

  on<K extends keyof SketchmarkCanvasEvents>(event: K, listener: (payload: SketchmarkCanvasEvents[K]) => void): () => void {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  render(nextDsl?: string): DiagramInstance | null {
    if (typeof nextDsl === "string") this.dsl = normalizeNewlines(nextDsl);
    this.clearError();
    this.mirroredEditor?.clearError();
    this.animUnsub?.();
    this.animUnsub = null;
    this.instance?.anim?.destroy();
    this.diagramWrap.innerHTML = "";

    try {
      const instance = render({
        container: this.diagramWrap,
        dsl: this.dsl,
        plugins: this.options.plugins,
        renderer: this.renderer,
        svgOptions: { interactive: true, showTitle: true, theme: this.options.svgOptions?.theme ?? this.theme, ...this.options.svgOptions },
        canvasOptions: this.options.canvasOptions,
        onNodeClick: this.options.onNodeClick,
      });
      this.instance = instance;
      this.applyCaptionVisibility(instance);
      this.applyTtsSetting(instance);
      this.statsLabel.textContent = `${instance.scene.nodes.length}n / ${instance.scene.edges.length}e / ${instance.scene.groups.length}g`;
      if (this.renderer === "svg") {
        this.animUnsub = instance.anim.on((event) => {
          this.syncAnimationUi();
          if (event.type === "step-change") {
            const targetId = this.getStepTarget(event.step);
            if (targetId) requestAnimationFrame(() => window.setTimeout(() => this.focusAnimatedElement(targetId), 40));
            this.emitter.emit("stepchange", { stepIndex: event.stepIndex, step: event.step, canvas: this });
          }
        });
      }
      this.syncAnimationUi();
      this.renderMinimapPreview();
      if (!this.hasRenderedOnce || this.options.preserveViewOnRender === false) {
        this.hasRenderedOnce = true;
        if (this.options.autoFit !== false) requestAnimationFrame(() => this.fitContent());
        else this.applyTransform();
      } else {
        this.applyTransform();
      }
      this.options.onRender?.(instance, this);
      this.emitter.emit("render", { instance, canvas: this });
      return instance;
    } catch (error) {
      const normalized = toError(error);
      this.instance = null;
      this.statsLabel.textContent = "";
      this.showError(normalized.message);
      this.mirroredEditor?.showError(normalized.message);
      this.syncAnimationUi();
      this.renderMinimapPreview();
      this.emitter.emit("error", { error: normalized, canvas: this });
      return null;
    }
  }

  async play(): Promise<void> {
    if (!this.instance || this.playInFlight || this.renderer !== "svg" || !this.instance.anim.total) return;
    this.playInFlight = true;
    this.syncAnimationUi();
    try {
      await this.instance.anim.play(this.options.playStepDelay ?? 800);
    } finally {
      this.playInFlight = false;
      this.syncAnimationUi();
    }
  }

  nextStep(): void {
    if (!this.instance || this.renderer !== "svg") return;
    this.instance.anim.next();
    this.syncAnimationUi();
    this.focusCurrentStep();
  }

  prevStep(): void {
    if (!this.instance || this.renderer !== "svg") return;
    this.instance.anim.prev();
    this.syncAnimationUi();
    this.focusCurrentStep();
  }

  resetAnimation(): void {
    if (!this.instance || this.renderer !== "svg") return;
    this.instance.anim.reset();
    this.syncAnimationUi();
  }

  fitContent(): void {
    const size = this.getContentSize();
    if (!size) return;
    const vpW = this.viewport.clientWidth || size.width;
    const vpH = this.viewport.clientHeight || size.height;
    const padding = this.options.fitPadding ?? 80;
    const nextZoom = Math.min((vpW - padding) / size.width, (vpH - padding) / size.height, 1);
    this.zoom = clamp(nextZoom || 1, this.options.zoomMin ?? 0.08, this.options.zoomMax ?? 4);
    this.panX = (vpW - size.width * this.zoom) / 2;
    this.panY = (vpH - size.height * this.zoom) / 2;
    this.applyTransform();
  }

  resetView(): void {
    this.panX = 60;
    this.panY = 60;
    this.zoom = 1;
    this.applyTransform();
  }

  setTheme(theme: CanvasTheme): void {
    this.theme = theme;
    this.root.classList.toggle("skm-canvas--dark", theme === "dark");
    this.render();
  }

  destroy(): void {
    this.editorCleanup?.();
    this.animUnsub?.();
    this.instance?.anim?.destroy();
    this.viewport.removeEventListener("pointerdown", this.onPointerDown);
    this.viewport.removeEventListener("pointermove", this.onPointerMove);
    this.viewport.removeEventListener("pointerup", this.onStopPanning);
    this.viewport.removeEventListener("pointercancel", this.onStopPanning);
    this.viewport.removeEventListener("lostpointercapture", this.onStopPanning);
    this.viewport.removeEventListener("click", this.onViewportClick, true);
    this.viewport.removeEventListener("wheel", this.onWheel);
    this.root.remove();
  }

  private applyTransform(): void {
    this.world.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
    const gridWidth = 24 * this.zoom;
    this.gridPattern.setAttribute("x", String(this.panX % gridWidth));
    this.gridPattern.setAttribute("y", String(this.panY % gridWidth));
    this.gridPattern.setAttribute("width", String(gridWidth));
    this.gridPattern.setAttribute("height", String(gridWidth));
    this.gridDot.setAttribute("cx", String(gridWidth / 2));
    this.gridDot.setAttribute("cy", String(gridWidth / 2));
    this.gridDot.setAttribute("r", String(Math.min(1.1, this.zoom * 0.85)));
    this.updateMinimapIndicator();
    this.emitter.emit("viewchange", { panX: this.panX, panY: this.panY, zoom: this.zoom, canvas: this });
  }

  private zoomTo(nextZoom: number, pivotX: number, pivotY: number): void {
    const clampedZoom = clamp(nextZoom, this.options.zoomMin ?? 0.08, this.options.zoomMax ?? 4);
    const ratio = clampedZoom / this.zoom;
    this.panX = pivotX - (pivotX - this.panX) * ratio;
    this.panY = pivotY - (pivotY - this.panY) * ratio;
    this.zoom = clampedZoom;
    this.applyTransform();
  }

  private applyCaptionVisibility(instance: DiagramInstance | null): void {
    const caption = instance?.anim.captionElement;
    if (!caption) return;
    caption.style.display = this.showCaption ? "" : "none";
    caption.setAttribute("aria-hidden", this.showCaption ? "false" : "true");
  }

  private applyTtsSetting(instance: DiagramInstance | null): void {
    if (!instance || this.ttsOverride === null) return;
    instance.anim.tts = this.ttsOverride;
  }

  private getTtsEnabled(): boolean {
    if (this.ttsOverride !== null) return this.ttsOverride;
    return !!this.instance?.anim.tts;
  }

  private syncToggleUi(): void {
    const canToggleCaption = this.renderer === "svg" && !!this.instance;
    const canToggleTts =
      canToggleCaption &&
      typeof speechSynthesis !== "undefined";
    const ttsEnabled = this.getTtsEnabled();

    this.captionButton.textContent = this.showCaption ? "Caption On" : "Caption Off";
    this.captionButton.classList.toggle("is-active", this.showCaption);
    this.captionButton.setAttribute("aria-pressed", this.showCaption ? "true" : "false");
    this.captionButton.disabled = !canToggleCaption;

    this.ttsButton.textContent = ttsEnabled ? "TTS On" : "TTS Off";
    this.ttsButton.classList.toggle("is-active", ttsEnabled);
    this.ttsButton.setAttribute("aria-pressed", ttsEnabled ? "true" : "false");
    this.ttsButton.disabled = !canToggleTts;
  }

  private syncAnimationUi(): void {
    const anim = this.instance?.anim;
    const canAnimate = this.renderer === "svg" && !!anim && anim.total > 0;
    if (!anim || !canAnimate) {
      this.stepDisplay.textContent = this.renderer === "canvas" ? "Static view" : "No steps";
      this.stepLabel.textContent = "";
      this.prevButton.disabled = true;
      this.nextButton.disabled = true;
      this.resetButton.disabled = true;
      this.playButton.disabled = true;
      this.syncToggleUi();
      return;
    }
    this.stepDisplay.textContent = anim.currentStep < 0 ? `${anim.total} steps` : `${anim.currentStep + 1} / ${anim.total}`;
    this.stepLabel.textContent = anim.currentStep >= 0 ? this.getStepLabel(anim.steps[anim.currentStep]) : "";
    this.prevButton.disabled = !anim.canPrev;
    this.nextButton.disabled = !anim.canNext;
    this.resetButton.disabled = false;
    this.playButton.disabled = this.playInFlight || !anim.canNext;
    this.syncToggleUi();
  }

  private getStepTarget(stepItem?: ASTStepItem): string | null {
    if (!stepItem) return null;
    return stepItem.kind === "beat" ? stepItem.children?.[0]?.target ?? null : stepItem.target ?? null;
  }

  private getStepLabel(stepItem?: ASTStepItem): string {
    if (!stepItem) return "";
    if (stepItem.kind === "beat") {
      const first = stepItem.children?.[0];
      return first ? `beat ${first.action} ${first.target ?? ""}`.trim() : "beat";
    }
    return `${stepItem.action} ${stepItem.target ?? ""}`.trim();
  }

  private focusCurrentStep(): void {
    const anim = this.instance?.anim;
    if (!anim || anim.currentStep < 0 || anim.currentStep >= anim.total) return;
    const targetId = this.getStepTarget(anim.steps[anim.currentStep]);
    if (targetId) window.setTimeout(() => this.focusAnimatedElement(targetId), 40);
  }

  private findSvgElement(svg: SVGSVGElement, id: string): Element | null {
    const prefixes = ["group-", "node-", "edge-", "table-", "chart-", "markdown-", "note-", ""];
    const esc = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape : (value: string) => value;
    for (const prefix of prefixes) {
      const found = svg.querySelector(`#${esc(prefix + id)}`);
      if (found) return found;
    }
    for (const attr of ["data-id", "data-node", "data-group", "sketchmark-id"]) {
      const found = svg.querySelector(`[${attr}="${id}"]`);
      if (found) return found;
    }
    return null;
  }

  private focusAnimatedElement(targetId: string): void {
    const svg = this.instance?.svg;
    if (!svg) return;
    const searchIds = this.splitEdgeTarget(targetId);
    let target: Element | null = null;
    for (const id of searchIds) {
      target = this.findSvgElement(svg, id);
      if (target) break;
    }
    if (!target) return;
    const box = target.getBoundingClientRect();
    if (!box.width && !box.height) return;
    const vpBox = this.viewport.getBoundingClientRect();
    const centerX = box.left + box.width / 2 - vpBox.left;
    const centerY = box.top + box.height / 2 - vpBox.top;
    const margin = 100;
    if (centerX >= margin && centerX <= vpBox.width - margin && centerY >= margin && centerY <= vpBox.height - margin) return;
    const targetPanX = this.panX + (vpBox.width / 2 - centerX);
    const targetPanY = this.panY + (vpBox.height / 2 - centerY);
    const startPanX = this.panX;
    const startPanY = this.panY;
    const startTs = performance.now();
    const duration = 350;
    const frame = (now: number) => {
      const t = Math.min((now - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.panX = startPanX + (targetPanX - startPanX) * eased;
      this.panY = startPanY + (targetPanY - startPanY) * eased;
      this.applyTransform();
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private splitEdgeTarget(targetId: string): string[] {
    const connectors = ["<-->", "<->", "-->", "<--", "---", "--", "->", "<-"];
    for (const connector of connectors) {
      if (targetId.includes(connector)) {
        return targetId.split(connector).map((part) => part.trim()).filter(Boolean);
      }
    }
    return [targetId.trim()];
  }

  private getContentSize(): { width: number; height: number } | null {
    if (this.instance?.svg) {
      return { width: parseFloat(this.instance.svg.getAttribute("width") || "400"), height: parseFloat(this.instance.svg.getAttribute("height") || "300") };
    }
    if (this.instance?.canvas) {
      return { width: this.instance.canvas.width || 400, height: this.instance.canvas.height || 300 };
    }
    return null;
  }

  private updateMinimapIndicator(): void {
    if (this.options.showMinimap === false) return;
    const size = this.getContentSize();
    if (!size) {
      this.minimapIndicator.style.width = "0px";
      this.minimapIndicator.style.height = "0px";
      return;
    }
    const mW = this.minimapCanvas.width;
    const mH = this.minimapCanvas.height;
    const scale = Math.min(mW / size.width, mH / size.height) * 0.9;
    const offX = (mW - size.width * scale) / 2;
    const offY = (mH - size.height * scale) / 2;
    const vpW = this.viewport.clientWidth || size.width;
    const vpH = this.viewport.clientHeight || size.height;
    const ix = offX + (-this.panX / this.zoom) * scale;
    const iy = offY + (-this.panY / this.zoom) * scale;
    const iw = (vpW / this.zoom) * scale;
    const ih = (vpH / this.zoom) * scale;
    this.minimapIndicator.style.left = `${Math.max(0, ix)}px`;
    this.minimapIndicator.style.top = `${Math.max(0, iy)}px`;
    this.minimapIndicator.style.width = `${Math.min(mW - Math.max(0, ix), iw)}px`;
    this.minimapIndicator.style.height = `${Math.min(mH - Math.max(0, iy), ih)}px`;
  }

  private renderMinimapPreview(): void {
    if (this.options.showMinimap === false) return;
    const ctx = this.minimapCanvas.getContext("2d");
    const size = this.getContentSize();
    if (!ctx) return;
    const width = this.minimapCanvas.width;
    const height = this.minimapCanvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = this.theme === "dark" ? "#1a140b" : "#fff8ea";
    ctx.fillRect(0, 0, width, height);
    if (!size) {
      this.updateMinimapIndicator();
      return;
    }
    const scale = Math.min(width / size.width, height / size.height) * 0.9;
    const drawW = size.width * scale;
    const drawH = size.height * scale;
    const offX = (width - drawW) / 2;
    const offY = (height - drawH) / 2;
    const token = ++this.minimapToken;
    const drawFallback = () => {
      if (token !== this.minimapToken) return;
      ctx.fillStyle = this.theme === "dark" ? "#20180e" : "#f7f1e2";
      ctx.fillRect(offX, offY, drawW, drawH);
      ctx.strokeStyle = this.theme === "dark" ? "#5a4525" : "#caba98";
      ctx.strokeRect(offX, offY, drawW, drawH);
      this.updateMinimapIndicator();
    };
    if (this.instance?.canvas) {
      try {
        ctx.drawImage(this.instance.canvas, offX, offY, drawW, drawH);
        ctx.strokeStyle = this.theme === "dark" ? "#5a4525" : "#caba98";
        ctx.strokeRect(offX, offY, drawW, drawH);
      } catch {
        drawFallback();
      }
      this.updateMinimapIndicator();
      return;
    }
    if (!this.instance?.svg || typeof XMLSerializer === "undefined") {
      drawFallback();
      return;
    }
    try {
      const serialized = new XMLSerializer().serializeToString(this.instance.svg);
      const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        if (token !== this.minimapToken) {
          URL.revokeObjectURL(url);
          return;
        }
        try {
          ctx.drawImage(image, offX, offY, drawW, drawH);
          ctx.strokeStyle = this.theme === "dark" ? "#5a4525" : "#caba98";
          ctx.strokeRect(offX, offY, drawW, drawH);
        } catch {
          drawFallback();
        } finally {
          URL.revokeObjectURL(url);
          this.updateMinimapIndicator();
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        drawFallback();
      };
      image.src = url;
    } catch {
      drawFallback();
    }
  }

  private showError(message: string): void {
    this.errorElement.textContent = message;
    this.errorElement.classList.add("is-visible");
  }

  private clearError(): void {
    this.errorElement.textContent = "";
    this.errorElement.classList.remove("is-visible");
  }
}
