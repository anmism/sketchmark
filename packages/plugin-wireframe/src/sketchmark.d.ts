declare module "sketchmark" {
  export interface SketchmarkPlugin {
    name: string;
    preprocess?: (source: string) => string;
    transformAst?: <T>(ast: T) => T;
  }
}
