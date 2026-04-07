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
import type { SketchmarkPlugin } from "../plugins";

const EMBED_STYLE_ID = "sketchmark-embed-ui";

const EMBED_CSS = `
.skm-embed {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #caba98;
  border-radius: 12px;
  background: #fff8ea;
  color: #3a2010;
  font-family: "Courier New", monospace;
}

.skm-embed--dark {
  background: #12100a;
  border-color: #4a3520;
  color: #f3ddaf;
}

.skm-embed__viewport {
  position: relative;
  flex: 1;
  overflow: hidden;
  min-height: 0;
  background: inherit;
}

.skm-embed__world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  will-change: transform;
}

.skm-embed__error {
  display: none;
  padding: 8px 12px;
  background: #280a0a;
  border-top: 1px solid #5a1818;
  color: #f07070;
  font-size: 11px;
  line-height: 1.4;
  white-space: pre-wrap;
}

.skm-embed__error.is-visible {
  display: block;
}

.skm-embed__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid #d8ccb1;
  background: rgba(255, 248, 234, 0.88);
  backdrop-filter: blur(6px);
}

.skm-embed--dark .skm-embed__controls {
  border-top-color: #3a2a12;
  background: rgba(26, 18, 8, 0.9);
}

.skm-embed__controls.is-hidden {
  display: none;
}

.skm-embed__controls-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.skm-embed__button {
  border: 1px solid #caba98;
  background: #f5eedd;
  color: #3a2010;
  border-radius: 6px;
  padding: 5px 10px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}

.skm-embed__button:hover:not(:disabled) {
  background: #c8a060;
  border-color: #c8a060;
  color: #fff;
}

.skm-embed__button.is-active {
  background: #c8a060;
  border-color: #c8a060;
  color: #fff;
}

.skm-embed--dark .skm-embed__button {
  border-color: #4a3520;
  background: #22190e;
  color: #f3ddaf;
}

.skm-embed--dark .skm-embed__button:hover:not(:disabled) {
  background: #c8a060;
  border-color: #c8a060;
  color: #fff;
}

.skm-embed__button:disabled {
  opacity: 0.45;
  cursor: default;
}

.skm-embed__zoom {
  min-width: 48px;
  text-align: center;
  color: #8a6040;
  font-size: 11px;
}

.skm-embed--dark .skm-embed__zoom {
  color: #d0b176;
}

.skm-embed__step {
  margin-left: auto;
  min-width: 96px;
  text-align: center;
  color: #8a6040;
  font-size: 11px;
}

.skm-embed--dark .skm-embed__step {
  color: #d0b176;
}
`;

type EmbedTheme = "light" | "dark";
type EmbedSize = number | string;

export interface SketchmarkEmbedOptions {
  container: ContainerTarget;
  dsl: string;
  plugins?: readonly SketchmarkPlugin[];
  width?: EmbedSize;
  height?: EmbedSize;
  theme?: EmbedTheme;
  showControls?: boolean;
  showCaption?: boolean;
  tts?: boolean;
  playStepDelay?: number;
  fitPadding?: number;
  zoomMin?: number;
  zoomMax?: number;
  focusPadding?: number;
  focusDuration?: number;
  autoFocus?: boolean;
  autoFocusOnStep?: boolean;
  svgOptions?: SVGRendererOptions;
  onNodeClick?: (nodeId: string) => void;
  onRender?: (instance: DiagramInstance, embed: SketchmarkEmbed) => void;
}

export interface SketchmarkEmbedEvents extends Record<string, unknown> {
  render: { instance: DiagramInstance; embed: SketchmarkEmbed };
  error: { error: Error; embed: SketchmarkEmbed };
  stepchange: { stepIndex: number; step?: ASTStepItem; embed: SketchmarkEmbed };
}

export class SketchmarkEmbed {
  readonly root: HTMLDivElement;
  readonly viewport: HTMLDivElement;
  readonly world: HTMLDivElement;
  readonly diagramWrap: HTMLDivElement;
  readonly errorElement: HTMLDivElement;
  readonly controlsElement: HTMLDivElement;
  readonly stepInfoElement: HTMLSpanElement;
  readonly zoomInfoElement: HTMLSpanElement;
  instance: DiagramInstance | null = null;

