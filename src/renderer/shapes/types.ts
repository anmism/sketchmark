// ============================================================
// Shape Strategy Interfaces
// ============================================================

import type { SceneNode } from "../../scene";
import type { DiagramPalette } from "../../theme";

import { NODE, SVG_NS as _SVG_NS } from "../../config";

// Re-export from centralized config for backward compatibility
export const MIN_W = NODE.minW;
export const MAX_W = NODE.maxW;
export const FONT_PX_PER_CHAR = NODE.fontPxPerChar;
export const BASE_PAD = NODE.basePad;
export const SVG_NS = _SVG_NS;

export interface RoughOpts {
  roughness?: number;
  bowing?: number;
  seed?: number;
  fill?: string;
  fillStyle?: string;
  fillWeight?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeLineDash?: number[];
  strokeLineDashOffset?: number;
  hachureAngle?: number;
  hachureGap?: number;
}

// Rough.js SVG API subset
export interface RoughSVG {
  rectangle(x: number, y: number, w: number, h: number, opts?: RoughOpts): SVGElement;
  circle(cx: number, cy: number, d: number, opts?: RoughOpts): SVGElement;
  ellipse(cx: number, cy: number, w: number, h: number, opts?: RoughOpts): SVGElement;
  line(x1: number, y1: number, x2: number, y2: number, opts?: RoughOpts): SVGElement;
  polygon(pts: [number, number][], opts?: RoughOpts): SVGElement;
  path(d: string, opts?: RoughOpts): SVGElement;
}

// Rough.js Canvas API subset
export interface RoughCanvas {
  rectangle(x: number, y: number, w: number, h: number, opts?: any): void;
  circle(cx: number, cy: number, d: number, opts?: any): void;
  ellipse(cx: number, cy: number, w: number, h: number, opts?: any): void;
  line(x1: number, y1: number, x2: number, y2: number, opts?: any): void;
  polygon(pts: [number, number][], opts?: any): void;
  path(d: string, opts?: any): void;
}

export interface ShapeDefinition {
  /** Auto-size the node. labelW = pre-computed label pixel width. */
  size(n: SceneNode, labelW: number): void;

  /** Render to SVG, returning created elements. */
  renderSVG(rc: RoughSVG, n: SceneNode, palette: DiagramPalette, opts: RoughOpts): SVGElement[];

  /** Render to Canvas (imperative draw). */
  renderCanvas(rc: RoughCanvas, ctx: CanvasRenderingContext2D, n: SceneNode, palette: DiagramPalette, opts: any): void;

  /** SVG element ID prefix (default: 'node'). Used for animation targeting. */
  idPrefix?: string;

  /** SVG group CSS class (default: 'ng'). Used for animation selectors. */
  cssClass?: string;
}
