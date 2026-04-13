import type { SceneNode } from "../../scene";

type RawSegment = {
  command: string;
  values: number[];
};

type AbsoluteSegment =
  | { command: "M"; values: [number, number] }
  | { command: "L"; values: [number, number] }
  | { command: "C"; values: [number, number, number, number, number, number] }
  | { command: "Q"; values: [number, number, number, number] }
  | { command: "A"; values: [number, number, number, number, number, number, number] }
  | { command: "Z"; values: [] };

type Point = { x: number; y: number };

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const COMMAND_RE = /^[AaCcHhLlMmQqSsTtVvZz]$/;
const TOKEN_RE = /[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g;
const EPSILON = 1e-6;

const PARAM_COUNTS: Record<string, number> = {
  A: 7,
  C: 6,
  H: 1,
  L: 2,
  M: 2,
  Q: 4,
  S: 4,
  T: 2,
  V: 1,
  Z: 0,
};

function isCommandToken(token: string): boolean {
  return COMMAND_RE.test(token);
}

function formatNumber(value: number): string {
  const rounded = Math.abs(value) < EPSILON ? 0 : Number(value.toFixed(3));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function parseRawSegments(pathData: string): RawSegment[] {
  const tokens = pathData.match(TOKEN_RE) ?? [];
  if (!tokens.length) return [];

  const segments: RawSegment[] = [];
  let index = 0;
  let currentCommand: string | null = null;

  while (index < tokens.length) {
    const token = tokens[index]!;
    if (isCommandToken(token)) {
      currentCommand = token;
      index += 1;
      if (token === "Z" || token === "z") {
        segments.push({ command: "Z", values: [] });
      }
      continue;
    }

    if (!currentCommand) break;

    const upper = currentCommand.toUpperCase();
    const paramCount = PARAM_COUNTS[upper];
    if (!paramCount) {
      index += 1;
      continue;
    }

    let isFirstMove = upper === "M";
    while (index < tokens.length && !isCommandToken(tokens[index]!)) {
      if (index + paramCount > tokens.length) return segments;
      const values = tokens
        .slice(index, index + paramCount)
        .map((value) => Number(value));

      if (values.some((value) => Number.isNaN(value))) {
        return segments;
      }

      if (upper === "M") {
        const moveCommand = isFirstMove
          ? currentCommand
          : currentCommand === "m"
            ? "l"
            : "L";
        segments.push({ command: moveCommand, values });
        isFirstMove = false;
      } else {
        segments.push({ command: currentCommand, values });
      }

      index += paramCount;
    }
  }

  return segments;
}

function reflect(control: Point, around: Point): Point {
  return {
    x: around.x * 2 - control.x,
    y: around.y * 2 - control.y,
  };
}

function toAbsoluteSegments(rawSegments: RawSegment[]): AbsoluteSegment[] {
  const segments: AbsoluteSegment[] = [];
  let current: Point = { x: 0, y: 0 };
  let subpathStart: Point = { x: 0, y: 0 };
  let previousCubicControl: Point | null = null;
  let previousQuadraticControl: Point | null = null;

  for (const segment of rawSegments) {
    const isRelative = segment.command === segment.command.toLowerCase();
    const command = segment.command.toUpperCase();
    const values = segment.values;

    switch (command) {
      case "M": {
        const x = isRelative ? current.x + values[0]! : values[0]!;
        const y = isRelative ? current.y + values[1]! : values[1]!;
        current = { x, y };
        subpathStart = { x, y };
        previousCubicControl = null;
        previousQuadraticControl = null;
        segments.push({ command: "M", values: [x, y] });
        break;
      }
      case "L": {
        const x = isRelative ? current.x + values[0]! : values[0]!;
        const y = isRelative ? current.y + values[1]! : values[1]!;
        current = { x, y };
        previousCubicControl = null;
        previousQuadraticControl = null;
        segments.push({ command: "L", values: [x, y] });
        break;
      }
      case "H": {
        const x = isRelative ? current.x + values[0]! : values[0]!;
        current = { x, y: current.y };
        previousCubicControl = null;
        previousQuadraticControl = null;
        segments.push({ command: "L", values: [x, current.y] });
        break;
      }
      case "V": {
        const y = isRelative ? current.y + values[0]! : values[0]!;
        current = { x: current.x, y };
        previousCubicControl = null;
        previousQuadraticControl = null;
        segments.push({ command: "L", values: [current.x, y] });
        break;
      }
      case "C": {
        const x1 = isRelative ? current.x + values[0]! : values[0]!;
        const y1 = isRelative ? current.y + values[1]! : values[1]!;
        const x2 = isRelative ? current.x + values[2]! : values[2]!;
        const y2 = isRelative ? current.y + values[3]! : values[3]!;
        const x = isRelative ? current.x + values[4]! : values[4]!;
        const y = isRelative ? current.y + values[5]! : values[5]!;
        current = { x, y };
        previousCubicControl = { x: x2, y: y2 };
        previousQuadraticControl = null;
        segments.push({ command: "C", values: [x1, y1, x2, y2, x, y] });
        break;
      }
      case "S": {
        const control1 = previousCubicControl
          ? reflect(previousCubicControl, current)
          : { ...current };
        const x2 = isRelative ? current.x + values[0]! : values[0]!;
        const y2 = isRelative ? current.y + values[1]! : values[1]!;
        const x = isRelative ? current.x + values[2]! : values[2]!;
        const y = isRelative ? current.y + values[3]! : values[3]!;
        current = { x, y };
        previousCubicControl = { x: x2, y: y2 };
        previousQuadraticControl = null;
        segments.push({
          command: "C",
          values: [control1.x, control1.y, x2, y2, x, y],
        });
        break;
      }
      case "Q": {
        const x1 = isRelative ? current.x + values[0]! : values[0]!;
        const y1 = isRelative ? current.y + values[1]! : values[1]!;
        const x = isRelative ? current.x + values[2]! : values[2]!;
        const y = isRelative ? current.y + values[3]! : values[3]!;
        current = { x, y };
        previousCubicControl = null;
        previousQuadraticControl = { x: x1, y: y1 };
        segments.push({ command: "Q", values: [x1, y1, x, y] });
        break;
      }
      case "T": {
        const control: Point = previousQuadraticControl
          ? reflect(previousQuadraticControl, current)
          : { ...current };
        const x = isRelative ? current.x + values[0]! : values[0]!;
        const y = isRelative ? current.y + values[1]! : values[1]!;
        current = { x, y };
        previousCubicControl = null;
        previousQuadraticControl = control;
        segments.push({ command: "Q", values: [control.x, control.y, x, y] });
        break;
      }
      case "A": {
        const rx = Math.abs(values[0]!);
        const ry = Math.abs(values[1]!);
        const rotation = values[2]!;
        const largeArc = values[3]!;
        const sweep = values[4]!;
        const x = isRelative ? current.x + values[5]! : values[5]!;
        const y = isRelative ? current.y + values[6]! : values[6]!;
        current = { x, y };
        previousCubicControl = null;
        previousQuadraticControl = null;
        segments.push({
          command: "A",
          values: [rx, ry, rotation, largeArc, sweep, x, y],
        });
        break;
      }
      case "Z": {
        current = { ...subpathStart };
        previousCubicControl = null;
        previousQuadraticControl = null;
        segments.push({ command: "Z", values: [] });
        break;
      }
    }
  }

  return segments;
}

function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return (
    mt * mt * mt * p0 +
    3 * mt * mt * t * p1 +
    3 * mt * t * t * p2 +
    t * t * t * p3
  );
}

function quadraticAt(p0: number, p1: number, p2: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 3 * p0 - 6 * p1 + 3 * p2;
  const c = -3 * p0 + 3 * p1;

  if (Math.abs(a) < EPSILON) {
    if (Math.abs(b) < EPSILON) return [];
    return [-c / (2 * b)].filter((t) => t > 0 && t < 1);
  }

  const discriminant = 4 * b * b - 12 * a * c;
  if (discriminant < 0) return [];

  const sqrtDiscriminant = Math.sqrt(discriminant);
  return [
    (-2 * b + sqrtDiscriminant) / (6 * a),
    (-2 * b - sqrtDiscriminant) / (6 * a),
  ].filter((t) => t > 0 && t < 1);
}

function quadraticExtrema(p0: number, p1: number, p2: number): number[] {
  const denominator = p0 - 2 * p1 + p2;
  if (Math.abs(denominator) < EPSILON) return [];
  const t = (p0 - p1) / denominator;
  return t > 0 && t < 1 ? [t] : [];
}

function angleBetween(u: Point, v: Point): number {
  const magnitude = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
  if (magnitude < EPSILON) return 0;

  const sign = u.x * v.y - u.y * v.x < 0 ? -1 : 1;
  const cosine = Math.min(1, Math.max(-1, (u.x * v.x + u.y * v.y) / magnitude));
  return sign * Math.acos(cosine);
}

function sampleArc(
  start: Point,
  values: [number, number, number, number, number, number, number],
): Point[] {
  let [rx, ry, rotation, largeArcFlag, sweepFlag, endX, endY] = values;
  if ((Math.abs(start.x - endX) < EPSILON && Math.abs(start.y - endY) < EPSILON) || rx < EPSILON || ry < EPSILON) {
    return [start, { x: endX, y: endY }];
  }

  rx = Math.abs(rx);
  ry = Math.abs(ry);

  const phi = (rotation * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx2 = (start.x - endX) / 2;
  const dy2 = (start.y - endY) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rx *= scale;
    ry *= scale;
  }

  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const x1p2 = x1p * x1p;
  const y1p2 = y1p * y1p;
  const numerator = rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2;
  const denominator = rx2 * y1p2 + ry2 * x1p2;
  const factor = denominator < EPSILON ? 0 : Math.sqrt(Math.max(0, numerator / denominator));
  const sign = largeArcFlag === sweepFlag ? -1 : 1;
  const cxp = sign * factor * ((rx * y1p) / ry);
  const cyp = sign * factor * (-(ry * x1p) / rx);

  const cx = cosPhi * cxp - sinPhi * cyp + (start.x + endX) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (start.y + endY) / 2;

  const startVector = {
    x: (x1p - cxp) / rx,
    y: (y1p - cyp) / ry,
  };
  const endVector = {
    x: (-x1p - cxp) / rx,
    y: (-y1p - cyp) / ry,
  };

  let deltaTheta = angleBetween(startVector, endVector);
  if (!sweepFlag && deltaTheta > 0) deltaTheta -= Math.PI * 2;
  if (sweepFlag && deltaTheta < 0) deltaTheta += Math.PI * 2;

  const theta1 = angleBetween({ x: 1, y: 0 }, startVector);
  const steps = Math.max(12, Math.ceil(Math.abs(deltaTheta) / (Math.PI / 8)));
  const points: Point[] = [];

  for (let index = 0; index <= steps; index += 1) {
    const theta = theta1 + (deltaTheta * index) / steps;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    points.push({
      x: cx + rx * cosPhi * cosTheta - ry * sinPhi * sinTheta,
      y: cy + rx * sinPhi * cosTheta + ry * cosPhi * sinTheta,
    });
  }

  return points;
}

function boundsFromAbsoluteSegments(segments: AbsoluteSegment[]): Bounds | null {
  if (!segments.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const include = (point: Point): void => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  };

  let current: Point = { x: 0, y: 0 };
  let subpathStart: Point = { x: 0, y: 0 };

  for (const segment of segments) {
    switch (segment.command) {
      case "M": {
        current = { x: segment.values[0], y: segment.values[1] };
        subpathStart = { ...current };
        include(current);
        break;
      }
      case "L": {
        include(current);
        current = { x: segment.values[0], y: segment.values[1] };
        include(current);
        break;
      }
      case "C": {
        const [x1, y1, x2, y2, x, y] = segment.values;
        const ts = new Set<number>([0, 1]);
        cubicExtrema(current.x, x1, x2, x).forEach((value) => ts.add(value));
        cubicExtrema(current.y, y1, y2, y).forEach((value) => ts.add(value));
        for (const t of ts) {
          include({
            x: cubicAt(current.x, x1, x2, x, t),
            y: cubicAt(current.y, y1, y2, y, t),
          });
        }
        current = { x, y };
        break;
      }
      case "Q": {
        const [x1, y1, x, y] = segment.values;
        const ts = new Set<number>([0, 1]);
        quadraticExtrema(current.x, x1, x).forEach((value) => ts.add(value));
        quadraticExtrema(current.y, y1, y).forEach((value) => ts.add(value));
        for (const t of ts) {
          include({
            x: quadraticAt(current.x, x1, x, t),
            y: quadraticAt(current.y, y1, y, t),
          });
        }
        current = { x, y };
        break;
      }
      case "A": {
        for (const point of sampleArc(current, segment.values)) {
          include(point);
        }
        current = { x: segment.values[5], y: segment.values[6] };
        break;
      }
      case "Z": {
        include(current);
        include(subpathStart);
        current = { ...subpathStart };
        break;
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function transformX(x: number, bounds: Bounds, scaleX: number): number {
  return (x - bounds.minX) * scaleX;
}

function transformY(y: number, bounds: Bounds, scaleY: number): number {
  return (y - bounds.minY) * scaleY;
}

function buildScaledPathData(
  segments: AbsoluteSegment[],
  bounds: Bounds,
  width: number,
  height: number,
): string {
  const sourceWidth = Math.max(bounds.maxX - bounds.minX, EPSILON);
  const sourceHeight = Math.max(bounds.maxY - bounds.minY, EPSILON);
  const scaleX = width / sourceWidth;
  const scaleY = height / sourceHeight;

  return segments
    .map((segment) => {
      switch (segment.command) {
        case "M":
        case "L":
          return [
            segment.command,
            formatNumber(transformX(segment.values[0], bounds, scaleX)),
            formatNumber(transformY(segment.values[1], bounds, scaleY)),
          ].join(" ");
        case "C":
          return [
            "C",
            formatNumber(transformX(segment.values[0], bounds, scaleX)),
            formatNumber(transformY(segment.values[1], bounds, scaleY)),
            formatNumber(transformX(segment.values[2], bounds, scaleX)),
            formatNumber(transformY(segment.values[3], bounds, scaleY)),
            formatNumber(transformX(segment.values[4], bounds, scaleX)),
            formatNumber(transformY(segment.values[5], bounds, scaleY)),
          ].join(" ");
        case "Q":
          return [
            "Q",
            formatNumber(transformX(segment.values[0], bounds, scaleX)),
            formatNumber(transformY(segment.values[1], bounds, scaleY)),
            formatNumber(transformX(segment.values[2], bounds, scaleX)),
            formatNumber(transformY(segment.values[3], bounds, scaleY)),
          ].join(" ");
        case "A":
          return [
            "A",
            formatNumber(segment.values[0] * scaleX),
            formatNumber(segment.values[1] * scaleY),
            formatNumber(segment.values[2]),
            formatNumber(segment.values[3]),
            formatNumber(segment.values[4]),
            formatNumber(transformX(segment.values[5], bounds, scaleX)),
            formatNumber(transformY(segment.values[6], bounds, scaleY)),
          ].join(" ");
        case "Z":
          return "Z";
      }
    })
    .join(" ");
}

function intrinsicSizeFromBounds(bounds: Bounds | null): { width: number; height: number } {
  if (!bounds) return { width: 100, height: 100 };

  return {
    width: Math.max(1, Math.ceil(bounds.maxX - bounds.minX)),
    height: Math.max(1, Math.ceil(bounds.maxY - bounds.minY)),
  };
}

function parsePathGeometry(pathData: string): { segments: AbsoluteSegment[]; bounds: Bounds | null } {
  const segments = toAbsoluteSegments(parseRawSegments(pathData));
  return {
    segments,
    bounds: boundsFromAbsoluteSegments(segments),
  };
}

export function getPathIntrinsicSize(pathData?: string): { width: number; height: number } {
  if (!pathData) return { width: 100, height: 100 };
  return intrinsicSizeFromBounds(parsePathGeometry(pathData).bounds);
}

export function getRenderablePathData(
  pathData: string | undefined,
  width: number,
  height: number,
): string | null {
  if (!pathData) return null;

  const { segments, bounds } = parsePathGeometry(pathData);
  if (!segments.length || !bounds) return pathData;

  return buildScaledPathData(segments, bounds, Math.max(1, width), Math.max(1, height));
}

export function getRenderableNodePathData(node: Pick<SceneNode, "pathData" | "w" | "h">): string | null {
  return getRenderablePathData(node.pathData, node.w, node.h);
}
