import type { KernelElement, KernelMesh3dElement, KernelVisualDocument, Point3, RenderOptions, ResolvedVisualDocument, VisualDocument } from "../types";
import { lowerResolvedVisualDocument, resolveKernelFrame } from "../kernel";

export function renderThreePreviewSvg(document: VisualDocument, time = 0, options: RenderOptions = {}): string {
  const frame = resolveKernelFrame(document, time);
  return renderResolvedThreePreviewSvg(frame, options);
}

export function renderResolvedThreePreviewSvg(document: ResolvedVisualDocument | KernelVisualDocument, options: RenderOptions = {}): string {
  const kernel = isKernelVisualDocument(document) ? document : lowerResolvedVisualDocument(document);
  const width = document.canvas.width;
  const height = document.canvas.height;
  const background = document.canvas.background ?? "#ffffff";
  const elements = [...(kernel.elements ?? [])].sort((a, b) => depthOf(a) - depthOf(b));
  const backdrop = options.transparent ? "" : `<rect x="0" y="0" width="${width}" height="${height}" fill="${escapeAttr(background)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">${backdrop}${elements.map((element) => renderElement(element, width, height)).join("")}</svg>`;
}

function renderElement(element: KernelElement, width: number, height: number): string {
  const opacity = element.opacity === undefined ? "" : ` opacity="${Number(element.opacity)}"`;
  const id = element.id ? ` id="${escapeAttr(element.id)}"` : "";
  const fill = escapeAttr(String(element.fill ?? "#2563eb"));
  const stroke = escapeAttr(String(element.stroke ?? "#111827"));
  const strokeWidth = Number(element.strokeWidth ?? 1);

  if (element.type === "mesh3d") {
    const faces = meshFaces(element, width, height);
    return faces
      .sort((a, b) => a.depth - b.depth)
      .map((face, index) => `<polygon${index === 0 ? `${id}${opacity}` : opacity} points="${face.points.map((point) => point.join(",")).join(" ")}" fill="${shade(fill, face.shade)}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`)
      .join("");
  }
  if (element.type === "line3d" && Array.isArray(element.from) && Array.isArray(element.to)) {
    const from = project(element.from, width, height);
    const to = project(element.to, width, height);
    return `<line${id}${opacity} x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"/>`;
  }
  if (element.type === "text3d") {
    const point = project(element.position, width, height);
    return `<text${id}${opacity} x="${point[0]}" y="${point[1]}" text-anchor="middle" dominant-baseline="middle" font-family="Inter, Arial, sans-serif" font-size="${Number(element.fontSize ?? 18)}" font-weight="700" fill="${fill}">${escapeText(element.text)}</text>`;
  }
  return "";
}

function isKernelVisualDocument(document: ResolvedVisualDocument | KernelVisualDocument): document is KernelVisualDocument {
  return (document.elements ?? []).every((element) => element.type === "group" || element.type === "path" || element.type === "text" || element.type === "image" || element.type === "point" || element.type === "group3d" || element.type === "mesh3d" || element.type === "line3d" || element.type === "text3d" || element.type === "point3d" || element.type === "light");
}

function meshFaces(element: KernelMesh3dElement, width: number, height: number): Array<{ points: Array<[number, number]>; shade: number; depth: number }> {
  const faces = element.faces && element.faces.length ? element.faces : indicesToFaces(element.indices);
  return faces
    .filter((face) => face.length >= 3)
    .map((face, index) => {
      const world = face.map((vertexIndex) => worldVertex(element, vertexIndex));
      const depth = world.reduce((total, point) => total + point[2] - point[1] * 0.1, 0) / world.length;
      return {
        points: world.map((point) => project(point, width, height)),
        shade: 0.74 + (index % 4) * 0.08,
        depth
      };
    });
}

function indicesToFaces(indices: number[]): number[][] {
  const faces: number[][] = [];
  for (let index = 0; index < indices.length; index += 3) faces.push(indices.slice(index, index + 3));
  return faces;
}

function worldVertex(element: KernelMesh3dElement, index: number): Point3 {
  const vertex = element.vertices[index] ?? [0, 0, 0];
  const position = element.position ?? [0, 0, 0];
  return [vertex[0] + position[0], vertex[1] + position[1], vertex[2] + position[2]];
}

function project([x, y, z]: Point3, width: number, height: number): [number, number] {
  const s = scale(width, height);
  return [
    width / 2 + (x - z) * s * 0.9,
    height / 2 - y * s * 0.9 + (x + z) * s * 0.35
  ];
}

function scale(width: number, height: number): number {
  return Math.min(width, height) / 8;
}

function depthOf(element: KernelElement): number {
  if ("position" in element && Array.isArray(element.position)) return element.position[2] - element.position[1] * 0.1;
  return 0;
}

function shade(hex: string, factor: number): string {
  const color = parseHex(hex);
  if (!color) return hex;
  return `#${color.map((channel) => Math.max(0, Math.min(255, Math.round(channel * factor))).toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(value: string): [number, number, number] | undefined {
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return undefined;
  return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
