import type {
  AnimationValue,
  ArcElement,
  CircleElement,
  CurveElement,
  EllipseElement,
  Endpoint,
  GroupElement,
  LineElement,
  PointElement,
  PolygonElement,
  PolylineElement,
  RectElement,
  TextElement,
  VisualDocument,
  VisualElement
} from "../types";
import { clone, elementBox } from "../utils";

export type ElementInput = VisualElement | VisualElement[];

export function scene(input: Omit<VisualDocument, "version"> & { version?: 1 }): VisualDocument {
  return { version: 1, ...input };
}

export function rect(input: Omit<RectElement, "type">): RectElement {
  return { type: "rect", ...input };
}

export function circle(input: Omit<CircleElement, "type">): CircleElement {
  return { type: "circle", ...input };
}

export function ellipse(input: Omit<EllipseElement, "type">): EllipseElement {
  return { type: "ellipse", ...input };
}

export function point(input: Omit<PointElement, "type">): PointElement {
  return { type: "point", ...input };
}

export function polyline(input: Omit<PolylineElement, "type">): PolylineElement {
  return { type: "polyline", ...input };
}

export function polygon(input: Omit<PolygonElement, "type">): PolygonElement {
  return { type: "polygon", ...input };
}

export function text(input: Omit<TextElement, "type">): TextElement {
  return { type: "text", ...input };
}

export function line(input: Omit<LineElement, "type">): LineElement {
  return { type: "line", ...input };
}

export function arrow(input: Omit<LineElement, "type">): LineElement {
  return { type: "arrow", ...input };
}

export function arc(input: Omit<ArcElement, "type">): ArcElement {
  return { type: "arc", ...input };
}

export function curve(input: Omit<CurveElement, "type">): CurveElement {
  return { type: "curve", ...input };
}

export function group(input: Omit<GroupElement, "type">): GroupElement {
  return { type: "group", ...input };
}

export function animate(from: number | string, to: number | string, options: Omit<AnimationValue, "from" | "to"> = {}): AnimationValue {
  return { from, to, ...options };
}

export function keyframes(values: Array<[number, number | string]>): AnimationValue {
  return { keyframes: values };
}

export interface NodeOptions {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  textFill?: string;
}

export function node(options: NodeOptions): [RectElement, TextElement] {
  return [
    rect({
      id: `${options.id}_box`,
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
      radius: options.radius ?? 12,
      fill: options.fill ?? "#ffffff",
      stroke: options.stroke ?? "#2563eb",
      strokeWidth: options.strokeWidth ?? 2
    }),
    text({
      id: `${options.id}_label`,
      text: options.label,
      x: options.x + options.width / 2,
      y: options.y + options.height / 2,
      align: "center",
      valign: "middle",
      fontSize: options.fontSize ?? 18,
      fill: options.textFill ?? "#111827"
    })
  ];
}

export interface FlowOptions {
  id: string;
  from: Endpoint;
  to: Endpoint;
  stroke?: string;
  strokeWidth?: number;
  label?: string;
  labelX?: number;
  labelY?: number;
}

export function flow(options: FlowOptions): VisualElement[] {
  const out: VisualElement[] = [
    arrow({
      id: options.id,
      from: options.from,
      to: options.to,
      stroke: options.stroke ?? "#2563eb",
      strokeWidth: options.strokeWidth ?? 2
    })
  ];
  if (options.label) {
    if (typeof options.labelX !== "number" || typeof options.labelY !== "number") {
      throw new Error("flow label requires explicit labelX and labelY. The builder does not infer label positions.");
    }
    out.push(text({
      id: `${options.id}_label`,
      text: options.label,
      x: options.labelX,
      y: options.labelY,
      align: "center",
      valign: "middle",
      fontSize: 14,
      fill: options.stroke ?? "#2563eb"
    }));
  }
  return out;
}

