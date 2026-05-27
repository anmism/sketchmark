export type KernelElementType = "path" | "text" | "image" | "point" | "group";
export type VisualElementType = KernelElementType;
export type Align = "left" | "center" | "right";
export type VAlign = "top" | "middle" | "bottom";

export type Point2 = [number, number];
export type JsonMotionObject = { [key: string]: JsonMotionValue };
export type JsonMotionValue = number | string | boolean | null | JsonMotionValue[] | JsonMotionObject;
export type MotionValue = number | string | Point2 | number[] | string[] | JsonMotionObject;
export type TimelineTrackValue = MotionValue;
export type TimelineCurve =
  | { type: "graph"; points: Point2[] }
  | { type: "cubicBezier"; x1: number; y1: number; x2: number; y2: number }
  | { type: "hold" };
export type TimelineKeyframeTuple = [number, TimelineTrackValue];
export interface TimelineKeyframeObject {
  time: number;
  value: TimelineTrackValue;
  in?: TimelineCurve;
  out?: TimelineCurve;
  interpolation?: TimelineCurve;
}
export type TimelineKeyframe = TimelineKeyframeTuple | TimelineKeyframeObject;

export type GradientStop = [number, string] | { offset: number; color: string };
export type ImageFit = "fill" | "contain" | "cover";
export type Paint =
  | string
  | {
      type: "linearGradient";
      from: Point2;
      to: Point2;
      stops: GradientStop[];
    }
  | {
      type: "radialGradient";
      center: Point2;
      radius: number;
      focus?: Point2;
      stops: GradientStop[];
    }
  | {
      type: "pattern";
      src: string;
      x?: number;
      y?: number;
      width: number;
      height: number;
      fit?: ImageFit;
      opacity?: number;
    };

export type ClipShape = { type: "path"; d: string };
export type MaskShape = { type: "path"; d: string; opacity?: number };

export interface VisualCanvas {
  width: number;
  height: number;
  background?: string;
  duration?: number;
  fps?: number;
}

export interface TimelineTrack {
  keyframes: TimelineKeyframe[];
  curve?: TimelineCurve;
  ease?: "linear" | "ease-in" | "ease-out" | "ease-in-out" | string;
}

export interface ElementTimeline {
  start?: number;
  end?: number;
  tracks?: Record<string, TimelineTrack>;
}

export interface ShadowEffect {
  dx: number;
  dy: number;
  blur: number;
  color: string;
  opacity?: number;
}

export interface VisualEffects {
  blur?: number;
  brightness?: number;
  contrast?: number;
  saturate?: number;
  hueRotate?: number;
  shadow?: ShadowEffect;
}

export interface VisualElementBase {
  id?: string;
  type: KernelElementType | string;
  opacity?: number;
  fill?: Paint;
  stroke?: Paint;
  strokeWidth?: number;
  strokeCap?: "butt" | "round" | "square";
  strokeJoin?: "miter" | "round" | "bevel";
  miterLimit?: number;
  dashArray?: number[];
  dashOffset?: number;
  drawStart?: number;
  drawEnd?: number;
  effects?: VisualEffects;
  blendMode?: string;
  rotation?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  origin?: Point2;
  clip?: ClipShape;
  mask?: MaskShape;
  timeline?: ElementTimeline;
  metadata?: Record<string, unknown>;
}

export interface PathElement extends VisualElementBase {
  type: "path";
  d: string;
  x?: number;
  y?: number;
}

export interface TextElement extends VisualElementBase {
  type: "text";
  x: number;
  y: number;
  text?: string;
  lines?: string[];
  align?: Align;
  valign?: VAlign;
  fontSize?: number;
  fontFamily?: string;
  weight?: number | string;
  fontStyle?: string;
  lineHeight?: number;
  letterSpacing?: number;
  maxWidth?: number;
  wrap?: boolean;
}

export interface ImageElement extends VisualElementBase {
  type: "image";
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius?: number;
  fit?: ImageFit;
  source?: {
    x: number;
    y: number;
    width: number;
    height: number;
    imageWidth: number;
    imageHeight: number;
  };
}

export interface PointElement extends VisualElementBase {
  type: "point";
  x: number;
  y: number;
}

export interface GroupElement extends VisualElementBase {
  type: "group";
  x: number;
  y: number;
  width?: number;
  height?: number;
  children: VisualElement[];
}

export type VisualElement = PathElement | TextElement | ImageElement | PointElement | GroupElement;
export type KernelElement = VisualElement;

export interface VisualDocument {
  version: 1;
  canvas: VisualCanvas;
  elements?: VisualElement[];
}

export interface ResolvedVisualDocument extends VisualDocument {
  elements: VisualElement[];
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
  suggestion?: string;
}

export interface ValidationWarning {
  path: string;
  code: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  warnings: ValidationWarning[];
}

export interface RenderOptions {
  time?: number;
  transparent?: boolean;
}
