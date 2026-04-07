import type { SketchmarkPlugin } from "sketchmark";
export interface GeometryPluginOptions {
    pointRadius?: number;
    pointLabelDx?: number;
    pointLabelDy?: number;
    lineExtend?: number;
    autoAbsoluteLayout?: boolean;
}
export declare function geometry(options?: GeometryPluginOptions): SketchmarkPlugin;
export declare function compileGeometry(source: string, options?: GeometryPluginOptions): string;
//# sourceMappingURL=index.d.ts.map