import type { ClipShape, KernelMesh3dElement, KernelPathElement, MaskShape, Point3, VisualElement } from "../types";
import { clone } from "../utils";
import { circlePath, roundedRectPath, triangulateFaces } from "./geometry";

const KERNEL_PATH_ANIMATABLE = new Set(["opacity", "fill", "stroke", "strokeWidth", "dashOffset", "drawStart", "drawEnd", "rotation", "scale", "scaleX", "scaleY"]);

export function toPath(element: VisualElement, d: string, overrides: Record<string, unknown> = {}): KernelPathElement {
  const base = common2d(element);
  keepAnimatable(base, KERNEL_PATH_ANIMATABLE);
  return { ...(base as Omit<KernelPathElement, "type" | "d">), ...overrides, type: "path", d };
}

export function common2d(element: VisualElement): Record<string, unknown> {
  return cleanCommon(element, ["type", "children"]);
}

export function common3d(element: VisualElement): Record<string, unknown> {
  return cleanCommon(element, ["type", "children", "position", "size", "radius"]);
}

export function cleanCommon(element: VisualElement, omit: string[]): Record<string, unknown> {
  const record = clone(element) as unknown as Record<string, unknown>;
  for (const key of omit) delete record[key];
  record.clip = lowerClip(record.clip as ClipShape | undefined);
  record.mask = lowerMask(record.mask as MaskShape | undefined);
  return record;
}

function keepAnimatable(record: Record<string, unknown>, allowed: Set<string>): void {
  const animation = record.animate;
  if (!animation || typeof animation !== "object" || Array.isArray(animation)) return;
  const entries = Object.entries(animation as Record<string, unknown>).filter(([property]) => allowed.has(property));
  if (entries.length) {
    record.animate = Object.fromEntries(entries);
  } else {
    delete record.animate;
  }
}

export function lowerClip(clip: ClipShape | undefined): ClipShape | undefined {
  if (!clip) return undefined;
  if (clip.type === "path") return clone(clip);
  if (clip.type === "rect") return { type: "path", d: roundedRectPath(clip.x, clip.y, clip.width, clip.height, Number(clip.radius ?? 0)) };
  return { type: "path", d: circlePath(clip.cx, clip.cy, clip.radius) };
}

export function lowerMask(mask: MaskShape | undefined): MaskShape | undefined {
  if (!mask) return undefined;
  if (mask.type === "path") return clone(mask);
  if (mask.type === "rect") return { type: "path", d: roundedRectPath(mask.x, mask.y, mask.width, mask.height, Number(mask.radius ?? 0)), opacity: mask.opacity };
  return { type: "path", d: circlePath(mask.cx, mask.cy, mask.radius), opacity: mask.opacity };
}

export function cloneOptional<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : clone(value);
}

export function meshElement(source: VisualElement, vertices: Point3[], faces: number[][], position: Point3): KernelMesh3dElement {
  return {
    ...(common3d(source) as Omit<KernelMesh3dElement, "type" | "vertices" | "indices">),
    type: "mesh3d",
    vertices,
    faces,
    indices: triangulateFaces(faces),
    position
  };
}
