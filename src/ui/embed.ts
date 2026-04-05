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
  width?: EmbedSize;
  height?: EmbedSize;
  theme?: EmbedTheme;
  showControls?: boolean;
  playStepDelay?: number;
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
  instance: DiagramInstance | null = null;

  private readonly emitter = new EventEmitter<SketchmarkEmbedEvents>();
  private readonly options: SketchmarkEmbedOptions;
  private readonly btnReset: HTMLButtonElement;
  private readonly btnPrev: HTMLButtonElement;
  private readonly btnNext: HTMLButtonElement;
  private readonly btnPlay: HTMLButtonElement;
  private animUnsub: (() => void) | null = null;
  private playInFlight = false;
  private dsl: string;
  private theme: EmbedTheme;
  private offsetX = 0;
  private offsetY = 0;
  private motionFrame: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(options: SketchmarkEmbedOptions) {
    this.options = options;
    this.dsl = normalizeNewlines(options.dsl);
    this.theme = options.theme ?? "light";

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
        <button type="button" class="skm-embed__button" data-action="reset">Reset</button>
        <button type="button" class="skm-embed__button" data-action="prev">Prev</button>
        <button type="button" class="skm-embed__button" data-action="next">Next</button>
        <button type="button" class="skm-embed__button" data-action="play">Play</button>
        <span class="skm-embed__step">No steps</span>
      </div>
    `;

    this.viewport = this.root.querySelector(".skm-embed__viewport") as HTMLDivElement;
    this.world = this.root.querySelector(".skm-embed__world") as HTMLDivElement;
    this.diagramWrap = this.root.querySelector(".skm-embed__diagram") as HTMLDivElement;
    this.errorElement = this.root.querySelector(".skm-embed__error") as HTMLDivElement;
    this.controlsElement = this.root.querySelector(".skm-embed__controls") as HTMLDivElement;
    this.stepInfoElement = this.root.querySelector(".skm-embed__step") as HTMLSpanElement;
    this.btnReset = this.root.querySelector('[data-action="reset"]') as HTMLButtonElement;
    this.btnPrev = this.root.querySelector('[data-action="prev"]') as HTMLButtonElement;
    this.btnNext = this.root.querySelector('[data-action="next"]') as HTMLButtonElement;
    this.btnPlay = this.root.querySelector('[data-action="play"]') as HTMLButtonElement;

    this.controlsElement.classList.toggle("is-hidden", options.showControls === false);

    this.btnReset.addEventListener("click", () => this.resetAnimation());
    this.btnPrev.addEventListener("click", () => this.prevStep());
    this.btnNext.addEventListener("click", () => this.nextStep());
    this.btnPlay.addEventListener("click", () => {
      void this.play();
    });

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
    this.diagramWrap.innerHTML = "";

    try {
      const instance = render({
        container: this.diagramWrap,
        dsl: this.dsl,
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
    const anim = this.instance?.anim;
    if (!anim || !anim.total) {
      this.stepInfoElement.textContent = "No steps";
      this.btnReset.disabled = true;
      this.btnPrev.disabled = true;
      this.btnNext.disabled = true;
      this.btnPlay.disabled = true;
      return;
    }

    this.stepInfoElement.textContent =
      anim.currentStep < 0 ? `${anim.total} steps` : `${anim.currentStep + 1} / ${anim.total}`;
    this.btnReset.disabled = false;
    this.btnPrev.disabled = !anim.canPrev;
    this.btnNext.disabled = !anim.canNext;
    this.btnPlay.disabled = this.playInFlight || !anim.canNext;
  }

  private positionViewport(animated: boolean): void {
    if (!this.instance?.svg) return;

    const svg = this.instance.svg;
    const svgWidth = parseFloat(svg.getAttribute("width") || "0");
    const svgHeight = parseFloat(svg.getAttribute("height") || "0");
    if (!svgWidth || !svgHeight) return;

    const viewportRect = this.viewport.getBoundingClientRect();
    const viewWidth = viewportRect.width || this.viewport.clientWidth;
    const viewHeight = viewportRect.height || this.viewport.clientHeight;
    if (!viewWidth || !viewHeight) return;

    const sceneIsLarge = svgWidth > viewWidth || svgHeight > viewHeight;
    const shouldFocus =
      sceneIsLarge &&
      this.options.autoFocus !== false &&
      !!this.getFocusTarget();

    if (!shouldFocus) {
      this.animateTo(
        svgWidth <= viewWidth ? (viewWidth - svgWidth) / 2 : 0,
        svgHeight <= viewHeight ? (viewHeight - svgHeight) / 2 : 0,
        animated,
      );
      return;
    }

    const target = this.findTargetElement(this.getFocusTarget()!);
    if (!target) {
      this.animateTo(0, 0, animated);
      return;
    }

    const currentRect = target.getBoundingClientRect();
    const sceneX = currentRect.left - viewportRect.left - this.offsetX;
    const sceneY = currentRect.top - viewportRect.top - this.offsetY;
    const targetCenterX = sceneX + currentRect.width / 2;
    const targetCenterY = sceneY + currentRect.height / 2;

    let nextX = viewWidth / 2 - targetCenterX;
    let nextY = viewHeight / 2 - targetCenterY;
    const padding = this.options.focusPadding ?? 24;

    if (svgWidth <= viewWidth) {
      nextX = (viewWidth - svgWidth) / 2;
    } else {
      nextX = clamp(nextX, viewWidth - svgWidth - padding, padding);
    }

    if (svgHeight <= viewHeight) {
      nextY = (viewHeight - svgHeight) / 2;
    } else {
      nextY = clamp(nextY, viewHeight - svgHeight - padding, padding);
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
    this.world.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px)`;
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
