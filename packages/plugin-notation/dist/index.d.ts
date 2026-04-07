import type { SketchmarkPlugin } from "sketchmark";
export interface NotationPluginOptions {
    delimiters?: ReadonlyArray<readonly [string, string]>;
    transformNarration?: boolean;
    transformMarkdown?: boolean;
}
export declare function notation(options?: NotationPluginOptions): SketchmarkPlugin;
export declare function renderMath(text: string): string;
//# sourceMappingURL=index.d.ts.map