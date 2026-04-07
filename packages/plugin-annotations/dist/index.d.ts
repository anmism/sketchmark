import type { SketchmarkPlugin } from "sketchmark";
export interface AnnotationPluginOptions {
    color?: string;
    strokeWidth?: number;
    angleRadius?: number;
    rightAngleSize?: number;
    midpointRadius?: number;
    dimensionOffset?: number;
    equalTickSize?: number;
    equalTickSpacing?: number;
    labelOffset?: number;
}
export declare function annotations(options?: AnnotationPluginOptions): SketchmarkPlugin;
//# sourceMappingURL=index.d.ts.map