import type { Point2, VisualElement } from "../types";
import type { BasePresetOptions, PresetFragment, StylePresetOptions } from "./types";
import { ellipsePath, fragment, linePath, pathStyle, polygonPath, rectPath, regularPoints, roundedRectPath, starPoints, withPaint } from "./helpers";

export interface RectOptions extends BasePresetOptions, StylePresetOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoundedRectOptions extends RectOptions {
  radius?: number;
}

export interface EllipseOptions extends BasePresetOptions, StylePresetOptions {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface CircleOptions extends BasePresetOptions, StylePresetOptions {
  cx: number;
  cy: number;
  radius: number;
}

export interface LineOptions extends BasePresetOptions, StylePresetOptions {
  from: Point2;
  to: Point2;
  strokeCap?: "butt" | "round" | "square";
}

export interface PolylineOptions extends BasePresetOptions, StylePresetOptions {
  points: Point2[];
  closed?: boolean;
  strokeCap?: "butt" | "round" | "square";
  strokeJoin?: "miter" | "round" | "bevel";
}

export interface ArrowOptions extends BasePresetOptions, StylePresetOptions {
  from: Point2;
  to: Point2;
  headLength?: number;
  headWidth?: number;
}

export interface RegularPolygonOptions extends BasePresetOptions, StylePresetOptions {
  cx: number;
  cy: number;
  radius: number;
  sides: number;
  rotation?: number;
}

export interface StarOptions extends BasePresetOptions, StylePresetOptions {
  cx: number;
  cy: number;
  outerRadius: number;
  innerRadius?: number;
  points?: number;
  rotation?: number;
}

export interface SpeechBubbleOptions extends RectOptions {
  radius?: number;
  tail?: Point2;
  text?: string;
  fontSize?: number;
  textFill?: string;
}

export function rect(options: RectOptions): PresetFragment {
  return fragment([path(options.id ?? "rect", rectPath(options.x, options.y, options.width, options.height), { fill: withPaint(options.fill, "#ffffff"), stroke: options.stroke ?? "#111827", strokeWidth: options.strokeWidth ?? 1, opacity: options.opacity })]);
}

export function roundedRect(options: RoundedRectOptions): PresetFragment {
  return fragment([path(options.id ?? "roundedRect", roundedRectPath(options.x, options.y, options.width, options.height, options.radius ?? 8), { fill: withPaint(options.fill, "#ffffff"), stroke: options.stroke ?? "#111827", strokeWidth: options.strokeWidth ?? 1, opacity: options.opacity })]);
}

export function ellipse(options: EllipseOptions): PresetFragment {
  return fragment([path(options.id ?? "ellipse", ellipsePath(options.cx, options.cy, options.rx, options.ry), { fill: withPaint(options.fill, "#ffffff"), stroke: options.stroke ?? "#111827", strokeWidth: options.strokeWidth ?? 1, opacity: options.opacity })]);
}

export function circle(options: CircleOptions): PresetFragment {
  return ellipse({ ...options, rx: options.radius, ry: options.radius, id: options.id ?? "circle" });
}

export function line(options: LineOptions): PresetFragment {
  return fragment([path(options.id ?? "line", linePath(options.from, options.to), { fill: "none", stroke: options.stroke ?? "#111827", strokeWidth: options.strokeWidth ?? 2, strokeCap: options.strokeCap ?? "round", opacity: options.opacity })]);
}

export function polyline(options: PolylineOptions): PresetFragment {
  return fragment([path(options.id ?? "polyline", polygonPath(options.points, !!options.closed), { fill: options.closed ? withPaint(options.fill, "none") : "none", stroke: options.stroke ?? "#111827", strokeWidth: options.strokeWidth ?? 2, strokeCap: options.strokeCap ?? "round", strokeJoin: options.strokeJoin ?? "round", opacity: options.opacity })]);
}

export function arrow(options: ArrowOptions): PresetFragment {
  const id = options.id ?? "arrow";
  const headLength = options.headLength ?? 16;
  const headWidth = options.headWidth ?? 12;
  const angle = Math.atan2(options.to[1] - options.from[1], options.to[0] - options.from[0]);
  const back: Point2 = [options.to[0] - Math.cos(angle) * headLength, options.to[1] - Math.sin(angle) * headLength];
  const normal = angle + Math.PI / 2;
  const left: Point2 = [back[0] + Math.cos(normal) * headWidth * 0.5, back[1] + Math.sin(normal) * headWidth * 0.5];
  const right: Point2 = [back[0] - Math.cos(normal) * headWidth * 0.5, back[1] - Math.sin(normal) * headWidth * 0.5];
  return fragment([
    {
      id,
      type: "group",
      x: 0,
      y: 0,
      children: [
        path(`${id}.shaft`, linePath(options.from, back), { fill: "none", stroke: options.stroke ?? "#111827", strokeWidth: options.strokeWidth ?? 2, strokeCap: "round" }),
        path(`${id}.head`, polygonPath([options.to, left, right]), { fill: withPaint(options.fill, options.stroke ?? "#111827"), stroke: options.stroke ?? "#111827", strokeWidth: 1 })
      ]
    }
  ]);
}

export function regularPolygon(options: RegularPolygonOptions): PresetFragment {
  return fragment([path(options.id ?? "polygon", polygonPath(regularPoints(options.cx, options.cy, options.radius, options.sides, options.rotation)), { fill: withPaint(options.fill, "#ffffff"), stroke: options.stroke ?? "#111827", strokeWidth: options.strokeWidth ?? 1, opacity: options.opacity })]);
}

export function star(options: StarOptions): PresetFragment {
  const outer = options.outerRadius;
  return fragment([path(options.id ?? "star", polygonPath(starPoints(options.cx, options.cy, outer, options.innerRadius ?? outer * 0.45, options.points ?? 5, options.rotation)), { fill: withPaint(options.fill, "#facc15"), stroke: options.stroke ?? "#111827", strokeWidth: options.strokeWidth ?? 1, opacity: options.opacity })]);
}

export function speechBubble(options: SpeechBubbleOptions): PresetFragment {
  const id = options.id ?? "speechBubble";
  const tail = options.tail ?? [options.x + options.width * 0.25, options.y + options.height + 24];
  const tailBaseLeft: Point2 = [options.x + options.width * 0.25, options.y + options.height - 2];
  const tailBaseRight: Point2 = [options.x + options.width * 0.38, options.y + options.height - 2];
  const bubble = roundedRectPath(options.x, options.y, options.width, options.height, options.radius ?? 14);
  const tailPath = polygonPath([tailBaseLeft, tail, tailBaseRight]);
  const children: VisualElement[] = [
    path(`${id}.bubble`, bubble, { fill: withPaint(options.fill, "#ffffff"), stroke: options.stroke ?? "#111827", strokeWidth: options.strokeWidth ?? 2 }),
    path(`${id}.tail`, tailPath, { fill: withPaint(options.fill, "#ffffff"), stroke: options.stroke ?? "#111827", strokeWidth: options.strokeWidth ?? 2 })
  ];
  if (options.text) {
    children.push({
      id: `${id}.text`,
      type: "text",
      text: options.text,
      x: options.x + options.width / 2,
      y: options.y + options.height / 2,
      align: "center",
      valign: "middle",
      fontSize: options.fontSize ?? 18,
      fill: options.textFill ?? "#111827"
    });
  }
  return fragment([{ id, type: "group", x: 0, y: 0, width: options.width, height: options.height, children }]);
}

function path(id: string, d: string, options: StylePresetOptions & { strokeCap?: "butt" | "round" | "square"; strokeJoin?: "miter" | "round" | "bevel" } = {}): VisualElement {
  return {
    id,
    type: "path",
    d,
    ...pathStyle(options),
    ...(options.strokeCap ? { strokeCap: options.strokeCap } : {}),
    ...(options.strokeJoin ? { strokeJoin: options.strokeJoin } : {})
  };
}