export interface PacketOptions {
  id: string;
  on: string;
  radius?: number;
  fill?: string;
  progress: number | AnimationValue;
}

export function packet(options: PacketOptions): CircleElement {
  return circle({
    id: options.id,
    radius: options.radius ?? 7,
    fill: options.fill ?? "#ef4444",
    follow: options.on,
    progress: options.progress
  });
}

export interface CalloutOptions {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  target: Endpoint;
  fill?: string;
  textFill?: string;
  stroke?: string;
}

export function callout(options: CalloutOptions): VisualElement[] {
  const boxId = `${options.id}_box`;
  return [
    rect({
      id: boxId,
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
      radius: 8,
      fill: options.fill ?? "#111827",
      stroke: options.stroke ?? "none"
    }),
    text({
      id: `${options.id}_text`,
      text: options.text,
      x: options.x + options.width / 2,
      y: options.y + options.height / 2,
      align: "center",
      valign: "middle",
      fontSize: 15,
      fill: options.textFill ?? "#ffffff"
    }),
    arrow({
      id: `${options.id}_arrow`,
      from: `${boxId}.bottom`,
      to: options.target,
      stroke: options.stroke ?? "#ef4444",
      strokeWidth: 2
    })
  ];
}

export interface StackOptions {
  x: number;
  y: number;
  gap?: number;
  children: ElementInput[];
}

export function row(options: StackOptions): VisualElement[] {
  return stack(options, "row");
}

export function column(options: StackOptions): VisualElement[] {
  return stack(options, "column");
}

function stack(options: StackOptions, direction: "row" | "column"): VisualElement[] {
  const gap = options.gap ?? 0;
  let cursorX = options.x;
  let cursorY = options.y;
  const out: VisualElement[] = [];
  for (const childInput of options.children) {
    const child = Array.isArray(childInput) ? childInput : [childInput];
    const bounds = boundsFor(child);
    if (!bounds) throw new Error(`${direction} children must have explicit geometry. No auto measurement is performed.`);
    const dx = cursorX - bounds.x;
    const dy = cursorY - bounds.y;
    const moved = child.map((element) => translateElement(element, dx, dy));
    out.push(...moved);
    if (direction === "row") cursorX += bounds.width + gap;
    else cursorY += bounds.height + gap;
  }
  return out;
}

function boundsFor(elements: VisualElement[]): { x: number; y: number; width: number; height: number } | undefined {
  const boxes = elements.map((element) => elementBox(element)).filter(Boolean) as Array<{ x: number; y: number; width: number; height: number }>;
  if (!boxes.length) return undefined;
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function translateElement(element: VisualElement, dx: number, dy: number): VisualElement {
  const next = clone(element);
  if ("x" in next && typeof next.x === "number") next.x += dx;
  if ("y" in next && typeof next.y === "number") next.y += dy;
  if ("cx" in next && typeof next.cx === "number") next.cx += dx;
  if ("cy" in next && typeof next.cy === "number") next.cy += dy;
  if ((next.type === "line" || next.type === "arrow" || next.type === "curve") && Array.isArray(next.from) && Array.isArray(next.to)) {
    next.from = [Number(next.from[0]) + dx, Number(next.from[1]) + dy];
    next.to = [Number(next.to[0]) + dx, Number(next.to[1]) + dy];
  }
  if (next.type === "arc") {
    next.cx += dx;
    next.cy += dy;
  }
  if (next.type === "curve") {
    next.control1 = [next.control1[0] + dx, next.control1[1] + dy];
    if (next.control2) next.control2 = [next.control2[0] + dx, next.control2[1] + dy];
  }
  if ((next.type === "polyline" || next.type === "polygon") && Array.isArray(next.points)) {
    next.points = next.points.map((point) => [point[0] + dx, point[1] + dy]);
  }
  if (next.type === "group" && Array.isArray(next.children)) {
    next.children = next.children.map((child) => translateElement(child, dx, dy));
  }
  return next;
}
