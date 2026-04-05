import { AnimationController } from "./animation";
import { buildSceneGraph } from "./scene";
import type { SVGRendererOptions } from "./renderer/svg";
import type { CanvasRendererOptions } from "./renderer/canvas";
export interface RenderOptions {
    container: string | HTMLElement | SVGSVGElement;
    dsl: string;
    renderer?: "svg" | "canvas";
    injectCSS?: boolean;
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
export declare function render(options: RenderOptions): DiagramInstance;
//# sourceMappingURL=render.d.ts.map