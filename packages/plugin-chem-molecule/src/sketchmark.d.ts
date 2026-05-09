declare module "@sketchmark/diagram" {
  export interface SketchmarkPlugin {
    name: string;
    preprocess?: (source: string) => string;
    transformAst?: <T>(ast: T) => T;
  }
}
