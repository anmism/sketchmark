import type { SceneNode, SceneGroup, SceneTable, SceneChart } from "../scene";
import type { EdgePoint } from "../ast/types";
export declare function hashStr(s: string): number;
export declare function darkenHex(hex: string, amount?: number): string;
export declare function resolveStyleFont(style: Record<string, unknown>, fallback: string): string;
export { buildFontStr, measureTextWidth, wrapText } from '../utils/text-measure';
export declare function shapeInnerTextWidth(shape: string, w: number, padding: number): number;
export declare function connMeta(connector: string): {
    arrowAt: "end" | "start" | "both" | "none";
    dashed: boolean;
};
export declare function rectConnPoint(rx: number, ry: number, rw: number, rh: number, ox: number, oy: number): [number, number];
export declare function resolveEndpoint(id: string, nm: Map<string, SceneNode>, tm: Map<string, SceneTable>, gm: Map<string, SceneGroup>, cm: Map<string, SceneChart>): {
    x: number;
    y: number;
    w: number;
    h: number;
    shape?: string;
} | null;
export declare function getConnPoint(src: {
    x: number;
    y: number;
    w: number;
    h: number;
    shape?: string;
}, dstCX: number, dstCY: number, anchor?: string): [number, number];
export declare function compactPolylinePoints(points: EdgePoint[]): EdgePoint[];
export declare function polylinePathData(points: EdgePoint[]): string;
export declare function polylineEndpointDirection(points: EdgePoint[], end: "start" | "end"): EdgePoint;
export declare function insetPolylineEndpoints(points: EdgePoint[], arrowAt: "end" | "start" | "both" | "none", inset: number): EdgePoint[];
export declare function polylineLabelPosition(points: EdgePoint[], offset: number, dx?: number, dy?: number): {
    x: number;
    y: number;
};
export declare function polylineArrowTipPoint(entity: {
    x: number;
    y: number;
    w: number;
    h: number;
    shape?: string;
}, points: EdgePoint[], end: "start" | "end"): EdgePoint;
export declare function groupDepth(g: SceneGroup, gm: Map<string, SceneGroup>): number;
//# sourceMappingURL=shared.d.ts.map