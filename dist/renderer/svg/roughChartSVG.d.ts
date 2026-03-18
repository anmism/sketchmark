import type { SceneChart } from '../../scene';
import { DiagramPalette } from '../../theme';
interface RoughSVG {
    rectangle(x: number, y: number, w: number, h: number, opts?: any): SVGElement;
    ellipse(cx: number, cy: number, w: number, h: number, opts?: any): SVGElement;
    line(x1: number, y1: number, x2: number, y2: number, opts?: any): SVGElement;
    polygon(pts: [number, number][], opts?: any): SVGElement;
    path(d: string, opts?: any): SVGElement;
}
export declare function renderRoughChartSVG(rc: RoughSVG, c: SceneChart, palette: DiagramPalette, isDark: boolean): SVGGElement;
export {};
//# sourceMappingURL=roughChartSVG.d.ts.map