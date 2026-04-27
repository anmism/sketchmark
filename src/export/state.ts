import type { ASTStepItem } from "../ast/types";

export interface ExportAnimationState {
  steps: ASTStepItem[];
  config?: Record<string, string | number | boolean>;
}

const exportAnimationState = new WeakMap<SVGSVGElement, ExportAnimationState>();

export function bindExportAnimationState(
  svg: SVGSVGElement,
  state: ExportAnimationState,
): void {
  exportAnimationState.set(svg, state);
}

export function getExportAnimationState(
  svg: SVGSVGElement,
): ExportAnimationState | undefined {
  return exportAnimationState.get(svg);
}
