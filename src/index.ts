// ============================================================
// sketchmark - Public API
// ============================================================

// Core pipeline
export { parse, ParseError } from "./parser";
export type { DiagramAST } from "./parser";
export { buildSceneGraph, nodeMap, groupMap, markdownMap } from "./scene";
export type {
  SceneGraph,
  SceneNode,
  SceneEdge,
  SceneGroup,
  SceneMarkdown,
} from "./scene";
export { layout, connPoint } from "./layout";

// Renderers
export { renderToSVG, svgToString } from "./renderer/svg";
export type { SVGRendererOptions } from "./renderer/svg";
export {
  renderToCanvas,
  canvasToPNGBlob,
  canvasToPNGDataURL,
} from "./renderer/canvas";
export type { CanvasRendererOptions } from "./renderer/canvas";

// Animation
export { AnimationController, ANIMATION_CSS } from "./animation";
export type { AnimationEvent, AnimationEventType } from "./animation";

// Export system
export {
  exportSVG,
  exportPNG,
  exportCanvasPNG,
  exportHTML,
  exportGIF,
  exportMP4,
  getSVGBlob,
  svgToPNGDataURL,
} from "./export";
export type { ExportFormat, ExportOptions } from "./export";

// AST types
export type {
  NodeShape,
  EdgeConnector,
  LayoutType,
  AlignItems,
  JustifyContent,
  AnimationAction,
  AnimationTrigger,
  StyleProps,
  StepPace,
  ASTNode,
  ASTEdge,
  ASTGroup,
  ASTStep,
  ASTBeat,
  ASTStepItem,
  ASTChart,
  ASTTable,
  GroupChildRef,
  RootItemRef,
  ASTMarkdown,
} from "./ast/types";

// Utilities
export {
  hashStr,
  clamp,
  lerp,
  parseHex,
  sleep,
  throttle,
  debounce,
  EventEmitter,
} from "./utils";

// High-level renderer
export { render } from "./render";
export type { RenderOptions, DiagramInstance } from "./render";

// UI widgets
export { SketchmarkCanvas } from "./ui/canvas";
export type {
  SketchmarkCanvasOptions,
  SketchmarkCanvasEvents,
  SketchmarkCanvasBindEditorOptions,
} from "./ui/canvas";
export { SketchmarkEditor } from "./ui/editor";
export type {
  SketchmarkEditorOptions,
  SketchmarkEditorEvents,
} from "./ui/editor";
export { SketchmarkEmbed } from "./ui/embed";
export type {
  SketchmarkEmbedOptions,
  SketchmarkEmbedEvents,
} from "./ui/embed";

// Themes and fonts
export {
  PALETTES,
  resolvePalette,
  THEME_CONFIG_KEY,
  listThemes,
  THEME_NAMES,
} from "./theme";
export { resolveFont, loadFont, registerFont, BUILTIN_FONTS } from "./fonts";
