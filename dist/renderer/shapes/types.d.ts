import type { SceneNode } from "../../scene";
import type { DiagramPalette } from "../../theme";
export declare const MIN_W: 90;
export declare const MAX_W: 180;
export declare const FONT_PX_PER_CHAR: 8.6;
export declare const BASE_PAD: 26;
export declare const SVG_NS = "http://www.w3.org/2000/svg";
export interface RoughOpts {
    roughness?: number;
    bowing?: number;
    seed?: number;
    fill?: string;
    fillStyle?: string;
    fillWeight?: number;
    stroke?: string;
    strokeWidth?: number;
    strokeLineDash?: number[];
    strokeLineDashOffset?: number;
    hachureAngle?: number;
    hachureGap?: number;
}
export interface RoughSVG {
    rectangle(x: number, y: number, w: number, h: number, opts?: RoughOpts): SVGElement;
    circle(cx: number, cy: number, d: number, opts?: RoughOpts): SVGElement;
    ellipse(cx: number, cy: number, w: number, h: number, opts?: RoughOpts): SVGElement;
    line(x1: number, y1: number, x2: number, y2: number, opts?: RoughOpts): SVGElement;
    polygon(pts: [number, number][], opts?: RoughOpts): SVGElement;
    path(d: string, opts?: RoughOpts): SVGElement;
}
export interface RoughCanvas {
    rectangle(x: number, y: number, w: number, h: number, opts?: any): void;
    circle(cx: number, cy: number, d: number, opts?: any): void;
    ellipse(cx: number, cy: number, w: number, h: number, opts?: any): void;
    line(x1: number, y1: number, x2: number, y2: number, opts?: any): void;
    polygon(pts: [number, number][], opts?: any): void;
    path(d: string, opts?: any): void;
}
export interface ShapeDefinition {
    /** Auto-size the node. labelW = pre-computed label pixel width. */
    size(n: SceneNode, labelW: number): void;
    /** Render to SVG, returning created elements. */
    renderSVG(rc: RoughSVG, n: SceneNode, palette: DiagramPalette, opts: RoughOpts): SVGElement[];
    /** Render to Canvas (imperative draw). */
    renderCanvas(rc: RoughCanvas, ctx: CanvasRenderingContext2D, n: SceneNode, palette: DiagramPalette, opts: any): void;
    /** SVG element ID prefix (default: 'node'). Used for animation targeting. */
    idPrefix?: string;
    /** SVG group CSS class (default: 'ng'). Used for animation selectors. */
    cssClass?: string;
}
//# sourceMappingURL=types.d.ts.map