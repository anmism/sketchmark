import type { Point2 } from "./types";

export function pointOnPath(d: string, progress: number): Point2 | undefined {
  const points = samplePath(d);
  if (points.length === 0) return undefined;
  if (points.length === 1) return points[0];
  const clamped = clamp(progress, 0, 1);
  const lengths: number[] = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = distance(points[index - 1]!, points[index]!);
    lengths.push(length);
    total += length;
  }
  if (total <= 0) return points[0];
  const target = clamped * total;
  let cursor = 0;
  for (let index = 1; index < points.length; index += 1) {
    const segment = lengths[index - 1]!;
    if (cursor + segment >= target) {
      const local = segment <= 0 ? 0 : (target - cursor) / segment;
      return lerpPoint(points[index - 1]!, points[index]!, local);
    }
    cursor += segment;
  }
  return points[points.length - 1];
}

export function samplePath(d: string): Point2[] {
  const tokens = tokenizePath(d);
  const points: Point2[] = [];
  let index = 0;
  let command = "";
  let current: Point2 = [0, 0];
  let subpathStart: Point2 = [0, 0];
  let lastCubicControl: Point2 | undefined;
  let lastQuadraticControl: Point2 | undefined;

  while (index < tokens.length) {
    const token = tokens[index];
    if (typeof token === "string") {
      command = token;
      index += 1;
    }
    if (!command) break;
    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    const nextPoint = (): Point2 | undefined => {
      const x = readNumber(tokens, index);
      const y = readNumber(tokens, index + 1);
      if (x === undefined || y === undefined) return undefined;
      index += 2;
      return relative ? [current[0] + x, current[1] + y] : [x, y];
    };

    if (upper === "M") {
      const point = nextPoint();
      if (!point) break;
      current = point;
      subpathStart = point;
      points.push(current);
      command = relative ? "l" : "L";
      lastCubicControl = undefined;
      lastQuadraticControl = undefined;
      continue;
    }
    if (upper === "L") {
      const point = nextPoint();
      if (!point) break;
      current = point;
      points.push(current);
      lastCubicControl = undefined;
      lastQuadraticControl = undefined;
      continue;
    }
    if (upper === "H") {
      const value = readNumber(tokens, index);
      if (value === undefined) break;
      index += 1;
      current = [relative ? current[0] + value : value, current[1]];
      points.push(current);
      lastCubicControl = undefined;
      lastQuadraticControl = undefined;
      continue;
    }
    if (upper === "V") {
      const value = readNumber(tokens, index);
      if (value === undefined) break;
      index += 1;
      current = [current[0], relative ? current[1] + value : value];
      points.push(current);
      lastCubicControl = undefined;
      lastQuadraticControl = undefined;
      continue;
    }
    if (upper === "C") {
      const start = current;
      const c1 = nextPoint();
      const c2 = nextPoint();
      const end = nextPoint();
      if (!c1 || !c2 || !end) break;
      for (let step = 1; step <= 24; step += 1) points.push(cubicPoint(start, c1, c2, end, step / 24));
      current = end;
      lastCubicControl = c2;
      lastQuadraticControl = undefined;
      continue;
    }
    if (upper === "S") {
      const start = current;
      const reflected: Point2 = lastCubicControl ? [current[0] * 2 - lastCubicControl[0], current[1] * 2 - lastCubicControl[1]] : current;
      const c2 = nextPoint();
      const end = nextPoint();
      if (!c2 || !end) break;
      for (let step = 1; step <= 24; step += 1) points.push(cubicPoint(start, reflected, c2, end, step / 24));
      current = end;
      lastCubicControl = c2;
      lastQuadraticControl = undefined;
      continue;
    }
    if (upper === "Q") {
      const start = current;
      const c = nextPoint();
      const end = nextPoint();
      if (!c || !end) break;
      for (let step = 1; step <= 20; step += 1) points.push(quadraticPoint(start, c, end, step / 20));
      current = end;
      lastCubicControl = undefined;
      lastQuadraticControl = c;
      continue;
    }
    if (upper === "T") {
      const start = current;
      const reflected: Point2 = lastQuadraticControl ? [current[0] * 2 - lastQuadraticControl[0], current[1] * 2 - lastQuadraticControl[1]] : current;
      const end = nextPoint();
      if (!end) break;
      for (let step = 1; step <= 20; step += 1) points.push(quadraticPoint(start, reflected, end, step / 20));
      current = end;
      lastCubicControl = undefined;
      lastQuadraticControl = reflected;
      continue;
    }
    if (upper === "A") {
      const rx = readNumber(tokens, index);
      const ry = readNumber(tokens, index + 1);
      const rotation = readNumber(tokens, index + 2);
      const largeArcFlag = readNumber(tokens, index + 3);
      const sweepFlag = readNumber(tokens, index + 4);
      const rawEndX = readNumber(tokens, index + 5);
      const rawEndY = readNumber(tokens, index + 6);
      if (rx === undefined || ry === undefined || rotation === undefined || largeArcFlag === undefined || sweepFlag === undefined || rawEndX === undefined || rawEndY === undefined) break;
      index += 7;
      const end: Point2 = relative ? [current[0] + rawEndX, current[1] + rawEndY] : [rawEndX, rawEndY];
      const arcPoints = sampleSvgArc(current, Math.abs(rx), Math.abs(ry), rotation, Boolean(largeArcFlag), Boolean(sweepFlag), end);
      points.push(...arcPoints);
      current = end;
      lastCubicControl = undefined;
      lastQuadraticControl = undefined;
      continue;
    }
    if (upper === "Z") {
      current = subpathStart;
      points.push(current);
      lastCubicControl = undefined;
      lastQuadraticControl = undefined;
      continue;
    }
    break;
  }
  return points;
}

