import type { AnimationValue, Endpoint, KernelElement, Point2, ResolvedVisualDocument, VisualDocument, VisualElement } from "./types";
import { pointOnPath } from "./path-sampling";
import { getInternalShapeDefinition, lowerAuthoringElement } from "./shapes";
import { anchorPoint, clone, elementBox, flattenElements, isPoint2, parseReference, easing } from "./utils";
import { validateVisualDocument } from "./validate";

export interface NormalizeOptions {
  validate?: boolean;
}

export function normalizeVisualDocument(document: VisualDocument, options: NormalizeOptions = {}): ResolvedVisualDocument {
  if (options.validate !== false) {
    const result = validateVisualDocument(document);
    if (!result.ok) {
      const first = result.issues[0];
      throw new Error(first ? `${first.path}: ${first.message}` : "Invalid visual document.");
    }
  }

  const cloned = clone(document);
  const elements = cloned.elements ?? [];
  const resolvedElements = resolveEndpointReferences(elements);
  return { ...cloned, elements: resolvedElements };
}

export function resolveVisualFrame(document: VisualDocument, time = 0): ResolvedVisualDocument {
  const normalized = normalizeVisualDocument(document);
  const source = clone(document.elements ?? normalized.elements);
  const animated = source.map((element) => resolveElementAnimation(element, time));
  const endpoints = resolveEndpointReferences(animated);
  const followed = endpoints.map((element) => resolveElementFollowers(element, endpoints, time));
  return { ...normalized, elements: followed };
}

function resolveEndpointReferences(elements: VisualElement[]): VisualElement[] {
  const map = new Map<string, VisualElement>();
  for (const element of flattenElements(elements)) {
    if (element.id) map.set(element.id, element);
  }
  return elements.map((element) => resolveElementEndpoints(element, map));
}

function resolveElementEndpoints(element: VisualElement, map: Map<string, VisualElement>): VisualElement {
  const next = clone(element);
  if ((next.type === "line" || next.type === "arrow" || next.type === "curve") && next.from !== undefined && next.to !== undefined) {
    next.from = resolveEndpoint(next.from, map);
    next.to = resolveEndpoint(next.to, map);
  }
  if (next.type === "group" && Array.isArray(next.children)) {
    next.children = next.children.map((child) => resolveElementEndpoints(child, map));
  }
  return next;
}

function resolveEndpoint(endpoint: Endpoint, map: Map<string, VisualElement>): Point2 {
  if (isPoint2(endpoint)) return [endpoint[0], endpoint[1]];
  const { id, anchor } = parseReference(String(endpoint));
  const target = map.get(id);
  const box = target ? elementBox(target) : undefined;
  if (!box) return [0, 0];
  return anchorPoint(box, anchor);
}

function resolveElementAnimation(element: VisualElement, time: number): VisualElement {
  const next = clone(element);
  if (next.animate) {
    for (const [property, animation] of Object.entries(next.animate)) {
      const record = next as unknown as Record<string, unknown>;
      record[property] = resolveAnimation(animation, time, record[property] as number | string | undefined);
    }
    delete next.animate;
  }
  if (next.type === "group" && Array.isArray(next.children)) {
    next.children = next.children.map((child) => resolveElementAnimation(child, time));
  }
  return next;
}

function resolveElementFollowers(element: VisualElement, elements: VisualElement[], time: number): VisualElement {
  const next = clone(element);
  if (next.type === "circle" && next.follow) {
    const point = pointOnFollowPath(elements, next.follow, progressValue(next.progress, time));
    if (point) {
      next.cx = point[0];
      next.cy = point[1];
    }
  }
  if (next.type === "group" && Array.isArray(next.children)) {
    next.children = next.children.map((child) => resolveElementFollowers(child, elements, time));
  }
  return next;
}

function progressValue(progress: number | AnimationValue | undefined, time: number): number {
  if (typeof progress === "number") return clamp(progress, 0, 1);
  if (progress && typeof progress === "object") return clamp(Number(resolveAnimation(progress, time, progress.from ?? 0)), 0, 1);
  return 0;
}

