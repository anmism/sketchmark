import type { SceneGraph } from "../../scene";
export interface CanvasRendererOptions {
    scale?: number;
    background?: string;
    roughness?: number;
    bowing?: number;
    theme?: "light" | "dark" | "auto";
    animate?: boolean;
    transparent?: boolean;
}
export declare function renderToCanvas(sg: SceneGraph, canvas: HTMLCanvasElement, options?: CanvasRendererOptions): void;
export declare function canvasToPNGBlob(canvas: HTMLCanvasElement): Promise<Blob>;
export declare function canvasToPNGDataURL(canvas: HTMLCanvasElement): string;
//# sourceMappingURL=index.d.ts.map