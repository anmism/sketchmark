import type { SketchmarkPlugin } from "sketchmark";
export interface WireframePluginOptions {
    surfaceFill?: string;
    surfaceStroke?: string;
    controlFill?: string;
    mutedTextColor?: string;
    placeholderStroke?: string;
    screenGap?: number;
    screenPadding?: number;
    panelGap?: number;
    panelPadding?: number;
    textGap?: number;
    choiceGap?: number;
}
export declare function wireframe(options?: WireframePluginOptions): SketchmarkPlugin;
export declare function compileWireframe(source: string, options?: WireframePluginOptions): string;
//# sourceMappingURL=index.d.ts.map