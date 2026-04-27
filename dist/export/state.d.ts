import type { ASTStepItem } from "../ast/types";
export interface ExportAnimationState {
    steps: ASTStepItem[];
    config?: Record<string, string | number | boolean>;
}
export declare function bindExportAnimationState(svg: SVGSVGElement, state: ExportAnimationState): void;
export declare function getExportAnimationState(svg: SVGSVGElement): ExportAnimationState | undefined;
//# sourceMappingURL=state.d.ts.map