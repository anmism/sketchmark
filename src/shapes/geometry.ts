import type { Point2, Point3 } from "../types";
import { isPoint2 } from "../utils";

export function roundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (r <= 0) return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
  return [
    `M ${x + r} ${y}`,
    `H ${x + width - r}`,
    `A ${r} ${r} 0 0 1 ${x + width} ${y + r}`,
    `V ${y + height - r}`,
    `A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + height - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    "Z"
  ].join(" ");
}

export function circlePath(cx: number, cy: number, radius: number): string {
  return `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 0 ${cx + radius} ${cy} A ${radius} ${radius} 0 1 0 ${cx - radius} ${cy} Z`;
}

export function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

export function linePath(from: Point2, to: Point2): string {
  return `M ${from[0]} ${from[1]} L ${to[0]} ${to[1]}`;
}

export function curvePath(from: Point2, control1: Point2, control2: Point2 | undefined, to: Point2): string {
  return control2
    ? `M ${from[0]} ${from[1]} C ${control1[0]} ${control1[1]} ${control2[0]} ${control2[1]} ${to[0]} ${to[1]}`
    : `M ${from[0]} ${from[1]} Q ${control1[0]} ${control1[1]} ${to[0]} ${to[1]}`;
}

export function pointsPath(points: Point2[], closed: boolean): string {
  if (!points.length) return "";
  const [first, ...rest] = points;
  return `M ${first![0]} ${first![1]}${rest.map((point) => ` L ${point[0]} ${point[1]}`).join("")}${closed ? " Z" : ""}`;
}

export function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number, counterclockwise: boolean, closed: boolean): string {
  const start = normalizeArcStart(startAngle, endAngle, counterclockwise);
  const end = normalizeArcEnd(start, endAngle, counterclockwise);
  const startPoint = polarPoint(cx, cy, radius, start);
  const endPoint = polarPoint(cx, cy, radius, end);
  const delta = Math.abs(end - start);
  const largeArc = delta % 360 > 180 ? 1 : 0;
  const sweep = counterclockwise ? 0 : 1;
  const arc = `M ${startPoint[0]} ${startPoint[1]} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${endPoint[0]} ${endPoint[1]}`;
  return closed ? `${arc} L ${cx} ${cy} Z` : arc;
}

export function point2(value: unknown): Point2 {
  return isPoint2(value) ? [value[0], value[1]] : [0, 0];
}

export function cuboidGeometry(size: Point3): { vertices: Point3[]; faces: number[][] } {
  const [w, h, d] = size;
  const x = w / 2;
  const y = h / 2;
  const z = d / 2;
  return {
    vertices: [
      [-x, -y, z],
      [x, -y, z],
      [x, y, z],
      [-x, y, z],
      [-x, -y, -z],
      [x, -y, -z],
      [x, y, -z],
      [-x, y, -z]
    ],
    faces: [
      [0, 1, 2, 3],
      [1, 5, 6, 2],
      [5, 4, 7, 6],
      [4, 0, 3, 7],
      [3, 2, 6, 7],
      [4, 5, 1, 0]
    ]
  };
}

export function planeGeometry(size: Point2): { vertices: Point3[]; faces: number[][] } {
  const [w, d] = size;
  const x = w / 2;
  const z = d / 2;
  return {
    vertices: [
      [-x, 0, -z],
      [x, 0, -z],
      [x, 0, z],
      [-x, 0, z]
    ],
    faces: [[0, 1, 2, 3]]
  };
}

export function sphereGeometry(radius: number, segments = 24, rings = 12): { vertices: Point3[]; faces: number[][] } {
  const vertices: Point3[] = [];
  const faces: number[][] = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const phi = (ring / rings) * Math.PI;
    const y = Math.cos(phi) * radius;
    const rr = Math.sin(phi) * radius;
    for (let segment = 0; segment < segments; segment += 1) {
      const theta = (segment / segments) * Math.PI * 2;
      vertices.push([Math.cos(theta) * rr, y, Math.sin(theta) * rr]);
    }
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      faces.push([
        ring * segments + segment,
        ring * segments + next,
        (ring + 1) * segments + next,
        (ring + 1) * segments + segment
      ]);
    }
  }
  return { vertices, faces };
}

export function triangulateFaces(faces: number[][]): number[] {
  return faces.flatMap((face) => triangulateFace(face));
}

function triangulateFace(face: number[]): number[] {
  if (face.length < 3) return [];
  const out: number[] = [];
  for (let index = 1; index < face.length - 1; index += 1) out.push(face[0]!, face[index]!, face[index + 1]!);
  return out;
}

function normalizeArcStart(startAngle: number, endAngle: number, counterclockwise: boolean): number {
  if (!counterclockwise) return startAngle;
  let start = startAngle;
  while (start <= endAngle) start += 360;
  return start;
}

function normalizeArcEnd(startAngle: number, endAngle: number, counterclockwise: boolean): number {
  let end = endAngle;
  if (counterclockwise) {
    while (end >= startAngle) end -= 360;
  } else {
    while (end <= startAngle) end += 360;
  }
  return end;
}

function polarPoint(cx: number, cy: number, radius: number, degrees: number): Point2 {
  const radians = (degrees * Math.PI) / 180;
  return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
}
