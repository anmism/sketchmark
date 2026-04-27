import rough from "roughjs/bin/rough";
import { AnimationController, ANIMATION_CSS } from "./animation";
import { buildSceneGraph } from "./scene";
import { layout } from "./layout";
import { parse } from "./parser";
import { renderToSVG } from "./renderer/svg";
import { renderToCanvas } from "./renderer/canvas";
import type { SVGRendererOptions } from "./renderer/svg";
import type { CanvasRendererOptions } from "./renderer/canvas";
import type { SketchmarkPlugin } from "./plugins";
import { bindExportAnimationState } from "./export/state";

export interface RenderOptions {
  container: string | HTMLElement | SVGSVGElement;
  dsl: string;
  plugins?: readonly SketchmarkPlugin[];
  renderer?: "svg" | "canvas";
  injectCSS?: boolean;
  tts?: boolean;
  svgOptions?: SVGRendererOptions;
  canvasOptions?: CanvasRendererOptions;
  onNodeClick?: (nodeId: string) => void;
  onReady?: (anim: AnimationController, svg?: SVGSVGElement) => void;
}

export interface DiagramInstance {
  scene: ReturnType<typeof buildSceneGraph>;
  anim: AnimationController;
  svg?: SVGSVGElement;
  canvas?: HTMLCanvasElement;
  update: (dsl: string) => DiagramInstance;
  exportSVG: (filename?: string) => void;
  exportPNG: (filename?: string) => Promise<void>;
}

export function render(options: RenderOptions): DiagramInstance {
  const {
    container: rawContainer,
    dsl,
    plugins,
    renderer = "svg",
    injectCSS = true,
    tts,
    svgOptions = {},
    canvasOptions = {},
    onNodeClick,
    onReady,
  } = options;

  if (injectCSS && !document.getElementById("ai-diagram-css")) {
    const style = document.createElement("style");
    style.id = "ai-diagram-css";
    style.textContent = ANIMATION_CSS;
    document.head.appendChild(style);
  }

  let el: HTMLElement | SVGSVGElement;
  if (typeof rawContainer === "string") {
    el = document.querySelector(rawContainer) as HTMLElement;
    if (!el) throw new Error(`Container "${rawContainer}" not found`);
  } else {
    el = rawContainer;
  }

  const ast = parse(dsl, { plugins });
  const scene = buildSceneGraph(ast);
  layout(scene);

  let svg: SVGSVGElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let anim: AnimationController;

  if (renderer === "canvas") {
    canvas = el instanceof HTMLCanvasElement
      ? el
      : (() => {
          const nextCanvas = document.createElement("canvas");
          (el as HTMLElement).appendChild(nextCanvas);
          return nextCanvas;
        })();

    renderToCanvas(scene, canvas, canvasOptions);
    anim = new AnimationController(
      document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement,
      ast.steps,
    );
  } else {
    svg = renderToSVG(scene, el as HTMLElement, {
      ...svgOptions,
      interactive: true,
      onNodeClick,
    });

    let rc: unknown = null;
    try {
      rc = rough.svg(svg);
    } catch {
      rc = null;
    }

    const containerEl = el instanceof SVGSVGElement ? undefined : (el as HTMLElement);
    anim = new AnimationController(svg, ast.steps, containerEl, rc, ast.config);
    bindExportAnimationState(svg, { steps: ast.steps, config: ast.config });
  }

  if (typeof tts === "boolean") {
    anim.tts = tts;
  }

  onReady?.(anim, svg);

  return {
    scene,
    anim,
    svg,
    canvas,
    update: (newDsl: string) => {
      anim?.destroy();
      return render({ ...options, dsl: newDsl });
    },
    exportSVG: (filename = "diagram.svg") => {
      if (svg) {
        import("./export").then((mod) => mod.exportSVG(svg!, { filename }));
      }
    },
    exportPNG: async (filename = "diagram.png") => {
      if (svg) {
        const mod = await import("./export");
        await mod.exportPNG(svg, { filename });
      }
    },
  };
}
