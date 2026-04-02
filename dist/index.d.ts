export { parse, ParseError } from './parser';
export type { DiagramAST } from './parser';
export { buildSceneGraph, nodeMap, groupMap, markdownMap } from './scene';
export type { SceneGraph, SceneNode, SceneEdge, SceneGroup, SceneMarkdown } from './scene';
export { layout, connPoint } from './layout';
export { renderToSVG, svgToString } from './renderer/svg';
export type { SVGRendererOptions } from './renderer/svg';
export { renderToCanvas, canvasToPNGBlob, canvasToPNGDataURL } from './renderer/canvas';
export type { CanvasRendererOptions } from './renderer/canvas';
export { AnimationController, ANIMATION_CSS } from './animation';
export type { AnimationEvent, AnimationEventType } from './animation';
export { exportSVG, exportPNG, exportCanvasPNG, exportHTML, exportGIF, exportMP4, getSVGBlob, svgToPNGDataURL, } from './export';
export type { ExportFormat, ExportOptions } from './export';
export type { NodeShape, EdgeConnector, LayoutType, AlignItems, JustifyContent, AnimationAction, AnimationTrigger, StyleProps, StepPace, ASTNode, ASTEdge, ASTGroup, ASTStep, ASTBeat, ASTStepItem, ASTChart, ASTTable, GroupChildRef, RootItemRef, ASTMarkdown, } from './ast/types';
export { hashStr, clamp, lerp, parseHex, sleep, throttle, debounce, EventEmitter } from './utils';
import { buildSceneGraph } from './scene';
import { AnimationController } from './animation';
import type { SVGRendererOptions } from './renderer/svg';
import type { CanvasRendererOptions } from './renderer/canvas';
export interface RenderOptions {
    /** CSS selector, HTMLElement, or SVGSVGElement */
    container: string | HTMLElement | SVGSVGElement;
    /** DSL source text */
    dsl: string;
    /** 'svg' (default) | 'canvas' */
    renderer?: 'svg' | 'canvas';
    /** Inject animation CSS into <head> */
    injectCSS?: boolean;
    /** SVG-specific options */
    svgOptions?: SVGRendererOptions;
    /** Canvas-specific options */
    canvasOptions?: CanvasRendererOptions;
    /** Called when a node is clicked */
    onNodeClick?: (nodeId: string) => void;
    /** Callback with the AnimationController after render */
    onReady?: (anim: AnimationController, svg?: SVGSVGElement) => void;
}
export interface DiagramInstance {
    scene: ReturnType<typeof buildSceneGraph>;
    anim: AnimationController;
    svg?: SVGSVGElement;
    canvas?: HTMLCanvasElement;
    /** Re-render with the same or updated options */
    update: (dsl: string) => DiagramInstance;
    exportSVG: (filename?: string) => void;
    exportPNG: (filename?: string) => Promise<void>;
}
export declare function render(options: RenderOptions): DiagramInstance;
export { PALETTES, resolvePalette, THEME_CONFIG_KEY, listThemes, THEME_NAMES } from './theme';
export { resolveFont, loadFont, registerFont, BUILTIN_FONTS } from './fonts';
//# sourceMappingURL=index.d.ts.map