import type { SceneChart } from '../../scene';
interface RoughCanvas {
    rectangle(x: number, y: number, w: number, h: number, opts?: any): void;
    ellipse(cx: number, cy: number, w: number, h: number, opts?: any): void;
    line(x1: number, y1: number, x2: number, y2: number, opts?: any): void;
    polygon(pts: [number, number][], opts?: any): void;
    path(d: string, opts?: any): void;
}
export declare function drawRoughChartCanvas(rc: RoughCanvas, ctx: CanvasRenderingContext2D, c: SceneChart, pal: {
    nodeFill: string;
    nodeStroke: string;
    labelText: string;
    labelBg: string;
}, R: any): void;
export {};
//# sourceMappingURL=roughChartCanvas.d.ts.map