function sampleSvgArc(start: Point2, rxInput: number, ryInput: number, rotation: number, largeArc: boolean, sweep: boolean, end: Point2): Point2[] {
  if (rxInput === 0 || ryInput === 0) return [end];
  if (nearPoint(start, end)) return [end];
  let rx = rxInput;
  let ry = ryInput;
  const phi = (rotation * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx2 = (start[0] - end[0]) / 2;
  const dy2 = (start[1] - end[1]) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  const radiusScale = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (radiusScale > 1) {
    const factor = Math.sqrt(radiusScale);
    rx *= factor;
    ry *= factor;
  }

  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const x1p2 = x1p * x1p;
  const y1p2 = y1p * y1p;
  const sign = largeArc === sweep ? -1 : 1;
  const numerator = Math.max(0, rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2);
  const denominator = Math.max(0.000001, rx2 * y1p2 + ry2 * x1p2);
  const coef = sign * Math.sqrt(numerator / denominator);
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (coef * -ry * x1p) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (start[0] + end[0]) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (start[1] + end[1]) / 2;

  const vectorAngle = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy;
    const length = Math.max(0.000001, Math.hypot(ux, uy) * Math.hypot(vx, vy));
    const signValue = ux * vy - uy * vx < 0 ? -1 : 1;
    return signValue * Math.acos(clamp(dot / length, -1, 1));
  };

  const theta1 = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = vectorAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  if (sweep && delta < 0) delta += Math.PI * 2;

  const steps = Math.max(8, Math.ceil(Math.abs(delta) / (Math.PI / 12)));
  const out: Point2[] = [];
  for (let step = 1; step <= steps; step += 1) {
    const theta = theta1 + delta * (step / steps);
    const x = cosPhi * rx * Math.cos(theta) - sinPhi * ry * Math.sin(theta) + cx;
    const y = sinPhi * rx * Math.cos(theta) + cosPhi * ry * Math.sin(theta) + cy;
    out.push([x, y]);
  }
  return out;
}

function tokenizePath(d: string): Array<string | number> {
  const matches = d.match(/[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g) ?? [];
  return matches.map((token) => (/^[A-Za-z]$/.test(token) ? token : Number(token)));
}

function readNumber(tokens: Array<string | number>, index: number): number | undefined {
  const value = tokens[index];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function distance(a: Point2, b: Point2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function lerpPoint(a: Point2, b: Point2, t: number): Point2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function cubicPoint(a: Point2, b: Point2, c: Point2, d: Point2, t: number): Point2 {
  const mt = 1 - t;
  return [
    mt * mt * mt * a[0] + 3 * mt * mt * t * b[0] + 3 * mt * t * t * c[0] + t * t * t * d[0],
    mt * mt * mt * a[1] + 3 * mt * mt * t * b[1] + 3 * mt * t * t * c[1] + t * t * t * d[1]
  ];
}

function quadraticPoint(a: Point2, b: Point2, c: Point2, t: number): Point2 {
  const mt = 1 - t;
  return [
    mt * mt * a[0] + 2 * mt * t * b[0] + t * t * c[0],
    mt * mt * a[1] + 2 * mt * t * b[1] + t * t * c[1]
  ];
}

function nearPoint(left: Point2, right: Point2): boolean {
  return Math.abs(left[0] - right[0]) < 0.000001 && Math.abs(left[1] - right[1]) < 0.000001;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
