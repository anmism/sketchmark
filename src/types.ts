export type PrimitiveType =
  | "rect"
  | "circle"
  | "ellipse"
  | "point"
  | "line"
  | "arrow"
  | "arc"
  | "curve"
  | "polyline"
  | "polygon"
  | "path"
  | "text"
  | "image"
  | "group";

export type AdvancedThreeType =
  | "cuboid"
  | "sphere"
  | "plane"
  | "line3d"
  | "text3d"
  | "light";

export type VisualElementType = PrimitiveType | AdvancedThreeType;
export type Align = "left" | "center" | "right";
export type VAlign = "top" | "middle" | "bottom";
export type AnchorName =
  | "center"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type Point2 = [number, number];
export type Point3 = [number, number, number];
export type Point = Point2 | Point3;
export type Endpoint = Point | string;
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
export type ExportFormat = "svg" | "html" | "png" | "jpg" | "mp4" | "webm" | "pdf" | "pptx";
export type SequenceTransition =
  | "cut"
  | "fade"
  | {
      type: "cut" | "fade";
      duration?: number;
    };

export interface VisualCanvas {
  width: number;
  height: number;
  background?: string;
  duration?: number;
  fps?: number;
  space?: "2d" | "3d";
  renderer?: "svg" | "three";
}

export interface AnimationValue {
  from?: number | string;
  to?: number | string;
  duration?: number;
  delay?: number;
  ease?: "linear" | "ease-in" | "ease-out" | "ease-in-out" | string;
  keyframes?: Array<[number, number | string]>;
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

export type ClipShape =
  | { type: "rect"; x: number; y: number; width: number; height: number; radius?: number }
  | { type: "circle"; cx: number; cy: number; radius: number }
  | { type: "path"; d: string };

export type MaskShape =
  | { type: "rect"; x: number; y: number; width: number; height: number; radius?: number; opacity?: number }
  | { type: "circle"; cx: number; cy: number; radius: number; opacity?: number }
  | { type: "path"; d: string; opacity?: number };

export interface VisualElementBase {
  id?: string;
  type: VisualElementType | string;
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
  origin?: AnchorName | Point2;
  clip?: ClipShape;
  mask?: MaskShape;
  animate?: Record<string, AnimationValue>;
  children?: VisualElement[];
  metadata?: Record<string, unknown>;
}

export interface RectElement extends VisualElementBase {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
}

export interface CircleElement extends VisualElementBase {
  type: "circle";
  cx?: number;
  cy?: number;
  radius: number;
  follow?: string;
  progress?: number | AnimationValue;
}

export interface EllipseElement extends VisualElementBase {
  type: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface PointElement extends VisualElementBase {
  type: "point";
  x: number;
  y: number;
}

export interface LineElement extends VisualElementBase {
  type: "line" | "arrow";
  from: Endpoint;
  to: Endpoint;
  label?: string;
  labelX?: number;
  labelY?: number;
}

export interface ArcElement extends VisualElementBase {
  type: "arc";
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  counterclockwise?: boolean;
  closed?: boolean;
}

export interface CurveElement extends VisualElementBase {
  type: "curve";
  from: Endpoint;
  to: Endpoint;
  control1: Point2;
  control2?: Point2;
}

export interface PolylineElement extends VisualElementBase {
  type: "polyline";
  points: Point2[];
}

export interface PolygonElement extends VisualElementBase {
  type: "polygon";
  points: Point2[];
}

export interface PathElement extends VisualElementBase {
  type: "path";
  d: string;
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
  fit?: boolean;
}

export interface ImageElement extends VisualElementBase {
  type: "image";
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
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

export interface GroupElement extends VisualElementBase {
  type: "group";
  x: number;
  y: number;
  width?: number;
  height?: number;
  children: VisualElement[];
}

export interface CuboidElement extends VisualElementBase {
  type: "cuboid";
  position: Point3;
  size: Point3;
}

export interface SphereElement extends VisualElementBase {
  type: "sphere";
  position: Point3;
  radius: number;
}

export interface PlaneElement extends VisualElementBase {
  type: "plane";
  position: Point3;
  size: Point2;
}

export interface Line3dElement extends VisualElementBase {
  type: "line3d";
  from: Point3 | string;
  to: Point3 | string;
}

export interface Text3dElement extends VisualElementBase {
  type: "text3d";
  text: string;
  position: Point3;
  fontSize?: number;
}

export interface LightElement extends VisualElementBase {
  type: "light";
  kind?: "ambient" | "directional" | "point";
  position?: Point3;
  intensity?: number;
}

export type VisualElement =
  | RectElement
  | CircleElement
  | EllipseElement
  | PointElement
  | LineElement
  | ArcElement
  | CurveElement
  | PolylineElement
  | PolygonElement
  | PathElement
  | TextElement
  | ImageElement
  | GroupElement
  | CuboidElement
  | SphereElement
  | PlaneElement
  | Line3dElement
  | Text3dElement
  | LightElement;

export type Kernel2dType = "group" | "path" | "text" | "image" | "point";
export type Kernel3dType = "group3d" | "mesh3d" | "line3d" | "text3d" | "point3d" | "light";
export type KernelElementType = Kernel2dType | Kernel3dType;

export interface KernelElementBase extends Omit<VisualElementBase, "type" | "children"> {
  type: KernelElementType;
  children?: KernelElement[];
}

export interface KernelPathElement extends Omit<PathElement, "type" | "children"> {
  type: "path";
}

export interface KernelTextElement extends Omit<TextElement, "type" | "children"> {
  type: "text";
}

export interface KernelImageElement extends Omit<ImageElement, "type" | "children"> {
  type: "image";
}

export interface KernelPointElement extends Omit<PointElement, "type" | "children"> {
  type: "point";
}

export interface KernelGroupElement extends Omit<GroupElement, "type" | "children"> {
  type: "group";
  children: KernelElement[];
}

export interface KernelPoint3dElement extends KernelElementBase {
  type: "point3d";
  position: Point3;
}

export interface KernelMesh3dElement extends KernelElementBase {
  type: "mesh3d";
  vertices: Point3[];
  indices: number[];
  faces?: number[][];
  position?: Point3;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  scaleZ?: number;
}

export interface KernelLine3dElement extends Omit<Line3dElement, "type" | "children"> {
  type: "line3d";
}

export interface KernelText3dElement extends Omit<Text3dElement, "type" | "children"> {
  type: "text3d";
}

export interface KernelLightElement extends Omit<LightElement, "type" | "children"> {
  type: "light";
}

export interface KernelGroup3dElement extends KernelElementBase {
  type: "group3d";
  position?: Point3;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  scaleZ?: number;
  children: KernelElement[];
}

export type KernelElement =
  | KernelPathElement
  | KernelTextElement
  | KernelImageElement
  | KernelPointElement
  | KernelGroupElement
  | KernelPoint3dElement
  | KernelMesh3dElement
  | KernelLine3dElement
  | KernelText3dElement
  | KernelLightElement
  | KernelGroup3dElement;

export interface VisualScene {
  id?: string;
  canvas?: Partial<VisualCanvas>;
  elements: VisualElement[];
  steps?: VisualDeckStep[];
}

export interface VisualSequenceClip {
  scene: string;
  duration: number;
  transition?: SequenceTransition;
}

export interface VisualSequence {
  id: string;
  clips: VisualSequenceClip[];
  export?: {
    format?: ExportFormat;
    fps?: number;
  };
}

export interface VisualDeckStep {
  id: string;
  show?: string[];
  hide?: string[];
  duration?: number;
}

export type VisualPatchOperation =
  | { op: "add"; element: VisualElement; index?: number }
  | { op: "update"; id: string; set: Partial<VisualElement> }
  | { op: "remove"; id: string }
  | { op: "replace"; id: string; element: VisualElement }
  | { op: "move"; id: string; x?: number; y?: number; cx?: number; cy?: number }
  | { op: "reorder"; id: string; index: number };

export interface VisualDocument {
  version: 1;
  canvas: VisualCanvas;
  elements?: VisualElement[];
  scenes?: Record<string, VisualScene>;
  sequences?: Record<string, VisualSequence>;
  imports?: Record<string, string>;
  assets?: Record<string, string>;
  exports?: Record<string, { format: ExportFormat; sequence?: string; scene?: string }>;
}

export interface ResolvedVisualDocument extends VisualDocument {
  elements: VisualElement[];
}

export interface KernelVisualDocument extends Omit<VisualDocument, "elements" | "scenes" | "sequences"> {
  elements: KernelElement[];
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
  threeRuntime?: string;
}

export interface ExportOptions extends RenderOptions {
  format?: ExportFormat;
  scene?: string;
  sequence?: string;
}

export interface VisualSymbol {
  id: string;
  type: VisualElementType | string;
  file?: string;
  scene?: string;
  path: string;
}
