import type { DiagramAST } from "./ast/types";
export interface SketchmarkPlugin {
    name: string;
    preprocess?: (source: string) => string;
    transformAst?: (ast: DiagramAST) => DiagramAST;
}
export interface ParseOptions {
    plugins?: readonly SketchmarkPlugin[];
}
export declare function applyPluginPreprocessors(source: string, plugins?: readonly SketchmarkPlugin[]): string;
export declare function applyPluginAstTransforms(ast: DiagramAST, plugins?: readonly SketchmarkPlugin[]): DiagramAST;
//# sourceMappingURL=plugins.d.ts.map