  private readonly emitter = new EventEmitter<SketchmarkEmbedEvents>();
  private readonly options: SketchmarkEmbedOptions;
  private readonly btnRestart: HTMLButtonElement;
  private readonly btnPrev: HTMLButtonElement;
  private readonly btnNext: HTMLButtonElement;
  private readonly btnPlay: HTMLButtonElement;
  private readonly btnFit: HTMLButtonElement;
  private readonly btnZoomIn: HTMLButtonElement;
  private readonly btnZoomOut: HTMLButtonElement;
  private readonly btnCaption: HTMLButtonElement;
  private readonly btnTts: HTMLButtonElement;
  private animUnsub: (() => void) | null = null;
  private playInFlight = false;
  private dsl: string;
  private theme: EmbedTheme;
  private showCaption = true;
  private ttsOverride: boolean | null = null;
  private zoom = 1;
  private offsetX = 0;
  private offsetY = 0;
  private autoFitEnabled = true;
  private motionFrame: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(options: SketchmarkEmbedOptions) {
    this.options = options;
    this.dsl = normalizeNewlines(options.dsl);
    this.theme = options.theme ?? "light";
    this.showCaption = options.showCaption !== false;
    this.ttsOverride = typeof options.tts === "boolean" ? options.tts : null;

    injectStyleOnce(EMBED_STYLE_ID, EMBED_CSS);

    const host = resolveContainer(options.container);
    host.innerHTML = "";

    this.root = document.createElement("div");
    this.root.className = "skm-embed";
    this.root.classList.toggle("skm-embed--dark", this.theme === "dark");
    this.applySize(options.width, options.height);

    this.root.innerHTML = `
      <div class="skm-embed__viewport">
        <div class="skm-embed__world">
          <div class="skm-embed__diagram"></div>
        </div>
      </div>
      <div class="skm-embed__error"></div>
      <div class="skm-embed__controls">
        <div class="skm-embed__controls-group">
          <button type="button" class="skm-embed__button" data-action="zoom-out">-</button>
          <span class="skm-embed__zoom">100%</span>
          <button type="button" class="skm-embed__button" data-action="zoom-in">+</button>
          <button type="button" class="skm-embed__button" data-action="fit">Reset</button>
        </div>
        <div class="skm-embed__controls-group">
          <button type="button" class="skm-embed__button" data-action="restart">Restart</button>
          <button type="button" class="skm-embed__button" data-action="prev">Prev</button>
          <button type="button" class="skm-embed__button" data-action="next">Next</button>
          <button type="button" class="skm-embed__button" data-action="play">Play</button>
        </div>
        <div class="skm-embed__controls-group">
          <button type="button" class="skm-embed__button" data-action="toggle-caption">Caption On</button>
          <button type="button" class="skm-embed__button" data-action="toggle-tts">TTS Off</button>
        </div>
        <span class="skm-embed__step">No steps</span>
      </div>
    `;

    this.viewport = this.root.querySelector(".skm-embed__viewport") as HTMLDivElement;
    this.world = this.root.querySelector(".skm-embed__world") as HTMLDivElement;
    this.diagramWrap = this.root.querySelector(".skm-embed__diagram") as HTMLDivElement;
    this.errorElement = this.root.querySelector(".skm-embed__error") as HTMLDivElement;
    this.controlsElement = this.root.querySelector(".skm-embed__controls") as HTMLDivElement;
    this.stepInfoElement = this.root.querySelector(".skm-embed__step") as HTMLSpanElement;
    this.zoomInfoElement = this.root.querySelector(".skm-embed__zoom") as HTMLSpanElement;
    this.btnFit = this.root.querySelector('[data-action="fit"]') as HTMLButtonElement;
    this.btnZoomIn = this.root.querySelector('[data-action="zoom-in"]') as HTMLButtonElement;
    this.btnZoomOut = this.root.querySelector('[data-action="zoom-out"]') as HTMLButtonElement;
    this.btnRestart = this.root.querySelector('[data-action="restart"]') as HTMLButtonElement;
    this.btnPrev = this.root.querySelector('[data-action="prev"]') as HTMLButtonElement;
    this.btnNext = this.root.querySelector('[data-action="next"]') as HTMLButtonElement;
    this.btnPlay = this.root.querySelector('[data-action="play"]') as HTMLButtonElement;
    this.btnCaption = this.root.querySelector('[data-action="toggle-caption"]') as HTMLButtonElement;
    this.btnTts = this.root.querySelector('[data-action="toggle-tts"]') as HTMLButtonElement;

    this.controlsElement.classList.toggle("is-hidden", options.showControls === false);

    this.btnFit.addEventListener("click", () => this.resetView());
    this.btnZoomIn.addEventListener("click", () => this.zoomIn());
    this.btnZoomOut.addEventListener("click", () => this.zoomOut());
    this.btnRestart.addEventListener("click", () => this.resetAnimation());
    this.btnPrev.addEventListener("click", () => this.prevStep());
    this.btnNext.addEventListener("click", () => this.nextStep());
    this.btnPlay.addEventListener("click", () => {
      void this.play();
    });
    this.btnCaption.addEventListener("click", () => this.setCaptionVisible(!this.showCaption));
    this.btnTts.addEventListener("click", () => this.setTtsEnabled(!this.getTtsEnabled()));

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.positionViewport(false);
      });
      this.resizeObserver.observe(this.viewport);
    }

    host.appendChild(this.root);
    this.render();
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
    this.syncToggleControls();
  }

  setTtsEnabled(enabled: boolean): void {
    this.ttsOverride = enabled;
    this.applyTtsSetting(this.instance);
    this.syncToggleControls();
  }

  setSize(width?: EmbedSize, height?: EmbedSize): void {
    this.applySize(width, height);
    this.positionViewport(false);
  }

  setTheme(theme: EmbedTheme): void {
    this.theme = theme;
    this.root.classList.toggle("skm-embed--dark", theme === "dark");
    this.render();
  }

  on<K extends keyof SketchmarkEmbedEvents>(
    event: K,
    listener: (payload: SketchmarkEmbedEvents[K]) => void,
  ): () => void {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  render(nextDsl?: string): DiagramInstance | null {
    if (typeof nextDsl === "string") {
      this.dsl = normalizeNewlines(nextDsl);
    }

    this.clearError();
    this.stopMotion();
    this.animUnsub?.();
    this.animUnsub = null;
    this.instance?.anim?.destroy();
    this.instance = null;
    this.autoFitEnabled = true;
    this.zoom = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.diagramWrap.innerHTML = "";
    this.applyTransform();

    try {
      const instance = render({
        container: this.diagramWrap,
        dsl: this.dsl,
        plugins: this.options.plugins,
        renderer: "svg",
        svgOptions: {
          showTitle: true,
          interactive: true,
          transparent: true,
          theme: this.options.svgOptions?.theme ?? this.theme,
          ...this.options.svgOptions,
        },
        onNodeClick: this.options.onNodeClick,
      });

      this.instance = instance;
      this.applyCaptionVisibility(instance);
      this.applyTtsSetting(instance);
      this.animUnsub = instance.anim.on((event) => {
        this.syncControls();
        if (event.type === "step-change") {
          if (this.options.autoFocusOnStep !== false) {
            requestAnimationFrame(() => {
              window.setTimeout(() => this.positionViewport(true), 40);
            });
          }
          this.emitter.emit("stepchange", {
            stepIndex: event.stepIndex,
            step: event.step,
            embed: this,
          });
        }
      });

      this.syncControls();
      requestAnimationFrame(() => {
        this.positionViewport(false);
      });
      this.options.onRender?.(instance, this);
      this.emitter.emit("render", { instance, embed: this });
      return instance;
    } catch (error) {
      const normalized = toError(error);
      this.showError(normalized.message);
      this.syncControls();
      this.emitter.emit("error", { error: normalized, embed: this });
      return null;
    }
  }

  async play(): Promise<void> {
    if (!this.instance || this.playInFlight || !this.instance.anim.total) return;
    this.playInFlight = true;
    this.syncControls();
    try {
      await this.instance.anim.play(this.options.playStepDelay ?? 800);
    } finally {
      this.playInFlight = false;
      this.syncControls();
    }
  }

  nextStep(): void {
    if (!this.instance) return;
    this.instance.anim.next();
    this.syncControls();
    this.positionViewport(true);
  }

  prevStep(): void {
    if (!this.instance) return;
    this.instance.anim.prev();
    this.syncControls();
    this.positionViewport(true);
  }

  resetAnimation(): void {
    if (!this.instance) return;
    this.instance.anim.reset();
    this.syncControls();
    this.positionViewport(true);
  }

  fitToViewport(animated = false): void {
    if (!this.instance?.svg) return;
    this.autoFitEnabled = true;
    this.positionViewport(animated);
  }

  resetView(animated = false): void {
    this.fitToViewport(animated);
  }

  zoomIn(): void {
    this.zoomAroundViewportCenter(1.2);
  }

  zoomOut(): void {
    this.zoomAroundViewportCenter(0.8);
  }

  exportSVG(filename?: string): void {
    this.instance?.exportSVG(filename);
  }

  async exportPNG(filename?: string): Promise<void> {
    await this.instance?.exportPNG(filename);
  }

  destroy(): void {
    this.stopMotion();
    this.animUnsub?.();
    this.instance?.anim?.destroy();
    this.instance = null;
    this.resizeObserver?.disconnect();
    this.root.remove();
  }

  private applySize(width?: EmbedSize, height?: EmbedSize): void {
    this.root.style.width = this.formatSize(width ?? 960);
    this.root.style.height = this.formatSize(height ?? 540);
  }

  private formatSize(value: EmbedSize): string {
    return typeof value === "number" ? `${value}px` : value;
  }

  private syncControls(): void {
    this.syncAnimationControls();
    this.syncViewControls();
    this.syncToggleControls();
  }

  private syncAnimationControls(): void {
    const anim = this.instance?.anim;
    if (!anim || !anim.total) {
      this.stepInfoElement.textContent = "No steps";
      this.btnRestart.disabled = true;
      this.btnPrev.disabled = true;
      this.btnNext.disabled = true;
      this.btnPlay.disabled = true;
      return;
    }

    this.stepInfoElement.textContent =
      anim.currentStep < 0 ? `${anim.total} steps` : `${anim.currentStep + 1} / ${anim.total}`;
    this.btnRestart.disabled = false;
    this.btnPrev.disabled = !anim.canPrev;
    this.btnNext.disabled = !anim.canNext;
    this.btnPlay.disabled = this.playInFlight || !anim.canNext;
  }

  private syncViewControls(): void {
    const hasView = !!this.instance?.svg;
    const zoomMin = this.getZoomMin();
    const zoomMax = this.getZoomMax();

    this.zoomInfoElement.textContent = `${Math.round(this.zoom * 100)}%`;
    this.btnFit.disabled = !hasView;
    this.btnZoomOut.disabled = !hasView || this.zoom <= zoomMin + 0.001;
    this.btnZoomIn.disabled = !hasView || this.zoom >= zoomMax - 0.001;
  }

  private positionViewport(animated: boolean): void {
    const size = this.getContentSize();
    if (!size) return;

    const { width: svgWidth, height: svgHeight } = size;

    const viewportRect = this.viewport.getBoundingClientRect();
    const viewWidth = viewportRect.width || this.viewport.clientWidth;
    const viewHeight = viewportRect.height || this.viewport.clientHeight;
    if (!viewWidth || !viewHeight) return;

    if (this.autoFitEnabled) {
      this.zoom = this.getFitZoom(svgWidth, svgHeight, viewWidth, viewHeight);
    }
    this.syncViewControls();

    const scaledWidth = svgWidth * this.zoom;
    const scaledHeight = svgHeight * this.zoom;
    const focusTarget = this.getFocusTarget();
    const sceneIsLarge = scaledWidth > viewWidth || scaledHeight > viewHeight;
    const shouldFocus =
      sceneIsLarge &&
      this.options.autoFocus !== false &&
      !!focusTarget;

    if (!shouldFocus) {
      this.animateTo(
        scaledWidth <= viewWidth ? (viewWidth - scaledWidth) / 2 : 0,
        scaledHeight <= viewHeight ? (viewHeight - scaledHeight) / 2 : 0,
        animated,
      );
      return;
    }

    const target = this.findTargetElement(focusTarget!);
    if (!target) {
      this.animateTo(0, 0, animated);
      return;
    }

    const targetBox = this.getTargetBox(target, viewportRect);
    if (!targetBox) {
      this.animateTo(0, 0, animated);
      return;
    }

    let nextX = viewWidth / 2 - targetBox.centerX;
    let nextY = viewHeight / 2 - targetBox.centerY;
    const padding = this.options.focusPadding ?? 24;

    if (scaledWidth <= viewWidth) {
      nextX = (viewWidth - scaledWidth) / 2;
    } else {
      nextX = clamp(nextX, viewWidth - scaledWidth - padding, padding);
    }

    if (scaledHeight <= viewHeight) {
      nextY = (viewHeight - scaledHeight) / 2;
    } else {
      nextY = clamp(nextY, viewHeight - scaledHeight - padding, padding);
    }

    this.animateTo(nextX, nextY, animated);
  }

  private animateTo(nextX: number, nextY: number, animated: boolean): void {
    this.stopMotion();

    const duration = this.options.focusDuration ?? 320;
    if (!animated || duration <= 0) {
      this.offsetX = nextX;
      this.offsetY = nextY;
      this.applyTransform();
      return;
    }

    const startX = this.offsetX;
    const startY = this.offsetY;
    const start = performance.now();

    const frame = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.offsetX = startX + (nextX - startX) * eased;
      this.offsetY = startY + (nextY - startY) * eased;
      this.applyTransform();
      if (t < 1) {
        this.motionFrame = requestAnimationFrame(frame);
      } else {
        this.motionFrame = null;
      }
    };

    this.motionFrame = requestAnimationFrame(frame);
  }

  private applyTransform(): void {
    this.world.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoom})`;
    this.zoomInfoElement.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  private getContentSize(): { width: number; height: number } | null {
    if (!this.instance?.svg) return null;

    const svg = this.instance.svg;
    const width = parseFloat(svg.getAttribute("width") || "0");
    const height = parseFloat(svg.getAttribute("height") || "0");
    if (!width || !height) return null;
    return { width, height };
  }

  private getFitZoom(svgWidth: number, svgHeight: number, viewWidth: number, viewHeight: number): number {
    const padding = this.getFitPadding(viewWidth, viewHeight);
    const availableWidth = Math.max(viewWidth - padding * 2, 1);
    const availableHeight = Math.max(viewHeight - padding * 2, 1);
    const nextZoom = Math.min(availableWidth / svgWidth, availableHeight / svgHeight, 1);
    return clamp(nextZoom || 1, this.getZoomMin(), this.getZoomMax());
  }

  private getFitPadding(viewWidth: number, viewHeight: number): number {
    if (typeof this.options.fitPadding === "number") {
      return Math.max(0, this.options.fitPadding);
    }
    return Math.max(16, Math.min(40, Math.round(Math.min(viewWidth, viewHeight) * 0.08)));
  }

  private getZoomMin(): number {
    return this.options.zoomMin ?? 0.08;
  }

  private getZoomMax(): number {
    return this.options.zoomMax ?? 4;
  }

  private zoomAroundViewportCenter(factor: number): void {
    if (!this.instance?.svg) return;
    const pivotX = this.viewport.clientWidth / 2;
    const pivotY = this.viewport.clientHeight / 2;
    this.zoomTo(this.zoom * factor, pivotX, pivotY);
  }

  private zoomTo(nextZoom: number, pivotX: number, pivotY: number): void {
    const clampedZoom = clamp(nextZoom, this.getZoomMin(), this.getZoomMax());
    const ratio = clampedZoom / this.zoom;
    if (!Number.isFinite(ratio) || ratio === 1) {
      this.syncViewControls();
      return;
    }

    this.stopMotion();
    this.autoFitEnabled = false;
    this.offsetX = pivotX - (pivotX - this.offsetX) * ratio;
    this.offsetY = pivotY - (pivotY - this.offsetY) * ratio;
    this.zoom = clampedZoom;
    this.applyTransform();
    this.syncViewControls();
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

  private syncToggleControls(): void {
    const hasView = !!this.instance?.svg;
    const canToggleTts =
      hasView &&
      typeof speechSynthesis !== "undefined";
    const ttsEnabled = this.getTtsEnabled();

    this.btnCaption.textContent = this.showCaption ? "Caption On" : "Caption Off";
    this.btnCaption.classList.toggle("is-active", this.showCaption);
    this.btnCaption.setAttribute("aria-pressed", this.showCaption ? "true" : "false");
    this.btnCaption.disabled = !hasView;

    this.btnTts.textContent = ttsEnabled ? "TTS On" : "TTS Off";
    this.btnTts.classList.toggle("is-active", ttsEnabled);
    this.btnTts.setAttribute("aria-pressed", ttsEnabled ? "true" : "false");
    this.btnTts.disabled = !canToggleTts;
  }

  private getTargetBox(
    target: Element,
    viewportRect: DOMRect,
  ): { centerX: number; centerY: number } | null {
    if (target instanceof SVGGraphicsElement) {
      try {
        const bounds = target.getBBox();
        return {
          centerX: (bounds.x + bounds.width / 2) * this.zoom,
          centerY: (bounds.y + bounds.height / 2) * this.zoom,
        };
      } catch {
        // Ignore and fall back to layout-based bounds below.
      }
    }

    const currentRect = target.getBoundingClientRect();
    return {
      centerX: currentRect.left - viewportRect.left - this.offsetX + currentRect.width / 2,
      centerY: currentRect.top - viewportRect.top - this.offsetY + currentRect.height / 2,
    };
  }

  private getFocusTarget(): string | null {
    const anim = this.instance?.anim;
    if (!anim || !anim.total) return null;

    const startIndex = anim.currentStep >= 0 ? anim.currentStep : 0;
    for (let index = startIndex; index < anim.steps.length; index += 1) {
      const target = this.getStepTarget(anim.steps[index]);
      if (target) return target;
    }
    for (let index = startIndex - 1; index >= 0; index -= 1) {
      const target = this.getStepTarget(anim.steps[index]);
      if (target) return target;
    }
    return null;
  }

  private findTargetElement(targetId: string): Element | null {
    const svg = this.instance?.svg;
    if (!svg) return null;

    const edgeTarget = this.parseEdgeTarget(targetId);
    const esc = typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape
      : (value: string) => value;

    if (edgeTarget) {
      const edgeEl = svg.querySelector(`#${esc(`edge-${edgeTarget.from}-${edgeTarget.to}`)}`);
      if (edgeEl) return edgeEl;
    }

    const ids = this.splitEdgeTarget(targetId);
    const prefixes = ["group-", "node-", "edge-", "table-", "chart-", "markdown-", "note-", ""];

    for (const id of ids) {
      for (const prefix of prefixes) {
        const found = svg.querySelector(`#${esc(prefix + id)}`);
        if (found) return found;
      }
      for (const attr of ["data-id", "data-node", "data-group", "sketchmark-id"]) {
        const found = svg.querySelector(`[${attr}="${id}"]`);
        if (found) return found;
      }
    }

    return null;
  }

  private getStepTarget(stepItem?: ASTStepItem): string | null {
    if (!stepItem) return null;
    return stepItem.kind === "beat" ? stepItem.children?.[0]?.target ?? null : stepItem.target ?? null;
  }

  private parseEdgeTarget(targetId: string): { from: string; to: string } | null {
    const connectors = ["<-->", "<->", "-->", "<--", "---", "--", "->", "<-"];
    for (const connector of connectors) {
      if (targetId.includes(connector)) {
        const [from, to] = targetId.split(connector).map((part) => part.trim());
        if (from && to) return { from, to };
      }
    }
    return null;
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

  private showError(message: string): void {
    this.errorElement.textContent = message;
    this.errorElement.classList.add("is-visible");
  }

  private clearError(): void {
    this.errorElement.textContent = "";
    this.errorElement.classList.remove("is-visible");
  }

  private stopMotion(): void {
    if (this.motionFrame === null) return;
    cancelAnimationFrame(this.motionFrame);
    this.motionFrame = null;
  }
}
