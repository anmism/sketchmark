import type { DiagramAST } from "./ast/types";

export interface SketchmarkPlugin {
  name: string;
  preprocess?: (source: string) => string;
  transformAst?: (ast: DiagramAST) => DiagramAST;
}

export interface ParseOptions {
  plugins?: readonly SketchmarkPlugin[];
}

function pluginMessage(plugin: SketchmarkPlugin, stage: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Plugin "${plugin.name}" ${stage} failed: ${detail}`;
}

export function applyPluginPreprocessors(
  source: string,
  plugins: readonly SketchmarkPlugin[] = [],
): string {
  let nextSource = source;
  for (const plugin of plugins) {
    if (!plugin.preprocess) continue;
    try {
      const transformed = plugin.preprocess(nextSource);
      if (typeof transformed !== "string") {
        throw new Error("preprocess must return a string");
      }
      nextSource = transformed;
    } catch (error) {
      throw new Error(pluginMessage(plugin, "preprocess", error));
    }
  }
  return nextSource;
}

export function applyPluginAstTransforms(
  ast: DiagramAST,
  plugins: readonly SketchmarkPlugin[] = [],
): DiagramAST {
  let nextAst = ast;
  for (const plugin of plugins) {
    if (!plugin.transformAst) continue;
    try {
      const transformed = plugin.transformAst(nextAst);
      if (!transformed || transformed.kind !== "diagram") {
        throw new Error('transformAst must return a DiagramAST with kind="diagram"');
      }
      nextAst = transformed;
    } catch (error) {
      throw new Error(pluginMessage(plugin, "transformAst", error));
    }
  }
  return nextAst;
}
