import type { SceneGraph } from "../../scene";
export interface SVGRendererOptions {
    roughness?: number;
    bowing?: number;
    showTitle?: boolean;
    interactive?: boolean;
    onNodeClick?: (nodeId: string) => void;
    theme?: "light" | "dark" | "auto";
    transparent?: boolean;
}
export declare function renderToSVG(sg: SceneGraph, container: HTMLElement | SVGSVGElement, options?: SVGRendererOptions): SVGSVGElement;
export declare function svgToString(svg: SVGSVGElement): string;
//# sourceMappingURL=index.d.ts.map