function resolveAnimation(animation: AnimationValue, time: number, fallback: number | string | undefined): number | string {
  if (Array.isArray(animation.keyframes) && animation.keyframes.length) {
    const frames = animation.keyframes.slice().sort((left, right) => left[0] - right[0]);
    if (time <= frames[0]![0]) return frames[0]![1];
    for (let index = 1; index < frames.length; index += 1) {
      const prev = frames[index - 1]!;
      const next = frames[index]!;
      if (time <= next[0]) {
        const span = Math.max(0.000001, next[0] - prev[0]);
        const t = (time - prev[0]) / span;
        return interpolateValue(prev[1], next[1], t);
      }
    }
    return frames[frames.length - 1]![1];
  }
  const from = animation.from ?? fallback;
  const to = animation.to ?? from;
  const delay = animation.delay ?? 0;
  const duration = Math.max(0.000001, animation.duration ?? 0);
  const t = easing(animation.ease, (time - delay) / duration);
  return interpolateValue(from ?? 0, to ?? from ?? 0, t);
}

function pointOnFollowPath(elements: VisualElement[], id: string, progress: number): Point2 | undefined {
  const target = flattenElements(elements).find((element) => element.id === id);
  if (!target) return undefined;
  const definition = getInternalShapeDefinition(target.type);
  if (!definition?.followable) return undefined;
  const lowered = lowerFollowTarget(target);
  const path = firstKernelPath(lowered);
  return path ? pointOnPath(path.d, progress) : undefined;
}

function lowerFollowTarget(target: VisualElement): KernelElement[] {
  const lowerElements = (items: VisualElement[]): KernelElement[] => items.flatMap((item) => lowerAuthoringElement(item, { lowerElements }));
  return lowerElements([target]);
}

function firstKernelPath(elements: KernelElement[]): Extract<KernelElement, { type: "path" }> | undefined {
  for (const element of elements) {
    if (element.type === "path") return element;
    if ((element.type === "group" || element.type === "group3d") && Array.isArray(element.children)) {
      const nested = firstKernelPath(element.children);
      if (nested) return nested;
    }
  }
  return undefined;
}

function interpolateValue(from: number | string, to: number | string, t: number): number | string {
  const eased = clamp(t, 0, 1);
  if (typeof from === "number" && typeof to === "number") return from + (to - from) * eased;
  if (typeof from === "string" && typeof to === "string") {
    const fromColor = parseHexColor(from);
    const toColor = parseHexColor(to);
    if (fromColor && toColor) return formatHexColor({
      r: Math.round(fromColor.r + (toColor.r - fromColor.r) * eased),
      g: Math.round(fromColor.g + (toColor.g - fromColor.g) * eased),
      b: Math.round(fromColor.b + (toColor.b - fromColor.b) * eased),
      a: fromColor.a + (toColor.a - fromColor.a) * eased
    });
  }
  return eased < 1 ? from : to;
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseHexColor(value: string): Rgba | undefined {
  const input = value.trim();
  const short = /^#([0-9a-f]{3}|[0-9a-f]{4})$/i.exec(input);
  if (short) {
    const chars = short[1]!;
    return {
      r: parseInt(chars[0]! + chars[0]!, 16),
      g: parseInt(chars[1]! + chars[1]!, 16),
      b: parseInt(chars[2]! + chars[2]!, 16),
      a: chars.length === 4 ? parseInt(chars[3]! + chars[3]!, 16) / 255 : 1
    };
  }
  const long = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(input);
  if (!long) return undefined;
  const hex = long[1]!;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
  };
}

function formatHexColor(color: Rgba): string {
  const hex = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  const alpha = clamp(Math.round(color.a * 255), 0, 255);
  return alpha >= 255 ? `#${hex(color.r)}${hex(color.g)}${hex(color.b)}` : `#${hex(color.r)}${hex(color.g)}${hex(color.b)}${hex(alpha)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
