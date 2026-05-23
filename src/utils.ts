import type { AnchorName, Point2, TextElement, VisualElement } from "./types";

export const CORE_TYPES = new Set(["rect", "circle", "ellipse", "point", "line", "arrow", "arc", "curve", "polyline", "polygon", "path", "text", "image", "group"]);
export const THREE_TYPES = new Set(["cuboid", "sphere", "plane", "line3d", "text3d", "light"]);
export const COMPOUND_TYPES = new Set(["node", "flow", "packet", "callout", "row", "column", "grid"]);
export const ANCHORS = new Set(["center", "left", "right", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"]);

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isPoint2(value: unknown): value is Point2 {
  return Array.isArray(value) && value.length >= 2 && isFiniteNumber(value[0]) && isFiniteNumber(value[1]);
}

export function isPoint2Array(value: unknown, minLength: number): value is Point2[] {
  return Array.isArray(value) && value.length >= minLength && value.every((point) => isPoint2(point));
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function elementBox(element: VisualElement): Box | undefined {
  switch (element.type) {
    case "rect":
    case "image":
    case "group":
      if (isFiniteNumber(element.x) && isFiniteNumber(element.y) && isFiniteNumber(element.width) && isFiniteNumber(element.height)) {
        return { x: element.x, y: element.y, width: element.width, height: element.height };
      }
      return undefined;
    case "text": {
      if (!isFiniteNumber(element.x) || !isFiniteNumber(element.y)) return undefined;
      const fontSize = isFiniteNumber(element.fontSize) ? element.fontSize : 16;
      const lines = textLines(element);
      const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
      const lineHeight = isFiniteNumber(element.lineHeight) ? element.lineHeight : 1.2;
      const width = isFiniteNumber(element.maxWidth) ? element.maxWidth : Math.max(1, longest * fontSize * 0.55);
      const height = Math.max(1, lines.length) * fontSize * lineHeight;
      const x = element.align === "center" ? element.x - width / 2 : element.align === "right" ? element.x - width : element.x;
      const y = element.valign === "middle" ? element.y - height / 2 : element.valign === "bottom" ? element.y - height : element.y;
      return { x, y, width, height };
    }
    case "point":
      if (isFiniteNumber(element.x) && isFiniteNumber(element.y)) {
        return { x: element.x, y: element.y, width: 0, height: 0 };
      }
      return undefined;
    case "circle":
      if (isFiniteNumber(element.cx) && isFiniteNumber(element.cy) && isFiniteNumber(element.radius)) {
        return { x: element.cx - element.radius, y: element.cy - element.radius, width: element.radius * 2, height: element.radius * 2 };
      }
      return undefined;
    case "ellipse":
      if (isFiniteNumber(element.cx) && isFiniteNumber(element.cy) && isFiniteNumber(element.rx) && isFiniteNumber(element.ry)) {
        return { x: element.cx - element.rx, y: element.cy - element.ry, width: element.rx * 2, height: element.ry * 2 };
      }
      return undefined;
    case "arc":
      if (isFiniteNumber(element.cx) && isFiniteNumber(element.cy) && isFiniteNumber(element.radius)) {
        return { x: element.cx - element.radius, y: element.cy - element.radius, width: element.radius * 2, height: element.radius * 2 };
      }
      return undefined;
    case "curve": {
      const points = [element.from, element.control1, element.control2, element.to].filter(isPoint2);
      return pointsBox(points);
    }
    case "polyline":
    case "polygon":
      return pointsBox(element.points);
    default:
      return undefined;
  }
}

export function pointsBox(points: Point2[] | undefined): Box | undefined {
  if (!Array.isArray(points) || !points.length) return undefined;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (!isPoint2(point)) return undefined;
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function textLines(element: Pick<TextElement, "text" | "lines">): string[] {
  if (Array.isArray(element.lines) && element.lines.length) return element.lines.map((line) => String(line));
  return String(element.text ?? "").split(/\r?\n/);
}

export function anchorPoint(box: Box, anchor: AnchorName): Point2 {
  switch (anchor) {
    case "left":
      return [box.x, box.y + box.height / 2];
    case "right":
      return [box.x + box.width, box.y + box.height / 2];
    case "top":
      return [box.x + box.width / 2, box.y];
    case "bottom":
      return [box.x + box.width / 2, box.y + box.height];
    case "top-left":
      return [box.x, box.y];
    case "top-right":
      return [box.x + box.width, box.y];
    case "bottom-left":
      return [box.x, box.y + box.height];
    case "bottom-right":
      return [box.x + box.width, box.y + box.height];
    case "center":
    default:
      return [box.x + box.width / 2, box.y + box.height / 2];
  }
}

export function parseReference(ref: string): { id: string; anchor: AnchorName } {
  const [id, rawAnchor] = ref.split(".");
  const anchor = (rawAnchor || "center") as AnchorName;
  return { id: id || "", anchor: ANCHORS.has(anchor) ? anchor : "center" };
}

export function flattenElements(elements: VisualElement[]): VisualElement[] {
  const out: VisualElement[] = [];
  for (const element of elements) {
    out.push(element);
    if (element.type === "group" && Array.isArray(element.children)) {
      out.push(...flattenElements(element.children));
    }
  }
  return out;
}

export function easing(name: string | undefined, t: number): number {
  const x = Math.max(0, Math.min(1, t));
  switch (name) {
    case "ease-in":
      return x * x;
    case "ease-out":
      return 1 - (1 - x) * (1 - x);
    case "ease-in-out":
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case "linear":
    default:
      return x;
  }
}
