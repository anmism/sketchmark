// ============================================================
// sketchmark — Public API
// ============================================================

// ── Core Pipeline ─────────────────────────────────────────
export { parse, ParseError }          from './parser';
export type { DiagramAST }            from './parser';
export { buildSceneGraph, nodeMap, groupMap } from './scene';  // ← added groupMap
export type { SceneGraph, SceneNode, SceneEdge, SceneGroup } from './scene';
export { layout, connPoint }          from './layout';

// ── Renderers ─────────────────────────────────────────────
export { renderToSVG, svgToString } from './renderer/svg';
export type { SVGRendererOptions }    from './renderer/svg';
export { renderToCanvas, canvasToPNGBlob, canvasToPNGDataURL } from './renderer/canvas';
export type { CanvasRendererOptions } from './renderer/canvas';

// ── Animation ─────────────────────────────────────────────
export { AnimationController, ANIMATION_CSS } from './animation';
export type { AnimationEvent, AnimationEventType } from './animation';

// ── Export System ─────────────────────────────────────────
export {
  exportSVG, exportPNG, exportCanvasPNG, exportHTML, exportGIF, exportMP4,
  getSVGBlob, svgToPNGDataURL,
} from './export';
export type { ExportFormat, ExportOptions } from './export';

// ── AST Types ─────────────────────────────────────────────
export type {
  NodeShape, EdgeConnector, LayoutType,
  AlignItems, JustifyContent,                              // ← new
  AnimationAction, AnimationTrigger, StyleProps,
  ASTNode, ASTEdge, ASTGroup, ASTStep, ASTChart, ASTTable,
  GroupChildRef, RootItemRef,                              // ← new
} from './ast/types';

// ── Utilities ─────────────────────────────────────────────
export { hashStr, clamp, lerp, parseHex, sleep, throttle, debounce, EventEmitter } from './utils';

// ============================================================
// High-level `render()` — one-call API
// ============================================================

import { parse }           from './parser';
import { buildSceneGraph } from './scene';
import { layout }          from './layout';
import { renderToSVG }     from './renderer/svg';
import { renderToCanvas }  from './renderer/canvas';
import { AnimationController, ANIMATION_CSS } from './animation';
import type { SVGRendererOptions }    from './renderer/svg';
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
  scene:     ReturnType<typeof buildSceneGraph>;
  anim:      AnimationController;
  svg?:      SVGSVGElement;
  canvas?:   HTMLCanvasElement;
  /** Re-render with the same or updated options */
  update:    (dsl: string) => DiagramInstance;
  exportSVG: (filename?: string) => void;
  exportPNG: (filename?: string) => Promise<void>;
}

export function render(options: RenderOptions): DiagramInstance {
  const {
    container: rawContainer,
    dsl,
    renderer = 'svg',
    injectCSS = true,
    svgOptions = {},
    canvasOptions = {},
    onNodeClick,
    onReady,
  } = options;

  // Inject animation CSS once
  if (injectCSS && !document.getElementById('ai-diagram-css')) {
    const style = document.createElement('style');
    style.id = 'ai-diagram-css';
    style.textContent = ANIMATION_CSS;
    document.head.appendChild(style);
  }

  // Resolve container
  let el: HTMLElement | SVGSVGElement;
  if (typeof rawContainer === 'string') {
    el = document.querySelector(rawContainer) as HTMLElement;
    if (!el) throw new Error(`Container "${rawContainer}" not found`);
  } else {
    el = rawContainer;
  }

  // Pipeline: DSL → AST → Scene → Layout → Render
  const ast   = parse(dsl);
  const scene = buildSceneGraph(ast);
  layout(scene);

  let svg:    SVGSVGElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let anim:   AnimationController;

  if (renderer === 'canvas') {
    canvas = el instanceof HTMLCanvasElement
      ? el
      : (() => { const c = document.createElement('canvas'); (el as HTMLElement).appendChild(c); return c; })();
    renderToCanvas(scene, canvas, canvasOptions);
    anim = new AnimationController(
      document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement,
      ast.steps,
    );
  } else {
    svg = renderToSVG(scene, el as HTMLElement, {
      ...svgOptions,
      interactive: true,
      onNodeClick,
    });
    anim = new AnimationController(svg, ast.steps);
  }

  onReady?.(anim, svg);

  const instance: DiagramInstance = {
    scene, anim, svg, canvas,
    update: (newDsl: string) => render({ ...options, dsl: newDsl }),
    exportSVG: (filename = 'diagram.svg') => {
      if (svg) { import('./export').then(m => m.exportSVG(svg!, { filename })); }
    },
    exportPNG: async (filename = 'diagram.png') => {
      if (svg) {
        const m = await import('./export');
        await m.exportPNG(svg, { filename });
      }
    },
  };

  return instance;
}

export { PALETTES, resolvePalette, THEME_CONFIG_KEY, listThemes, THEME_NAMES } from './theme';
